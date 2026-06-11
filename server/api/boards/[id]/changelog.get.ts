import { getRouterParam, getQuery } from 'h3'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../../../db'
import { tasks, boardMembers } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const boardId = getRouterParam(event, 'id')!

  const membership = (await db.select().from(boardMembers)
    .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, session.user.id))))[0]
  if (!membership) {
    throw createError({ statusCode: 403, statusMessage: 'Not a member of this board' })
  }

  const query = getQuery(event)
  const template = (query.template as string) || 'simple'

  const doneTasks = await db.select().from(tasks)
    .where(and(eq(tasks.boardId, boardId), eq(tasks.status, 'done')))
    .orderBy(desc(tasks.updatedAt))

  if (doneTasks.length === 0) {
    return { changelog: 'No tasks completed yet.' }
  }

  let changelog = `# Changelog - ${new Date().toLocaleDateString()}\n\n`

  if (template === 'detailed') {
    doneTasks.forEach(task => {
      changelog += `### ${task.title}\n`
      if (task.description) {
        changelog += `${task.description}\n\n`
      } else {
        changelog += '_No description provided._\n\n'
      }
    })
  } else if (template === 'priority') {
    const byPriority: Record<string, typeof doneTasks> = {
      critical: [],
      high: [],
      medium: [],
      low: []
    }
    doneTasks.forEach(task => {
      const p = task.priority || 'medium'
      byPriority[p].push(task)
    })

    const priorities = ['critical', 'high', 'medium', 'low']
    priorities.forEach(p => {
      const priorityTasks = byPriority[p]
      if (priorityTasks.length > 0) {
        changelog += `## ${p.charAt(0).toUpperCase() + p.slice(1)} Priority\n`
        priorityTasks.forEach(task => {
          changelog += `- ${task.title}\n`
        })
        changelog += '\n'
      }
    })
  } else {
    // simple
    doneTasks.forEach(task => {
      changelog += `- ${task.title}\n`
    })
  }

  return { changelog }
})
