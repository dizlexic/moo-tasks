import { db } from './index'
import { tasks, users, boards, boardColumns } from './schema'
import { nanoid } from 'nanoid'

const sampleTasks = [
  { title: 'Set up CI/CD pipeline', description: 'Configure GitHub Actions for automated testing and deployment.', status: 'backlog' as const, priority: 'medium' as const },
  { title: 'Write API documentation', description: 'Document all REST endpoints with request/response examples.', status: 'todo' as const, priority: 'high' as const },
  { title: 'Add input validation', description: 'Add Zod validation to all API route inputs.', status: 'todo' as const, priority: 'medium' as const },
  { title: 'Implement dark mode', description: 'Add dark mode toggle with Tailwind CSS dark variant.', status: 'backlog' as const, priority: 'low' as const },
  { title: 'Fix task card overflow', description: 'Long task titles overflow the card boundary on mobile.', status: 'in_progress' as const, priority: 'high' as const, assignee: 'claude' },
  { title: 'Initial project setup', description: 'Scaffold Nuxt app with Tailwind CSS and SQLite.', status: 'done' as const, priority: 'critical' as const },
]

async function seed() {
  const now = new Date()
  console.log('Seeding database...')

  const userId = nanoid(12)
  const boardId = 'seed-board-id'

  await db.insert(users).values({
    id: userId,
    email: 'admin@mootasks.dev',
    name: 'Admin',
    passwordHash: 'dummy',
    createdAt: now,
    updatedAt: now,
  })

  await db.insert(boards).values({
    id: boardId,
    name: 'Seed Board',
    ownerId: userId,
    createdAt: now,
    updatedAt: now,
  })

  const columns = ['backlog', 'todo', 'in_progress', 'review', 'done']
  for (let i = 0; i < columns.length; i++) {
    await db.insert(boardColumns).values({
      id: nanoid(12),
      boardId: boardId,
      name: columns[i].charAt(0).toUpperCase() + columns[i].slice(1),
      status: columns[i] as any,
      order: i,
      createdAt: now,
      updatedAt: now,
    })
  }

  let taskCounter = 1
  for (const task of sampleTasks) {
    await db.insert(tasks).values({
      id: nanoid(12),
      boardId: boardId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      boardTaskId: taskCounter++,
      assignee: task.assignee || null,
      createdAt: now,
      updatedAt: now,
    })
  }

  console.log(`Seeded ${sampleTasks.length} sample tasks.`)
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
