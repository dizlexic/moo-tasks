import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { eq, and, or, like, isNull, inArray, asc, desc, gte, gt, lt, ne, count } from 'drizzle-orm'
import { db } from '../db'
import { tasks, comments, instructions, boards, boardColumns, users, boardMembers, tags, taskTags, plans, planTasks } from '../db/schema'
import { generateId } from './id'
import { emitTaskEvent } from './socket'
import { reorderTasks, getNextBoardTaskId, getNextBoardTaskIds } from './tasks'
import { logBoardEvent } from './logs'
import { createBoardWithDefaultColumns } from './board-creation'
import { MCP_INSTALLATION_INSTRUCTIONS } from './mcp-shared'

export { MCP_FUNCTIONS } from '#shared/mcp-capabilities'
export type { McpFunction } from '#shared/mcp-capabilities'

const MCP_MAX_PAGE_SIZE = 100
const MCP_DEFAULT_PAGE_SIZE = 50
const MCP_MAX_OFFSET = 100_000
const MCP_MAX_DESCRIPTION_LENGTH = 10_000
const MCP_MAX_COMMENT_LENGTH = 16_000
const taskIdSchema = z.string().min(1).max(191)
const taskTitleSchema = z.string().trim().min(1).max(255)
const descriptionSchema = z.string().max(MCP_MAX_DESCRIPTION_LENGTH)
const commentAuthorSchema = z.string().trim().min(1).max(255)
const commentContentSchema = z.string().min(1).max(MCP_MAX_COMMENT_LENGTH)
const isoDateTimeSchema = z.string().datetime({ offset: true })
const taskCursorSchema = z.object({ order: z.number().int(), boardTaskId: z.number().int().positive() })
const commentCursorSchema = z.object({ createdAt: isoDateTimeSchema, id: taskIdSchema })
const changelogCursorSchema = z.object({ updatedAt: isoDateTimeSchema, id: taskIdSchema })

function invalidSinceResult() {
  return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'since must be a valid ISO 8601 date-time' }) }], isError: true }
}

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

// Bounded process-local LRU for column metadata. Board settings and the metadata version are read per request.
const metadataCache = new Map<string, { version: number; columns: any; expires: number }>()
const CACHE_TTL_MS = 30_000
const METADATA_CACHE_MAX_SIZE = 500
type CachedMcpRegistration = { method: 'tool' | 'prompt' | 'resource'; args: any[] }
const registrationCache = new Map<string, { signature: string; definitions: CachedMcpRegistration[] }>()
const REGISTRATION_CACHE_MAX_SIZE = 500

export function invalidateBoardMetadata(boardId?: string) {
  if (boardId) {
    metadataCache.delete(boardId)
    registrationCache.delete(boardId)
  } else {
    metadataCache.clear()
    registrationCache.clear()
  }
}

function cacheBoardMetadata(boardId: string, version: number, columns: any) {
  metadataCache.delete(boardId)
  metadataCache.set(boardId, { version, columns, expires: Date.now() + CACHE_TTL_MS })
  while (metadataCache.size > METADATA_CACHE_MAX_SIZE) {
    const oldestBoardId = metadataCache.keys().next().value
    if (oldestBoardId === undefined) break
    metadataCache.delete(oldestBoardId)
  }
}

