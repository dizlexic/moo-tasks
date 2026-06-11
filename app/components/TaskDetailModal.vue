<script setup lang="ts">
import { debounce } from '~/utils/debounce'
import type { Task } from '#server/db/schema'
import type { TaskPriority, TaskStatus } from '~/composables/useTasks'

const props = defineProps<{ task: Task; boardId: string }>()
const emit = defineEmits<{ close: []; updated: []; openTask: [task: Task] }>()
const { updateTask, deleteTask, tasks, createTask, taskTags, fetchTaskTags, addComment } = useTasks(props.boardId)
const { tags, fetchTags, addTagToTask, removeTagFromTask } = useTags(props.boardId)

const title = ref(props.task.title)
const description = ref(props.task.description || '')
const priority = ref<TaskPriority>(props.task.priority as TaskPriority)
const difficulty = ref<number>(props.task.difficulty || 2)
const status = ref<TaskStatus>(props.task.status as TaskStatus)
const assignee = ref(props.task.assignee || '')
const isHumanOnly = ref(!!props.task.isHumanOnly)
const members = ref<{ userId: string, name: string }[]>([])
async function fetchMembers() {
  const res = await $fetch<{ members: { userId: string, name: string }[] }>(`/api/boards/${props.boardId}/members`)
  members.value = res.members
}
const selectedTagIds = ref<string[]>(
  taskTags.value
    .filter(tt => tt.taskId === props.task.id)
    .map(tt => tt.tagId)
)
const saving = ref(false)

const debouncedSaveGeneral = debounce((closeModal = false) => saveTask(closeModal), 500)
const debouncedSaveDescription = debounce((closeModal = false) => saveTask(closeModal), 30000)
const confirmDelete = ref(false)
const error = ref('')
const linkCopied = ref(false)
const showTimeline = ref(false)
const modalRef = ref<HTMLElement | null>(null)
const commentsRef = ref<any>(null)
const commentAdded = ref(false)

const isCorrectionMode = ref(false)
const originalStatus = ref<TaskStatus | null>(null)
const showCorrectionExitModal = ref(false)

watch(description, () => {
  if (hasChanged.value) {
    debouncedSaveDescription(false)
  }
})

watch([title, priority, difficulty, status, assignee, isHumanOnly], () => {
  if (hasChanged.value) {
    debouncedSaveGeneral(false)
  }
})

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    handleClose()
  }
}

async function handleClose() {
  if (isCorrectionMode.value && !commentAdded.value) {
    showCorrectionExitModal.value = true
  } else {
    emit('close')
  }
}

async function onStartCorrection() {
  originalStatus.value = status.value
  status.value = 'todo'
  isCorrectionMode.value = true
  commentAdded.value = false

  // Ensure 'correction' tag exists and add it
  let correctionTag = tags.value.find(t => t.name.toLowerCase() === 'correction')
  if (!correctionTag) {
    try {
      correctionTag = await createTag({ name: 'correction', color: '#ff4d4d', icon: 'wrench' }) as any
    } catch (e) {
      console.error('Failed to create correction tag', e)
    }
  }

  if (correctionTag) {
    const hasTag = selectedTagIds.value.includes(correctionTag.id)
    if (!hasTag) {
      selectedTagIds.value = [...selectedTagIds.value, correctionTag.id]
    }
  }

  await saveTask(false)
  nextTick(() => {
    commentsRef.value?.focusInput()
  })
}

async function cancelCorrectionExit() {
  showCorrectionExitModal.value = false
  nextTick(() => {
    commentsRef.value?.focusInput()
  })
}

async function continueCorrectionExit() {
  isCorrectionMode.value = false
  showCorrectionExitModal.value = false

  // Revert status
  if (originalStatus.value) {
    status.value = originalStatus.value
  }

  // Remove correction tag
  const correctionTag = tags.value.find(t => t.name.toLowerCase() === 'correction')
  if (correctionTag) {
    selectedTagIds.value = selectedTagIds.value.filter(id => id !== correctionTag.id)
  }

  await saveTask(false)
  emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  nextTick(() => modalRef.value?.focus())
  fetchTags()
  fetchTaskTags()
  fetchMembers()
})

