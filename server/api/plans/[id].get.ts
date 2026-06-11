import { getRouterParam } from 'h3'
import { db } from '../../db'
import { plans } from '../../db/schema'
import { eq, or, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')!
  
  const results = await db.select().from(plans)
    .where(and(
      eq(plans.id, id),
      or(eq(plans.isPublic, true), eq(plans.creatorId, session.user.id))
    ))
    
  const plan = results[0]
  if (!plan) {
    throw createError({ statusCode: 404, statusMessage: 'Plan not found' })
  }
    
  return plan
})
