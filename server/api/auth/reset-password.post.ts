import { readBody } from 'h3'
import { eq, and, gt } from 'drizzle-orm'
import { db } from '../../db'
import { passwordResetTokens, users } from '../../db/schema'
import { hashPassword } from '../../utils/password'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const token = body?.token
  const password = body?.password

  if (!token || !password || password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input' })
  }

  const resetToken = await db.select().from(passwordResetTokens)
    .where(and(
      eq(passwordResetTokens.token, token),
      gt(passwordResetTokens.expiresAt, new Date())
    ))
    .then(res => res[0])

  if (!resetToken) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid or expired token' })
  }

  const passwordHash = await hashPassword(password)
  await db.update(users).set({ passwordHash }).where(eq(users.id, resetToken.userId))
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, resetToken.id))

  return { success: true }
})
