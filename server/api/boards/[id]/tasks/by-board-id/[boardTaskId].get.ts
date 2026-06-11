import { getRouterParam } from 'h3'
import { eq, and } from 'drizzle-orm'
import { db } from '../../../../../db'
import { tasks, boardMembers } from '../../../../../db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const boardId = getRouterParam(event, 'id')!
  const boardTaskId = parseInt(getRouterParam(event, 'boardTaskId')!, 10)

  if (isNaN(boardTaskId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid boardTaskId' })
  }

  // Verify board membership
  const membershipResult = await db.select().from(boardMembers)
    .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, session.user.id)))
  const membership = membershipResult[0]
  if (!membership) {
    throw createError({ statusCode: 403, statusMessage: 'Not a member of this board' })
  }

  const results = await db.select().from(tasks)
    .where(and(eq(tasks.boardId, boardId), eq(tasks.boardTaskId, boardTaskId)))
    
  const task = results[0]
  if (!task) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  return task
})
