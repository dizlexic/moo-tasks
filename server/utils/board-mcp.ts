import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { eq, and, or, like, isNull, inArray, asc, desc, gte } from 'drizzle-orm'
import { db } from '../db'
import { tasks, comments, instructions, boards, boardColumns, users, boardMembers, tags, taskTags, plans, planTasks } from '../db/schema'
import { generateId } from './id'
import { emitTaskEvent } from './socket'
import { reorderTasks, getNextBoardTaskId } from './tasks'
import { logBoardEvent } from './logs'

async function getInstructionContent(boardId: string, type: 'agent_instructions' | 'task_workflow'): Promise<string> {
  // Try board-specific first, then fall back to global
  const boardInstrResults = await db.select().from(instructions)
    .where(and(eq(instructions.boardId, boardId), eq(instructions.type, type)))
  const boardInstr = boardInstrResults[0]
  if (boardInstr) return boardInstr.content

  const globalInstrResults = await db.select().from(instructions)
    .where(and(isNull(instructions.boardId), eq(instructions.type, type)))
  const globalInstr = globalInstrResults[0]
  return globalInstr?.content || ''
}

export const MCP_FUNCTIONS = [
  'list-tasks',
  'get-task',
  'create-task',
  'update-task-status',
  'submit-for-review',
  'request-corrections',
  'reject-task',
  'accept-task',
  'add-comment',
  'delete-task',
  'get-comments',
  'board-state',
  'agent-instructions',
  'task-workflow',
  'get-installation-instructions',
  'create-board',
  'list-plans',
  'apply-plan',
] as const

export type McpFunction = typeof MCP_FUNCTIONS[number]

// Simple in-memory TTL cache for board metadata (board row + columns/permissions/mcp config).
// Avoids repeated SELECTs on every stateless MCP request (createBoardMcpServer called per req).
// TTL keeps it fresh-ish; invalidate on mutations for correctness.
const metadataCache = new Map<string, { board: any; columns: any; expires: number }>()
const CACHE_TTL_MS = 30_000 // 30 seconds; metadata (cols, enabled funcs) rarely changes

export function invalidateBoardMetadata(boardId?: string) {
  if (boardId) {
    metadataCache.delete(boardId)
  } else {
    metadataCache.clear()
  }
}

