<script setup lang="ts">
import type { Task } from '#server/db/schema'

defineProps<{
  task: Task
  corrections: Task[]
  status: string
  isCorrectionMode: boolean
}>()

const emit = defineEmits<{
  startCorrection: []
  openTask: [task: Task]
}>()
</script>

<template>
  <div v-if="status === 'review' || status === 'done' || isCorrectionMode" class="bg-gray-50 dark:bg-surface-raised/30 rounded-2xl p-5 border border-gray-100 dark:border-surface-border/30 space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="text-neon-orange" aria-hidden="true">↩</span>
        <h3 class="text-sm font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300">Corrections</h3>
      </div>
      <button
        v-if="!isCorrectionMode"
        type="button"
        @click="emit('startCorrection')"
        class="text-[10px] font-bold uppercase tracking-widest bg-neon-orange/10 text-orange-600 dark:text-neon-orange border border-neon-orange/20 px-3 py-1.5 rounded-xl hover:bg-neon-orange/20 transition-all"
      >
        Request Correction
      </button>
      <div v-else class="text-[10px] font-bold uppercase tracking-widest text-neon-orange animate-pulse">
        Correction in progress...
      </div>
    </div>

    <div v-if="corrections.length > 0" class="grid grid-cols-1 gap-2">
      <div
        v-for="c in corrections"
        :key="c.id"
        @click="emit('openTask', c)"
        class="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-raised hover:border-neon-orange/50 dark:hover:border-neon-orange/50 cursor-pointer transition-all group"
        role="button"
        :aria-label="`Open correction: ${c.title}`"
        tabindex="0"
        @keydown.enter="emit('openTask', c)"
      >
        <div class="flex items-center gap-3 overflow-hidden">
          <span class="text-neon-orange opacity-50 group-hover:opacity-100 transition-opacity" aria-hidden="true">↩</span>
          <span class="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">{{ c.title }}</span>
        </div>
        <span class="text-[9px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded bg-gray-100 dark:bg-surface-hover text-gray-500 dark:text-gray-400">{{ c.status }}</span>
      </div>
    </div>
  </div>
</template>
