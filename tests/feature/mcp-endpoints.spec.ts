import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { db } from '../../server/db'
import { boardColumns, tasks } from '../../server/db/schema'
import { readBody } from 'h3'
import { createBoardMcpServer } from '../../server/utils/board-mcp'
import { createGlobalMcpServer } from '../../server/utils/global-mcp'
import { hashBearerToken } from '../../server/utils/token-digests'
import boardMcpEndpoint from '../../server/api/boards/[id]/mcp'
import globalMcpEndpoint from '../../server/api/mcp'

const endpointState = vi.hoisted(() => ({
  boardId: 'board-1',
  transportRequests: [] as unknown[],
  transportResults: [] as unknown[],
}))

vi.mock('h3', () => ({
  defineEventHandler: (handler: (event: unknown) => unknown) => handler,
  getRouterParam: () => endpointState.boardId,
  createError: (options: { statusCode: number; statusMessage: string }) => Object.assign(new Error(options.statusMessage), options),
  readBody: vi.fn(),
}))

vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: class {
    server: any

    async handleRequest(_req: unknown, _res: unknown, body: any) {
      endpointState.transportRequests.push(body)
      if (body?.method !== 'tools/call') return
      const tool = this.server?._registeredTools[body.params?.name]
      endpointState.transportResults.push(tool
        ? await tool.handler(body.params?.arguments ?? {})
        : { isError: true, error: 'Method not found' })
    }
  },
}))

vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
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

vi.mock('../../server/utils/socket', () => ({
  emitTaskEvent: vi.fn(),
}))

