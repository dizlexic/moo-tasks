import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createBoardMcpServer, invalidateBoardMetadata } from '../board-mcp'
import { db } from '../../db'

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  }
}))

vi.mock('../socket', () => ({
  emitTaskEvent: vi.fn(),
}))

vi.mock('../tasks', () => ({
  reorderTasks: vi.fn(),
  getNextBoardTaskId: vi.fn(),
}))

vi.mock('../logs', () => ({
  logBoardEvent: vi.fn(),
}))

describe('board-mcp utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

    it('should respect permissions in list-tasks', async () => {
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
      
      const mockTasks = [
        { id: 'task-1', status: 'todo' }
      ]
      
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(mockTasks),
          offset: vi.fn().mockResolvedValue(mockTasks),
        }),
      })

      const result = await listTasksHandler({ status: 'todo' })
      const parsedResult = JSON.parse(result.content[0].text)
      expect(parsedResult.tasks).toHaveLength(0)
    })

    it('supports limit + offset pagination in list-tasks (DB-backed, exercises limit/offset path)', async () => {
      const mockBoard = { id: 'board-1', mcpEnabledFunctions: { 'list-tasks': true }, allowAiReview: false }
      const mockColumns = [{ status: 'todo', permissions: { view: true } }]
      ;(db.select as any).mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([mockBoard]) })
        .mockReturnValueOnce({ from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(mockColumns) })

      const server = await createBoardMcpServer('board-1')
      const listHandler = server._registeredTools['list-tasks'].handler

      const manyTasks = Array.from({ length: 25 }, (_, i) => ({ id: 't' + i, status: 'todo', order: i }))
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(manyTasks.slice(10, 15)),
      })

      const res = await listHandler({ status: 'todo', limit: 5, offset: 10 })
      const p = JSON.parse(res.content[0].text)
      expect(p.tasks).toHaveLength(5)
    })

    it('should create a task when create-task is called', async () => {
       const mockBoard = { id: 'board-1', mcpEnabledFunctions: { 'create-task': true } }
       const mockColumns = [{ status: 'backlog', permissions: { add: true } }]
       
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
        orderBy: vi.fn().mockResolvedValue(mockTasks),
      })

      const result = await listTasksHandler({ status: 'review' })
      const parsedResult = JSON.parse(result.content[0].text)
      expect(parsedResult.tasks).toHaveLength(1)
    })

    it('should accept a task when accept-task is called', async () => {
      const mockBoard = { id: 'board-1', mcpEnabledFunctions: { 'accept-task': true } }
      const mockColumns = [{ status: 'todo', permissions: { move: true } }]
      
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
        where: vi.fn().mockResolvedValue({}),
      })

      const result = await acceptTaskHandler({ taskId: 'task-1', agentName: 'Agent 1' })
      const parsedResult = JSON.parse(result.content[0].text)
      expect(parsedResult.message).toContain('accepted')
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
      const boardStateResource = server._registeredResources['moo-tasks://board-1/board-state']
      const boardStateHandler = boardStateResource.readCallback

      const mockTasks = [
        { id: 'task-1', status: 'todo' },
        { id: 'task-2', status: 'done' }
      ]
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockTasks),
      })

      const result = await boardStateHandler(new URL('moo-tasks://board-1/board-state'))
      const parsedContent = JSON.parse(result.contents[0].text)
      expect(parsedContent.totalTasks).toBe(2)
      expect(parsedContent.columns.todo).toHaveLength(1)
      expect(parsedContent.columns.done).toHaveLength(1)
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
      const genChangelogHandler = server._registeredTools['generate-changelog'].handler

      const mockDone = [
        { id: 'd1', title: 'Ship v1', description: 'Initial release', priority: 'high', updatedAt: new Date('2026-06-01') },
        { id: 'd2', title: 'Fix bug', description: null, priority: 'medium', updatedAt: new Date('2026-06-02') },
      ]
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockDone),
      })

      const result = await genChangelogHandler({ template: 'simple' })
      expect(result.content[0].text).toContain('# Changelog')
      expect(result.content[0].text).toContain('- Ship v1')
      expect(result.content[0].text).toContain('- Fix bug')

      // Also exercise 'detailed' template path
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockDone),
      })
      const detailed = await genChangelogHandler({ template: 'detailed' })
      expect(detailed.content[0].text).toContain('### Ship v1')
      expect(detailed.content[0].text).toContain('Initial release')
    })

    it('caches board metadata (micro-benchmark path for repeated creates; after first hit, no DB)', async () => {
      const mockBoard = {
        id: 'board-cache-test',
        mcpEnabledFunctions: { 'list-tasks': true },
        allowAiReview: false,
      }
      const mockColumns = [{ status: 'todo', permissions: { view: true } }]

      // First create populates cache (two selects)
      ;(db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockBoard]),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockColumns),
      })

      await createBoardMcpServer('board-cache-test')

      // Subsequent creates should hit cache (no more select mocks needed for this board in this test)
      const start = Date.now()
      for (let i = 0; i < 50; i++) {
        await createBoardMcpServer('board-cache-test')
      }
      const dur = Date.now() - start
      // In real env this demonstrates the win (near-zero cost on hits); invalidate in beforeEach keeps tests clean
      expect(dur).toBeLessThan(100)
    })
  })
})
