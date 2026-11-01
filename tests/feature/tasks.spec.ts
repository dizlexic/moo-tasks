import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getNextBoardTaskId, getNextBoardTaskIds, reindexTasks, reorderTasks } from '../../server/utils/tasks'
import { db } from '../../server/db'
import { emitTaskEvent } from '../../server/utils/socket'

vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  }
}))

vi.mock('../../server/utils/socket', () => ({
  emitTaskEvent: vi.fn(),
}))

describe('tasks utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getNextBoardTaskId', () => {
    it('should atomically reserve a range after the highest existing task ID', async () => {
      const selectResults: any[] = [[{ maxId: 7 }], [{ lastTaskId: 10 }]]
      const tx = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue(selectResults.shift()),
        })),
        insert: vi.fn(),
        update: vi.fn(),
      }
      const onDuplicateKeyUpdate = vi.fn().mockResolvedValue(undefined)
      const values = vi.fn().mockReturnValue({ onDuplicateKeyUpdate })
      tx.insert.mockReturnValue({ values })
      const updateWhere = vi.fn().mockResolvedValue([{ affectedRows: 1 }, []])
      const set = vi.fn().mockReturnValue({ where: updateWhere })
      tx.update.mockReturnValue({ set })
      ;(db.transaction as any).mockImplementation((callback: any) => callback(tx))

      const ids = await getNextBoardTaskIds('board-1', 3)

      expect(ids).toEqual([8, 9, 10])
      expect(db.transaction).toHaveBeenCalledOnce()
      expect(values).toHaveBeenCalledWith({ boardId: 'board-1', lastTaskId: 7 })
      expect(onDuplicateKeyUpdate).toHaveBeenCalledOnce()
      expect(set).toHaveBeenCalledOnce()
      expect(updateWhere).toHaveBeenCalledOnce()
    })
  })

  describe('reindexTasks', () => {
    it('should do nothing if tasks are already ordered', async () => {
      const mockTasks = [
        { id: '1', order: 0 },
        { id: '2', order: 1 }
      ]
      const mockSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockTasks)
      }
      ;(db.select as any).mockReturnValue(mockSelectChain)

      await reindexTasks('board-1', 'todo')
      
      expect(db.update).not.toHaveBeenCalled()
      expect(emitTaskEvent).not.toHaveBeenCalled()
    })

    it('should update order and emit events if tasks are out of order', async () => {
      const mockTasks = [
        { id: '1', order: 5 },
        { id: '2', order: 10 }
      ]
      const mockSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockTasks)
      }
      ;(db.select as any).mockReturnValue(mockSelectChain)

      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue({})
      }
      ;(db.update as any).mockReturnValue(mockUpdateChain)

      await reindexTasks('board-1', 'todo')

      expect(db.update).toHaveBeenCalledTimes(2)
      expect(emitTaskEvent).toHaveBeenCalledTimes(2)
      expect(emitTaskEvent).toHaveBeenCalledWith('board-1', 'task:updated', expect.objectContaining({ id: '1', order: 0 }))
      expect(emitTaskEvent).toHaveBeenCalledWith('board-1', 'task:updated', expect.objectContaining({ id: '2', order: 1 }))
    })
  })

  describe('reorderTasks', () => {
    it('should move a task and reindex remaining', async () => {
      const mockTasks = [
        { id: '1', order: 0 },
        { id: '2', order: 1 },
        { id: '3', order: 2 }
      ]
      const mockSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockTasks)
      }
      ;(db.select as any).mockReturnValue(mockSelectChain)

      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue({})
      }
      ;(db.update as any).mockReturnValue(mockUpdateChain)

      // Move task '3' to index 0
      await reorderTasks('board-1', 'todo', '3', 0)

      // Expected order: '3' (0), '1' (1), '2' (2)
      expect(db.update).toHaveBeenCalledTimes(3)
      expect(emitTaskEvent).toHaveBeenCalledWith('board-1', 'task:updated', expect.objectContaining({ id: '3', order: 0 }))
      expect(emitTaskEvent).toHaveBeenCalledWith('board-1', 'task:updated', expect.objectContaining({ id: '1', order: 1 }))
      expect(emitTaskEvent).toHaveBeenCalledWith('board-1', 'task:updated', expect.objectContaining({ id: '2', order: 2 }))
    })

    it('should return early if task to move is not found', async () => {
      const mockSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([])
      }
      ;(db.select as any).mockReturnValue(mockSelectChain)

      await reorderTasks('board-1', 'todo', 'non-existent', 0)
      expect(db.update).not.toHaveBeenCalled()
    })
  })
})
