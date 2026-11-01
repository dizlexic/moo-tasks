import { eq, and, asc, sql, inArray } from 'drizzle-orm'
import { db } from '../db'
import { boardTaskCounters, boards, tasks } from '../db/schema'
import { emitTaskEvent } from './socket'

export async function reindexTasks(boardId: string, status: string) {
  const changedTasks = await db.transaction(async (tx) => {
    await tx.select({ id: boards.id }).from(boards).where(eq(boards.id, boardId)).for('update')
    const tasksInColumn = await tx.select({ id: tasks.id, order: tasks.order, boardTaskId: tasks.boardTaskId }).from(tasks)
      .where(and(eq(tasks.boardId, boardId), eq(tasks.status, status)))
      .orderBy(asc(tasks.order), asc(tasks.boardTaskId))
    const orderedTasks = tasksInColumn.map((task, order) => ({ ...task, order }))
    return updateChangedTaskOrders(tx, boardId, tasksInColumn, orderedTasks)
  })

  changedTasks.forEach(task => emitTaskEvent(boardId, 'task:updated', task))
}

export async function reorderTasks(boardId: string, status: string, taskId: string, newOrder: number) {
  const changedTasks = await db.transaction(async (tx) => {
    await tx.select({ id: boards.id }).from(boards).where(eq(boards.id, boardId)).for('update')
    const tasksInColumn = await tx.select({ id: tasks.id, order: tasks.order, boardTaskId: tasks.boardTaskId }).from(tasks)
      .where(and(eq(tasks.boardId, boardId), eq(tasks.status, status)))
      .orderBy(asc(tasks.order), asc(tasks.boardTaskId))

    const taskToMove = tasksInColumn.find(task => task.id === taskId)
    if (!taskToMove) return []

    const orderedTasks = tasksInColumn.filter(task => task.id !== taskId)
    orderedTasks.splice(Math.max(0, Math.min(newOrder, orderedTasks.length)), 0, taskToMove)
    return updateChangedTaskOrders(tx, boardId, tasksInColumn, orderedTasks.map((task, order) => ({ ...task, order })))
  })

  changedTasks.forEach(task => emitTaskEvent(boardId, 'task:updated', task))
}

async function updateChangedTaskOrders(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  boardId: string,
  originalTasks: { id: string; order: number }[],
  orderedTasks: { id: string; order: number }[],
) {
  const originalOrders = new Map(originalTasks.map(task => [task.id, task.order]))
  const changedTasks = orderedTasks.filter(task => originalOrders.get(task.id) !== task.order)
  if (changedTasks.length === 0) return []

  const updatedAt = new Date()
  const orderCases = changedTasks.map(task => sql`when ${task.id} then ${task.order}`)
  await tx.update(tasks)
    .set({
      order: sql<number>`case ${tasks.id} ${sql.join(orderCases, sql` `)} else ${tasks.order} end`,
      updatedAt,
    })
    .where(and(eq(tasks.boardId, boardId), inArray(tasks.id, changedTasks.map(task => task.id))))

  return tx.select().from(tasks)
    .where(and(eq(tasks.boardId, boardId), inArray(tasks.id, changedTasks.map(task => task.id))))
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
