import { readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { users, invitations, boardMembers } from '../../db/schema'
import { generateId } from '../../utils/id'
import { hashPassword } from '../../utils/password'
import { createEmailVerificationToken } from '../../utils/auth'
import { getVerificationEmail } from '../../utils/email-templates'
import { sendEmail } from '../../utils/mailer'
import { replaceUserSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body?.email || typeof body.email !== 'string' || !body.email.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Email is required' })
  }
  if (!body?.password || typeof body.password !== 'string' || body.password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Password must be at least 8 characters' })
  }
  if (!body?.name || typeof body.name !== 'string' || !body.name.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }

  const email = body.email.trim().toLowerCase()
  const existingResults = await db.select().from(users).where(eq(users.email, email))
  const existing = existingResults[0]
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Email already registered' })
  }

  const passwordHash = await hashPassword(body.password)
  const now = new Date()
  const user = {
    id: generateId(),
    email,
    name: body.name.trim(),
    passwordHash,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(users).values(user)

  // Send verification email
  const token = await createEmailVerificationToken(user.id)
  const verificationUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/verify-email?token=${token}`
  const emailTemplate = getVerificationEmail(verificationUrl)
  await sendEmail(email, emailTemplate.subject, emailTemplate.text, emailTemplate.html)

  // Process pending invitations
  const pendingInvites = await db.select().from(invitations).where(eq(invitations.email, email))
  for (const invite of pendingInvites) {
    await db.insert(boardMembers).values({
      boardId: invite.boardId,
      userId: user.id,
      role: 'member',
      joinedAt: now,
    })
    await db.delete(invitations).where(eq(invitations.id, invite.id))
  }

  await replaceUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  })

  return { id: user.id, email: user.email, name: user.name }
})
