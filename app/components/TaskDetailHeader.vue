<script setup lang="ts">
import { slugify } from '~/utils/slug'
import { copyTextToClipboard } from '~/utils/clipboard'
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
const copyStatus = ref('')
let copyStatusTimeout: ReturnType<typeof setTimeout> | undefined
let linkCopiedTimeout: ReturnType<typeof setTimeout> | undefined

const taskUrl = computed(() => {
  const origin = window.location.origin
  const slug = slugify(props.task.title)
  return `${origin}/boards/${props.boardId}/tasks/${props.task.boardTaskId}/${slug}?taskId=${props.task.id}`
})

async function copyToClipboard(text: string) {
  const copied = await copyTextToClipboard(text)
  copyStatus.value = copied ? 'Copied!' : 'Copy failed'
  clearTimeout(copyStatusTimeout)
  copyStatusTimeout = setTimeout(() => { copyStatus.value = '' }, 2000)
  return copied
}

async function copyTaskLink() {
  linkCopied.value = await copyToClipboard(taskUrl.value)
  clearTimeout(linkCopiedTimeout)
  if (linkCopied.value) {
    linkCopiedTimeout = setTimeout(() => { linkCopied.value = false }, 2000)
  }
}
</script>

<template>
  <div class="border-b border-gray-100 dark:border-surface-border/50 flex items-center justify-between shrink-0">
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2 text-[12px] font-mono text-gray-400 content-between flex-grow">
        <span class="cursor-pointer hover:text-neon-cyan" @click="copyToClipboard(task.boardTaskId.toString())" title="Copy Board Task ID">#{{ task.boardTaskId }}</span>
        <span class="cursor-pointer hover:text-neon-cyan" @click="copyToClipboard(task.id)" title="Copy Task ID">{{ task.id }}</span>
        <span v-if="copyStatus" role="status" class="font-sans">{{ copyStatus }}</span>
      </div>
      <button
        type="button"
        @click="copyTaskLink"
        class="text-sm font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-gray-200 dark:border-surface-border bg-gray-50 dark:bg-surface-raised text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-hover hover:text-neon-cyan dark:hover:text-neon-cyan transition-all flex items-center gap-1.5"
        :aria-label="linkCopied ? 'Link copied' : 'Copy task link'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path d="M3.9 12a3.1 3.1 0 0 1 3.1-3.1h4V7H7a5 5 0 0 0 0 10h4v-1.9H7A3.1 3.1 0 0 1 3.9 12ZM8 13h8v-2H8v2Zm9-6h-4v1.9h4a3.1 3.1 0 0 1 0 6.2h-4V17h4a5 5 0 0 0 0-10Z" />
        </svg>
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
