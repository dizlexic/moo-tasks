import { getRouterParam } from 'h3'
import { db } from '../../../db'
import { planTasks, plans } from '../../../db/schema'
import { eq, or, and, asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const planId = getRouterParam(event, 'id')!
  
  // Verify plan access
  const planResults = await db.select().from(plans)
    .where(and(
      eq(plans.id, planId),
      or(eq(plans.isPublic, true), eq(plans.creatorId, session.user.id))
    ))
    
  if (planResults.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Plan not found' })
  }
  
  const results = await db.select().from(planTasks)
    .where(eq(planTasks.planId, planId))
    .orderBy(asc(planTasks.order))
    
  return results
})