export async function createBoardMcpServer(boardId: string, publicReadOnly?: boolean): Promise<McpServer> {
  const board = (await db.select({
    ownerId: boards.ownerId,
    mcpPublic: boards.mcpPublic,
    mcpEnabledFunctions: boards.mcpEnabledFunctions,
    mcpMetadataVersion: boards.mcpMetadataVersion,
    allowAiReview: boards.allowAiReview,
  }).from(boards).where(eq(boards.id, boardId)))[0]
  if (!board) throw new Error('Board not found')

  let columns: any
  const cached = metadataCache.get(boardId)
  if (cached && cached.version === board.mcpMetadataVersion && cached.expires > Date.now()) {
    metadataCache.delete(boardId)
    metadataCache.set(boardId, cached)
    columns = cached.columns
  } else {
    if (cached) metadataCache.delete(boardId)
    columns = await db.select().from(boardColumns).where(eq(boardColumns.boardId, boardId))
    cacheBoardMetadata(boardId, board.mcpMetadataVersion, columns)
    registrationCache.delete(boardId)
  }

  const serverConstructionStartedAt = performance.now()
  const server = new McpServer({
    name: `moo-tasks-${boardId}`,
    version: '2.0.0',
  })
  const canRegisterWriteTools = !(publicReadOnly ?? board.mcpPublic === true)
  const definitionSignature = JSON.stringify([
    board.mcpMetadataVersion ?? 0,
    board.ownerId,
    board.allowAiReview,
    canRegisterWriteTools,
  ])
  const cachedDefinitions = registrationCache.get(boardId)
  const registrationCacheHit = cachedDefinitions?.signature === definitionSignature
  const logConstructionProfile = () => {
    if (process.env.MCP_PROFILE_SERVER_CONSTRUCTION === 'true') {
      console.info('[MCP] Board server construction and registration completed', {
        boardId,
        durationMs: Number((performance.now() - serverConstructionStartedAt).toFixed(2)),
        registrationCacheHit,
        toolCount: Object.keys((server as any)._registeredTools).length,
      })
    }
  }

  if (registrationCacheHit && cachedDefinitions) {
    registrationCache.delete(boardId)
    registrationCache.set(boardId, cachedDefinitions)
    for (const definition of cachedDefinitions.definitions) {
      ;(server as any)[definition.method](...definition.args)
    }
    logConstructionProfile()
    return server
  }

  const definitions: CachedMcpRegistration[] = []
  const registrationMethods: CachedMcpRegistration['method'][] = ['tool', 'prompt', 'resource']
  const originalRegistrationMethods = new Map<CachedMcpRegistration['method'], (...args: any[]) => unknown>()
  for (const method of registrationMethods) {
    const register = (server as any)[method].bind(server)
    originalRegistrationMethods.set(method, register)
    ;(server as any)[method] = (...args: any[]) => {
      definitions.push({ method, args })
      return register(...args)
    }
  }

  const enabledFunctions = (board.mcpEnabledFunctions as Record<string, boolean>) || {}

  type ColumnPermission = 'view' | 'add' | 'move' | 'delete'
  const defaultPermissions: Record<ColumnPermission, boolean> = { view: true, add: true, move: true, delete: true }
  const getPermissions = (status: string): Record<ColumnPermission, boolean> => {
    const column = columns.find(c => c.status === status)
    if (!column) return { view: false, add: false, move: false, delete: false }
    return { ...defaultPermissions, ...(column.permissions as Partial<Record<ColumnPermission, boolean>> || {}) }
  }
  const canViewTask = (task: { status: string }) => getPermissions(task.status).view
  const canPerformTaskAction = (task: { status: string }, permission: ColumnPermission) =>
    canViewTask(task) && getPermissions(task.status)[permission]
  const permissionDenied = () => ({
    content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Permission denied' }) }],
    isError: true,
  })
  const registerWriteTool = (register: () => void) => {
    if (canRegisterWriteTools) register()
  }

  server.tool(
    'list-tasks',
    'List task summaries on this board. Use get-task for full details. Results include count, hasMore, and nextCursor; pass nextCursor to continue. WHEN TO USE: To discover available tasks, check board status, or find tasks by status/priority.',
    {
      status: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done', 'archive']).optional().describe('Filter by task status'),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Filter by task priority'),
      limit: z.number().int().positive().max(MCP_MAX_PAGE_SIZE).optional().describe('Limit the number of tasks returned (maximum 100; default 10 for todo, 50 otherwise)'),
      offset: z.number().int().nonnegative().max(MCP_MAX_OFFSET).optional().describe('Offset for pagination (0-based; maximum 100000)'),
      cursor: taskCursorSchema.optional().describe('Continue after the last task from a previous page; preferred over offset'),
    },
    async ({ status, priority, limit, offset, cursor }) => {
      if (enabledFunctions['list-tasks'] === false) throw new Error('Tool disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'list-tasks', data: { status, priority } })
      
      const viewableStatuses = columns
        .filter(c => getPermissions(c.status).view)
        .map(c => c.status)

      if (status && !viewableStatuses.includes(status)) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Status not found or not viewable' }) }], isError: true }
      }

      const conditions = [
        eq(tasks.boardId, boardId),
        inArray(tasks.status, (status ? [status] : viewableStatuses) as any)
      ]
      if (priority) conditions.push(eq(tasks.priority, priority))
      if (cursor) {
        conditions.push(or(
          gt(tasks.order, cursor.order),
          and(eq(tasks.order, cursor.order), gt(tasks.boardTaskId, cursor.boardTaskId)),
        )!)
      }

      let q = db.select({
        id: tasks.id,
        boardId: tasks.boardId,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        order: tasks.order,
        boardTaskId: tasks.boardTaskId,
        assignee: tasks.assignee,
        parentTaskId: tasks.parentTaskId,
        difficulty: tasks.difficulty,
        isHumanOnly: tasks.isHumanOnly,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
      }).from(tasks).where(and(...conditions)).orderBy(asc(tasks.order), asc(tasks.boardTaskId))
      const effLimit = limit ?? (status === 'todo' && !offset ? 10 : MCP_DEFAULT_PAGE_SIZE)
      q = q.limit(effLimit + 1)
      if (offset) q = q.offset(offset)
      const result = await q

      const hasMore = result.length > effLimit
      const filteredTasks = result.slice(0, effLimit).filter(t => getPermissions(t.status).view !== false)
      const lastTask = filteredTasks.at(-1)

      return { content: [{ type: 'text', text: JSON.stringify({
        tasks: filteredTasks,
        count: filteredTasks.length,
        hasMore,
        nextCursor: hasMore && lastTask ? { order: lastTask.order, boardTaskId: lastTask.boardTaskId } : null,
      }) }] }
    },
  )

  server.tool(
    'get-task',
    'Get full details of a task by ID.',
    { taskId: taskIdSchema.describe('The unique task ID') },
    async ({ taskId }) => {
      if (enabledFunctions['get-task'] === false) throw new Error('Tool disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'get-task', data: { taskId } })
      const taskResults = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
      const task = taskResults[0]
      if (!task) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }], isError: true }
      if (!canViewTask(task)) return permissionDenied()
      return { content: [{ type: 'text', text: JSON.stringify(task) }] }
    },
  )

  registerWriteTool(() => server.tool(
    'create-task',
    'Create a new task on this board.',
    {
      title: taskTitleSchema.describe('Task title (maximum 255 characters)'),
      description: descriptionSchema.optional().describe('Task description (maximum 10000 characters)'),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Task priority'),
      parentTaskId: taskIdSchema.optional().describe('Parent task ID if this is a correction/follow-up task'),
    },
    async ({ title, description, priority, parentTaskId }) => {
      if (enabledFunctions['create-task'] === false) throw new Error('Tool disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'create-task', data: { priority, parentTaskId } })
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
  ))

  registerWriteTool(() => server.tool(
    'update-task-status',
    'Update a task\'s status.',
    {
      taskId: taskIdSchema.describe('The unique task ID'),
      status: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done', 'archive']).describe('New status'),
    },
    async ({ taskId, status }) => {
      if (enabledFunctions['update-task-status'] === false) throw new Error('Tool disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'update-task-status', data: { taskId, status } })
      const existingResults = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
      const existing = existingResults[0]
      if (!existing) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }], isError: true }
      if (!canPerformTaskAction(existing, 'move') || !getPermissions(status).move) return permissionDenied()

      await db.update(tasks).set({ status, updatedAt: new Date() }).where(eq(tasks.id, taskId))
      const updatedResults = await db.select().from(tasks).where(eq(tasks.id, taskId))
      const updated = updatedResults[0]
      if (updated) emitTaskEvent(boardId, 'task:updated', updated)
      return { content: [{ type: 'text', text: JSON.stringify({ message: `Task status updated to ${status}`, task: updated }) }] }
    },
  ))

  registerWriteTool(() => server.tool(
    'submit-for-review',
    'Submit a task for review. Moves the task to review status.',
    {
      taskId: taskIdSchema.describe('The unique task ID'),
    },
    async ({ taskId }) => {
      if (enabledFunctions['submit-for-review'] === false) throw new Error('Tool disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'submit-for-review', data: { taskId } })
      const existingResults = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
      const existing = existingResults[0]
      if (!existing) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }], isError: true }
      if (!canPerformTaskAction(existing, 'move') || !getPermissions('review').move) return permissionDenied()

      await db.update(tasks).set({ status: 'review', updatedAt: new Date() }).where(eq(tasks.id, taskId))
      const updatedResults = await db.select().from(tasks).where(eq(tasks.id, taskId))
      const updated = updatedResults[0]
      if (updated) emitTaskEvent(boardId, 'task:updated', updated)
      return { content: [{ type: 'text', text: JSON.stringify({ message: 'Task submitted for review', task: updated }) }] }
    },
  ))

  registerWriteTool(() => server.tool(
    'request-corrections',
    'Create a correction task linked to a reviewed task. The original task stays in review.',
    {
      taskId: taskIdSchema.describe('The original task ID that needs corrections'),
      title: taskTitleSchema.describe('Title for the correction task (maximum 255 characters)'),
      description: descriptionSchema.optional().describe('Description of corrections needed (maximum 10000 characters)'),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Priority for the correction task'),
    },
    async ({ taskId, title, description, priority }) => {
      if (enabledFunctions['request-corrections'] === false) throw new Error('Tool disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'request-corrections', data: { taskId } })
      const existingResults = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
      const existing = existingResults[0]
      if (!existing) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Original task not found' }) }], isError: true }
      if (!canViewTask(existing)
        || !getPermissions(existing.status).move
        || !getPermissions('in_progress').move
        || !getPermissions('todo').add) return permissionDenied()

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
  ))

  registerWriteTool(() => server.tool(
    'reject-task',
    'Reject a task review and move it back to todo with a comment and correction tag. Use this for AI review.',
    {
      taskId: taskIdSchema.describe('The unique task ID'),
      reason: commentContentSchema.describe('The reason for rejection (maximum 16000 characters)'),
    },
    async ({ taskId, reason }) => {
      if (enabledFunctions['reject-task'] === false) throw new Error('Tool disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'reject-task', data: { taskId } })
      const existingResults = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
      const existing = existingResults[0]
      if (!existing) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }], isError: true }
      if (!canViewTask(existing) || !getPermissions(existing.status).move || !getPermissions('todo').move) return permissionDenied()

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
  ))

  registerWriteTool(() => server.tool(
    'accept-task',
    'Accept a task by assigning yourself and moving it to in_progress.',
    {
      taskId: taskIdSchema.describe('The unique task ID'),
      agentName: z.string().trim().min(1).max(255).describe('Your agent name/identifier (maximum 255 characters)'),
    },
    async ({ taskId, agentName }) => {
      if (enabledFunctions['accept-task'] === false) throw new Error('Tool disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'accept-task', data: { taskId } })
      const existingResults = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
      const existing = existingResults[0]
      if (!existing) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }], isError: true }
      if (!canViewTask(existing) || !getPermissions(existing.status).move || !getPermissions('in_progress').move) return permissionDenied()

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

      const updateResult = await db.update(tasks)
        .set({ assignee: agentName.trim(), status: 'in_progress', updatedAt: new Date() })
        .where(and(
          eq(tasks.id, taskId),
          eq(tasks.boardId, boardId),
          eq(tasks.status, existing.status),
          or(ne(tasks.status, 'in_progress'), isNull(tasks.assignee)),
        ))
      if (!updateResult[0]?.affectedRows) {
        const currentResults = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
        const current = currentResults[0]
        if (!current) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }], isError: true }
        if (current.assignee && current.status === 'in_progress') {
          return { content: [{ type: 'text', text: JSON.stringify({ error: `Task is already accepted by ${current.assignee}` }) }], isError: true }
        }
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task could not be accepted because it changed. Please retry.' }) }], isError: true }
      }

      const updatedResults = await db.select().from(tasks).where(eq(tasks.id, taskId))
      const updated = updatedResults[0]
      if (updated) emitTaskEvent(boardId, 'task:updated', updated)
      return { content: [{ type: 'text', text: JSON.stringify({ message: `Task accepted by ${agentName}`, task: updated }) }] }
    },
  ))

  registerWriteTool(() => server.tool(
    'add-comment',
    'Add a comment to a task.',
    {
      taskId: taskIdSchema.describe('The unique task ID'),
      author: commentAuthorSchema.describe('Name of the comment author (maximum 255 characters)'),
      content: commentContentSchema.describe('The comment text (maximum 16000 characters)'),
    },
    async ({ taskId, author, content }) => {
      if (enabledFunctions['add-comment'] === false) throw new Error('Tool disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'add-comment', data: { taskId } })
      const taskResults = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
      const task = taskResults[0]
      if (!task) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }], isError: true }
      if (!canViewTask(task)) return permissionDenied()

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
  ))

  registerWriteTool(() => server.tool(
    'add-comment-with-attachment',
    'Add a comment with an attachment to a task.',
    {
      taskId: taskIdSchema.describe('The unique task ID'),
      author: commentAuthorSchema.describe('Name of the comment author (maximum 255 characters)'),
      content: commentContentSchema.describe('The comment text (maximum 16000 characters)'),
      attachmentUrl: z.string().max(2048).describe('The URL of the attachment (maximum 2048 characters)'),
      attachmentType: z.string().min(1).max(255).describe('The type of the attachment (e.g., image/png; maximum 255 characters)'),
      attachmentName: z.string().max(255).optional().describe('The name of the attachment (maximum 255 characters)'),
    },
    async ({ taskId, author, content, attachmentUrl, attachmentType, attachmentName }) => {
      if (enabledFunctions['add-comment'] === false || enabledFunctions['add-comment-with-attachment'] === false) throw new Error('Tool disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'add-comment', data: { taskId } })
      const taskResults = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
      const task = taskResults[0]
      if (!task) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }], isError: true }
      if (!canViewTask(task)) return permissionDenied()

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
  ))

  registerWriteTool(() => server.tool(
    'delete-task',
    'Deletes a task from the board.',
    {
      taskId: taskIdSchema.describe('The unique task ID'),
    },
    async ({ taskId }) => {
      if (enabledFunctions['delete-task'] === false) throw new Error('Tool disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'delete-task', data: { taskId } })
      const existingResults = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
      const existing = existingResults[0]
      if (!existing) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }], isError: true }
      if (!canPerformTaskAction(existing, 'delete')) return permissionDenied()

      await db.delete(tasks).where(eq(tasks.id, taskId))
      emitTaskEvent(boardId, 'task:deleted', { id: taskId, boardId })

      return { content: [{ type: 'text', text: JSON.stringify({ message: 'Task deleted', taskId }) }] }
    },
  ))

  server.tool(
    'get-comments',
    'Get all comments for a task.',
    {
      taskId: taskIdSchema.describe('The unique task ID'),
      limit: z.number().int().positive().max(MCP_MAX_PAGE_SIZE).optional().describe('Limit number of comments (maximum 100; default 50, most recent first)'),
      offset: z.number().int().nonnegative().max(MCP_MAX_OFFSET).optional().describe('Offset for pagination (maximum 100000)'),
      since: isoDateTimeSchema.optional().describe('ISO 8601 date-time; only return comments created at/after this time (for incremental)'),
      cursor: commentCursorSchema.optional().describe('Continue after the last comment from a previous page; preferred over offset'),
    },
    async ({ taskId, limit, offset, since, cursor }) => {
      if (enabledFunctions['get-comments'] === false) throw new Error('Tool disabled')
      if (since && !isoDateTimeSchema.safeParse(since).success) return invalidSinceResult()

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'get-comments', data: { taskId } })
      const taskResults = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
      const task = taskResults[0]
      if (!task) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }], isError: true }
      if (!canViewTask(task)) return permissionDenied()

      const conditions: any[] = [eq(comments.taskId, taskId)]
      if (since) conditions.push(gte(comments.createdAt, new Date(since)))
      if (cursor) {
        conditions.push(or(
          lt(comments.createdAt, new Date(cursor.createdAt)),
          and(eq(comments.createdAt, new Date(cursor.createdAt)), lt(comments.id, cursor.id)),
        )!)
      }
      const pageSize = limit ?? MCP_DEFAULT_PAGE_SIZE
      let q = db.select({
        id: comments.id,
        taskId: comments.taskId,
        boardId: comments.boardId,
        author: comments.author,
        content: comments.content,
        attachment: comments.attachment,
        createdAt: comments.createdAt,
      }).from(comments).where(and(...conditions)).orderBy(desc(comments.createdAt), desc(comments.id))
      q = q.limit(pageSize + 1)
      if (offset) q = q.offset(offset)
      const result = await q
      const hasMore = result.length > pageSize
      const page = result.slice(0, pageSize)
      const lastComment = page.at(-1)
      return { content: [{ type: 'text', text: JSON.stringify({
        comments: page,
        count: page.length,
        hasMore,
        nextCursor: hasMore && lastComment ? { createdAt: lastComment.createdAt, id: lastComment.id } : null,
      }) }] }
    },
  )

  server.resource(
    'board-state',
    `moo-tasks://${boardId}/board-state`,
    { description: 'JSON fields: totalTasks (visible task count), statusOrder (all statuses), counts (one count per status; zero for hidden or empty statuses), columns (visible samples ordered by order then boardTaskId), and sampleLimit (50).', mimeType: 'application/json' },
    async () => {
      if (enabledFunctions['board-state'] === false) throw new Error('Resource disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'resource:board-state', data: {} })
      const SAMPLE = 50
      const viewableStatuses = columns.filter(column => getPermissions(column.status).view).map(column => column.status)
      const statusNames = ['backlog', 'todo', 'in_progress', 'review', 'done', 'archive'] as const
      const grouped: Record<string, any[]> = Object.fromEntries(statusNames.map(status => [status, []]))
      const counts: Record<string, number> = Object.fromEntries(statusNames.map(status => [status, 0]))

      if (viewableStatuses.length > 0) {
        const countRows = await db.select({ status: tasks.status, total: count() })
          .from(tasks)
          .where(and(eq(tasks.boardId, boardId), inArray(tasks.status, viewableStatuses as any)))
          .groupBy(tasks.status)
        for (const row of countRows) counts[row.status] = row.total

        await Promise.all(viewableStatuses.map(async (status) => {
          grouped[status] = await db.select({
            id: tasks.id,
            boardId: tasks.boardId,
            title: tasks.title,
            status: tasks.status,
            priority: tasks.priority,
            order: tasks.order,
            boardTaskId: tasks.boardTaskId,
            assignee: tasks.assignee,
            parentTaskId: tasks.parentTaskId,
            difficulty: tasks.difficulty,
            isHumanOnly: tasks.isHumanOnly,
            createdAt: tasks.createdAt,
            updatedAt: tasks.updatedAt,
          }).from(tasks)
            .where(and(eq(tasks.boardId, boardId), eq(tasks.status, status as any)))
            .orderBy(asc(tasks.order), asc(tasks.boardTaskId))
            .limit(SAMPLE)
        }))
      }

      const totalTasks = Object.values(counts).reduce((total, statusCount) => total + statusCount, 0)
      return { contents: [{ uri: `moo-tasks://${boardId}/board-state`, mimeType: 'application/json', text: JSON.stringify({
        totalTasks,
        statusOrder: statusNames,
        counts,
        columns: grouped,
        sampleLimit: SAMPLE,
        note: 'counts contains every status in statusOrder, including zero and non-viewable statuses; columns contains deterministic samples for visible statuses only. Samples are capped at sampleLimit; use list-tasks with nextCursor or a status filter for complete results.',
      }) }] }
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
      limit: z.number().int().positive().max(MCP_MAX_PAGE_SIZE).optional().describe('Max number of done tasks to include (maximum 100; default 100, newest first)'),
      since: isoDateTimeSchema.optional().describe('ISO 8601 date-time; only include tasks updated at/after this (incremental changelog)'),
      cursor: changelogCursorSchema.optional().describe('Continue after the last task from a previous changelog page'),
    },
    async ({ template, limit, since, cursor }) => {
      if (enabledFunctions['generate-changelog'] === false) throw new Error('Tool disabled')
      if (since && !isoDateTimeSchema.safeParse(since).success) return invalidSinceResult()

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'tool:generate-changelog', data: { template, limit, since } })
      if (!getPermissions('done').view) return { content: [{ type: 'text', text: 'No tasks completed yet.' }] }
      const conditions = [eq(tasks.boardId, boardId), eq(tasks.status, 'done')]
      if (since) conditions.push(gte(tasks.updatedAt, new Date(since)))
      if (cursor) {
        const cursorDate = new Date(cursor.updatedAt)
        conditions.push(or(
          lt(tasks.updatedAt, cursorDate),
          and(eq(tasks.updatedAt, cursorDate), lt(tasks.id, cursor.id)),
        )!)
      }
      const pageSize = limit ?? MCP_MAX_PAGE_SIZE
      let q = db.select({ id: tasks.id, title: tasks.title, description: tasks.description, priority: tasks.priority, updatedAt: tasks.updatedAt })
        .from(tasks)
        .where(and(...conditions))
        .orderBy(desc(tasks.updatedAt), desc(tasks.id))
      q = q.limit(pageSize + 1)
      const queryResults = await q
      const hasMore = queryResults.length > pageSize
      const doneTasks = queryResults.slice(0, pageSize)
      const lastTask = doneTasks.at(-1)

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

      if (hasMore && lastTask) {
        const nextCursor = { updatedAt: lastTask.updatedAt, id: lastTask.id }
        changelog += `\n---\nMore completed tasks are available. Continue with cursor: ${JSON.stringify(nextCursor)}\n`
      }

      return { content: [{ type: 'text', text: changelog }] }
    },
  )

  registerWriteTool(() => server.tool(
    'create-board',
    'Create a new board on this Moo Tasks instance.',
    {
      name: z.string().trim().min(1).max(255).describe('Board name (maximum 255 characters)'),
      description: descriptionSchema.optional().describe('Board description (maximum 10000 characters)'),
    },
    async ({ name, description }) => {
      if (enabledFunctions['create-board'] === false) throw new Error('Tool disabled')

      const newBoard = await createBoardWithDefaultColumns({ name, description, ownerId: board.ownerId })

      void logBoardEvent({ boardId: newBoard.id, type: 'user_action', actor: 'AI Agent', action: 'board:created' })
      
      return { content: [{ type: 'text', text: JSON.stringify({ message: 'Board created successfully', board: newBoard }) }] }
    }
  ))

  server.tool(
    'get-installation-instructions',
    'Get instructions on how to install and set up Moo Tasks locally or use the cloud version.',
    {},
    async () => {
      if (enabledFunctions['get-installation-instructions'] === false) throw new Error('Tool disabled')

      return { content: [{ type: 'text', text: MCP_INSTALLATION_INSTRUCTIONS }] }
    }
  )

  server.tool(
    'list-plans',
    'Discover available task plans (templates). Plans can be applied to a board to populate it with a set of tasks.',
    {
      search: z.string().max(255).optional().describe('Search term to filter plans by name or description (maximum 255 characters)'),
      limit: z.number().int().positive().max(MCP_MAX_PAGE_SIZE).optional().describe('Maximum number of plans to return (default 50)'),
    },
    async ({ search, limit }) => {
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

      const results = await db.select().from(plans).where(and(...conditions)).limit(limit ?? MCP_DEFAULT_PAGE_SIZE)
      return { content: [{ type: 'text', text: JSON.stringify({ plans: results, count: results.length }) }] }
    }
  )

  registerWriteTool(() => server.tool(
    'apply-plan',
    'Apply a task plan to this board. This will create all tasks from the plan in the Todo column.',
    {
      planId: taskIdSchema.describe('The ID of the plan to apply'),
    },
    async ({ planId }) => {
      if (enabledFunctions['apply-plan'] === false) throw new Error('Tool disabled')

      void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'apply-plan', data: { planId } })
      if (!getPermissions('todo').add) return permissionDenied()

      const planResults = await db.select().from(plans).where(and(
        eq(plans.id, planId),
        or(eq(plans.isPublic, true), eq(plans.creatorId, board.ownerId))
      ))
      const planResult = planResults[0]
      if (!planResult) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Plan not found or not accessible' }) }], isError: true }

      // Get plan tasks
      const pTasks = await db.select().from(planTasks).where(eq(planTasks.planId, planId)).orderBy(asc(planTasks.order))
      if (pTasks.length === 0) return { content: [{ type: 'text', text: JSON.stringify({ message: 'Plan has no tasks' }) }] }
      if (pTasks.length > MCP_MAX_PAGE_SIZE) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: `Plan exceeds the maximum batch size of ${MCP_MAX_PAGE_SIZE} tasks` }) }], isError: true }
      }

      const now = new Date()
      const boardTaskIds = await getNextBoardTaskIds(boardId, pTasks.length)
      
      const createdTasks: any[] = []
      // Wrap the batch inserts in a transaction for atomicity (all-or-nothing plan apply) and fewer roundtrips
      await db.transaction(async (tx) => {
        for (const [index, pt] of pTasks.entries()) {
          const newTask = {
            id: generateId(),
            boardId,
            title: pt.title,
            description: pt.description || '',
            status: 'todo' as const,
            priority: pt.priority,
            order: pt.order,
            boardTaskId: boardTaskIds[index],
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
  ))

  registrationCache.set(boardId, { signature: definitionSignature, definitions })
  while (registrationCache.size > REGISTRATION_CACHE_MAX_SIZE) {
    const oldestBoardId = registrationCache.keys().next().value
    if (oldestBoardId === undefined) break
    registrationCache.delete(oldestBoardId)
  }
  for (const [method, register] of originalRegistrationMethods) {
    ;(server as any)[method] = register
  }

  logConstructionProfile()
  return server
}
