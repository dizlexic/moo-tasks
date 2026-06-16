import type { Task } from '../../server/db/schema'

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'archive'
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export function useTasks(boardId: string) {
  const tasks = useState<Task[]>(`tasks-${boardId}`, () => [])
  const taskTags = useState<any[]>(`task-tags-${boardId}`, () => [])
  const loading = useState(`tasks-loading-${boardId}`, () => false)

  const { connect, getSocket } = useSocket()

  async function fetchTasks(q?: string) {
    loading.value = true
    try {
      const url = q ? `/api/boards/${boardId}/tasks?q=${encodeURIComponent(q)}` : `/api/boards/${boardId}/tasks`
      tasks.value = await $fetch<Task[]>(url)
    } finally {
      loading.value = false
    }
  }

  async function fetchTaskTags() {
    taskTags.value = await $fetch<any[]>(`/api/boards/${boardId}/task-tags`)
  }

  function tasksByStatus(status: TaskStatus): Task[] {
    return tasks.value
      .filter(t => t.status === status)
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
  }

  async function createTask(data: {
    title: string
    description?: string
    priority?: TaskPriority
    status?: TaskStatus
    assignee?: string
    parentTaskId?: string
    difficulty?: number
    isHumanOnly?: boolean
  }) {
    const task = await $fetch<Task>(`/api/boards/${boardId}/tasks`, { method: 'POST', body: data })
    // Optimistic update — socket event will reconcile
    const exists = tasks.value.some(t => t.id === task.id)
    if (!exists) tasks.value = [...tasks.value, task]
    return task
  }

  async function updateTask(id: string, data: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'assignee' | 'order' | 'difficulty' | 'isHumanOnly'>>) {
    const updated = await $fetch<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: data })
    const idx = tasks.value.findIndex(t => t.id === id)
    if (idx !== -1) {
      tasks.value = [...tasks.value.slice(0, idx), updated, ...tasks.value.slice(idx + 1)]
    }
    return updated
  }

  async function deleteTask(id: string) {
    await $fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    tasks.value = tasks.value.filter(t => t.id !== id)
  }

  async function archiveAllDone() {
    const doneTasks = tasks.value.filter(t => t.status === 'done')
    for (const task of doneTasks) {
      try {
        await updateTask(task.id, { status: 'archive' })
      } catch (e) {
        console.error('Failed to archive task', task.id, e)
      }
    }
  }

  async function addComment(taskId: string, content: string, attachment?: any) {
    return await $fetch(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      body: { content, attachment }
    })
  }

  async function fetchComments(taskId: string) {
    return await $fetch<any[]>(`/api/tasks/${taskId}/comments`)
  }

  async function fetchTimeline(taskId: string) {
    return await $fetch<{ comments: any[], logs: any[] }>(`/api/tasks/${taskId}/timeline`)
  }

  async function moveTask(id: string, status: TaskStatus, order: number) {
    const idx = tasks.value.findIndex(t => t.id === id)
    if (idx !== -1) {
      const oldTask = tasks.value[idx]
      tasks.value = [
        ...tasks.value.slice(0, idx),
        { ...oldTask, status, order },
        ...tasks.value.slice(idx + 1)
      ]
    }
    return updateTask(id, { status, order })
  }

  function startSocket() {
    if (!import.meta.client) return

    const socket = connect()
    socket.emit('join-board', boardId)

    socket.on('task:created', (task: Task) => {
      const exists = tasks.value.some(t => t.id === task.id)
      if (!exists) tasks.value = [...tasks.value, task]
    })

    socket.on('task:updated', (task: Task) => {
      const idx = tasks.value.findIndex(t => t.id === task.id)
      if (idx !== -1) {
        tasks.value = [...tasks.value.slice(0, idx), task, ...tasks.value.slice(idx + 1)]
      } else {
        tasks.value = [...tasks.value, task]
      }
    })

    socket.on('task:deleted', (data: { id: string }) => {
      tasks.value = tasks.value.filter(t => t.id !== data.id)
    })
  }

  function stopSocket() {
    const socket = getSocket()
    if (!socket) return

    socket.emit('leave-board', boardId)
    socket.off('task:created')
    socket.off('task:updated')
    socket.off('task:deleted')
  }

  return { tasks, taskTags, loading, fetchTasks, fetchTaskTags, tasksByStatus, createTask, updateTask, deleteTask, archiveAllDone, addComment, fetchComments, fetchTimeline, moveTask, startSocket, stopSocket }
}
