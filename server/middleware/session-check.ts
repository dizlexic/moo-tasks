import { eq } from 'drizzle-orm'
import { db } from '../db'
import { users } from '../db/schema'
import { getUserSessionCustom, clearUserSessionCustom } from '../lib/session'

export default defineEventHandler(async (event) => {
  // Only check for API and page requests, skip static assets if they go through h3
  if (event.path.startsWith('/_nuxt') || event.path.startsWith('/__') || event.path.startsWith('/_ws')) return

  const session = await getUserSessionCustom(event)

  if (session?.user?.id) {
    const results = await db.select().from(users).where(eq(users.id, (session.user as any).id))
    const user = results[0]
    if (!user) {
      // User in session but not in database.
      // This happens if the database was reset but the cookie remains.
      await clearUserSessionCustom(event)
    }
  }
})
