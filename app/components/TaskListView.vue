<script setup lang="ts">
import draggable from 'vuedraggable'
import type { Task, Tag } from '../../server/db/schema'
import { COLUMNS, COLUMN_COLORS } from '../utils/task-constants'

const props = defineProps<{
  boardId: string,
  showArchive: boolean,
  searchQuery?: string,
  selectedTags?: Tag[]
}>()

const { tasks, tasksByStatus, taskTags, fetchTaskTags, moveTask } = useTasks(props.boardId)
const { tags, fetchTags } = useTags(props.boardId)

onMounted(() => {
  fetchTags()
  fetchTaskTags()
})

const filteredTasks = computed(() => {
  let result = tasks.value

  if (props.searchQuery) {
    const q = props.searchQuery.toLowerCase()
    result = result.filter(t => 
      t.title.toLowerCase().includes(q) || 
      t.description?.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      t.boardTaskId.toString().includes(q)
    )
  }

  if (props.selectedTags && props.selectedTags.length > 0) {
    const selectedTagIds = props.selectedTags.map(t => t.id)
    result = result.filter(task => {
      const taskTagIds = taskTags.value
        .filter(tt => tt.taskId === task.id)
        .map(tt => tt.tagId)
      return selectedTagIds.every(id => taskTagIds.includes(id))
    })
  }

  return result
})


async function onTaskMoved(evt: any, status: string) {
  if (evt.added) {
    const task = evt.added.element
    await moveTask(task.id, status as any, evt.added.newIndex)
  } else if (evt.moved) {
    const task = evt.moved.element
    await moveTask(task.id, status as any, evt.moved.newIndex)
  }
}

const columns = computed(() => {
  return props.showArchive ? [...COLUMNS, { title: 'Archive', status: 'archive' }] : COLUMNS
})

const emit = defineEmits<{
  taskClick: [task: Task],
  openMassAction: [taskIds: string[]],
  generateChangelog: []
}>()

const collapsed = ref<Record<string, boolean>>({})
const isSelectMode = ref<Record<string, boolean>>({})
const selectedTaskIds = ref<Record<string, Set<string>>>({})
const localTasksByStatus = ref<Record<string, Task[]>>({})
const announcement = ref('')

function announce(message: string) {
  announcement.value = message
  setTimeout(() => {
    announcement.value = ''
  }, 3000)
}


watch([filteredTasks, () => columns.value], () => {
  columns.value.forEach(col => {
    localTasksByStatus.value[col.status] = filteredTasks.value
      .filter(t => t.status === col.status)
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
  })
}, { immediate: true })

function toggleCollapse(status: string) {
  collapsed.value[status] = !isCollapsed(status)
}

function isCollapsed(status: string) {
  return collapsed.value[status] ?? false
}

function toggleSelectMode(status: string) {
  isSelectMode.value[status] = !isSelectMode.value[status]
  if (!isSelectMode.value[status]) {
    selectedTaskIds.value[status]?.clear()
  } else {
    if (!selectedTaskIds.value[status]) {
      selectedTaskIds.value[status] = new Set()
    }
  }
}

function toggleTaskSelection(status: string, taskId: string) {
  if (!selectedTaskIds.value[status]) {
    selectedTaskIds.value[status] = new Set()
  }
  if (selectedTaskIds.value[status].has(taskId)) {
    selectedTaskIds.value[status].delete(taskId)
  } else {
    selectedTaskIds.value[status].add(taskId)
  }
}

function isAllSelected(status: string) {
  const tasks = localTasksByStatus.value[status] || []
  return tasks.length > 0 && (selectedTaskIds.value[status]?.size === tasks.length)
}

function toggleSelectAll(status: string) {
  const tasks = localTasksByStatus.value[status] || []
  if (isAllSelected(status)) {
    selectedTaskIds.value[status]?.clear()
  } else {
    selectedTaskIds.value[status] = new Set(tasks.map(t => t.id))
  }
}

function resetAllSelections() {
  Object.keys(isSelectMode.value).forEach(status => {
    isSelectMode.value[status] = false
    selectedTaskIds.value[status]?.clear()
  })
}

defineExpose({ resetAllSelections })
const contextMenu = ref<{ open: (event: MouseEvent, task: Task) => void } | null>(null)

function onContextMenu(event: MouseEvent, task: Task) {
  event.preventDefault()
  contextMenu.value?.open(event, task)
}

async function onArchiveAll() {
  await useTasks(props.boardId).archiveAllDone()
}
</script>

