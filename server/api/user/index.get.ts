import { defineEventHandler } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { users } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  
  const userResults = await db.select().from(users).where(eq(users.id, session.user.id))
  const user = userResults[0]
  
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }
  
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    hasAccountToken: !!user.accountToken,
    // We don't return the token itself for security, only that it exists.
    // The user must generate a new one to see it.
  }
})
