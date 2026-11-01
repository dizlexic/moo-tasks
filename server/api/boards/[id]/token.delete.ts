import { getRouterParam } from 'h3'
import { eq, and } from 'drizzle-orm'
import { db } from '../../../db'
import { boards, boardMembers } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')!

  const membershipResults = await db.select().from(boardMembers)
    .where(and(eq(boardMembers.boardId, id), eq(boardMembers.userId, session.user.id)))
  const membership = membershipResults[0]
  if (!membership || membership.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only the board owner can manage tokens' })
  }

  await db.update(boards).set({ mcpToken: null, mcpTokenDigest: null, updatedAt: new Date() }).where(eq(boards.id, id))

  return { success: true }
})
