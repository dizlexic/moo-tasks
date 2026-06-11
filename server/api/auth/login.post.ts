import { readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { users } from '../../db/schema'
import { comparePasswords } from '../../utils/password'
import { replaceUserSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body?.email || typeof body.email !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Email is required' })
  }
  if (!body?.password || typeof body.password !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Password is required' })
  }

  const email = body.email.trim().toLowerCase()
  let results = await db.select().from(users).where(eq(users.email, email))
  let user = results[0]
  
  if (!user) {
    // Try case-sensitive fallback just in case
    results = await db.select().from(users).where(eq(users.email, body.email.trim()))
    user = results[0]
    if (user) {
       console.log(`[Login] Found user with case-sensitive match but not lowercased: ${body.email.trim()}`)
    }
  }

  if (!user) {
    console.log(`[Login] User not found: ${email}`)
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  const valid = await comparePasswords(body.password, user.passwordHash)
  if (!valid) {
    console.log(`[Login] Password mismatch for: ${email}. Hash prefix: ${user.passwordHash.substring(0, 10)}`)
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
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
