import { getQuery, getRouterParam, defineEventHandler, createError } from 'h3'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../../../db'
import { boards, boardMembers, boardLogs } from '#server/db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')!
  const query = getQuery(event)
  const page = parseInt(query.page as string || '1')
  const limit = parseInt(query.limit as string || '100')
  const offset = (page - 1) * limit

  const boardsResult = await db.select().from(boards).where(eq(boards.id, id))
  const board = boardsResult[0]
  if (!board) {
    throw createError({ statusCode: 404, statusMessage: 'Board not found' })
  }

  const membershipResult = await db.select().from(boardMembers)
    .where(and(eq(boardMembers.boardId, id), eq(boardMembers.userId, session.user.id)))
  const membership = membershipResult[0]
  if (!membership) {
    throw createError({ statusCode: 403, statusMessage: 'Not a member of this board' })
  }

  return await db.select()
    .from(boardLogs)
    .where(eq(boardLogs.boardId, id))
    .orderBy(desc(boardLogs.createdAt))
    .limit(limit)
    .offset(offset)
})
