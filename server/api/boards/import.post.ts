import { readBody } from 'h3'
import { db } from '../../db'
import { boards, tasks, boardMembers } from '../../db/schema'
import { nanoid } from 'nanoid'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const body = await readBody(event)

  // Validate body
  if (!body.name || !Array.isArray(body.tasks)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid import data' })
  }

  const boardId = nanoid()
  const now = new Date()

  // Create board
  await db.insert(boards).values({
    id: boardId,
    name: body.name,
    description: body.description,
    ownerId: session.user.id,
    createdAt: now,
    updatedAt: now,
  })

  // Add owner as member
  await db.insert(boardMembers).values({
    boardId: boardId,
    userId: session.user.id,
    role: 'owner',
    joinedAt: now,
  })

  // Create tasks
  let taskCounter = 1
  for (const task of body.tasks) {
    await db.insert(tasks).values({
      id: nanoid(),
      boardId,
      title: task.title,
      description: task.description,
      status: task.status || 'backlog',
      priority: task.priority || 'medium',
      order: task.order || 0,
      boardTaskId: taskCounter++,
      assignee: task.assignee,
      parentTaskId: task.parentTaskId,
      createdAt: now,
      updatedAt: now,
    })
  }

  return { id: boardId }
})
