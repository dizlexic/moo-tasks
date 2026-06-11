import { getRouterParam } from 'h3'
import { eq, and } from 'drizzle-orm'
import { db } from '../../db'
import { plans } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')!

  const results = await db.select().from(plans)
    .where(and(eq(plans.id, id), eq(plans.creatorId, session.user.id)))
  const plan = results[0]

  if (!plan) {
    throw createError({ statusCode: 404, statusMessage: 'Plan not found or you do not have permission' })
  }

  await db.delete(plans).where(eq(plans.id, id))
  
  return { success: true }
})
