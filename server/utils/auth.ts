import { db } from '../db'
import { emailVerificationTokens, passwordResetTokens } from '../db/schema'
import { eq } from 'drizzle-orm'
import { generateId } from './id'

export const createEmailVerificationToken = async (userId: string) => {
  const token = generateId(32)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24) // 24 hours
  await db.insert(emailVerificationTokens).values({
    id: generateId(),
    userId,
    token,
    expiresAt,
  })
  return token
}

export const createPasswordResetToken = async (userId: string) => {
  const token = generateId(32)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60) // 1 hour
  await db.insert(passwordResetTokens).values({
    id: generateId(),
    userId,
    token,
    expiresAt,
  })
  return token
}