export async function createBoardMcpServer(boardId: string): Promise<McpServer> {
  let board: any
  let columns: any

  const cached = metadataCache.get(boardId)
  if (cached && cached.expires > Date.now()) {
    board = cached.board
    columns = cached.columns
  } else {
    board = (await db.select().from(boards).where(eq(boards.id, boardId)))[0]
    if (!board) throw new Error('Board not found')
    columns = await db.select().from(boardColumns).where(eq(boardColumns.boardId, boardId))
    metadataCache.set(boardId, {
      board,
      columns,
      expires: Date.now() + CACHE_TTL_MS,
    })
  }

  const enabledFunctions = (board.mcpEnabledFunctions as Record<string, boolean>) || {}

  const getPermissions = (status: string) => {
    const column = columns.find(c => c.status === status);
    return (column?.permissions as Record<string, boolean>) || { view: true, add: true, move: true, delete: true };
  };

  const server = new McpServer({
    name: `moo-tasks-${boardId}`,
    version: '2.0.0',
  })

  console.log('Registering tool: list-tasks');
  server.tool(
    'list-tasks',
    'List tasks on this board. WHEN TO USE: To discover available tasks, check board status, or find tasks by status/priority.',
    {
      status: z.enum(['todo', 'in_progress', 'review']).optional().describe('Filter by task status'),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Filter by task priority'),
      limit: z.number().int().positive().optional().describe('Limit the number of tasks returned (default 10 for todo)'),
      offset: z.number().int().nonnegative().optional().describe('Offset for pagination (0-based)'),
    },
    async ({ status, priority, limit, offset }) => {
      if (enabledFunctions['list-tasks'] === false) throw new Error('Tool disabled')

      const getPermissions = (status: string) => {
        const column = columns.find(c => c.status === status)
        return (column?.permissions as Record<string, boolean>) || { view: true, add: true, move: true, delete: true }
      }

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'list-tasks', data: { status, priority, limit, offset } })
      
      const viewableStatuses = columns
        .filter(c => getPermissions(c.status).view)
        .map(c => c.status);

      if (status && !viewableStatuses.includes(status)) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Status not found or not viewable' }) }], isError: true }
      }

      const conditions = [
        eq(tasks.boardId, boardId),
        inArray(tasks.status, (status ? [status] : viewableStatuses) as any)
      ]
      if (priority) conditions.push(eq(tasks.priority, priority))

      let q = db.select().from(tasks).where(and(...conditions)).orderBy(tasks.order)
      const effLimit = limit || (status === 'todo' && !offset ? 10 : undefined)
      if (effLimit) q = q.limit(effLimit)
      if (offset) q = q.offset(offset)
      const result = await q

      let filteredTasks = result.filter(t => getPermissions(t.status).view !== false)

      // If limit was applied at DB but permissions filtered some, we may have fewer; clients can page with offset for full scan if needed.
      return { content: [{ type: 'text', text: JSON.stringify({ tasks: filteredTasks, count: filteredTasks.length }) }] }
    },
  )

  server.tool(
    'get-task',
    'Get full details of a task by ID.',
    { taskId: z.string().describe('The unique task ID') },
    async ({ taskId }) => {
      if (enabledFunctions['get-task'] === false) throw new Error('Tool disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'get-task', data: { taskId } })
      const taskResults = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
      const task = taskResults[0]
      if (!task) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }], isError: true }
      return { content: [{ type: 'text', text: JSON.stringify(task) }] }
    },
  )

  server.tool(
    'create-task',
    'Create a new task on this board.',
    {
      title: z.string().min(1).describe('Task title'),
      description: z.string().optional().describe('Task description'),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Task priority'),
      parentTaskId: z.string().optional().describe('Parent task ID if this is a correction/follow-up task'),
    },
    async ({ title, description, priority, parentTaskId }) => {
      if (enabledFunctions['create-task'] === false) throw new Error('Tool disabled')

      const getPermissions = (status: string) => {
        const column = columns.find(c => c.status === status)
        return (column?.permissions as Record<string, boolean>) || { view: true, add: true, move: true, delete: true }
      }

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'create-task', data: { title, priority, parentTaskId } })
      if (!getPermissions('backlog').add) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Permission denied' }) }], isError: true }

      const now = new Date()
      const boardTaskId = await getNextBoardTaskId(boardId)
      const newTask = {
        id: generateId(),
        boardId,
        title: title.trim(),
        description: description?.trim() || '',
        status: 'backlog' as const,
        priority: priority || ('medium' as const),
        order: 0,
        boardTaskId,
        assignee: null,
        parentTaskId: parentTaskId?.trim() || null,
        createdAt: now,
        updatedAt: now,
      }
      await db.insert(tasks).values(newTask)
      await reorderTasks(boardId, 'backlog', newTask.id, 0)
      emitTaskEvent(boardId, 'task:created', newTask)
      return { content: [{ type: 'text', text: JSON.stringify({ message: 'Task created', task: newTask }) }] }
    },
  )

  server.tool(
    'update-task-status',
    'Update a task\'s status.',
    {
      taskId: z.string().describe('The unique task ID'),
      status: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done']).describe('New status'),
    },
    async ({ taskId, status }) => {
      if (enabledFunctions['update-task-status'] === false) throw new Error('Tool disabled')

      const getPermissions = (status: string) => {
        const column = columns.find(c => c.status === status)
        return (column?.permissions as Record<string, boolean>) || { view: true, add: true, move: true, delete: true }
      }

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'update-task-status', data: { taskId, status } })
      const existingResults = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
      const existing = existingResults[0]
      if (!existing) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }], isError: true }
      if (!getPermissions(existing.status).move || !getPermissions(status).move) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Permission denied' }) }], isError: true }

      await db.update(tasks).set({ status, updatedAt: new Date() }).where(eq(tasks.id, taskId))
      const updatedResults = await db.select().from(tasks).where(eq(tasks.id, taskId))
      const updated = updatedResults[0]
      if (updated) emitTaskEvent(boardId, 'task:updated', updated)
      return { content: [{ type: 'text', text: JSON.stringify({ message: `Task status updated to ${status}`, task: updated }) }] }
    },
  )

  server.tool(
    'submit-for-review',
    'Submit a task for review. Moves the task to review status.',
    {
      taskId: z.string().describe('The unique task ID'),
    },
    async ({ taskId }) => {
      if (enabledFunctions['submit-for-review'] === false) throw new Error('Tool disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'submit-for-review', data: { taskId } })
      const existingResults = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
      const existing = existingResults[0]
      if (!existing) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }], isError: true }

      await db.update(tasks).set({ status: 'review', updatedAt: new Date() }).where(eq(tasks.id, taskId))
      const updatedResults = await db.select().from(tasks).where(eq(tasks.id, taskId))
      const updated = updatedResults[0]
      if (updated) emitTaskEvent(boardId, 'task:updated', updated)
      return { content: [{ type: 'text', text: JSON.stringify({ message: 'Task submitted for review', task: updated }) }] }
    },
  )

  server.tool(
    'request-corrections',
    'Create a correction task linked to a reviewed task. The original task stays in review.',
    {
      taskId: z.string().describe('The original task ID that needs corrections'),
      title: z.string().min(1).describe('Title for the correction task'),
      description: z.string().optional().describe('Description of corrections needed'),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Priority for the correction task'),
    },
    async ({ taskId, title, description, priority }) => {
      if (enabledFunctions['request-corrections'] === false) throw new Error('Tool disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'request-corrections', data: { taskId, title } })
      const existingResults = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
      const existing = existingResults[0]
      if (!existing) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Original task not found' }) }], isError: true }

      const now = new Date()
      const correctionTask = {
        id: generateId(),
        boardId,
        title: title.trim(),
        description: description?.trim() || '',
        status: 'todo' as const,
        priority: priority || existing.priority || ('medium' as const),
        order: 0,
        boardTaskId: await getNextBoardTaskId(boardId),
        assignee: null,
        parentTaskId: taskId,
        createdAt: now,
        updatedAt: now,
      }

      // Use tx for the correction insert (atomic even if extended later)
      await db.transaction(async (tx) => {
        await tx.insert(tasks).values(correctionTask)
      })
      await reorderTasks(boardId, 'todo', correctionTask.id, 0)
      emitTaskEvent(boardId, 'task:created', correctionTask)

      // Move original task back to in_progress (in tx for consistency with other mutators)
      const updatedOriginal = await db.transaction(async (tx) => {
        await tx.update(tasks).set({ status: 'in_progress', updatedAt: now }).where(eq(tasks.id, taskId))
        const updatedOriginalResults = await tx.select().from(tasks).where(eq(tasks.id, taskId))
        return updatedOriginalResults[0]
      })
      if (updatedOriginal) emitTaskEvent(boardId, 'task:updated', updatedOriginal)

      return { content: [{ type: 'text', text: JSON.stringify({ message: 'Correction task created, original moved back to in_progress', correctionTask, originalTaskId: taskId }) }] }
    },
  )

  server.tool(
    'reject-task',
    'Reject a task review and move it back to todo with a comment and correction tag. Use this for AI review.',
    {
      taskId: z.string().describe('The unique task ID'),
      reason: z.string().min(1).describe('The reason for rejection'),
    },
    async ({ taskId, reason }) => {
      if (enabledFunctions['reject-task'] === false) throw new Error('Tool disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'reject-task', data: { taskId, reason } })
      const existingResults = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
      const existing = existingResults[0]
      if (!existing) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }], isError: true }

      if (existing.status !== 'review' && existing.status !== 'in_progress') {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Only tasks in review or in_progress can be rejected' }) }], isError: true }
      }

      const now = new Date()

      // Wrap mutation sequence in a transaction for atomicity (comment + tag ensure + link + status change)
      const txResult = await db.transaction(async (tx) => {
        // 1. Add comment
        await tx.insert(comments).values({
          id: generateId(),
          taskId,
          boardId,
          author: 'AI Reviewer',
          content: `### Review Failed\n\n${reason}`,
          createdAt: now,
        })

        // 2. Ensure "correction" tag exists
        let tagResults = await tx.select().from(tags).where(and(eq(tags.boardId, boardId), eq(tags.name, 'correction')))
        let tagId = tagResults[0]?.id
        if (!tagId) {
          tagId = generateId()
          await tx.insert(tags).values({
            id: tagId,
            boardId,
            name: 'correction',
            color: '#ef4444',
            icon: 'wrench'
          })
        }

        // 3. Link tag to task
        const taskTagResults = await tx.select().from(taskTags).where(and(eq(taskTags.taskId, taskId), eq(taskTags.tagId, tagId)))
        if (taskTagResults.length === 0) {
          await tx.insert(taskTags).values({ taskId, tagId })
        }

        // 4. Move task back to todo and clear assignee
        await tx.update(tasks).set({
          status: 'todo',
          assignee: null,
          updatedAt: now
        }).where(eq(tasks.id, taskId))

        const updatedResults = await tx.select().from(tasks).where(eq(tasks.id, taskId))
        return updatedResults[0] || null
      })

      const updated = txResult
      if (updated) {
        emitTaskEvent(boardId, 'task:updated', updated)
        emitTaskEvent(boardId, 'comment:created', { taskId })
      }

      return { content: [{ type: 'text', text: JSON.stringify({ message: 'Task rejected and moved back to todo with correction tag', task: updated }) }] }
    },
  )

  server.tool(
    'accept-task',
    'Accept a task by assigning yourself and moving it to in_progress.',
    {
      taskId: z.string().describe('The unique task ID'),
      agentName: z.string().min(1).describe('Your agent name/identifier'),
    },
    async ({ taskId, agentName }) => {
      if (enabledFunctions['accept-task'] === false) throw new Error('Tool disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: agentName, action: 'accept-task', data: { taskId } })
      const existingResults = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
      const existing = existingResults[0]
      if (!existing) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }], isError: true }

      if (existing.assignee && existing.status === 'in_progress') {
        return { content: [{ type: 'text', text: JSON.stringify({ error: `Task is already accepted by ${existing.assignee}` }) }], isError: true }
      }

      if (existing.status === 'review') {
        if (!board.allowAiReview) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: 'AI Review is disabled on this board. Human review is required.' }) }], isError: true }
        }
        if (existing.isHumanOnly) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: 'This task is marked as human-only and requires human review.' }) }], isError: true }
        }
      }

      await db.update(tasks).set({ assignee: agentName.trim(), status: 'in_progress', updatedAt: new Date() }).where(eq(tasks.id, taskId))
      const updatedResults = await db.select().from(tasks).where(eq(tasks.id, taskId))
      const updated = updatedResults[0]
      if (updated) emitTaskEvent(boardId, 'task:updated', updated)
      return { content: [{ type: 'text', text: JSON.stringify({ message: `Task accepted by ${agentName}`, task: updated }) }] }
    },
  )

  server.tool(
    'add-comment',
    'Add a comment to a task.',
    {
      taskId: z.string().describe('The unique task ID'),
      author: z.string().min(1).describe('Name of the comment author'),
      content: z.string().min(1).describe('The comment text'),
    },
    async ({ taskId, author, content }) => {
      if (enabledFunctions['add-comment'] === false) throw new Error('Tool disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: author, action: 'add-comment', data: { taskId } })
      const taskResults = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
      const task = taskResults[0]
      if (!task) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }], isError: true }

      const newComment = {
        id: generateId(),
        taskId,
        boardId,
        author: author.trim(),
        content: content.trim(),
        attachment: null,
        createdAt: new Date(),
      }
      await db.insert(comments).values(newComment)
      return { content: [{ type: 'text', text: JSON.stringify({ message: 'Comment added', comment: newComment }) }] }
    },
  )

  server.tool(
    'add-comment-with-attachment',
    'Add a comment with an attachment to a task.',
    {
      taskId: z.string().describe('The unique task ID'),
      author: z.string().min(1).describe('Name of the comment author'),
      content: z.string().min(1).describe('The comment text'),
      attachmentUrl: z.string().describe('The URL of the attachment'),
      attachmentType: z.string().describe('The type of the attachment (e.g., image/png)'),
      attachmentName: z.string().optional().describe('The name of the attachment'),
    },
    async ({ taskId, author, content, attachmentUrl, attachmentType, attachmentName }) => {
      if (enabledFunctions['add-comment'] === false) throw new Error('Tool disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: author, action: 'add-comment', data: { taskId } })
      const taskResults = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
      const task = taskResults[0]
      if (!task) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }], isError: true }

      const newComment = {
        id: generateId(),
        taskId,
        boardId,
        author: author.trim(),
        content: content.trim(),
        attachment: { url: attachmentUrl, type: attachmentType, name: attachmentName || null },
        createdAt: new Date(),
      }
      await db.insert(comments).values(newComment)
      return { content: [{ type: 'text', text: JSON.stringify({ message: 'Comment added', comment: newComment }) }] }
    },
  )

  server.tool(
    'delete-task',
    'Deletes a task from the board.',
    {
      taskId: z.string().describe('The unique task ID'),
    },
    async ({ taskId }) => {
      if (enabledFunctions['delete-task'] === false) throw new Error('Tool disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'delete-task', data: { taskId } })
      const existingResults = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
      const existing = existingResults[0]
      if (!existing) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }], isError: true }
      if (getPermissions(existing.status).delete === false) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Permission denied' }) }], isError: true }

      await db.delete(tasks).where(eq(tasks.id, taskId))
      emitTaskEvent(boardId, 'task:deleted', { id: taskId, boardId })

      return { content: [{ type: 'text', text: JSON.stringify({ message: 'Task deleted', taskId }) }] }
    },
  )

  server.tool(
    'get-comments',
    'Get all comments for a task.',
    {
      taskId: z.string().describe('The unique task ID'),
      limit: z.number().int().positive().optional().describe('Limit number of comments (most recent first)'),
      offset: z.number().int().nonnegative().optional().describe('Offset for pagination'),
      since: z.string().optional().describe('ISO date string; only return comments created at/after this time (for incremental)'),
    },
    async ({ taskId, limit, offset, since }) => {
      if (enabledFunctions['get-comments'] === false) throw new Error('Tool disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'get-comments', data: { taskId, limit, offset, since } })
      const taskResults = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
      const task = taskResults[0]
      if (!task) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }], isError: true }

      const conditions: any[] = [eq(comments.taskId, taskId)]
      if (since) {
        const sinceDate = new Date(since)
        if (!isNaN(sinceDate.getTime())) conditions.push(gte(comments.createdAt, sinceDate))
      }
      let q = db.select().from(comments).where(and(...conditions)).orderBy(desc(comments.createdAt))
      if (limit) q = q.limit(limit)
      if (offset) q = q.offset(offset)
      const result = await q
      return { content: [{ type: 'text', text: JSON.stringify({ comments: result, count: result.length }) }] }
    },
  )

  server.resource(
    'board-state',
    `moo-tasks://${boardId}/board-state`,
    { description: 'Full snapshot of this board with all tasks grouped by status.', mimeType: 'application/json' },
    async () => {
      if (enabledFunctions['board-state'] === false) throw new Error('Resource disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'resource:board-state', data: {} })
      const allTasks = await db.select().from(tasks).where(eq(tasks.boardId, boardId))
      const SAMPLE = 50
      const grouped = {
        backlog: allTasks.filter(t => t.status === 'backlog').slice(0, SAMPLE),
        todo: allTasks.filter(t => t.status === 'todo').slice(0, SAMPLE),
        in_progress: allTasks.filter(t => t.status === 'in_progress').slice(0, SAMPLE),
        review: allTasks.filter(t => t.status === 'review').slice(0, SAMPLE),
        done: allTasks.filter(t => t.status === 'done').slice(0, SAMPLE),
      }
      const counts = {
        backlog: allTasks.filter(t => t.status === 'backlog').length,
        todo: allTasks.filter(t => t.status === 'todo').length,
        in_progress: allTasks.filter(t => t.status === 'in_progress').length,
        review: allTasks.filter(t => t.status === 'review').length,
        done: allTasks.filter(t => t.status === 'done').length,
      }
      return { contents: [{ uri: `moo-tasks://${boardId}/board-state`, mimeType: 'application/json', text: JSON.stringify({ totalTasks: allTasks.length, counts, columns: grouped, note: 'Per-column samples capped at 50; use list-tasks with limit/offset or status filter for full results.' }) }] }
    },
  )

  server.resource(
    'agent-instructions',
    `moo-tasks://${boardId}/agent-instructions`,
    { description: 'Workflow instructions for AI agents interacting with this board.', mimeType: 'text/plain' },
    async () => {
      if (enabledFunctions['agent-instructions'] === false) throw new Error('Resource disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'resource:agent-instructions', data: {} })
      const content = await getInstructionContent(boardId, 'agent_instructions')
      return { contents: [{ uri: `moo-tasks://${boardId}/agent-instructions`, mimeType: 'text/plain', text: content }] }
    },
  )

  server.prompt(
    'task-workflow',
    'Guided workflow for discovering and completing tasks on this board.',
    async () => {
      if (enabledFunctions['task-workflow'] === false) throw new Error('Prompt disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'prompt:task-workflow', data: {} })
      const content = await getInstructionContent(boardId, 'task_workflow')
      return { messages: [{ role: 'user', content: { type: 'text', text: content } }] }
    },
  )

  server.tool(
    'generate-changelog',
    'Generate a markdown changelog based on completed (done) tasks on this board.',
    {
      template: z.enum(['simple', 'detailed', 'priority']).optional().default('simple').describe('Changelog formatting template'),
      limit: z.number().int().positive().optional().describe('Max number of done tasks to include (default all, newest first)'),
      since: z.string().optional().describe('ISO date; only include tasks updated at/after this (incremental changelog)'),
    },
    async ({ template, limit, since }) => {
      if (enabledFunctions['generate-changelog'] === false) throw new Error('Tool disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'tool:generate-changelog', data: { template, limit, since } })
      const conditions = [eq(tasks.boardId, boardId), eq(tasks.status, 'done')]
      if (since) {
        const d = new Date(since)
        if (!isNaN(d.getTime())) conditions.push(gte(tasks.updatedAt, d))
      }
      let q = db.select().from(tasks)
        .where(and(...conditions))
        .orderBy(desc(tasks.updatedAt))
      if (limit) q = q.limit(limit)
      const doneTasks = await q

      if (doneTasks.length === 0) {
        return { content: [{ type: 'text', text: 'No tasks completed yet.' }] }
      }

      let changelog = `# Changelog - ${new Date().toLocaleDateString()}\n\n`

      if (template === 'detailed') {
        doneTasks.forEach(task => {
          changelog += `### ${task.title}\n`
          if (task.description) {
            changelog += `${task.description}\n\n`
          } else {
            changelog += '_No description provided._\n\n'
          }
        })
      } else if (template === 'priority') {
        const byPriority: Record<string, typeof doneTasks> = {
          critical: [],
          high: [],
          medium: [],
          low: []
        }
        doneTasks.forEach(task => {
          const p = task.priority || 'medium'
          byPriority[p].push(task)
        })

        const priorities = ['critical', 'high', 'medium', 'low']
        priorities.forEach(p => {
          const priorityTasks = byPriority[p]
          if (priorityTasks.length > 0) {
            changelog += `## ${p.charAt(0).toUpperCase() + p.slice(1)} Priority\n`
            priorityTasks.forEach(task => {
              changelog += `- ${task.title}\n`
            })
            changelog += '\n'
          }
        })
      } else {
        doneTasks.forEach(task => {
          changelog += `- ${task.title}\n`
        })
      }

      return { content: [{ type: 'text', text: changelog }] }
    },
  )

  server.tool(
    'create-board',
    'Create a new board on this Moo Tasks instance.',
    {
      name: z.string().min(1).describe('Board name'),
      description: z.string().optional().describe('Board description'),
    },
    async ({ name, description }) => {
      if (enabledFunctions['create-board'] === false) throw new Error('Tool disabled')

      const newBoardId = generateId()
      const now = new Date()
      const newBoard = {
        id: newBoardId,
        name: name.trim(),
        description: description?.trim() || null,
        ownerId: board.ownerId,
        createdAt: now,
        updatedAt: now,
      }

      // Wrap board + default columns creation in a tx for atomicity (no half-created boards)
      await db.transaction(async (tx) => {
        await tx.insert(boards).values(newBoard)
        
        // Also create default columns
        const columns = ['backlog', 'todo', 'in_progress', 'review', 'done']
        for (let i = 0; i < columns.length; i++) {
            await tx.insert(boardColumns).values({
            id: generateId(),
            boardId: newBoardId,
            name: columns[i].charAt(0).toUpperCase() + columns[i].slice(1),
            status: columns[i] as any,
            order: i,
            createdAt: now,
            updatedAt: now,
            })
        }
      })

      void logBoardEvent({ boardId: newBoardId, type: 'user_action', actor: 'AI Agent', action: 'board:created', data: { name } })
      
      return { content: [{ type: 'text', text: JSON.stringify({ message: 'Board created successfully', board: newBoard }) }] }
    }
  )

  server.tool(
    'get-installation-instructions',
    'Get instructions on how to install and set up Moo Tasks locally or use the cloud version.',
    {},
    async () => {
      if (enabledFunctions['get-installation-instructions'] === false) throw new Error('Tool disabled')

      const instructions = `
# Moo Tasks Installation & Setup

Moo Tasks can be run locally via Docker or used as a hosted service at https://mootasks.dev.

## 1. Cloud Version (mootasks.dev)
1. Go to https://mootasks.dev and sign up/login.
2. Create a new board on the dashboard.
3. In Board Settings, generate an MCP Token.
4. Use the provided MCP URL and Token in your AI agent's configuration.

## 2. Local Installation (Docker)
1. Clone the repository: \`git clone https://github.com/dizlexic/moo-agent-board.git\`
2. Create a \`.env\` file from \`.env.example\`.
3. Set \`NUXT_SESSION_PASSWORD\` (min 32 chars).
4. Run \`docker-compose up -d\`.
5. Access the UI at \`http://localhost:3000\`.
6. Follow the same steps as the Cloud version to create a board and connect an agent.

## 3. Local Installation (Manual)
1. Ensure you have Node.js 22+ and MySQL 8+ installed.
2. Run \`npm install\`.
3. Configure \`.env\`.
4. Run migrations: \`npm run db:migrate\`.
5. Start the server: \`npm run dev\`.

## 4. Connecting an Agent
Each board provides its own MCP endpoint. Copy the configuration snippet from Board Settings into your agent's config (e.g., \`~/.claude.json\` for Claude Code, or \`.cursor/mcp.json\` for Cursor).
`;
      return { content: [{ type: 'text', text: instructions }] }
    }
  )

  server.tool(
    'list-plans',
    'Discover available task plans (templates). Plans can be applied to a board to populate it with a set of tasks.',
    {
      search: z.string().optional().describe('Search term to filter plans by name or description'),
    },
    async ({ search }) => {
      if (enabledFunctions['list-plans'] === false) throw new Error('Tool disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'list-plans', data: { search } })
      
      const conditions = [
        or(eq(plans.isPublic, true), eq(plans.creatorId, board.ownerId))
      ]
      
      if (search) {
        conditions.push(or(
          like(plans.name, `%${search}%`),
          like(plans.description, `%${search}%`)
        ))
      }

      const results = await db.select().from(plans).where(and(...conditions))
      return { content: [{ type: 'text', text: JSON.stringify({ plans: results, count: results.length }) }] }
    }
  )

  server.tool(
    'apply-plan',
    'Apply a task plan to this board. This will create all tasks from the plan in the Todo column.',
    {
      planId: z.string().describe('The ID of the plan to apply'),
    },
    async ({ planId }) => {
      if (enabledFunctions['apply-plan'] === false) throw new Error('Tool disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'apply-plan', data: { planId } })

      const planResults = await db.select().from(plans).where(and(
        eq(plans.id, planId),
        or(eq(plans.isPublic, true), eq(plans.creatorId, board.ownerId))
      ))
      const planResult = planResults[0]
      if (!planResult) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Plan not found or not accessible' }) }], isError: true }

      // Get plan tasks
      const pTasks = await db.select().from(planTasks).where(eq(planTasks.planId, planId)).orderBy(asc(planTasks.order))
      if (pTasks.length === 0) return { content: [{ type: 'text', text: JSON.stringify({ message: 'Plan has no tasks' }) }] }

      const now = new Date()
      let nextBoardTaskId = await getNextBoardTaskId(boardId)
      
      const createdTasks: any[] = []
      // Wrap the batch inserts in a transaction for atomicity (all-or-nothing plan apply) and fewer roundtrips
      await db.transaction(async (tx) => {
        for (const pt of pTasks) {
          const newTask = {
            id: generateId(),
            boardId,
            title: pt.title,
            description: pt.description || '',
            status: 'todo' as const,
            priority: pt.priority,
            order: pt.order,
            boardTaskId: nextBoardTaskId++,
            difficulty: pt.difficulty,
            isHumanOnly: pt.isHumanOnly,
            createdAt: now,
            updatedAt: now,
          }
          await tx.insert(tasks).values(newTask)
          createdTasks.push(newTask)
        }
      })

      createdTasks.forEach(newTask => emitTaskEvent(boardId, 'task:created', newTask))

      return { content: [{ type: 'text', text: JSON.stringify({ message: `Successfully applied plan "${planResult.name}"`, count: pTasks.length }) }] }
    }
  )

  return server
}
