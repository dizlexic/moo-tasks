import { getRouterParam, getQuery } from 'h3'
import { eq, and } from 'drizzle-orm'
import { db } from '../../../db'
import { boards, tasks, boardMembers, comments } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')!
  const query = getQuery(event)
  const exportComments = query.exportComments !== undefined && query.exportComments !== 'false'
  const limit = query.limit ? Math.min(parseInt(query.limit as string, 10) || 1000, 5000) : undefined
  const offset = query.offset ? parseInt(query.offset as string, 10) || 0 : undefined

  // Check board existence and membership
  const boardsResult = await db.select().from(boards).where(eq(boards.id, id))
  const board = boardsResult[0]
  if (!board) {
    throw createError({ statusCode: 404, statusMessage: 'Board not found' })
  }

  const membershipResult = await db.select().from(boardMembers)
    .where(and(eq(boardMembers.boardId, id), eq(boardMembers.userId, session.user.id)))
  if (membershipResult.length === 0) {
    throw createError({ statusCode: 403, statusMessage: 'Not a member of this board' })
  }

  // Fetch tasks (with optional pagination / cap for large boards)
  let taskQuery = db.select().from(tasks).where(eq(tasks.boardId, id)).orderBy(tasks.order)
  if (limit) taskQuery = taskQuery.limit(limit)
  if (offset) taskQuery = taskQuery.offset(offset)
  const boardTasks = await taskQuery
  
  let taskComments: any[] = []
  if (exportComments) {
    // Comments not paginated here (use per-task get-comments or limit exportComments for huge boards)
    taskComments = await db.select().from(comments).where(eq(comments.boardId, id))
  }

  return {
    name: board.name,
    description: board.description,
    tasks: boardTasks.map(t => ({
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      order: t.order,
      assignee: t.assignee,
      parentTaskId: t.parentTaskId,
      comments: exportComments ? taskComments.filter(c => c.taskId === t.id) : undefined
    })),
    ...(limit || offset ? { partial: true, limit, offset } : {})
  }
})
