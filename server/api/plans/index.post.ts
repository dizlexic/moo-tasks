import { readBody } from 'h3'
import { db } from '../../db'
import { plans } from '../../db/schema'
import { generateId } from '../../utils/id'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const body = await readBody(event)

  if (!body?.name || typeof body.name !== 'string' || !body.name.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Plan name is required' })
  }

  const now = new Date()
  const plan = {
    id: generateId(),
    name: body.name.trim(),
    description: body.description?.trim() || '',
    isPublic: !!body.isPublic,
    creatorId: session.user.id,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(plans).values(plan)

  return plan
})
