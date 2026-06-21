import { getRouterParam, createError, defineEventHandler } from 'h3'
import { eq, and } from 'drizzle-orm'
import { db } from '../../../db'
import { boardTokens } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')!

  await db.delete(boardTokens)
    .where(and(eq(boardTokens.boardId, id), eq(boardTokens.userId, session.user.id)))

  return { success: true }
})
