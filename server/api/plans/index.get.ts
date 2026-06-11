import { db } from '../../db'
import { plans } from '../../db/schema'
import { eq, or, desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  
  const results = await db.select().from(plans)
    .where(or(eq(plans.isPublic, true), eq(plans.creatorId, session.user.id)))
    .orderBy(desc(plans.createdAt))
    
  return results
})
