<script setup lang="ts">
import type { TaskPriority, TaskStatus } from '~/composables/useTasks'

const props = defineProps<{
  boardId: string
  members: { userId: string, name: string }[]
}>()

const status = defineModel<TaskStatus>('status', { required: true })
const priority = defineModel<TaskPriority>('priority', { required: true })
const difficulty = defineModel<number>('difficulty', { required: true })
const assignee = defineModel<string>('assignee', { required: true })
const isHumanOnly = defineModel<boolean>('isHumanOnly', { required: true })
const selectedTagIds = defineModel<string[]>('selectedTagIds', { required: true })

const emit = defineEmits<{
  change: []
}>()

function onChange() {
  emit('change')
}
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <div class="space-y-1.5">
      <label for="task-status" class="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Status</label>
      <div class="relative">
        <select id="task-status" v-model="status" @change="onChange" class="w-full appearance-none border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all cursor-pointer">
          <option value="backlog">Backlog</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
          <option value="archive">Archive</option>
        </select>
        <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" aria-hidden="true">▼</div>
      </div>
    </div>
    
    <div class="space-y-1.5 flex items-end">
      <button
        type="button"
        @click="isHumanOnly = !isHumanOnly; onChange()"
        class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-raised hover:border-neon-cyan/50 transition-all w-full md:w-auto"
      >
        <span class="text-sm" aria-hidden="true">{{ isHumanOnly ? '👤' : '🤖' }}</span>
        <span class="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          {{ isHumanOnly ? 'Human only' : 'AI capable' }}
        </span>
      </button>
    </div>

    <div class="space-y-1.5">
      <label for="task-priority" class="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Priority</label>
      <div class="relative">
        <select id="task-priority" v-model="priority" @change="onChange" class="w-full appearance-none border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all cursor-pointer">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" aria-hidden="true">▼</div>
      </div>
    </div>
    
    <div class="space-y-1.5">
      <label for="task-difficulty" class="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Difficulty</label>
      <div class="relative">
        <select id="task-difficulty" v-model="difficulty" @change="onChange" class="w-full appearance-none border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all cursor-pointer">
          <option :value="1">1</option>
          <option :value="2">2</option>
          <option :value="3">3</option>
          <option :value="4">4</option>
          <option :value="5">5</option>
        </select>
        <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" aria-hidden="true">▼</div>
      </div>
    </div>

    <div class="space-y-1.5">
      <label for="task-assignee" class="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Assignee</label>
      <div class="relative">
        <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs opacity-50" aria-hidden="true">{{ isHumanOnly ? '👤' : '🤖' }}</span>
        <select v-if="isHumanOnly" v-model="assignee" id="task-assignee" @change="onChange" class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl pl-9 pr-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all">
          <option value="">Unassigned</option>
          <option v-for="member in members" :key="member.userId" :value="member.name">{{ member.name }}</option>
        </select>
        <input v-else id="task-assignee" v-model="assignee" @blur="onChange" type="text" class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl pl-9 pr-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600" placeholder="Agent name" />
      </div>
    </div>

    <div class="space-y-1.5 col-span-1 md:col-span-3">
      <label class="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Tags</label>
      <TagPicker v-model:selectedTagIds="selectedTagIds" :board-id="boardId" />
    </div>
  </div>
</template>
