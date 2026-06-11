import { defineEventHandler } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { users } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  
  await db.update(users).set({ accountToken: null, updatedAt: new Date() }).where(eq(users.id, session.user.id))
  
  return { success: true }
})
