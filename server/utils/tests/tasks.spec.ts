import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getNextBoardTaskId, reindexTasks, reorderTasks } from '../tasks'
import { db } from '../../db'
import { emitTaskEvent } from '../socket'

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  }
}))

vi.mock('../socket', () => ({
  emitTaskEvent: vi.fn(),
}))

describe('tasks utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getNextBoardTaskId', () => {
    it('should return 1 if no tasks exist', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ maxId: null }])
      }
      ;(db.select as any).mockReturnValue(mockChain)

      const id = await getNextBoardTaskId('board-1')
      expect(id).toBe(1)
      expect(db.select).toHaveBeenCalled()
    })

    it('should return maxId + 1', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ maxId: 10 }])
      }
      ;(db.select as any).mockReturnValue(mockChain)

      const id = await getNextBoardTaskId('board-1')
      expect(id).toBe(11)
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
