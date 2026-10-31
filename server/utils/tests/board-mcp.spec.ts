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
        orderBy: vi.fn().mockResolvedValue([{ id: 'task-1', status: 'backlog' }]),
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
        orderBy: vi.fn().mockResolvedValue(mockTasks),
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
      const mockColumns = [
        { status: 'todo', permissions: { view: true } },
        { status: 'done', permissions: { view: true } },
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
        where: vi.fn().mockResolvedValue([
          { id: 'task-1', status: 'backlog' },
          { id: 'task-2', status: 'todo' },
        ]),
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
