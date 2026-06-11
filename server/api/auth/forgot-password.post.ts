import { readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { users } from '../../db/schema'
import { createPasswordResetToken } from '../../utils/auth'
import { getPasswordResetEmail } from '../../utils/email-templates'
import { sendEmail } from '../../utils/mailer'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const email = body?.email

  if (!email || typeof email !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Email is required' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const user = await db.select().from(users).where(eq(users.email, normalizedEmail)).then(res => res[0])

  if (!user) {
    // Return success to avoid email enumeration
    return { success: true }
  }

  const token = await createPasswordResetToken(user.id)
  const resetUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/reset-password?token=${token}`
  const emailTemplate = getPasswordResetEmail(resetUrl)
  await sendEmail(user.email, emailTemplate.subject, emailTemplate.text, emailTemplate.html)

  return { success: true }
})
