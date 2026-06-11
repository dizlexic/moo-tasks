import { getRouterParam } from 'h3'
import { eq, and } from 'drizzle-orm'
import { db } from '../../db'
import { planTasks, plans } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')!

  // Join with plans to verify ownership
  const results = await db.select({ task: planTasks, plan: plans }).from(planTasks)
    .innerJoin(plans, eq(planTasks.planId, plans.id))
    .where(and(eq(planTasks.id, id), eq(plans.creatorId, session.user.id)))
  
  if (results.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found or you do not have permission' })
  }

  await db.delete(planTasks).where(eq(planTasks.id, id))
  
  return { success: true }
})
