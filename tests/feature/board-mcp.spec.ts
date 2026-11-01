import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createBoardMcpServer, invalidateBoardMetadata } from '../../server/utils/board-mcp'
import { MCP_CAPABILITIES, MCP_FUNCTIONS } from '../../shared/mcp-capabilities'
import { db } from '../../server/db'

vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  }
}))

vi.mock('../../server/utils/socket', () => ({
  emitTaskEvent: vi.fn(),
}))

vi.mock('../../server/utils/tasks', () => ({
  reorderTasks: vi.fn(),
  getNextBoardTaskId: vi.fn(),
  getNextBoardTaskIds: vi.fn(),
}))

vi.mock('../../server/utils/logs', () => ({
  logBoardEvent: vi.fn(),
}))

describe('board-mcp utils', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    invalidateBoardMetadata() // ensure cache bypass so mocked selects are always exercised
  })

  describe('createBoardMcpServer', () => {
    it('should throw error if board not found', async () => {
      ;(db.select as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      })

      await expect(createBoardMcpServer('invalid-id')).rejects.toThrow('Board not found')
    })

    it('should create an McpServer instance with registered tools', async () => {
      const mockBoard = {
        id: 'board-1',
        mcpEnabledFunctions: {
          'list-tasks': true,
          'get-task': true,
        },
        allowAiReview: false,
      }
      
      const mockColumns = [
        { status: 'todo', permissions: { view: true } },
        { status: 'in_progress', permissions: { view: true } }
      ]

      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockBoard]),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockColumns),
      })

      const server = await createBoardMcpServer('board-1')
      // @ts-ignore
      const registeredTools = server._registeredTools
      expect(registeredTools).toHaveProperty('list-tasks')
      expect(registeredTools).toHaveProperty('get-task')
    })

    it('refreshes cached column permissions when another instance updates the metadata version', async () => {
      const selectResults = [
        [{ id: 'shared-board', mcpMetadataVersion: 1, mcpEnabledFunctions: null }],
        [{ status: 'todo', permissions: { view: true } }],
        [{ id: 'shared-board', mcpMetadataVersion: 2, mcpEnabledFunctions: null }],
        [{ status: 'todo', permissions: { view: false } }],
        [{ id: 'task-1', boardId: 'shared-board', status: 'todo' }],
      ]
      ;(db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation(() => Promise.resolve(selectResults.shift())),
      }))

      await createBoardMcpServer('shared-board')
      const server = await createBoardMcpServer('shared-board')
      expect(db.select).toHaveBeenCalledTimes(4)
      // @ts-ignore
      const result = await server._registeredTools['get-task'].handler({ taskId: 'task-1' })

      expect(result).toMatchObject({ isError: true, content: [{ text: JSON.stringify({ error: 'Permission denied' }) }] })
    })

    it('keeps private server registrations aligned with the shared tool registry and discovery list', async () => {
      const mockBoard = { id: 'registry-board', mcpEnabledFunctions: null }
      ;(db.select as any).mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([mockBoard]) })
        .mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) })

      const server = await createBoardMcpServer('registry-board')
      // @ts-ignore
      const registeredNames = Object.keys(server._registeredTools)
      const registeredCapabilities = MCP_CAPABILITIES.filter(capability => capability.kind === 'tool').map(capability => capability.name)

      expect(registeredNames.sort()).toEqual(registeredCapabilities.sort())
      expect(MCP_FUNCTIONS).toEqual(MCP_CAPABILITIES.map(capability => capability.name))
      expect(registeredNames).toContain('generate-changelog')
      expect(registeredNames).toContain('add-comment-with-attachment')
    })

    it('should expose only read-only tools for public boards', async () => {
      const mockBoard = { id: 'public-board', mcpPublic: true, mcpEnabledFunctions: null }
      ;(db.select as any).mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([mockBoard]) })
        .mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) })

      const server = await createBoardMcpServer('public-board')
      // @ts-ignore
      const registeredTools = server._registeredTools

      expect(Object.keys(registeredTools).sort()).toEqual([
        'generate-changelog',
        'get-comments',
        'get-installation-instructions',
        'get-task',
        'list-plans',
        'list-tasks',
      ])
    })

    it('should reject oversized task, comment, agent, and pagination inputs in tool schemas', async () => {
      const mockBoard = { id: 'bounded-board', mcpEnabledFunctions: null }
      ;(db.select as any).mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([mockBoard]) })
        .mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) })

      const server = await createBoardMcpServer('bounded-board')
      // @ts-ignore
      const registeredTools = server._registeredTools

      expect(registeredTools['create-task'].inputSchema.safeParse({ title: 't'.repeat(256) }).success).toBe(false)
      expect(registeredTools['create-task'].inputSchema.safeParse({ title: 'Valid title', description: 'd'.repeat(10_001) }).success).toBe(false)
      expect(registeredTools['accept-task'].inputSchema.safeParse({ taskId: 'task-1', agentName: 'a'.repeat(256) }).success).toBe(false)
      expect(registeredTools['add-comment'].inputSchema.safeParse({ taskId: 'task-1', author: 'agent', content: 'c'.repeat(16_001) }).success).toBe(false)
      expect(registeredTools['list-tasks'].inputSchema.safeParse({ limit: 101 }).success).toBe(false)
      expect(registeredTools['get-comments'].inputSchema.safeParse({ taskId: 'task-1', since: 'not-a-date' }).success).toBe(false)
    })

    it('should return an error for invalid since values instead of ignoring them', async () => {
      const mockBoard = { id: 'since-board', mcpEnabledFunctions: null }
      ;(db.select as any).mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([mockBoard]) })
        .mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) })

      const server = await createBoardMcpServer('since-board')
      // @ts-ignore
      const result = await server._registeredTools['generate-changelog'].handler({ since: 'not-a-date' })

      expect(result.isError).toBe(true)
      expect(JSON.parse(result.content[0].text).error).toContain('valid ISO 8601')
    })

    it('should reject plan applications above the maximum batch size', async () => {
      const mockBoard = { id: 'batch-board', ownerId: 'owner-1', mcpEnabledFunctions: null }
      const mockColumns = [{ status: 'todo', permissions: { add: true } }]
      ;(db.select as any).mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([mockBoard]) })
        .mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(mockColumns) })

      const server = await createBoardMcpServer('batch-board')
      // @ts-ignore
      const applyPlanHandler = server._registeredTools['apply-plan'].handler
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: 'plan-1', name: 'Large plan' }]),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(Array.from({ length: 101 }, (_, order) => ({ order }))),
      })

      const result = await applyPlanHandler({ planId: 'plan-1' })

      expect(result.isError).toBe(true)
      expect(JSON.parse(result.content[0].text).error).toContain('maximum batch size of 100')
      expect(db.transaction).not.toHaveBeenCalled()
    })

    it('should reject inaccessible statuses in list-tasks', async () => {
      const mockBoard = {
        id: 'board-1',
        mcpEnabledFunctions: { 'list-tasks': true },
        allowAiReview: false,
      }
      
      const mockColumns = [
        { status: 'todo', permissions: { view: false } },
      ]

      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockBoard]),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockColumns),
      })

      const server = await createBoardMcpServer('board-1')
      // @ts-ignore
      const listTasksHandler = server._registeredTools['list-tasks'].handler
      
      const result = await listTasksHandler({ status: 'todo' })
      const parsedResult = JSON.parse(result.content[0].text)
      expect(result.isError).toBe(true)
      expect(parsedResult.error).toBe('Status not found or not viewable')
    })

    it('should allow listing backlog tasks when the backlog column is viewable', async () => {
      const mockBoard = { id: 'board-1', mcpEnabledFunctions: { 'list-tasks': true } }
      const mockColumns = [{ status: 'backlog', permissions: { view: true } }]
      ;(db.select as any).mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([mockBoard]) })
        .mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(mockColumns) })

      const server = await createBoardMcpServer('board-1')
      const listTasksHandler = server._registeredTools['list-tasks'].handler
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 'task-1', status: 'backlog' }]),
      })

      const result = await listTasksHandler({ status: 'backlog' })

      expect(JSON.parse(result.content[0].text).tasks).toEqual([{ id: 'task-1', status: 'backlog' }])
    })

    it('should deny getting a task when its column is not viewable', async () => {
      const mockBoard = { id: 'board-1', mcpEnabledFunctions: { 'get-task': true } }
      const mockColumns = [{ status: 'backlog', permissions: { view: false } }]
      ;(db.select as any).mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([mockBoard]) })
        .mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(mockColumns) })

      const server = await createBoardMcpServer('board-1')
      const getTaskHandler = server._registeredTools['get-task'].handler
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: 'task-1', status: 'backlog' }]),
      })

      const result = await getTaskHandler({ taskId: 'task-1' })

      expect(result.isError).toBe(true)
      expect(JSON.parse(result.content[0].text).error).toBe('Permission denied')
    })

    it('should deny submitting a task for review when its column does not allow moves', async () => {
      const mockBoard = { id: 'board-1', mcpEnabledFunctions: { 'submit-for-review': true } }
      const mockColumns = [
        { status: 'backlog', permissions: { view: true, move: false } },
        { status: 'review', permissions: { view: true, move: true } },
      ]
      ;(db.select as any).mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([mockBoard]) })
        .mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(mockColumns) })

      const server = await createBoardMcpServer('board-1')
      const submitHandler = server._registeredTools['submit-for-review'].handler
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: 'task-1', status: 'backlog' }]),
      })

      const result = await submitHandler({ taskId: 'task-1' })

      expect(result.isError).toBe(true)
      expect(JSON.parse(result.content[0].text).error).toBe('Permission denied')
      expect(db.update).not.toHaveBeenCalled()
    })

    it('supports bounded cursor pagination in list-tasks with a stable continuation key', async () => {
      const mockBoard = { id: 'board-1', mcpEnabledFunctions: { 'list-tasks': true }, allowAiReview: false }
      const mockColumns = [{ status: 'todo', permissions: { view: true } }]
      ;(db.select as any).mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([mockBoard]) })
        .mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(mockColumns) })

      const server = await createBoardMcpServer('board-1')
      const listHandler = server._registeredTools['list-tasks'].handler

      const firstPage = [
        { id: 'task-1', status: 'todo', order: 1, boardTaskId: 1 },
        { id: 'task-2', status: 'todo', order: 1, boardTaskId: 2 },
        { id: 'task-3', status: 'todo', order: 2, boardTaskId: 3 },
      ]
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(firstPage),
      })

      const firstResult = await listHandler({ status: 'todo', limit: 2 })
      const firstPageResult = JSON.parse(firstResult.content[0].text)
      expect(firstPageResult.tasks).toHaveLength(2)
      expect(db.select.mock.calls[2][0]).not.toHaveProperty('description')
      expect(firstPageResult.hasMore).toBe(true)
      expect(firstPageResult.nextCursor).toEqual({ order: 1, boardTaskId: 2 })

      const secondPage = [{ id: 'task-3', status: 'todo', order: 2, boardTaskId: 3 }]
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(secondPage),
      })
      const secondResult = await listHandler({ status: 'todo', limit: 2, cursor: firstPageResult.nextCursor })
      const secondPageResult = JSON.parse(secondResult.content[0].text)
      expect(secondPageResult.tasks).toEqual(secondPage)
      expect(secondPageResult.hasMore).toBe(false)
      expect(secondPageResult.nextCursor).toBeNull()
    })

    it('should create a task when create-task is called', async () => {
       const mockBoard = { id: 'board-1', mcpEnabledFunctions: { 'create-task': true } }
       const mockColumns = [{ status: 'backlog', permissions: { view: true } }]
       
       ;(db.select as any).mockReturnValueOnce({
         from: vi.fn().mockReturnThis(),
         where: vi.fn().mockResolvedValue([mockBoard]),
       }).mockReturnValueOnce({
         from: vi.fn().mockReturnThis(),
         where: vi.fn().mockResolvedValue(mockColumns),
       })

       const server = await createBoardMcpServer('board-1')
       // @ts-ignore
       const createTaskHandler = server._registeredTools['create-task'].handler

       ;(db.insert as any).mockReturnValue({
         values: vi.fn().mockResolvedValue({}),
       })
       
       const result = await createTaskHandler({ title: 'New Task' })
       const parsedResult = JSON.parse(result.content[0].text)
       expect(parsedResult.message).toBe('Task created')
       expect(db.insert).toHaveBeenCalled()
    })

    it('should include review tasks if allowAiReview is enabled', async () => {
      const mockBoard = {
        id: 'board-1',
        mcpEnabledFunctions: { 'list-tasks': true },
        allowAiReview: true,
      }
      
      const mockColumns = [
        { status: 'review', permissions: { view: true } },
      ]

      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockBoard]),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockColumns),
      })

      const server = await createBoardMcpServer('board-1')
      // @ts-ignore
      const listTasksHandler = server._registeredTools['list-tasks'].handler
      
      const mockTasks = [
        { id: 'task-1', status: 'review' }
      ]
      
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockTasks),
      })

      const result = await listTasksHandler({ status: 'review' })
      const parsedResult = JSON.parse(result.content[0].text)
      expect(parsedResult.tasks).toHaveLength(1)
    })

    it('should accept a task when accept-task is called', async () => {
      const mockBoard = { id: 'board-1', mcpEnabledFunctions: { 'accept-task': true } }
      const mockColumns = [
        { status: 'todo', permissions: { move: true } },
        { status: 'in_progress', permissions: { move: true } },
      ]
      
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockBoard]),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockColumns),
      })

      const server = await createBoardMcpServer('board-1')
      // @ts-ignore
      const acceptTaskHandler = server._registeredTools['accept-task'].handler

      const mockTask = { id: 'task-1', status: 'todo', isHumanOnly: false }
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockTask]),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ ...mockTask, assignee: 'Agent 1', status: 'in_progress' }]),
      })

      ;(db.update as any).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ affectedRows: 1 }, []]),
      })

      const result = await acceptTaskHandler({ taskId: 'task-1', agentName: 'Agent 1' })
      const parsedResult = JSON.parse(result.content[0].text)
      expect(parsedResult.message).toContain('accepted')
    })

    it('should reject a task claim when another agent wins the conditional update', async () => {
      const mockBoard = { id: 'board-1', mcpEnabledFunctions: { 'accept-task': true } }
      const mockColumns = [
        { status: 'todo', permissions: { move: true } },
        { status: 'in_progress', permissions: { move: true } },
      ]

      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockBoard]),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockColumns),
      })

      const server = await createBoardMcpServer('board-1')
      // @ts-ignore
      const acceptTaskHandler = server._registeredTools['accept-task'].handler

      const taskBeforeRace = { id: 'task-1', status: 'todo', isHumanOnly: false, assignee: null }
      const taskAfterRace = { ...taskBeforeRace, status: 'in_progress', assignee: 'Agent 1' }
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([taskBeforeRace]),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([taskAfterRace]),
      })

      ;(db.update as any).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ affectedRows: 0 }, []]),
      })

      const result = await acceptTaskHandler({ taskId: 'task-1', agentName: 'Agent 2' })
      const parsedResult = JSON.parse(result.content[0].text)
      expect(result.isError).toBe(true)
      expect(parsedResult.error).toContain('Agent 1')
    })

    it('should reject a task when reject-task is called', async () => {
      const mockBoard = { id: 'board-1', mcpEnabledFunctions: { 'reject-task': true } }
      const mockColumns = [
        { status: 'review', permissions: { move: true } },
        { status: 'todo', permissions: { move: true } }
      ]
      
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockBoard]),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockColumns),
      })

      const server = await createBoardMcpServer('board-1')
      // @ts-ignore
      const rejectTaskHandler = server._registeredTools['reject-task'].handler

      const mockTask = { id: 'task-1', status: 'review', isHumanOnly: false }
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockTask]),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ ...mockTask, status: 'todo' }]),
      })

      ;(db.update as any).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue({}),
      })
      
      ;(db.insert as any).mockReturnValue({
        values: vi.fn().mockResolvedValue({}),
      })
      ;(db.select as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: 'task-1', status: 'todo' }]),
      })
      ;(db.update as any).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue({}),
      })

      ;(db.transaction as any).mockImplementation(async (cb: any) => {
        // Delegate to the same mocked methods (tests configure returns on db.* which we alias)
        const tx = {
          insert: db.insert,
          update: db.update,
          select: db.select,
        }
        return cb(tx)
      })

      const result = await rejectTaskHandler({ taskId: 'task-1', reason: 'Issues found' })
      const parsedResult = JSON.parse(result.content[0].text)
      expect(parsedResult.message).toContain('rejected')
    })

    it('should return board state when board-state resource is read', async () => {
      const mockBoard = { id: 'board-1', mcpEnabledFunctions: { 'board-state': true } }
      const mockColumns = [
        { status: 'todo', permissions: { view: true } },
        { status: 'done', permissions: { view: true } },
        { status: 'archive', permissions: { view: true } },
      ]
      
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockBoard]),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockColumns),
      })

      const server = await createBoardMcpServer('board-1')
      // @ts-ignore
      const boardStateResource = server._registeredResources['moo-tasks://board-1/board-state']
      const boardStateHandler = boardStateResource.readCallback

      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([{ status: 'todo', total: 1 }, { status: 'done', total: 1 }, { status: 'archive', total: 1 }]),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 'task-1', status: 'todo' }]),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 'task-2', status: 'done' }]),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 'task-3', status: 'archive' }]),
      })

      const result = await boardStateHandler(new URL('moo-tasks://board-1/board-state'))
      const parsedContent = JSON.parse(result.contents[0].text)
      expect(parsedContent.totalTasks).toBe(3)
      expect(parsedContent.statusOrder).toEqual(['backlog', 'todo', 'in_progress', 'review', 'done', 'archive'])
      expect(parsedContent.counts.archive).toBe(1)
      expect(parsedContent.sampleLimit).toBe(50)
      expect(parsedContent.note).toContain('deterministic samples')
      expect(parsedContent.columns.todo).toHaveLength(1)
      expect(parsedContent.columns.done).toHaveLength(1)
      expect(parsedContent.columns.archive).toEqual([{ id: 'task-3', status: 'archive' }])
    })

    it('should only include viewable tasks in board state', async () => {
      const mockBoard = { id: 'board-1', mcpEnabledFunctions: { 'board-state': true } }
      const mockColumns = [
        { status: 'backlog', permissions: { view: false } },
        { status: 'todo', permissions: { view: true } },
      ]
      ;(db.select as any).mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([mockBoard]) })
        .mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(mockColumns) })

      const server = await createBoardMcpServer('board-1')
      const boardStateResource = server._registeredResources['moo-tasks://board-1/board-state']
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([{ status: 'todo', total: 1 }]),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 'task-2', status: 'todo' }]),
      })

      const result = await boardStateResource.readCallback(new URL('moo-tasks://board-1/board-state'))
      const parsedContent = JSON.parse(result.contents[0].text)

      expect(parsedContent.totalTasks).toBe(1)
      expect(parsedContent.counts.backlog).toBe(0)
      expect(parsedContent.columns.backlog).toHaveLength(0)
      expect(parsedContent.columns.todo).toHaveLength(1)
    })

    it('should deny reading or adding comments to tasks in hidden columns', async () => {
      const mockBoard = { id: 'board-1', mcpEnabledFunctions: { 'add-comment': true, 'get-comments': true } }
      const mockColumns = [{ status: 'backlog', permissions: { view: false } }]
      ;(db.select as any).mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([mockBoard]) })
        .mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(mockColumns) })

      const server = await createBoardMcpServer('board-1')
      const addCommentHandler = server._registeredTools['add-comment'].handler
      const getCommentsHandler = server._registeredTools['get-comments'].handler
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: 'task-1', status: 'backlog' }]),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: 'task-1', status: 'backlog' }]),
      })

      const addResult = await addCommentHandler({ taskId: 'task-1', author: 'Agent', content: 'Comment' })
      const getResult = await getCommentsHandler({ taskId: 'task-1' })

      expect(addResult.isError).toBe(true)
      expect(getResult.isError).toBe(true)
      expect(db.insert).not.toHaveBeenCalled()
    })

    it('paginates comments with a timestamp and ID cursor', async () => {
      const mockBoard = { id: 'board-1', mcpEnabledFunctions: { 'get-comments': true } }
      const mockColumns = [{ status: 'todo', permissions: { view: true } }]
      ;(db.select as any).mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([mockBoard]) })
        .mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(mockColumns) })

      const server = await createBoardMcpServer('board-1')
      const getCommentsHandler = server._registeredTools['get-comments'].handler
      const task = { id: 'task-1', status: 'todo' }
      ;(db.select as any).mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([task]) })

      const firstCreatedAt = new Date('2026-10-31T12:00:00.000Z')
      const secondCreatedAt = new Date('2026-10-31T11:00:00.000Z')
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { id: 'comment-1', taskId: 'task-1', createdAt: firstCreatedAt },
          { id: 'comment-2', taskId: 'task-1', createdAt: secondCreatedAt },
        ]),
      })

      const firstResult = await getCommentsHandler({ taskId: 'task-1', limit: 1 })
      const firstPage = JSON.parse(firstResult.content[0].text)
      expect(firstPage.comments).toHaveLength(1)
      expect(firstPage.hasMore).toBe(true)
      expect(firstPage.nextCursor).toEqual({ createdAt: firstCreatedAt.toISOString(), id: 'comment-1' })

      ;(db.select as any).mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([task]) })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([{ id: 'comment-2', taskId: 'task-1', createdAt: secondCreatedAt }]),
        })
      const secondResult = await getCommentsHandler({ taskId: 'task-1', limit: 1, cursor: firstPage.nextCursor })
      const secondPage = JSON.parse(secondResult.content[0].text)
      expect(secondPage.comments[0].id).toBe('comment-2')
      expect(secondPage.hasMore).toBe(false)
      expect(secondPage.nextCursor).toBeNull()
    })

    it('should deny applying a plan when the Todo column does not allow additions', async () => {
      const mockBoard = { id: 'board-1', ownerId: 'owner-1', mcpEnabledFunctions: { 'apply-plan': true } }
      const mockColumns = [{ status: 'todo', permissions: { add: false } }]
      ;(db.select as any).mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([mockBoard]) })
        .mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(mockColumns) })

      const server = await createBoardMcpServer('board-1')
      const applyPlanHandler = server._registeredTools['apply-plan'].handler

      const result = await applyPlanHandler({ planId: 'plan-1' })

      expect(result.isError).toBe(true)
      expect(JSON.parse(result.content[0].text).error).toBe('Permission denied')
      expect(db.select).toHaveBeenCalledTimes(2)
      expect(db.transaction).not.toHaveBeenCalled()
    })

    it('should return task workflow prompt', async () => {
      const mockBoard = { id: 'board-1', mcpEnabledFunctions: { 'task-workflow': true } }
      const mockColumns = []
      
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockBoard]),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockColumns),
      })

      const server = await createBoardMcpServer('board-1')
      // @ts-ignore
      const workflowPrompt = server._registeredPrompts['task-workflow']
      const workflowHandler = workflowPrompt.callback

      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ content: 'Board instructions' }]),
      })

      const result = await workflowHandler({})
      expect(result.messages[0].content.text).toBe('Board instructions')
    })

    it('should generate a changelog via generate-changelog handler (exercises done tasks query + desc orderBy)', async () => {
      const mockBoard = {
        id: 'board-1',
        mcpEnabledFunctions: { 'generate-changelog': true },
        allowAiReview: false,
      }
      const mockColumns = [{ status: 'done', permissions: { view: true } }]

      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockBoard]),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockColumns),
      })

      const server = await createBoardMcpServer('board-1')
      // @ts-ignore
      const genChangelogHandler = server._registeredTools['generate-changelog'].handler

      const mockDone = [
        { id: 'd1', title: 'Ship v1', description: 'Initial release', priority: 'high', updatedAt: new Date('2026-06-01') },
        { id: 'd2', title: 'Fix bug', description: null, priority: 'medium', updatedAt: new Date('2026-06-02') },
      ]
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockDone),
      })

      const result = await genChangelogHandler({ template: 'simple' })
      expect(result.content[0].text).toContain('# Changelog')
      expect(result.content[0].text).toContain('- Ship v1')
      expect(result.content[0].text).toContain('- Fix bug')

      // Also exercise 'detailed' template path
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockDone),
      })
      const detailed = await genChangelogHandler({ template: 'detailed' })
      expect(detailed.content[0].text).toContain('### Ship v1')
      expect(detailed.content[0].text).toContain('Initial release')

      const extraDone = [
        { id: 'd3', title: 'Newest', description: null, priority: 'high', updatedAt: new Date('2026-06-03T00:00:00.000Z') },
        { id: 'd2', title: 'Next', description: null, priority: 'medium', updatedAt: new Date('2026-06-02T00:00:00.000Z') },
        { id: 'd1', title: 'Older', description: null, priority: 'low', updatedAt: new Date('2026-06-01T00:00:00.000Z') },
      ]
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(extraDone),
      })
      const paginated = await genChangelogHandler({ limit: 2 })
      expect(paginated.content[0].text).toContain('More completed tasks are available.')
      expect(paginated.content[0].text).toContain('"id":"d2"')
    })

    it('checks the shared metadata version while reusing cached columns', async () => {
      const mockBoard = {
        id: 'board-cache-test',
        mcpMetadataVersion: 1,
        mcpEnabledFunctions: { 'list-tasks': true },
        allowAiReview: false,
      }
      const mockColumns = [{ status: 'todo', permissions: { view: true } }]

      ;(db.select as any).mockImplementation(() => {
        const result = db.select.mock.calls.length === 2 ? mockColumns : [mockBoard]
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue(result),
        }
      })

      await createBoardMcpServer('board-cache-test')

      // Subsequent creates check the shared version but reuse cached columns.
      for (let i = 0; i < 50; i++) {
        await createBoardMcpServer('board-cache-test')
      }
      expect(db.select).toHaveBeenCalledTimes(52)
    })
  })
})
