import { cleanupOldBoardLogs } from '../server/utils/logs'

try {
  const deletedCount = await cleanupOldBoardLogs()
  console.info(`Removed ${deletedCount} board log entries older than 90 days.`)
  process.exit(0)
} catch (error) {
  console.error('Failed to clean up old board logs:', error)
  process.exit(1)
}