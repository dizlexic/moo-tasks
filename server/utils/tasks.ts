import { eq, and, asc, desc, sql } from 'drizzle-orm'
import { db } from '../db'
import { boardTaskCounters, tasks } from '../db/schema'
import { emitTaskEvent } from './socket'

export async function reindexTasks(boardId: string, status: string) {
  const tasksInColumn = await db.select().from(tasks)
    .where(and(eq(tasks.boardId, boardId), eq(tasks.status, status)))
    .orderBy(asc(tasks.order), desc(tasks.createdAt))

  for (let i = 0; i < tasksInColumn.length; i++) {
    if (tasksInColumn[i].order !== i) {
      await db.update(tasks).set({ order: i, updatedAt: new Date() }).where(eq(tasks.id, tasksInColumn[i].id))
      const updated = { ...tasksInColumn[i], order: i, updatedAt: new Date() }
      emitTaskEvent(boardId, 'task:updated', updated)
    }
  }
}

export async function reorderTasks(boardId: string, status: string, taskId: string, newOrder: number) {
  const tasksInColumn = await db.select().from(tasks)
    .where(and(eq(tasks.boardId, boardId), eq(tasks.status, status)))
    .orderBy(asc(tasks.order), desc(tasks.createdAt))

  // Find the task, remove it from old list
  const taskToMove = tasksInColumn.find(t => t.id === taskId)
  const otherTasks = tasksInColumn.filter(t => t.id !== taskId)

  if (!taskToMove) return;

  // Insert at new position
  otherTasks.splice(newOrder, 0, taskToMove)

  // Update all
  for (let i = 0; i < otherTasks.length; i++) {
    if (otherTasks[i].order !== i) {
      await db.update(tasks).set({ order: i, updatedAt: new Date() }).where(eq(tasks.id, otherTasks[i].id))
      const updated = { ...otherTasks[i], order: i, updatedAt: new Date() }
      emitTaskEvent(boardId, 'task:updated', updated)
    }
  }
}

export async function getNextBoardTaskId(boardId: string): Promise<number> {
  const [nextTaskId] = await getNextBoardTaskIds(boardId, 1)
  return nextTaskId
}

export async function getNextBoardTaskIds(boardId: string, count: number): Promise<number[]> {
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new Error('Task ID reservation count must be a positive integer')
  }

  return db.transaction(async (tx) => {
    const maxResults = await tx.select({ maxId: sql<number>`max(${tasks.boardTaskId})` })
      .from(tasks)
      .where(eq(tasks.boardId, boardId))
    const maxId = Number(maxResults[0]?.maxId || 0)

    await tx.insert(boardTaskCounters).values({ boardId, lastTaskId: maxId })
      .onDuplicateKeyUpdate({ set: { lastTaskId: sql`${boardTaskCounters.lastTaskId}` } })

    const updateResult = await tx.update(boardTaskCounters)
      .set({ lastTaskId: sql`${boardTaskCounters.lastTaskId} + ${count}` })
      .where(eq(boardTaskCounters.boardId, boardId))
    if (!updateResult[0]?.affectedRows) throw new Error('Failed to reserve task IDs')

    const counterResults = await tx.select({ lastTaskId: boardTaskCounters.lastTaskId })
      .from(boardTaskCounters)
      .where(eq(boardTaskCounters.boardId, boardId))
    const allocatedThrough = Number(counterResults[0]?.lastTaskId)
    if (!Number.isSafeInteger(allocatedThrough)) throw new Error('Failed to read reserved task IDs')

    const firstTaskId = allocatedThrough - count + 1
    return Array.from({ length: count }, (_, index) => firstTaskId + index)
  })
}
