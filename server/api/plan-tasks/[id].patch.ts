import { readBody, getRouterParam } from 'h3'
import { eq, and } from 'drizzle-orm'
import { db } from '../../db'
import { planTasks, plans } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  // Join with plans to verify ownership
  const results = await db.select({ task: planTasks, plan: plans }).from(planTasks)
    .innerJoin(plans, eq(planTasks.planId, plans.id))
    .where(and(eq(planTasks.id, id), eq(plans.creatorId, session.user.id)))
  
  if (results.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found or you do not have permission' })
  }

  const updates: Record<string, any> = { updatedAt: new Date() }
  if (body.title && typeof body.title === 'string') updates.title = body.title.trim()
  if (typeof body.description === 'string') updates.description = body.description.trim()
  if (body.priority) updates.priority = body.priority
  if (body.order !== undefined) updates.order = parseInt(body.order, 10)
  if (body.difficulty !== undefined) updates.difficulty = body.difficulty !== null ? parseInt(body.difficulty, 10) : null
  if (typeof body.isHumanOnly === 'boolean') updates.isHumanOnly = body.isHumanOnly

  if (updates.difficulty !== undefined && updates.difficulty !== null && (isNaN(updates.difficulty) || updates.difficulty < 1 || updates.difficulty > 5)) {
    throw createError({ statusCode: 400, statusMessage: 'Difficulty must be between 1 and 5' })
  }

  await db.update(planTasks).set(updates).where(eq(planTasks.id, id))
  
  const updatedResults = await db.select().from(planTasks).where(eq(planTasks.id, id))
  return updatedResults[0]
})
