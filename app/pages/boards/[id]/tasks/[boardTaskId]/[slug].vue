<script setup lang="ts">
const route = useRoute()
const boardId = route.params.id as string
const boardTaskId = route.params.boardTaskId as string

const { data: task, error } = await useFetch(`/api/boards/${boardId}/tasks/by-board-id/${boardTaskId}`)

if (error.value) {
  throw createError({ statusCode: 404, statusMessage: 'Task not found' })
}

if (task.value) {
  await navigateTo(`/boards/${boardId}?taskId=${(task.value as any).id}`, { replace: true })
}
</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-surface-dark">
    <div class="text-center">
      <div class="w-12 h-12 border-4 border-neon-cyan/20 border-t-neon-cyan rounded-full animate-spin mx-auto mb-4"></div>
      <p class="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Loading Task...</p>
    </div>
  </div>
</template>
