import { db } from '../db'
import { boardColumns, boards } from '../db/schema'
import { generateId } from './id'

const DEFAULT_BOARD_COLUMNS = ['backlog', 'todo', 'in_progress', 'review', 'done'] as const

export async function createBoardWithDefaultColumns(input: {
  name: string
  description?: string | null
  ownerId: string
}) {
  const now = new Date()
  const board = {
    id: generateId(),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    ownerId: input.ownerId,
    createdAt: now,
    updatedAt: now,
  }

  await db.transaction(async (tx) => {
    await tx.insert(boards).values(board)
    await tx.insert(boardColumns).values(DEFAULT_BOARD_COLUMNS.map((status, order) => ({
      id: generateId(),
      boardId: board.id,
      name: status.charAt(0).toUpperCase() + status.slice(1),
      status,
      order,
      createdAt: now,
      updatedAt: now,
    })))
  })

  return board
}