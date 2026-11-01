import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanupOldBoardLogs, logBoardEvent } from '../../server/utils/logs'
import { db } from '../../server/db'
import { boardLogs, boards } from '../../server/db/schema'

vi.mock('../../server/db', () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
    delete: vi.fn(),
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

  it('throttles repeated MCP request logs for the same board and action', async () => {
    ;(db.insert as any).mockReturnValue({ values: vi.fn().mockResolvedValue({}) })
    ;(db.update as any).mockReturnValue({ set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue({}) })
    const event = { boardId: 'board-mcp-throttle', type: 'mcp_request' as const, actor: 'Agent', action: 'list-tasks-throttle-test' }

    await logBoardEvent(event)
    await logBoardEvent(event)
    expect(db.insert).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1001)
    await logBoardEvent(event)
    expect(db.insert).toHaveBeenCalledTimes(2)
  })

  it('deletes old logs in bounded batches and validates cleanup limits', async () => {
    const resultSets = [[{ id: 'old-1' }, { id: 'old-2' }], [{ id: 'old-3' }], []]
    ;(db.select as any).mockImplementation(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(resultSets.shift()),
    }))
    ;(db.delete as any).mockReturnValue({ where: vi.fn().mockResolvedValue({}) })

    await expect(cleanupOldBoardLogs(90, 2)).resolves.toBe(3)
    expect(db.delete).toHaveBeenCalledTimes(2)
    await expect(cleanupOldBoardLogs(0)).rejects.toThrow('Retention period must be a positive integer')
    await expect(cleanupOldBoardLogs(90, 1001)).rejects.toThrow('Cleanup batch size')
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
