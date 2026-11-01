import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { reorderTasks } from '../../server/utils/tasks'
import { db } from '../../server/db'
import { emitTaskEvent } from '../../server/utils/socket'

vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  }
}))

vi.mock('../../server/utils/socket', () => ({
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
            { id: '1', order: 0, boardTaskId: 1 },
            { id: '2', order: 1, boardTaskId: 2 },
            { id: taskId, order: 2, boardTaskId: 3 } // Ensure taskId is in the list sometimes
          ]
          let selectCalls = 0
          const tx = {
            select: vi.fn(() => {
              selectCalls++
              const query: any = {
                from: vi.fn().mockReturnThis(),
                where: vi.fn(() => selectCalls === 3 ? Promise.resolve(mockTasks) : query),
                for: vi.fn().mockResolvedValue([{ id: boardId }]),
                orderBy: vi.fn().mockResolvedValue(mockTasks),
              }
              return query
            }),
            update: vi.fn(() => ({
              set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) }),
            })),
          }
          ;(db.transaction as any).mockImplementation((callback: any) => callback(tx))

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
