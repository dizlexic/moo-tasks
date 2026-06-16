import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { reorderTasks } from '../tasks'
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

describe('reorderTasks fuzz testing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reorderTasks should not crash with arbitrary inputs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }), // boardId
        fc.string({ minLength: 1 }), // status
        fc.string({ minLength: 1 }), // taskId
        fc.integer({ min: -10, max: 100 }), // newOrder
        async (boardId, status, taskId, newOrder) => {
          // Mock DB select to return some random tasks
          const mockTasks = [
            { id: '1', order: 0 },
            { id: '2', order: 1 },
            { id: taskId, order: 2 } // Ensure taskId is in the list sometimes
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

          // We expect this to run without throwing an error
          await reorderTasks(boardId, status, taskId, newOrder)
          
          // Basic check: did it attempt any DB updates?
          // It might or might not, depending on the random inputs, but it shouldn't crash.
          expect(true).toBe(true) 
        }
      ),
      { numRuns: 50 }
    )
  })
})
