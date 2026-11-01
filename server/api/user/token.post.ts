import { defineEventHandler } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { users } from '../../db/schema'
import { nanoid } from 'nanoid'
import { hashBearerToken } from '../../utils/token-digests'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const token = `moo_acc_${nanoid(32)}`
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  
  await db.update(users).set({
    accountToken: null,
    accountTokenDigest: hashBearerToken(token),
    accountTokenExpiresAt: expiresAt,
    updatedAt: new Date(),
  }).where(eq(users.id, session.user.id))
  
  return { token, expiresAt }
})
