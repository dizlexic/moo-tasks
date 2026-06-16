import { readBody, getRouterParam } from 'h3'
import { eq, and } from 'drizzle-orm'
import { db } from '../../../db'
import { boardMembers } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  
  await db.update(boardMembers)
    .set({ isFavorite: body.isFavorite, favoritedAt: body.isFavorite ? new Date() : null })
    .where(and(eq(boardMembers.boardId, id), eq(boardMembers.userId, session.user.id)))
    
  return { success: true }
})