watch(selectedTagIds, async (newTags, oldTags) => {
  const added = newTags.filter(t => !oldTags.includes(t))
  const removed = oldTags.filter(t => !newTags.includes(t))
  for (const tagId of added) await addTagToTask(props.task.id, tagId)
  for (const tagId of removed) await removeTagFromTask(props.task.id, tagId)
})

watch(() => taskTags.value, () => {
  const latestTags = taskTags.value
    .filter(tt => tt.taskId === props.task.id)
    .map(tt => tt.tagId)

  if (JSON.stringify(selectedTagIds.value) !== JSON.stringify(latestTags)) {
    selectedTagIds.value = latestTags
  }
}, { deep: true })

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})

async function copyTaskLink() {
  const origin = window.location.origin
  const url = `${origin}/boards/${props.boardId}?taskId=${props.task.id}`
  await navigator.clipboard.writeText(url)
  linkCopied.value = true
  setTimeout(() => { linkCopied.value = false }, 2000)
}

// Correction task
const showCorrectionForm = ref(false)
const correctionTitle = ref('')
const correctionDescription = ref('')
const correctionPriority = ref<TaskPriority>('medium')
const correctionSubmitting = ref(false)

const hasChanged = computed(() => {
  return title.value.trim() !== props.task.title ||
         description.value.trim() !== (props.task.description || '') ||
         priority.value !== props.task.priority ||
         difficulty.value !== (props.task.difficulty || 2) ||
         status.value !== props.task.status ||
         (assignee.value.trim() || null) !== (props.task.assignee || null) ||
         isHumanOnly.value !== !!props.task.isHumanOnly
})

async function saveTask(closeModal = false) {
  if (!title.value.trim()) return
  if (!hasChanged.value) {
    if (closeModal) emit('close')
    return
  }
  error.value = ''
  saving.value = true
  try {
    await updateTask(props.task.id, {
      title: title.value.trim(),
      description: description.value.trim(),
      priority: priority.value,
      difficulty: difficulty.value || undefined,
      status: status.value,
      assignee: assignee.value.trim() || null,
      isHumanOnly: isHumanOnly.value,
    } as any)
    emit('updated')
    if (closeModal) emit('close')
  } catch (e: any) {
    error.value = e.data?.message || e.statusMessage || 'Failed to save task'
  } finally {
    saving.value = false
  }
}

async function onSave() {
  await saveTask(true)
}

async function onDelete() {
  error.value = ''
  try {
    await deleteTask(props.task.id)
    emit('close')
  } catch (e: any) {
    error.value = e.data?.message || e.statusMessage || 'Failed to delete task'
    confirmDelete.value = false
  }
}

async function onCreateCorrection() {
  if (!correctionTitle.value.trim()) return
  correctionSubmitting.value = true
  try {
    const newTask = await createTask({
      title: correctionTitle.value.trim(),
      description: correctionDescription.value.trim(),
      priority: correctionPriority.value,
      parentTaskId: props.task.id,
      status: 'todo',
    })

    // Add comment linking back to original task
    try {
      const origin = window.location.origin
      const originalTaskLink = `${origin}/boards/${props.boardId}?taskId=${props.task.id}`
      await addComment(newTask.id, `Created from correction request on task: [${props.task.title}](${originalTaskLink})`)
    } catch (commentError) {
      console.error('Failed to add link comment:', commentError)
    }

    showCorrectionForm.value = false
    correctionTitle.value = ''
    correctionDescription.value = ''
    emit('updated')
  } catch (e: any) {
    error.value = e.data?.message || e.statusMessage || 'Failed to create correction task'
  } finally {
    correctionSubmitting.value = false
  }
}

const parentTaskId = computed(() => (props.task as any).parentTaskId)
const parentTask = computed(() => tasks.value.find(t => t.id === parentTaskId.value))
const corrections = computed(() => tasks.value.filter(t => (t as any).parentTaskId === props.task.id))

function openParentTask() {
  if (parentTask.value) {
    emit('openTask', parentTask.value)
  }
}
</script>