<template>
  <div class="space-y-4">
    <div
      v-for="col in columns"
      :key="col.status"
      class="bg-white dark:bg-surface-card rounded-2xl border border-gray-100 dark:border-surface-border/50 overflow-hidden shadow-sm transition-all"
    >
      <button
        @click="toggleCollapse(col.status)"
        class="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-surface-raised transition-all group"
      >
        <div class="flex items-center gap-4">
          <span
            class="text-xs font-black rounded-full px-2.5 py-1 min-w-[2rem] text-center uppercase tracking-tighter"
            :class="COLUMN_COLORS[col.status].badge"
          >
            {{ localTasksByStatus[col.status]?.length || 0 }}
          </span>
          <h3
            class="text-sm font-bold uppercase tracking-widest"
            :class="COLUMN_COLORS[col.status].text"
          >
            {{ col.title }}
          </h3>
          <div class="flex items-center gap-2 ml-2" @click.stop>
            <button
              v-if="(localTasksByStatus[col.status]?.length || 0) > 0"
              @click="toggleSelectMode(col.status)"
              :title="isSelectMode[col.status] ? 'Cancel' : 'Select'"
              class="text-sm font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-raised text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-hover hover:text-neon-cyan dark:hover:text-neon-cyan transition-all"
            >
              <AppIcon :name="isSelectMode[col.status] ? 'x' : 'select'" :title="isSelectMode[col.status] ? 'Cancel' : 'Select'" />
            </button>
            <button
              v-if="isSelectMode[col.status] && (localTasksByStatus[col.status]?.length || 0) > 0"
              @click="toggleSelectAll(col.status)"
              :title="isAllSelected(col.status) ? 'Deselect All' : 'Select All'"
              class="text-sm font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-raised text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-hover hover:text-neon-cyan dark:hover:text-neon-cyan transition-all"
            >
              <AppIcon :name="isAllSelected(col.status) ? 'minus' : 'plus'" :title="isAllSelected(col.status) ? 'Deselect All' : 'Select All'" />
            </button>
            <button
              v-if="isSelectMode[col.status] && selectedTaskIds[col.status]?.size > 0"
              @click="emit('openMassAction', Array.from(selectedTaskIds[col.status]))"
              title="Update selected tasks"
              class="flex items-center gap-1 text-sm font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-neon-cyan bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 transition-all"
            >
              <AppIcon name="update" title="Update selected tasks" /> ({{ selectedTaskIds[col.status]?.size }})
            </button>
            <button
              v-if="col.status === 'done' && (localTasksByStatus['done']?.length || 0) > 1 && !isSelectMode[col.status]"
              @click="onArchiveAll"
              title="Archive All"
              class="text-sm font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-raised text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-hover hover:text-neon-cyan dark:hover:text-neon-cyan transition-all"
            >
              Archive All
            </button>
            <button
              v-if="col.status === 'done' && (localTasksByStatus['done']?.length || 0) > 0"
              @click="emit('generateChangelog')"
              title="Changelog"
              class="text-sm font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-raised text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-hover hover:text-neon-cyan dark:hover:text-neon-cyan transition-all"
            >
              Changelog
            </button>
          </div>
        </div>
        <div class="text-gray-400 group-hover:text-neon-cyan transition-colors">
          <div
            class="transition-transform duration-300"
            :class="{ 'rotate-180': !isCollapsed(col.status) }"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      <transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="transform -translate-y-2 opacity-0"
        enter-to-class="transform translate-y-0 opacity-100"
      >
        <div v-if="!isCollapsed(col.status)" class="p-5 pt-0">
          <div v-if="(localTasksByStatus[col.status]?.length || 0) === 0" class="text-center py-8 text-sm font-medium text-gray-400 dark:text-gray-500 italic bg-gray-50/50 dark:bg-surface-dark/30 rounded-xl border border-dashed border-gray-200 dark:border-surface-border/50">
            No tasks in this category
          </div>
          <div
            v-else
            class="flex flex-col gap-3"
          >
            <draggable
              v-model="localTasksByStatus[col.status]"
              group="tasks"
              item-key="id"
              class="flex flex-col gap-3 min-h-[50px]"
              ghost-class="sortable-ghost"
              drag-class="sortable-drag"
              chosen-class="sortable-chosen"
              :animation="200"
              @change="onTaskMoved($event, col.status)"
              :disabled="!!props.searchQuery"
            >
              <template #item="{ element: task }">
                <div
                  :key="task.id"
                  class="flex items-center gap-3"
                >
                  <button
                    v-if="isSelectMode[col.status]"
                    @click="toggleTaskSelection(col.status, task.id)"
                    class="w-6 h-6 flex items-center justify-center rounded border transition-colors"
                    :class="selectedTaskIds[col.status]?.has(task.id) ? 'bg-neon-cyan border-neon-cyan' : 'border-gray-300 bg-white'"
                  >
                    <span v-if="selectedTaskIds[col.status]?.has(task.id)" class="text-white">✓</span>
                  </button>
                  <TaskCard
                    class="flex-1"
                    :task="task"
                    :tags="tags"
                    :task-tags="taskTags"
                    @click="emit('taskClick', task)"
                    @contextmenu="onContextMenu($event, task)"
                  />
                </div>
              </template>
            </draggable>
          </div>
        </div>
      </transition>
    </div>
    <TaskContextMenu ref="contextMenu" :board-id="boardId" />
  </div>
</template>
