import { readBody, getRouterParam } from 'h3'
import { db } from '../../../db'
import { tasks, planTasks, plans, boardMembers } from '../../../db/schema'
import { generateId } from '../../../utils/id'
import { eq, and, or, asc } from 'drizzle-orm'
import { getNextBoardTaskId } from '../../../utils/tasks'
import { emitTaskEvent } from '../../../utils/socket'
import { logBoardEvent } from '../../../utils/logs'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const boardId = getRouterParam(event, 'id')!
  const body = await readBody(event)

  if (!body?.planId || typeof body.planId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'planId is required' })
  }

  // Verify board membership
  const membershipResult = await db.select().from(boardMembers)
    .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, session.user.id)))
  const membership = membershipResult[0]
  if (!membership) {
    throw createError({ statusCode: 403, statusMessage: 'Not a member of this board' })
  }

  // Verify plan access
  const planResults = await db.select().from(plans)
    .where(and(
      eq(plans.id, body.planId),
      or(eq(plans.isPublic, true), eq(plans.creatorId, session.user.id))
    ))
  const plan = planResults[0]
  if (!plan) {
    throw createError({ statusCode: 404, statusMessage: 'Plan not found' })
  }

  // Get plan tasks
  const pTasks = await db.select().from(planTasks)
    .where(eq(planTasks.planId, body.planId))
    .orderBy(asc(planTasks.order))

  if (pTasks.length === 0) {
    return { success: true, message: 'Plan has no tasks' }
  }

  const now = new Date()
  let nextBoardTaskId = await getNextBoardTaskId(boardId)
  
  const createdTasks = []
  for (const pt of pTasks) {
    const newTask = {
      id: generateId(),
      boardId,
      title: pt.title,
      description: pt.description || '',
      status: 'todo',
      priority: pt.priority,
      order: pt.order,
      boardTaskId: nextBoardTaskId++,
      difficulty: pt.difficulty,
      isHumanOnly: pt.isHumanOnly,
      createdAt: now,
      updatedAt: now,
    }
    
    await db.insert(tasks).values(newTask)
    emitTaskEvent(boardId, 'task:created', newTask)
    createdTasks.push(newTask)
  }

  await logBoardEvent({
    boardId,
    type: 'user_action',
    actor: session.user.name || session.user.email,
    action: 'plan:applied',
    data: { planId: plan.id, planName: plan.name, taskCount: createdTasks.length }
  })

  return { success: true, count: createdTasks.length }
})
