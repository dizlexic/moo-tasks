<script setup lang="ts">
import type { TaskPriority } from '~/composables/useTasks'
import { debounce } from '~/utils/debounce'

const props = defineProps<{ boardId: string; parentTaskId?: string }>()
const emit = defineEmits<{ close: [] }>()
const { createTask, updateTask } = useTasks(props.boardId)
const { tags, fetchTags, addTagToTask } = useTags(props.boardId)

const title = ref('')
const description = ref('')
const priority = ref<TaskPriority>('medium')
const difficulty = ref<number>(2)
const isHumanOnly = ref(false)
const selectedTagIds = ref<string[]>([])
const submitting = ref(false)
const error = ref('')
const modalRef = ref<HTMLElement | null>(null)

const taskId = ref<string | null>(null)
const saving = ref(false)
const saved = ref(false)

const debouncedSaveTask = debounce(() => saveTask(), 500)

// watch([title, priority, difficulty, isHumanOnly], () => {
//   debouncedSaveGeneral()
// })

async function saveTask(forceCreate = false) {
  if (!title.value.trim()) return
  saving.value = true
  error.value = ''
  try {
    if (taskId.value) {
      await updateTask(taskId.value, {
        title: title.value.trim(),
        description: description.value.trim(),
        priority: priority.value,
        difficulty: difficulty.value || undefined,
        isHumanOnly: isHumanOnly.value
      })
    } else if (forceCreate) {
      const task = await createTask({
        title: title.value.trim(),
        description: description.value.trim(),
        priority: priority.value,
        difficulty: difficulty.value || undefined,
        isHumanOnly: isHumanOnly.value,
        parentTaskId: props.parentTaskId
      })
      taskId.value = task.id
    }
    saved.value = true
    setTimeout(() => { saved.value = false }, 2000)
  } catch (e: any) {
    error.value = e.data?.message || e.statusMessage || 'Failed to save task'
  } finally {
    saving.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    closeModal()
  }
}

async function closeModal() {
  await saveTask(true)
  emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  nextTick(() => modalRef.value?.focus())
  fetchTags()
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})

async function onSubmit() {
  if (!title.value.trim()) return

  if (!taskId.value) {
    await saveTask(true)
  }

  if (error.value) return

  submitting.value = true
  try {
    for (const tagId of selectedTagIds.value) {
      await addTagToTask(taskId.value!, tagId)
    }
    // Task already created, just close
    emit('close')
  } catch (e: any) {
    error.value = e.data?.message || e.statusMessage || 'Failed to finish task creation'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div
    ref="modalRef"
    class="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="create-task-title"
    tabindex="-1"
    @mousedown.self="closeModal"
  >
    <div class="modal-panel relative bg-white dark:bg-surface-card rounded-2xl shadow-2xl dark:shadow-[0_0_40px_rgba(0,0,0,0.5)] w-full max-w-2xl border border-gray-200 dark:border-surface-border overflow-hidden">
      <div class="p-6 pb-4 border-b border-gray-100 dark:border-surface-border/50 flex items-center justify-between">
        <h2 id="create-task-title" class="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Create New Task</h2>
        <Transition name="fade">
          <div v-if="saved" class="absolute top-4 right-4 bg-green-500 text-white text-xs font-bold uppercase tracking-widest px-2 py-1 rounded">Saved</div>
        </Transition>
        <button @click="closeModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors text-2xl leading-none p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-raised" aria-label="Close dialog">&times;</button>
      </div>

      <div class="p-6 pt-5">
        <div v-if="error" role="alert" class="bg-red-50 dark:bg-neon-red/10 text-red-600 dark:text-neon-red text-sm font-medium rounded-xl px-4 py-3 mb-6 border border-red-200 dark:border-neon-red/20 shadow-sm shadow-neon-red/5">{{ error }}</div>

        <form @submit.prevent="onSubmit" class="space-y-5">
          <div class="space-y-1.5">
            <div class="flex items-center justify-between ml-1">
                <label for="new-task-title" class="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Title *</label>
                <button
                type="button"
                @click="isHumanOnly = !isHumanOnly; debouncedSaveTask()"
                class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-raised hover:border-neon-cyan/50 transition-all"
                >
                <span class="text-sm" aria-hidden="true">{{ isHumanOnly ? '👤' : '🤖' }}</span>
                <span class="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                    {{ isHumanOnly ? 'Human only' : 'AI capable' }}
                </span>
                </button>
            </div>
            <input id="new-task-title" v-model="title" @blur="debouncedSaveTask" type="text" required autofocus class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-3 text-base font-medium focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600" placeholder="What needs to be done?" />
          </div>

          <div class="space-y-1.5">
            <label for="new-task-description" class="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Description</label>
            <textarea id="new-task-description" v-model="description" @input="debouncedSaveTask" rows="4" class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none resize-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600" placeholder="Add some details..." />
          </div>

          <div class="grid grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <label for="new-task-priority" class="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Priority</label>
                <div class="relative">
                  <select id="new-task-priority" v-model="priority" @change="debouncedSaveTask" class="w-full appearance-none border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all cursor-pointer">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                  <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" aria-hidden="true">▼</div>
                </div>
              </div>

              <div class="space-y-1.5">
                <label for="new-task-difficulty" class="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Difficulty</label>
                <div class="relative">
                  <select id="new-task-difficulty" v-model="difficulty" @change="debouncedSaveTask" class="w-full appearance-none border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all cursor-pointer">
                    <option :value="1">1</option>
                    <option :value="2">2</option>
                    <option :value="3">3</option>
                    <option :value="4">4</option>
                    <option :value="5">5</option>
                  </select>
                  <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" aria-hidden="true">▼</div>
                </div>
              </div>
          </div>

          <div class="space-y-1.5">
            <label class="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Tags</label>
            <TagPicker v-model:selectedTagIds="selectedTagIds" :board-id="boardId" />
          </div>

          <div class="flex justify-end gap-3 pt-4">
            <button type="button" @click="closeModal" class="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">Cancel</button>
            <button
              type="submit"
              :disabled="submitting || !title.trim()"
              class="px-8 py-2.5 text-xs font-bold uppercase tracking-widest bg-neon-cyan text-cyan-950 dark:text-gray-900 rounded-xl hover:bg-neon-cyan/90 disabled:opacity-50 transition-all shadow-lg shadow-neon-cyan/20 active:scale-95"
            >
              {{ submitting ? 'Creating...' : 'Create Task' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
