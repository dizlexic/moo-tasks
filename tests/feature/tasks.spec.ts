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

function mockTaskOrderingTransaction(mockTasks: any[], refreshedTasks = mockTasks.map((task, order) => ({ ...task, order }))) {
  let selectCount = 0
  const orderBy = vi.fn().mockResolvedValue(mockTasks)
  const forUpdate = vi.fn().mockResolvedValue([{ id: 'board-1' }])
  const select = vi.fn(() => {
    selectCount++
    const query: any = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn(() => selectCount === 3 ? Promise.resolve(refreshedTasks) : query),
      for: forUpdate,
      orderBy,
    }
    return query
  })
  const updateWhere = vi.fn().mockResolvedValue({})
  const set = vi.fn().mockReturnValue({ where: updateWhere })
  const tx = {
    select,
    update: vi.fn().mockReturnValue({ set }),
  }
  ;(db.transaction as any).mockImplementation((callback: any) => callback(tx))
  return { tx, forUpdate, orderBy, set, updateWhere }
}

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
      const ordering = mockTaskOrderingTransaction(mockTasks)

      await reindexTasks('board-1', 'todo')
      
      expect(db.update).not.toHaveBeenCalled()
      expect(ordering.forUpdate).toHaveBeenCalledWith('update')
      expect(emitTaskEvent).not.toHaveBeenCalled()
    })

    it('should update order and emit events if tasks are out of order', async () => {
      const mockTasks = [
        { id: '1', order: 5 },
        { id: '2', order: 10 }
      ]
      const ordering = mockTaskOrderingTransaction(mockTasks)

      await reindexTasks('board-1', 'todo')

      expect(ordering.tx.update).toHaveBeenCalledTimes(1)
      expect(ordering.set).toHaveBeenCalledWith(expect.objectContaining({ order: expect.anything(), updatedAt: expect.any(Date) }))
      expect(emitTaskEvent).toHaveBeenCalledTimes(2)
      expect(emitTaskEvent).toHaveBeenCalledWith('board-1', 'task:updated', expect.objectContaining({ id: '1', order: 0 }))
      expect(emitTaskEvent).toHaveBeenCalledWith('board-1', 'task:updated', expect.objectContaining({ id: '2', order: 1 }))
    })
  })

  describe('reorderTasks', () => {
    it('should move a task with one batched update and emit only changed rows', async () => {
      const mockTasks = [
        { id: '1', order: 0 },
        { id: '2', order: 1 },
        { id: '3', order: 2 }
      ]
      const ordering = mockTaskOrderingTransaction(mockTasks, [
        { id: '3', order: 0 },
        { id: '1', order: 1 },
        { id: '2', order: 2 },
      ])

      // Move task '3' to index 0
      await reorderTasks('board-1', 'todo', '3', 0)

      // Expected order: '3' (0), '1' (1), '2' (2)
      expect(ordering.tx.update).toHaveBeenCalledTimes(1)
      expect(emitTaskEvent).toHaveBeenCalledWith('board-1', 'task:updated', expect.objectContaining({ id: '3', order: 0 }))
      expect(emitTaskEvent).toHaveBeenCalledWith('board-1', 'task:updated', expect.objectContaining({ id: '1', order: 1 }))
      expect(emitTaskEvent).toHaveBeenCalledWith('board-1', 'task:updated', expect.objectContaining({ id: '2', order: 2 }))
    })

    it('should return early if task to move is not found', async () => {
      const ordering = mockTaskOrderingTransaction([])

      await reorderTasks('board-1', 'todo', 'non-existent', 0)
      expect(ordering.tx.update).not.toHaveBeenCalled()
    })
  })
})
