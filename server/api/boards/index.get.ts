import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { boards, boardMembers } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id

  const results = await db.select({
    board: boards,
    lastVisitedAt: boardMembers.lastVisitedAt,
    isFavorite: boardMembers.isFavorite,
    favoritedAt: boardMembers.favoritedAt
  })
  .from(boards)
  .innerJoin(boardMembers, eq(boards.id, boardMembers.boardId))
  .where(eq(boardMembers.userId, userId))

  return results.map(r => ({
    ...r.board,
    lastVisitedAt: r.lastVisitedAt,
    lastActivityAt: r.board.lastActivityAt,
    isFavorite: r.isFavorite,
    favoritedAt: r.favoritedAt
  }))
})
