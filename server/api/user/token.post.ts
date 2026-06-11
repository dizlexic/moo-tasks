import { defineEventHandler, createError } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { users } from '../../db/schema'
import { nanoid } from 'nanoid'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const token = `moo_acc_${nanoid(32)}`
  
  await db.update(users).set({ accountToken: token, updatedAt: new Date() }).where(eq(users.id, session.user.id))
  
  return { token }
})
