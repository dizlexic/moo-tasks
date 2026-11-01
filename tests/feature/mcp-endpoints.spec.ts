import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { db } from '../../server/db'
import { createBoardMcpServer } from '../../server/utils/board-mcp'
import { createGlobalMcpServer } from '../../server/utils/global-mcp'
import boardMcpEndpoint from '../../server/api/boards/[id]/mcp'
import globalMcpEndpoint from '../../server/api/mcp'

vi.mock('h3', () => ({
  defineEventHandler: (handler: (event: unknown) => unknown) => handler,
  getRouterParam: () => 'board-1',
  createError: (options: { statusCode: number; statusMessage: string }) => Object.assign(new Error(options.statusMessage), options),
  readBody: vi.fn(),
}))

vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn(),
  },
}))

vi.mock('../../server/utils/board-mcp', () => ({
  createBoardMcpServer: vi.fn(),
}))

vi.mock('../../server/utils/global-mcp', () => ({
  createGlobalMcpServer: vi.fn(),
}))

vi.mock('../../server/utils/logs', () => ({
  logBoardEvent: vi.fn(),
}))

describe('MCP endpoint errors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function createEvent() {
    return {
      node: {
        req: { method: 'GET', headers: { accept: 'application/json' } },
        res: { headersSent: false, writeHead: vi.fn(), end: vi.fn(), setHeader: vi.fn() },
      },
    }
  }

  it('returns a sanitized error for board endpoint failures and logs the original exception', async () => {
    const board = { id: 'board-1', mcpPublic: true }
    ;(db.select as any).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([board]),
    })
    const internalError = new Error('database credentials leaked')
    ;(createBoardMcpServer as any).mockRejectedValue(internalError)
    const event = createEvent()

    await (boardMcpEndpoint as any)(event)

    expect(event.node.res.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'application/json' })
    expect(JSON.parse(event.node.res.end.mock.calls[0][0])).toEqual({ error: 'Internal server error' })
    expect(console.error).toHaveBeenCalledWith('[MCP] Board endpoint request failed:', internalError)
  })

  it('returns a sanitized error for global endpoint failures and logs the original exception', async () => {
    const internalError = new Error('database credentials leaked')
    ;(createGlobalMcpServer as any).mockRejectedValue(internalError)
    const event = createEvent()

    await (globalMcpEndpoint as any)(event)

    expect(event.node.res.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'application/json' })
    expect(JSON.parse(event.node.res.end.mock.calls[0][0])).toEqual({ error: 'Internal server error' })
    expect(console.error).toHaveBeenCalledWith('[MCP] Global endpoint request failed:', internalError)
  })
})