<template>
  <div
    ref="modalRef"
    class="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all duration-300"
    role="dialog"
    aria-modal="true"
    aria-labelledby="task-detail-title"
    tabindex="-1"
    @click.self="emit('close')"
  >
    <div class="modal-panel bg-white dark:bg-surface-card rounded-2xl shadow-2xl dark:shadow-[0_0_40px_rgba(0,0,0,0.5)] w-full max-w-[90vw] max-h-[90vh] overflow-hidden border border-gray-200 dark:border-surface-border flex flex-col">
      <!-- Header -->
      <div class="p-6 pb-4 border-b border-gray-100 dark:border-surface-border/50 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-4">
          <h2 id="task-detail-title" class="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Task Details</h2>
          <button
            type="button"
            @click="copyTaskLink"
            class="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-gray-200 dark:border-surface-border bg-gray-50 dark:bg-surface-raised text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-hover hover:text-neon-cyan dark:hover:text-neon-cyan transition-all flex items-center gap-1.5"
            :aria-label="linkCopied ? 'Link copied' : 'Copy task link'"
          >
            <span aria-hidden="true">{{ linkCopied ? '✓' : '🔗' }}</span>
            <span>{{ linkCopied ? 'Copied' : 'Link' }}</span>
          </button>
        </div>
        <div class="flex items-center gap-3">
          <div v-if="parentTask" @click="openParentTask" class="cursor-pointer text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-neon-orange/10 text-orange-600 dark:text-neon-orange border border-neon-orange/20 hover:bg-neon-orange/20 transition-all flex items-center gap-1.5 shadow-sm shadow-neon-orange/5" title="Go to parent task">
            <span aria-hidden="true">↩</span>
            <span class="truncate max-w-[120px]">Parent: {{ parentTask.title }}</span>
          </div>
          <div v-else-if="parentTaskId" class="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-neon-orange/10 text-orange-600 dark:text-neon-orange border border-neon-orange/20">
            <span>↩ Correction</span>
          </div>
          <button @click="handleClose" class="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors text-2xl leading-none p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-raised" aria-label="Close dialog">&times;</button>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 flex flex-col xl:flex-row overflow-y-auto xl:overflow-hidden">
        <div class="flex-1 xl:w-2/3 xl:overflow-y-auto p-6 space-y-6">
          <div v-if="error" role="alert" class="bg-red-50 dark:bg-neon-red/10 text-red-600 dark:text-neon-red text-sm font-medium rounded-xl px-4 py-3 border border-red-200 dark:border-neon-red/20 shadow-sm shadow-neon-red/5">{{ error }}</div>

          <form @submit.prevent="onSave" id="task-edit-form" class="space-y-6">
            <div class="space-y-1.5">
              <label for="task-title" class="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Title</label>
              <input id="task-title" v-model="title" @blur="debouncedSaveGeneral(false)" type="text" required class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600" placeholder="Task title..." />
            </div>

            <div class="space-y-1.5">
              <label for="task-description" class="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Description</label>
              <textarea id="task-description" v-model="description" @blur="debouncedSaveGeneral(false)" rows="6" class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none resize-none transition-all leading-relaxed placeholder:text-gray-400 dark:placeholder:text-gray-600" placeholder="Describe the task in detail..." />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div class="space-y-1.5">
                <label for="task-status" class="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Status</label>
                <div class="relative">
                  <select id="task-status" v-model="status" class="w-full appearance-none border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all cursor-pointer">
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
                  @click="isHumanOnly = !isHumanOnly; debouncedSaveGeneral(false)"
                  class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-raised hover:border-neon-cyan/50 transition-all"
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
                  <select id="task-priority" v-model="priority" class="w-full appearance-none border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all cursor-pointer">
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
                  <select id="task-difficulty" v-model="difficulty" @change="debouncedSaveGeneral" class="w-full appearance-none border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all cursor-pointer">
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
                  <select v-if="isHumanOnly" v-model="assignee" id="task-assignee" class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl pl-9 pr-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all">
                    <option value="">Unassigned</option>
                    <option v-for="member in members" :key="member.userId" :value="member.name">{{ member.name }}</option>
                  </select>
                  <input v-else id="task-assignee" v-model="assignee" type="text" class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl pl-9 pr-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600" placeholder="Agent name" />
                </div>
              </div>

              <div class="space-y-1.5 col-span-1 md:col-span-3">
                <label class="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Tags</label>
                <TagPicker v-model:selectedTagIds="selectedTagIds" :board-id="boardId" />
              </div>
            </div>

            <!-- Correction Task Section -->
            <div v-if="status === 'review' || status === 'done' || isCorrectionMode" class="bg-gray-50 dark:bg-surface-raised/30 rounded-2xl p-5 border border-gray-100 dark:border-surface-border/30 space-y-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-neon-orange" aria-hidden="true">↩</span>
                  <h3 class="text-sm font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300">Corrections</h3>
                </div>
                <button
                  v-if="!isCorrectionMode"
                  type="button"
                  @click="onStartCorrection"
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

            <!-- Child Task Section -->
            <div class="bg-gray-50 dark:bg-surface-raised/30 rounded-2xl p-5 border border-gray-100 dark:border-surface-border/30 space-y-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-neon-cyan" aria-hidden="true">↓</span>
                  <h3 class="text-sm font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300">Child Tasks</h3>
                </div>
                <button
                  type="button"
                  @click="emit('close'); /* Need to trigger child task creation dialog */"
                  class="text-[10px] font-bold uppercase tracking-widest text-neon-cyan hover:text-neon-cyan/80 transition-colors"
                >
                  Create Child Task
                </button>
              </div>
            </div>
          </form>

          <div class="border-t pt-6 flex items-center justify-between">
            <div>
              <button v-if="!confirmDelete" type="button" @click="confirmDelete = true" class="text-xs font-bold uppercase tracking-widest text-red-500 hover:text-red-700 dark:text-neon-red/70 dark:hover:text-neon-red transition-all">Delete Task</button>
              <div v-else class="flex items-center gap-3" role="alert">
                <span class="text-[10px] font-bold uppercase tracking-widest text-red-600 dark:text-neon-red">Confirm?</span>
                <button type="button" @click="onDelete" class="text-[10px] font-bold uppercase tracking-widest text-red-700 dark:text-neon-red hover:underline">Yes, delete</button>
                <button type="button" @click="confirmDelete = false" class="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Cancel</button>
              </div>
            </div>
            <div class="flex gap-2">
              <button type="button" @click="emit('close')" class="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors" title="Cancel">Cancel</button>
              <button
                type="submit"
                form="task-edit-form"
                :disabled="saving || !title.trim()"
                class="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-neon-cyan text-cyan-950 dark:text-gray-900 rounded-lg hover:bg-neon-cyan/90 disabled:opacity-50 transition-all shadow-md shadow-neon-cyan/20 active:scale-95"
              >
                {{ saving ? 'Saving...' : 'Save' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Comments Section -->
        <div class="w-full xl:w-1/3 border-t xl:border-t-0 xl:border-l border-gray-100 dark:border-surface-border/50 xl:overflow-y-auto p-6 bg-gray-50 dark:bg-surface-raised/20">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Activity</h3>
            <button @click="showTimeline = !showTimeline" class="text-[10px] font-bold uppercase tracking-widest text-neon-cyan hover:text-neon-cyan/80 transition-colors">
              {{ showTimeline ? 'Hide Timeline' : 'Show Timeline' }}
            </button>
          </div>
          <TaskComments ref="commentsRef" :task-id="task.id" :board-id="boardId" @comment-added="commentAdded = true" />
          <TaskTimeline v-if="showTimeline" class="mt-6" :task-id="task.id" :board-id="boardId" />
        </div>
      </div>
    </div>
  </div>
  <!-- Correction Exit Confirmation -->
  <div v-if="showCorrectionExitModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div class="bg-white dark:bg-surface-card rounded-2xl p-6 shadow-2xl w-full max-w-sm border border-gray-200 dark:border-surface-border animate-in fade-in zoom-in duration-200">
      <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2">Unfinished Correction</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">You are trying to exit without adding correction details. Would you like to continue and revert the task or stay and add a comment?</p>
      <div class="flex flex-col gap-3">
        <button
          @click="cancelCorrectionExit"
          class="w-full py-2.5 text-xs font-black uppercase tracking-widest bg-neon-cyan text-cyan-950 rounded-xl hover:scale-[1.02] transition-all"
        >
          Stay & Comment
        </button>
        <button
          @click="continueCorrectionExit"
          class="w-full py-2.5 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-all"
        >
          Continue & Revert
        </button>
      </div>
    </div>
  </div>
</template>
