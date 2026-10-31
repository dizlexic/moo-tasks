import { createError, readBody } from 'h3'
import { and, eq } from 'drizzle-orm'
import { db } from '../../../db'
import { boardMembers } from '../../../db/schema'
import { normalizeFavoriteBoardOrder } from '../../../utils/favorite-order'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const body = await readBody(event)
  const favorites = await db.select({ boardId: boardMembers.boardId })
    .from(boardMembers)
    .where(and(eq(boardMembers.userId, session.user.id), eq(boardMembers.isFavorite, true)))
  const boardIds = normalizeFavoriteBoardOrder(body?.boardIds, favorites.map(favorite => favorite.boardId))

  if (!boardIds) {
    throw createError({ statusCode: 400, statusMessage: 'Favorite board order must include each favorite exactly once' })
  }

  await db.transaction(async (tx) => {
    for (const [favoriteOrder, boardId] of boardIds.entries()) {
      await tx.update(boardMembers)
        .set({ favoriteOrder })
        .where(and(
          eq(boardMembers.boardId, boardId),
          eq(boardMembers.userId, session.user.id),
          eq(boardMembers.isFavorite, true)
        ))
    }
  })

  return { success: true }
})