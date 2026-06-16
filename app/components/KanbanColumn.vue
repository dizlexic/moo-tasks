<script setup lang="ts">
import draggable from 'vuedraggable'
import type { Task, Tag, TaskTag } from '../../server/db/schema'
import { COLUMN_COLORS } from '../utils/task-constants'
import { onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  title: string
  status: string
  tasks: Task[]
  tags: Tag[]
  taskTags: TaskTag[]
}>()

const emit = defineEmits<{
  taskMoved: [taskId: string, newStatus: string, newIndex: number]
  taskClick: [task: Task]
  contextmenu: [event: MouseEvent, task: Task]
  archiveAll: []
  openMassAction: [taskIds: string[]]
  generateChangelog: []
}>()

const localTasks = ref<Task[]>([...props.tasks])
watch(() => props.tasks, (newTasks) => {
  localTasks.value = [...newTasks]
})

const isDragOver = ref(false)
const isSelectMode = ref(false)
const selectedTaskIds = ref(new Set<string>())
const showMenu = ref(false)
const menuRef = ref<HTMLElement | null>(null)
const announcement = ref('')

function announce(message: string) {
  announcement.value = message
  setTimeout(() => {
    announcement.value = ''
  }, 3000)
}

function handleTaskKeydown(event: KeyboardEvent, task: Task, index: number) {
  if (event.key === 'ArrowUp' && index > 0) {
    event.preventDefault()
    const prevTask = localTasks.value[index - 1]
    localTasks.value.splice(index, 1)
    localTasks.value.splice(index - 1, 0, task)
    emit('taskMoved', task.id, props.status, index - 1)
    announce(`Task ${task.title} moved up to position ${index}`)
  } else if (event.key === 'ArrowDown' && index < localTasks.value.length - 1) {
    event.preventDefault()
    const nextTask = localTasks.value[index + 1]
    localTasks.value.splice(index, 1)
    localTasks.value.splice(index + 1, 0, task)
    emit('taskMoved', task.id, props.status, index + 1)
    announce(`Task ${task.title} moved down to position ${index + 2}`)
  }
}

function toggleTaskSelection(taskId: string) {
  if (selectedTaskIds.value.has(taskId)) {
    selectedTaskIds.value.delete(taskId)
  } else {
    selectedTaskIds.value.add(taskId)
  }
}

function toggleSelectMode() {
  isSelectMode.value = !isSelectMode.value
  selectedTaskIds.value.clear()
}
onMounted(() => {
  document.addEventListener('click', closeMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeMenu)
})

function closeMenu() {
  showMenu.value = false
}

const isAllSelected = computed(() => {
  return props.tasks.length > 0 && selectedTaskIds.value.size === props.tasks.length
})

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedTaskIds.value.clear()
  } else {
    selectedTaskIds.value = new Set(props.tasks.map(t => t.id))
  }
}

function onChange(evt: any) {
  isDragOver.value = false
  if (evt.added) {
    emit('taskMoved', evt.added.element.id, props.status, evt.added.newIndex)
  } else if (evt.moved) {
    emit('taskMoved', evt.moved.element.id, props.status, evt.moved.newIndex)
  }
}

const col = computed(() => (COLUMN_COLORS as any)[props.status] || COLUMN_COLORS.backlog)

function resetSelection() {
  isSelectMode.value = false
  selectedTaskIds.value.clear()
}

defineExpose({ resetSelection })
</script>

