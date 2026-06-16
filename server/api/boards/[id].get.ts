import { getRouterParam } from 'h3'
import { eq, and } from 'drizzle-orm'
import { db } from '../../db'
import { boards, boardMembers, boardTransfers } from '../../db/schema'
import { logBoardEvent } from '../../utils/logs'
import { getHeader } from 'h3'

export default defineEventHandler(async (event) => {
  console.log('Fetching board', getRouterParam(event, 'id'))
  const session = await requireUserSession(event)
  console.log('Session', session)
  const id = getRouterParam(event, 'id')!

  const boardsResult = await db.select().from(boards).where(eq(boards.id, id))
  console.log('Boards result', boardsResult)
  const board = boardsResult[0]
  if (!board) {
    throw createError({ statusCode: 404, statusMessage: 'Board not found' })
  }

  const membershipResult = await db.select().from(boardMembers)
    .where(and(eq(boardMembers.boardId, id), eq(boardMembers.userId, session.user.id)))
  console.log('Membership result', membershipResult)
  const membership = membershipResult[0]
  if (!membership) {
    throw createError({ statusCode: 403, statusMessage: 'Not a member of this board' })
  }

  const pendingTransfer = await db.select().from(boardTransfers)
    .where(and(eq(boardTransfers.boardId, id), eq(boardTransfers.status, 'pending')))
  const transfer = pendingTransfer[0]
  console.log('Transfer', transfer)

  await db.update(boardMembers)
    .set({ lastVisitedAt: new Date() })
    .where(and(eq(boardMembers.boardId, id), eq(boardMembers.userId, session.user.id)))

  await logBoardEvent({
    boardId: id,
    type: 'user_connection',
    actor: session.user.name || session.user.email,
    action: 'view',
    data: { userAgent: getHeader(event, 'user-agent') }
  })

  const { mcpToken, ...boardData } = board
  return {
    ...boardData,
    role: membership.role,
    ...(membership.role === 'owner' ? { mcpToken } : {}),
    transfer: transfer || null,
  }
})
