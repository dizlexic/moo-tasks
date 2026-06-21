import { getRouterParam, createError, defineEventHandler } from 'h3'
import { eq, and } from 'drizzle-orm'
import { db } from '../../../db'
import { boardMembers, boardTokens } from '../../../db/schema'
import { generateId } from '../../../utils/id'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')!

  // Check if user is a member
  const membershipResults = await db.select().from(boardMembers)
    .where(and(eq(boardMembers.boardId, id), eq(boardMembers.userId, session.user.id)))
  
  if (membershipResults.length === 0) {
    throw createError({ statusCode: 403, statusMessage: 'You are not a member of this board' })
  }

  const token = `mab_${generateId(32)}`
  
  // Check for existing token
  const existingToken = await db.select().from(boardTokens)
    .where(and(eq(boardTokens.boardId, id), eq(boardTokens.userId, session.user.id)))
    
  if (existingToken.length > 0) {
    // Update existing
    await db.update(boardTokens)
      .set({ token, updatedAt: new Date() })
      .where(eq(boardTokens.id, existingToken[0].id))
  } else {
    // Insert new
    await db.insert(boardTokens).values({
      id: generateId(16),
      boardId: id,
      userId: session.user.id,
      token,
      createdAt: new Date(),
      updatedAt: new Date()
    })
  }

  return { token }
})
