import { db } from '../db'
import { boardLogs, boards, type NewBoardLog } from '../db/schema'
import { generateId } from './id'
import { asc, eq, inArray, lt } from 'drizzle-orm'

const lastActivityCache = new Map<string, number>()
const THROTTLE_MS = 60 * 1000 // 1 minute
const mcpRequestCache = new Map<string, number>()
const MCP_REQUEST_THROTTLE_MS = 1000
const MAX_LOG_CACHE_ENTRIES = 1000
const LOG_RETENTION_DAYS = 90
const LOG_CLEANUP_BATCH_SIZE = 1000

function setBoundedCache(cache: Map<string, number>, key: string, value: number) {
  cache.delete(key)
  cache.set(key, value)
  while (cache.size > MAX_LOG_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value
    if (oldestKey === undefined) break
    cache.delete(oldestKey)
  }
}

export async function logBoardEvent(log: Omit<NewBoardLog, 'id' | 'createdAt'>) {
  try {
    const now = Date.now()
    if (log.type === 'mcp_request') {
      const throttleKey = `${log.boardId}:${log.action}`
      const lastLogged = mcpRequestCache.get(throttleKey)
      if (lastLogged !== undefined && now - lastLogged < MCP_REQUEST_THROTTLE_MS) return
      setBoundedCache(mcpRequestCache, throttleKey, now)
    }

    await db.insert(boardLogs).values({
      id: generateId(),
      createdAt: new Date(),
      ...log
    })
    if (log.type !== 'user_connection') {
      const lastUpdate = lastActivityCache.get(log.boardId) || 0
      if (now - lastUpdate > THROTTLE_MS) {
        await db.update(boards)
          .set({ lastActivityAt: new Date() })
          .where(eq(boards.id, log.boardId))
        setBoundedCache(lastActivityCache, log.boardId, now)
      }
    }
  } catch (error) {
    console.error('Failed to log board event:', error)
  }
}

export async function cleanupOldBoardLogs(
  retentionDays = LOG_RETENTION_DAYS,
  batchSize = LOG_CLEANUP_BATCH_SIZE,
): Promise<number> {
  if (!Number.isSafeInteger(retentionDays) || retentionDays < 1) throw new Error('Retention period must be a positive integer')
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > LOG_CLEANUP_BATCH_SIZE) {
    throw new Error(`Cleanup batch size must be between 1 and ${LOG_CLEANUP_BATCH_SIZE}`)
  }

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  let deletedCount = 0
  while (true) {
    const oldLogs = await db.select({ id: boardLogs.id })
      .from(boardLogs)
      .where(lt(boardLogs.createdAt, cutoff))
      .orderBy(asc(boardLogs.createdAt))
      .limit(batchSize)
    if (oldLogs.length === 0) break

    await db.delete(boardLogs).where(inArray(boardLogs.id, oldLogs.map(log => log.id)))
    deletedCount += oldLogs.length
    if (oldLogs.length < batchSize) break
  }

  return deletedCount
}