<template>
  <div
    class="flex flex-col rounded-xl border-t-4 min-w-[300px] w-[300px] bg-gray-50/50 dark:bg-surface-card border border-gray-200 dark:border-surface-border shadow-sm dark:shadow-xl transition-all duration-300 cursor-default"
    :class="[col.border, col.glow, isDragOver ? 'ring-2 ring-neon-cyan/30 dark:ring-neon-cyan/20 bg-gray-100 dark:bg-surface-hover' : '']"
    role="region"
    :aria-label="`${title} column, ${tasks.length} tasks`"
  >
    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-surface-border/50">
      <div class="flex items-center gap-2">
        <h3
          class="text-sm font-bold uppercase tracking-widest"
          :class="col.text"
        >
          {{ title }}
        </h3>
        <button
          v-if="tasks.length > 0"
          @click="toggleSelectMode"
          :title="isSelectMode ? 'Cancel' : 'Select'"
          class="text-xs font-bold px-1.5 py-0.5 rounded-full border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-raised text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-hover hover:text-neon-cyan dark:hover:text-neon-cyan transition-all"
        >
          <AppIcon :name="isSelectMode ? 'x' : 'select'" :title="isSelectMode ? 'Cancel' : 'Select'" />
        </button>
        <button
          v-if="isSelectMode && tasks.length > 0"
          @click="toggleSelectAll"
          :title="isAllSelected ? 'Deselect All' : 'Select All'"
          class="text-xs font-bold px-1.5 py-0.5 rounded-full border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-raised text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-hover hover:text-neon-cyan dark:hover:text-neon-cyan transition-all"
        >
          <AppIcon :name="isAllSelected ? 'minus' : 'plus'" :title="isAllSelected ? 'Deselect All' : 'Select All'" />
        </button>
        <div v-if="status === 'done' && tasks.length > 0" class="relative">
          <button
            @click.stop="showMenu = !showMenu"
            class="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-raised text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-hover hover:text-neon-cyan dark:hover:text-neon-cyan transition-all"
          >
            ...
          </button>
          <div
            v-if="showMenu"
            class="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-lg shadow-xl z-20"
            @click.stop
          >
            <button
              v-if="tasks.length > 1"
              @click="emit('archiveAll'); showMenu = false"
              class="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-hover"
            >
              Archive All
            </button>
            <button
              @click="emit('generateChangelog'); showMenu = false"
              class="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-hover"
            >
              Changelog
            </button>
          </div>
        </div>
      </div>
      <div v-if="isSelectMode && selectedTaskIds.size > 0" class="flex gap-2">
        <button
          class="flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-full border border-neon-cyan bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 transition-all"
          @click="$emit('openMassAction', Array.from(selectedTaskIds))"
          title="Update selected tasks"
        >
          <AppIcon name="update" title="Update selected tasks" /> ({{ selectedTaskIds.size }})
        </button>
      </div>
      <span
        v-else
        class="text-xs font-bold rounded-full px-2 py-0.5 min-w-[20px] text-center"
        :class="col.badge"
        :aria-label="`${tasks.length} tasks`"
      >
        {{ tasks.length }}
      </span>
    </div>
    <draggable
      v-model="localTasks"
      group="tasks"
      item-key="id"
      class="flex-1 p-2 space-y-2 min-h-[120px] overflow-y-auto rounded-b-xl transition-colors"
      ghost-class="sortable-ghost"
      drag-class="sortable-drag"
      chosen-class="sortable-chosen"
      :animation="200"
      @change="onChange"
      @dragenter="isDragOver = true"
      @dragleave="isDragOver = false"
    >
      <template #item="{ element, index }">
        <div :data-id="element.id" class="flex items-center gap-2" tabindex="0" @keydown="handleTaskKeydown($event, element, index)">
          <button
            v-if="isSelectMode"
            @click="toggleTaskSelection(element.id)"
            class="w-6 h-6 flex items-center justify-center rounded border transition-colors"
            :class="selectedTaskIds.has(element.id) ? 'bg-neon-cyan border-neon-cyan' : 'border-gray-300 bg-white'"
          >
            <span v-if="selectedTaskIds.has(element.id)" class="text-white">✓</span>
          </button>
          <TaskCard
            :class="{'flex-1': isSelectMode}"
            :task="element"
            :tags="tags"
            :task-tags="taskTags"
            @click="emit('taskClick', element)"
            @contextmenu="emit('contextmenu', $event, element)"
          />
        </div>
      </template>
      <template #footer>
        <div v-if="tasks.length === 0" class="flex flex-col items-center justify-center py-8 text-center">
          <div class="text-2xl mb-2 opacity-30" aria-hidden="true">📋</div>
          <p class="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600">No tasks</p>
          <p class="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Drag tasks here</p>
        </div>
      </template>
    </draggable>
    <!-- Screen reader announcements -->
    <div aria-live="polite" class="sr-only" role="status">
        {{ announcement }}
    </div>
  </div>
</template>
