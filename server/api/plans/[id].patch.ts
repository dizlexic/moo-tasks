import { readBody, getRouterParam } from 'h3'
import { eq, and } from 'drizzle-orm'
import { db } from '../../db'
import { plans } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  const results = await db.select().from(plans)
    .where(and(eq(plans.id, id), eq(plans.creatorId, session.user.id)))
  const plan = results[0]

  if (!plan) {
    throw createError({ statusCode: 404, statusMessage: 'Plan not found or you do not have permission' })
  }

  const updates: Record<string, any> = { updatedAt: new Date() }
  if (body.name && typeof body.name === 'string') updates.name = body.name.trim()
  if (typeof body.description === 'string') updates.description = body.description.trim()
  if (typeof body.isPublic === 'boolean') updates.isPublic = body.isPublic

  await db.update(plans).set(updates).where(eq(plans.id, id))
  
  const updatedResults = await db.select().from(plans).where(eq(plans.id, id))
  return updatedResults[0]
})