describe('MCP endpoint authorization', () => {
  let actualBoardMcp: typeof import('../../server/utils/board-mcp')
  let createdBoardServers: any[]

  beforeEach(() => {
    vi.clearAllMocks()
    endpointState.boardId = 'board-1'
    endpointState.transportRequests = []
    endpointState.transportResults = []
    createdBoardServers = []
    ;(createBoardMcpServer as any).mockResolvedValue({ connect: vi.fn().mockResolvedValue(undefined) })
    ;(createGlobalMcpServer as any).mockResolvedValue({ connect: vi.fn().mockResolvedValue(undefined) })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function useRealBoardMcpServer() {
    actualBoardMcp ??= await vi.importActual<typeof import('../../server/utils/board-mcp')>('../../server/utils/board-mcp')
    actualBoardMcp.invalidateBoardMetadata()
    ;(createBoardMcpServer as any).mockImplementation(async (...args: [string, boolean?]) => {
      const server = await actualBoardMcp.createBoardMcpServer(...args)
      vi.spyOn(server, 'connect').mockImplementation(async (transport: any) => {
        transport.server = server
      })
      createdBoardServers.push(server)
      return server
    })
  }

  function mockSelectResults(...results: unknown[][]) {
    let index = 0
    ;(db.select as any).mockImplementation(() => {
      const result = results[index++] ?? []
      const query = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(result),
      }
      return query
    })
  }

  function createEvent() {
    return {
      node: {
        req: { method: 'GET', headers: { accept: 'application/json' } },
        res: { headersSent: false, writeHead: vi.fn(), end: vi.fn(), setHeader: vi.fn() },
      },
    }
  }

  it('rejects a private-board request without a bearer header', async () => {
    mockSelectResults([{ id: 'board-1', mcpPublic: false }])
    const event = createEvent()

    await expect((boardMcpEndpoint as any)(event)).rejects.toMatchObject({ statusCode: 401 })

    expect(event.node.res.setHeader).toHaveBeenCalledWith('WWW-Authenticate', 'Bearer realm="moo-tasks"')
    expect(createBoardMcpServer).not.toHaveBeenCalled()
  })

  it('allows a matching board bearer token to reach the MCP transport', async () => {
    const body = { jsonrpc: '2.0', method: 'tools/list', id: 1 }
    mockSelectResults([{ id: 'board-1', mcpPublic: false, mcpTokenDigest: hashBearerToken('board-secret') }])
    ;(readBody as any).mockResolvedValue(body)
    const event = createEvent()
    event.node.req.method = 'POST'
    event.node.req.headers.authorization = 'Bearer board-secret'

    await (boardMcpEndpoint as any)(event)

    expect(createBoardMcpServer).toHaveBeenCalledWith('board-1', false)
    expect(endpointState.transportRequests).toEqual([body])
  })

  it('allows a board member token only when it belongs to the requested board', async () => {
    mockSelectResults(
      [{ id: 'board-1', mcpPublic: false, mcpTokenDigest: null, allowAccountToken: false }],
      [{ boardId: 'board-1', tokenDigest: hashBearerToken('member-secret') }],
    )
    const event = createEvent()
    event.node.req.headers.authorization = 'Bearer member-secret'

    await (boardMcpEndpoint as any)(event)

    expect(createBoardMcpServer).toHaveBeenCalledWith('board-1', false)
  })

  it('rejects a board member token issued for a different board', async () => {
    mockSelectResults(
      [{ id: 'board-1', mcpPublic: false, mcpTokenDigest: null, allowAccountToken: false }],
      [{ boardId: 'board-2', tokenDigest: hashBearerToken('member-secret') }],
    )
    const event = createEvent()
    event.node.req.headers.authorization = 'Bearer member-secret'

    await expect((boardMcpEndpoint as any)(event)).rejects.toMatchObject({ statusCode: 401 })
    expect(createBoardMcpServer).not.toHaveBeenCalled()
  })

  it('allows an account token only when enabled and the user is a board member', async () => {
    mockSelectResults(
      [{ id: 'board-1', mcpPublic: false, mcpTokenDigest: null, allowAccountToken: true }],
      [],
      [{ id: 'user-1', accountTokenDigest: hashBearerToken('account-secret') }],
      [{ boardId: 'board-1', userId: 'user-1' }],
    )
    const event = createEvent()
    event.node.req.headers.authorization = 'Bearer account-secret'

    await (boardMcpEndpoint as any)(event)

    expect(createBoardMcpServer).toHaveBeenCalledWith('board-1', false)
  })

  it('rejects account tokens when the user is not a board member', async () => {
    mockSelectResults(
      [{ id: 'board-1', mcpPublic: false, mcpTokenDigest: null, allowAccountToken: true }],
      [],
      [{ id: 'user-1', accountTokenDigest: hashBearerToken('account-secret') }],
      [],
    )
    const event = createEvent()
    event.node.req.headers.authorization = 'Bearer account-secret'

    await expect((boardMcpEndpoint as any)(event)).rejects.toMatchObject({ statusCode: 401 })
    expect(createBoardMcpServer).not.toHaveBeenCalled()
  })

  it('binds global MCP access to a valid account bearer token', async () => {
    ;(db.select as any).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ id: 'user-2' }]),
    })
    const event = createEvent()
    event.node.req.headers.authorization = 'Bearer global-secret'

    await (globalMcpEndpoint as any)(event)

    expect(createGlobalMcpServer).toHaveBeenCalledWith('user-2')
  })

  it('keeps global MCP anonymous when the account token is missing or invalid', async () => {
    ;(db.select as any).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    })
    const missingTokenEvent = createEvent()
    await (globalMcpEndpoint as any)(missingTokenEvent)
    expect(createGlobalMcpServer).toHaveBeenCalledWith(undefined)

    vi.clearAllMocks()
    ;(db.select as any).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    })
    const invalidTokenEvent = createEvent()
    invalidTokenEvent.node.req.headers.authorization = 'Bearer invalid-secret'
    await (globalMcpEndpoint as any)(invalidTokenEvent)
    expect(createGlobalMcpServer).toHaveBeenCalledWith(undefined)
  })

  it('routes public write attempts to a server that does not register mutation tools', async () => {
    await useRealBoardMcpServer()
    const board = { id: 'board-1', mcpPublic: true, mcpEnabledFunctions: null }
    mockSelectResults([board], [board], [])
    const body = { jsonrpc: '2.0', method: 'tools/call', params: { name: 'create-task', arguments: { title: 'unauthorized' } }, id: 2 }
    ;(readBody as any).mockResolvedValue(body)
    const event = createEvent()
    event.node.req.method = 'POST'

    await (boardMcpEndpoint as any)(event)

    expect(createBoardMcpServer).toHaveBeenCalledWith('board-1', true)
    expect(endpointState.transportRequests).toEqual([body])
    expect(createdBoardServers[0]._registeredTools['create-task']).toBeUndefined()
    expect(createdBoardServers[0]._registeredTools['list-tasks']).toBeDefined()
    expect(endpointState.transportResults).toEqual([{ isError: true, error: 'Method not found' }])
  })

  it('allows only one concurrent claim through authenticated board requests', async () => {
    await useRealBoardMcpServer()
    const board = { id: 'board-1', mcpPublic: false, mcpTokenDigest: hashBearerToken('board-secret'), mcpEnabledFunctions: { 'accept-task': true } }
    const columns = [
      { status: 'todo', permissions: { move: true } },
      { status: 'in_progress', permissions: { move: true } },
    ]
    let currentTask: any = { id: 'task-1', boardId: 'board-1', status: 'todo', assignee: null, isHumanOnly: false }
    let initialTaskReads = 0
    let completeInitialReads: ((tasks: any[]) => void)[] = []
    let updates = 0
    ;(db.select as any).mockImplementation(() => {
      let table: unknown
      const query = {
        from: vi.fn((selectedTable: unknown) => {
          table = selectedTable
          return query
        }),
        where: vi.fn(() => {
          if (table === boardColumns) return Promise.resolve(columns)
          if (table === tasks) {
            if (currentTask.status === 'todo' && initialTaskReads < 2) {
              initialTaskReads++
              return new Promise(resolve => {
                completeInitialReads.push(resolve)
                if (completeInitialReads.length === 2) {
                  const initial = { ...currentTask }
                  completeInitialReads.forEach(done => done([initial]))
                  completeInitialReads = []
                }
              })
            }
            return Promise.resolve([{ ...currentTask }])
          }
          return Promise.resolve([board])
        }),
      }
      return query
    })
    ;(db.update as any).mockImplementation(() => {
      let updateValues: any
      return {
        set: vi.fn((values: unknown) => {
          updateValues = values
          return { where: vi.fn(async () => {
            updates++
            if (updates === 1 && currentTask.status === 'todo') {
              currentTask = { ...currentTask, ...updateValues }
              return [{ affectedRows: 1 }, []]
            }
            return [{ affectedRows: 0 }, []]
          }) }
        }),
      }
    })

    const events = [createEvent(), createEvent()]
    events.forEach((event, index) => {
      event.node.req.method = 'POST'
      event.node.req.headers.authorization = 'Bearer board-secret'
      ;(readBody as any).mockResolvedValueOnce({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'accept-task', arguments: { taskId: 'task-1', agentName: `Agent ${index + 1}` } },
        id: index + 1,
      })
    })
    await Promise.all(events.map(event => (boardMcpEndpoint as any)(event)))

    const results = endpointState.transportResults as any[]

    expect(results.filter(result => !result.isError)).toHaveLength(1)
    expect(results.filter(result => result.isError)).toHaveLength(1)
    expect(updates).toBe(2)
    expect(currentTask.status).toBe('in_progress')
  })
})

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