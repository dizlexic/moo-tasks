import { readBody, getRouterParam } from 'h3'
import { eq, and } from 'drizzle-orm'
import { db } from '../../db'
import { boards, boardMembers } from '../../db/schema'
import { logBoardEvent } from '../../utils/logs'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  const memberships = await db.select().from(boardMembers)
    .where(and(eq(boardMembers.boardId, id), eq(boardMembers.userId, session.user.id)))
  const membership = memberships[0]
  if (!membership || membership.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only the board owner can update it' })
  }

  const updates: Record<string, any> = { updatedAt: new Date() }
  if (body.name && typeof body.name === 'string') updates.name = body.name.trim()
  if (typeof body.description === 'string') updates.description = body.description.trim()
  if (typeof body.mcpPublic === 'boolean') updates.mcpPublic = body.mcpPublic
  if (typeof body.showTimeline === 'boolean') updates.showTimeline = body.showTimeline
  if (typeof body.allowAiReview === 'boolean') updates.allowAiReview = body.allowAiReview
  if (typeof body.allowAccountToken === 'boolean') updates.allowAccountToken = body.allowAccountToken

  await db.update(boards).set(updates).where(eq(boards.id, id))
  await logBoardEvent({
    boardId: id,
    type: 'user_action',
    actor: session.user.name || session.user.email,
    action: 'board:updated',
    data: { updates: body }
  })
  const results = await db.select().from(boards).where(eq(boards.id, id))
  return results[0]
})
