<script setup lang="ts">
import type { Task } from '../../server/db/schema'
import type { TaskStatus, TaskPriority } from '../composables/useTasks'

const props = defineProps<{
  boardId: string
}>()

const emit = defineEmits<{
  close: []
}>()

const { updateTask, deleteTask } = useTasks(props.boardId)

const task = ref<Task | null>(null)
const show = ref(false)
const x = ref(0)
const y = ref(0)
const menuRef = ref<HTMLElement | null>(null)

function open(event: MouseEvent, t: Task) {
  task.value = t
  x.value = event.clientX
  y.value = event.clientY
  show.value = true
  document.addEventListener('click', close)
}

function close() {
  show.value = false
  task.value = null
  document.removeEventListener('click', close)
}

async function handleAction(action: () => Promise<void>) {
  try {
    await action()
    close()
  } catch (e) {
    console.error('Action failed', e)
  }
}

function updateStatus(status: TaskStatus) {
  if (!task.value) return
  handleAction(() => updateTask(task.value!.id, { status }))
}

function updatePriority(priority: TaskPriority) {
  if (!task.value) return
  handleAction(() => updateTask(task.value!.id, { priority }))
}

function deleteT() {
  if (!task.value || !confirm('Are you sure you want to delete this task?')) return
  handleAction(() => deleteTask(task.value!.id))
}

defineExpose({ open })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      ref="menuRef"
      class="fixed z-[100] bg-white dark:bg-surface-card rounded-lg shadow-xl border border-gray-200 dark:border-surface-border w-48 overflow-hidden"
      :style="{ left: `${x}px`, top: `${y}px` }"
      @click.stop
    >
      <div class="py-1">
        <div class="px-3 py-1.5 text-sm font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-surface-border">Status</div>
        <button v-for="s in ['backlog', 'todo', 'in_progress', 'review', 'done', 'archive'] as TaskStatus[]" :key="s"
          @click="updateStatus(s)"
          class="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-hover capitalize"
        >
          {{ s.replace('_', ' ') }}
        </button>
      </div>
      <div class="py-1 border-t border-gray-100 dark:border-surface-border">
        <div class="px-3 py-1.5 text-sm font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-surface-border">Priority</div>
        <button v-for="p in ['low', 'medium', 'high', 'critical'] as TaskPriority[]" :key="p"
          @click="updatePriority(p)"
          class="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-hover capitalize"
        >
          {{ p }}
        </button>
      </div>
      <div class="py-1 border-t border-gray-100 dark:border-surface-border">
        <button @click="deleteT" class="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">Delete Task</button>
      </div>
    </div>
  </Teleport>
</template>
