import { readBody, getRouterParam } from 'h3'
import { db } from '../../../db'
import { planTasks, plans } from '../../../db/schema'
import { generateId } from '../../../utils/id'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const planId = getRouterParam(event, 'id')!
  const body = await readBody(event)

  // Verify plan ownership
  const planResults = await db.select().from(plans)
    .where(and(eq(plans.id, planId), eq(plans.creatorId, session.user.id)))
    
  if (planResults.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Plan not found or you do not have permission' })
  }

  if (!body?.title || typeof body.title !== 'string' || !body.title.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Title is required' })
  }

  const validPriorities = ['low', 'medium', 'high', 'critical']
  const priority = body.priority && validPriorities.includes(body.priority) ? body.priority : 'medium'

  const now = new Date()
  const newTask = {
    id: generateId(),
    planId,
    title: body.title.trim(),
    description: body.description?.trim() || '',
    priority,
    order: body.order !== undefined ? parseInt(body.order, 10) : 0,
    difficulty: (body.difficulty !== undefined && body.difficulty !== null) ? parseInt(body.difficulty, 10) : null,
    isHumanOnly: !!body.isHumanOnly,
    createdAt: now,
    updatedAt: now,
  }

  if (newTask.difficulty !== null && (isNaN(newTask.difficulty) || newTask.difficulty < 1 || newTask.difficulty > 5)) {
    throw createError({ statusCode: 400, statusMessage: 'Difficulty must be between 1 and 5' })
  }

  await db.insert(planTasks).values(newTask)

  return newTask
})
