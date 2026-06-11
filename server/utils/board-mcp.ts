import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { eq, and, isNull, inArray } from 'drizzle-orm'
import { db } from '../db'
import { tasks, comments, instructions, boards, boardColumns, users, boardMembers, tags, taskTags } from '../db/schema'
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
] as const

export type McpFunction = typeof MCP_FUNCTIONS[number]

export async function createBoardMcpServer(boardId: string): Promise<McpServer> {
  const board = (await db.select().from(boards).where(eq(boards.id, boardId)))[0]
  if (!board) throw new Error('Board not found')
  const enabledFunctions = (board.mcpEnabledFunctions as Record<string, boolean>) || {}

  const columns = await db.select().from(boardColumns).where(eq(boardColumns.boardId, boardId));
  const getPermissions = (status: string) => {
    const column = columns.find(c => c.status === status);
    return (column?.permissions as Record<string, boolean>) || { view: true, add: true, move: true, delete: true };
  };

  const server = new McpServer({
    name: `moo-tasks-${boardId}`,
    version: '2.0.0',
  })

  if (enabledFunctions['list-tasks'] !== false) {
    server.tool(
      'list-tasks',
      'List tasks on this board. WHEN TO USE: To discover available tasks, check board status, or find tasks by status/priority.',
      {
        status: z.enum(['todo', 'in_progress']).optional().describe('Filter by task status'),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Filter by task priority'),
      },
      async ({ status, priority }) => {
        void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'list-tasks', data: { status, priority } })
        const conditions = [
          eq(tasks.boardId, boardId),
          inArray(tasks.status, ['todo', 'in_progress'])
        ]
        if (status) conditions.push(eq(tasks.status, status))
        if (priority) conditions.push(eq(tasks.priority, priority))

        const result = await db.select().from(tasks).where(and(...conditions))
        const filteredTasks = result.filter(t => getPermissions(t.status).view !== false)
        return { content: [{ type: 'text', text: JSON.stringify({ tasks: filteredTasks, count: filteredTasks.length }) }] }
      },
    )
  }

  if (enabledFunctions['get-task'] !== false) {
    server.tool(
      'get-task',
      'Get full details of a task by ID.',
      { taskId: z.string().describe('The unique task ID') },
      async ({ taskId }) => {
        void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'get-task', data: { taskId } })
        const taskResults = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
        const task = taskResults[0]
        if (!task) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }], isError: true }
        return { content: [{ type: 'text', text: JSON.stringify(task) }] }
      },
    )
  }

  if (enabledFunctions['create-task'] !== false) {
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
  }

  if (enabledFunctions['update-task-status'] !== false) {
    server.tool(
      'update-task-status',
      'Update a task\'s status.',
      {
        taskId: z.string().describe('The unique task ID'),
        status: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done']).describe('New status'),
      },
      async ({ taskId, status }) => {
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
  }

  if (enabledFunctions['submit-for-review']) {
    server.tool(
      'submit-for-review',
      'Submit a task for review. Moves the task to review status.',
      {
        taskId: z.string().describe('The unique task ID'),
      },
      async ({ taskId }) => {
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
  }

  if (enabledFunctions['request-corrections'] !== false) {
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
        await db.insert(tasks).values(correctionTask)
        await reorderTasks(boardId, 'todo', correctionTask.id, 0)
        emitTaskEvent(boardId, 'task:created', correctionTask)

        // Move original task back to in_progress
        await db.update(tasks).set({ status: 'in_progress', updatedAt: now }).where(eq(tasks.id, taskId))
        const updatedOriginalResults = await db.select().from(tasks).where(eq(tasks.id, taskId))
        const updatedOriginal = updatedOriginalResults[0]
        if (updatedOriginal) emitTaskEvent(boardId, 'task:updated', updatedOriginal)

        return { content: [{ type: 'text', text: JSON.stringify({ message: 'Correction task created, original moved back to in_progress', correctionTask, originalTaskId: taskId }) }] }
      },
    )
  }

  if (enabledFunctions['reject-task'] !== false) {
    server.tool(
      'reject-task',
      'Reject a task review and move it back to todo with a comment and correction tag. Use this for AI review.',
      {
        taskId: z.string().describe('The unique task ID'),
        reason: z.string().min(1).describe('The reason for rejection'),
      },
      async ({ taskId, reason }) => {
        void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'reject-task', data: { taskId, reason } })
        const existingResults = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
        const existing = existingResults[0]
        if (!existing) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }], isError: true }

        if (existing.status !== 'review' && existing.status !== 'in_progress') {
          return { content: [{ type: 'text', text: JSON.stringify({ error: 'Only tasks in review or in_progress can be rejected' }) }], isError: true }
        }

        const now = new Date()

        // 1. Add comment
        await db.insert(comments).values({
          id: generateId(),
          taskId,
          boardId,
          author: 'AI Reviewer',
          content: `### Review Failed\n\n${reason}`,
          createdAt: now,
        })

        // 2. Ensure "correction" tag exists
        let tagResults = await db.select().from(tags).where(and(eq(tags.boardId, boardId), eq(tags.name, 'correction')))
        let tagId = tagResults[0]?.id
        if (!tagId) {
          tagId = generateId()
          await db.insert(tags).values({
            id: tagId,
            boardId,
            name: 'correction',
            color: '#ef4444',
            icon: 'wrench'
          })
        }

        // 3. Link tag to task
        const taskTagResults = await db.select().from(taskTags).where(and(eq(taskTags.taskId, taskId), eq(taskTags.tagId, tagId)))
        if (taskTagResults.length === 0) {
          await db.insert(taskTags).values({ taskId, tagId })
        }

        // 4. Move task back to todo and clear assignee
        await db.update(tasks).set({
          status: 'todo',
          assignee: null,
          updatedAt: now
        }).where(eq(tasks.id, taskId))

        const updatedResults = await db.select().from(tasks).where(eq(tasks.id, taskId))
        const updated = updatedResults[0]
        if (updated) {
          emitTaskEvent(boardId, 'task:updated', updated)
          emitTaskEvent(boardId, 'comment:created', { taskId })
        }

        return { content: [{ type: 'text', text: JSON.stringify({ message: 'Task rejected and moved back to todo with correction tag', task: updated }) }] }
      },
    )
  }

  if (enabledFunctions['accept-task']) {
    server.tool(
      'accept-task',
      'Accept a task by assigning yourself and moving it to in_progress.',
      {
        taskId: z.string().describe('The unique task ID'),
        agentName: z.string().min(1).describe('Your agent name/identifier'),
      },
      async ({ taskId, agentName }) => {
        void logBoardEvent({ boardId, type: 'mcp_request', actor: agentName, action: 'accept-task', data: { taskId } })
        const existingResults = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
        const existing = existingResults[0]
        if (!existing) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }], isError: true }

        if (existing.assignee && existing.status === 'in_progress') {
          return { content: [{ type: 'text', text: JSON.stringify({ error: `Task is already accepted by ${existing.assignee}` }) }], isError: true }
        }

        await db.update(tasks).set({ assignee: agentName.trim(), status: 'in_progress', updatedAt: new Date() }).where(eq(tasks.id, taskId))
        const updatedResults = await db.select().from(tasks).where(eq(tasks.id, taskId))
        const updated = updatedResults[0]
        if (updated) emitTaskEvent(boardId, 'task:updated', updated)
        return { content: [{ type: 'text', text: JSON.stringify({ message: `Task accepted by ${agentName}`, task: updated }) }] }
      },
    )
  }

  if (enabledFunctions['add-comment']) {
    server.tool(
      'add-comment',
      'Add a comment to a task.',
      {
        taskId: z.string().describe('The unique task ID'),
        author: z.string().min(1).describe('Name of the comment author'),
        content: z.string().min(1).describe('The comment text'),
      },
      async ({ taskId, author, content }) => {
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
  }

  if (enabledFunctions['delete-task'] !== false) {
    server.tool(
      'delete-task',
      'Deletes a task from the board.',
      {
        taskId: z.string().describe('The unique task ID'),
      },
      async ({ taskId }) => {
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
  }

  if (enabledFunctions['get-comments'] !== false) {
    server.tool(
      'get-comments',
      'Get all comments for a task.',
      {
        taskId: z.string().describe('The unique task ID'),
      },
      async ({ taskId }) => {
        void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'get-comments', data: { taskId } })
        const taskResults = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId)))
        const task = taskResults[0]
        if (!task) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }], isError: true }

        const result = await db.select().from(comments).where(eq(comments.taskId, taskId))
        return { content: [{ type: 'text', text: JSON.stringify({ comments: result, count: result.length }) }] }
      },
    )
  }

  if (enabledFunctions['board-state'] !== false) {
    server.resource(
      'board-state',
      `moo-tasks://${boardId}/board-state`,
      { description: 'Full snapshot of this board with all tasks grouped by status.', mimeType: 'application/json' },
      async () => {
        void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'resource:board-state', data: {} })
        const allTasks = await db.select().from(tasks).where(eq(tasks.boardId, boardId))
        const grouped = {
          backlog: allTasks.filter(t => t.status === 'backlog'),
          todo: allTasks.filter(t => t.status === 'todo'),
          in_progress: allTasks.filter(t => t.status === 'in_progress'),
          review: allTasks.filter(t => t.status === 'review'),
          done: allTasks.filter(t => t.status === 'done'),
        }
        return { contents: [{ uri: `moo-tasks://${boardId}/board-state`, mimeType: 'application/json', text: JSON.stringify({ totalTasks: allTasks.length, columns: grouped }) }] }
      },
    )
  }

  if (enabledFunctions['agent-instructions']) {
    server.resource(
      'agent-instructions',
      `moo-tasks://${boardId}/agent-instructions`,
      { description: 'Workflow instructions for AI agents interacting with this board.', mimeType: 'text/plain' },
      async () => {
        void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'resource:agent-instructions', data: {} })
        const content = await getInstructionContent(boardId, 'agent_instructions')
        return { contents: [{ uri: `moo-tasks://${boardId}/agent-instructions`, mimeType: 'text/plain', text: content }] }
      },
    )
  }

  if (enabledFunctions['task-workflow']) {
    server.prompt(
      'task-workflow',
      'Guided workflow for discovering and completing tasks on this board.',
      async () => {
        void logBoardEvent({ boardId, type: 'mcp_request', actor: 'AI Agent', action: 'prompt:task-workflow', data: {} })
        const content = await getInstructionContent(boardId, 'task_workflow')
        return { messages: [{ role: 'user', content: { type: 'text', text: content } }] }
      },
    )
  }

  if (enabledFunctions['create-board'] !== false) {
    server.tool(
      'create-board',
      'Create a new board on this Moo Tasks instance.',
      {
        name: z.string().min(1).describe('Board name'),
        description: z.string().optional().describe('Board description'),
      },
      async ({ name, description }) => {
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
        await db.insert(boards).values(newBoard)
        
        // Also create default columns
        const columns = ['backlog', 'todo', 'in_progress', 'review', 'done']
        for (let i = 0; i < columns.length; i++) {
            await db.insert(boardColumns).values({
            id: generateId(),
            boardId: newBoardId,
            name: columns[i].charAt(0).toUpperCase() + columns[i].slice(1),
            status: columns[i] as any,
            order: i,
            createdAt: now,
            updatedAt: now,
            })
        }

        void logBoardEvent({ boardId: newBoardId, type: 'user_action', actor: 'AI Agent', action: 'board:created', data: { name } })
        
        return { content: [{ type: 'text', text: JSON.stringify({ message: 'Board created successfully', board: newBoard }) }] }
      }
    )
  }

  if (enabledFunctions['get-installation-instructions'] !== false) {
    server.tool(
      'get-installation-instructions',
      'Get instructions on how to install and set up Moo Tasks locally or use the cloud version.',
      {},
      async () => {
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
  }

  return server
}
