import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createBoardMcpServer } from '../board-mcp'
import { db } from '../../db'

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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
        orderBy: vi.fn().mockResolvedValue(mockTasks),
      })

      const result = await listTasksHandler({ status: 'todo' })
      const parsedResult = JSON.parse(result.content[0].text)
      expect(parsedResult.tasks).toHaveLength(0)
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
  })
})
