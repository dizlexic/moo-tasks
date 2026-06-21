import { useSession, createError } from 'h3'

/**
 * Get the user session from the cookie.
 */
export async function getUserSessionCustom(event: any) {
  const session = await _useRawSession(event)
  return session.data || { user: null }
}

/**
 * Set the user session in the cookie.
 */
export async function setUserSession(event: any, data: any) {
  const session = await _useRawSession(event)
  await session.update(data)
  return data
}

/**
 * Replace the user session with new data.
 */
export async function replaceUserSession(event: any, data: any) {
  const session = await _useRawSession(event)
  await session.clear()
  await session.update(data)
  return data
}

/**
 * Clear the user session.
 */
export async function clearUserSession(event: any) {
  const session = await _useRawSession(event)
  await session.clear()
  return true
}

/**
 * Require a user session, throws 401 if not logged in.
 */
export async function requireUserSession(event: any, opts: { statusCode?: number; message?: string } = {}) {
  const userSession = await getUserSessionCustom(event)
  if (!userSession.user) {
    throw createError({
      statusCode: opts.statusCode || 401,
      message: opts.message || 'Unauthorized',
    })
  }
  return userSession
}

/**
 * Internal helper to get the raw h3 session (sealed cookie).
 */
function _useRawSession(event: any) {
  const config = useRuntimeConfig(event)
  // @ts-ignore
  return useSession(event, {
    name: 'nuxt-session',
    password: config.session?.password || process.env.NUXT_SESSION_PASSWORD || 'default-session-password-at-least-32-chars-long',
    cookie: {
      sameSite: 'lax'
    }
  })
}
