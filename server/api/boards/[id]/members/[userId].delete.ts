import { getRouterParam, createError } from 'h3'
import { eq, and } from 'drizzle-orm'
import { db } from '../../../../db'
import { boardMembers, boardTokens } from '../../../../db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const boardId = getRouterParam(event, 'id')!
  const userId = getRouterParam(event, 'userId')!

  const myMembershipResult = await db.select().from(boardMembers)
    .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, session.user.id)))
  const myMembership = myMembershipResult[0]

  if (!myMembership) {
    throw createError({ statusCode: 403, statusMessage: 'Not a member of this board' })
  }

  // If trying to remove someone else, must be owner
  if (userId !== session.user.id && myMembership.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only the board owner can remove members' })
  }

  // If trying to remove yourself and you are the owner, you must delete the board instead or transfer ownership
  if (userId === session.user.id && myMembership.role === 'owner') {
    throw createError({ statusCode: 400, statusMessage: 'Owners cannot leave their own board. Delete the board instead.' })
  }

  const targetResult = await db.select().from(boardMembers)
    .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)))
  const target = targetResult[0]
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'Member not found' })
  }

  await db.delete(boardMembers)
    .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)))

  // Revoke user's board tokens
  await db.delete(boardTokens)
    .where(and(eq(boardTokens.boardId, boardId), eq(boardTokens.userId, userId)))

  return { removed: true }
})
