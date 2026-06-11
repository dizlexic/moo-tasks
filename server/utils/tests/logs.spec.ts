import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logBoardEvent } from '../logs'
import { db } from '../../db'
import { boardLogs, boards } from '../../db/schema'

vi.mock('../../db', () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
  }
}))

describe('logs utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should insert a log entry', async () => {
    const mockInsertChain = {
      values: vi.fn().mockResolvedValue({})
    }
    ;(db.insert as any).mockReturnValue(mockInsertChain)

    const mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue({})
    }
    ;(db.update as any).mockReturnValue(mockUpdateChain)

    await logBoardEvent({
      boardId: 'board-insert',
      type: 'user_action',
      actor: 'User',
      action: 'test-action'
    })

    expect(db.insert).toHaveBeenCalledWith(boardLogs)
    expect(mockInsertChain.values).toHaveBeenCalledWith(expect.objectContaining({
      boardId: 'board-insert',
      type: 'user_action',
      actor: 'User',
      action: 'test-action'
    }))
  })

  it('should update lastActivityAt if not user_connection and not throttled', async () => {
    const mockInsertChain = {
      values: vi.fn().mockResolvedValue({})
    }
    ;(db.insert as any).mockReturnValue(mockInsertChain)

    const mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue({})
    }
    ;(db.update as any).mockReturnValue(mockUpdateChain)

    await logBoardEvent({
      boardId: 'board-update',
      type: 'user_action',
      actor: 'User',
      action: 'test-action'
    })

    expect(db.update).toHaveBeenCalledWith(boards)
    expect(mockUpdateChain.set).toHaveBeenCalledWith(expect.objectContaining({
      lastActivityAt: expect.any(Date)
    }))
  })

  it('should throttle lastActivityAt updates', async () => {
    const mockInsertChain = {
      values: vi.fn().mockResolvedValue({})
    }
    ;(db.insert as any).mockReturnValue(mockInsertChain)

    const mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue({})
    }
    ;(db.update as any).mockReturnValue(mockUpdateChain)

    const boardId = 'board-throttle'

    // First call
    await logBoardEvent({
      boardId,
      type: 'user_action',
      actor: 'User',
      action: 'action-1'
    })
    expect(db.update).toHaveBeenCalledTimes(1)

    // Second call immediately - should be throttled
    vi.advanceTimersByTime(1000)
    await logBoardEvent({
      boardId,
      type: 'user_action',
      actor: 'User',
      action: 'action-2'
    })
    expect(db.update).toHaveBeenCalledTimes(1)

    // Third call after throttle period (60s)
    vi.advanceTimersByTime(61 * 1000)
    await logBoardEvent({
      boardId,
      type: 'user_action',
      actor: 'User',
      action: 'action-3'
    })
    expect(db.update).toHaveBeenCalledTimes(2)
  })

  it('should NOT update lastActivityAt for user_connection type', async () => {
    const mockInsertChain = {
      values: vi.fn().mockResolvedValue({})
    }
    ;(db.insert as any).mockReturnValue(mockInsertChain)

    const mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue({})
    }
    ;(db.update as any).mockReturnValue(mockUpdateChain)

    await logBoardEvent({
      boardId: 'board-no-update',
      type: 'user_connection',
      actor: 'User',
      action: 'connected'
    })

    expect(db.update).not.toHaveBeenCalled()
  })

  it('should handle errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    ;(db.insert as any).mockImplementation(() => {
      throw new Error('DB Error')
    })

    await logBoardEvent({
      boardId: 'board-error',
      type: 'user_action',
      actor: 'User',
      action: 'test-action'
    })

    expect(consoleSpy).toHaveBeenCalledWith('Failed to log board event:', expect.any(Error))
    consoleSpy.mockRestore()
  })
})
