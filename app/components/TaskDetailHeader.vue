<script setup lang="ts">
import { slugify } from '~/utils/slug'
import type { Task } from '#server/db/schema'

const props = defineProps<{
  task: Task
  boardId: string
  parentTask?: Task
}>()

const emit = defineEmits<{
  close: []
  openParent: []
}>()

const linkCopied = ref(false)

async function copyTaskLink() {
  const origin = window.location.origin
  const slug = slugify(props.task.title)
  const url = `${origin}/boards/${props.boardId}/tasks/${props.task.boardTaskId}/${slug}`
  await navigator.clipboard.writeText(url)
  linkCopied.value = true
  setTimeout(() => { linkCopied.value = false }, 2000)
}
</script>

<template>
  <div class="p-6 pb-4 border-b border-gray-100 dark:border-surface-border/50 flex items-center justify-between shrink-0">
    <div class="flex items-center gap-4">
      <h2 id="task-detail-title" class="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Task Details</h2>
      <button
        type="button"
        @click="copyTaskLink"
        class="text-sm font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-gray-200 dark:border-surface-border bg-gray-50 dark:bg-surface-raised text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-hover hover:text-neon-cyan dark:hover:text-neon-cyan transition-all flex items-center gap-1.5"
        :aria-label="linkCopied ? 'Link copied' : 'Copy task link'"
      >
        <span aria-hidden="true">{{ linkCopied ? '✓' : '🔗' }}</span>
        <span>{{ linkCopied ? 'Copied' : 'Link' }}</span>
      </button>
    </div>
    <div class="flex items-center gap-3">
      <div v-if="parentTask" @click="emit('openParent')" class="cursor-pointer text-sm font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-neon-orange/10 text-orange-600 dark:text-neon-orange border border-neon-orange/20 hover:bg-neon-orange/20 transition-all flex items-center gap-1.5 shadow-sm shadow-neon-orange/5" title="Go to parent task">
        <span aria-hidden="true">↩</span>
        <span class="truncate max-w-[120px]">Parent: {{ parentTask.title }}</span>
      </div>
      <div v-else-if="task.parentTaskId" class="text-sm font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-neon-orange/10 text-orange-600 dark:text-neon-orange border border-neon-orange/20">
        <span>↩ Correction</span>
      </div>
      <button @click="emit('close')" class="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors text-2xl leading-none p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-raised" aria-label="Close dialog">&times;</button>
    </div>
  </div>
</template>
