<script setup lang="ts">
const route = useRoute()
const { user } = useUserSession()
const id = route.params.id as string

const { data: plan, refresh: refreshPlan } = await useFetch(`/api/plans/${id}`)
const { data: tasks, refresh: refreshTasks } = await useFetch(`/api/plans/${id}/tasks`)

if (!plan.value) {
  throw createError({ statusCode: 404, statusMessage: 'Plan not found' })
}

const isOwner = computed(() => plan.value?.creatorId === user.value?.id)

const editingPlan = ref(false)
const editName = ref(plan.value?.name || '')
const editDescription = ref(plan.value?.description || '')
const editIsPublic = ref(plan.value?.isPublic || false)

async function savePlan() {
  try {
    await $fetch(`/api/plans/${id}`, {
      method: 'PATCH',
      body: {
        name: editName.value.trim(),
        description: editDescription.value.trim(),
        isPublic: editIsPublic.value
      }
    })
    editingPlan.value = false
    await refreshPlan()
  } catch (e: any) {
    alert(e.data?.message || 'Failed to update plan')
  }
}

const showAddTask = ref(false)
const newTaskTitle = ref('')
const newTaskDescription = ref('')
const newTaskPriority = ref('medium')

async function addTask() {
  if (!newTaskTitle.value.trim()) return
  try {
    await $fetch(`/api/plans/${id}/tasks`, {
      method: 'POST',
      body: {
        title: newTaskTitle.value.trim(),
        description: newTaskDescription.value.trim(),
        priority: newTaskPriority.value,
        order: tasks.value?.length || 0
      }
    })
    newTaskTitle.value = ''
    newTaskDescription.value = ''
    newTaskPriority.value = 'medium'
    showAddTask.value = false
    await refreshTasks()
  } catch (e: any) {
    alert(e.data?.message || 'Failed to add task')
  }
}

async function deleteTask(taskId: string) {
  if (!confirm('Are you sure you want to remove this task from the plan?')) return
  try {
    await $fetch(`/api/plan-tasks/${taskId}`, { method: 'DELETE' })
    await refreshTasks()
  } catch (e: any) {
    alert(e.data?.message || 'Failed to delete task')
  }
}

const editingTask = ref<any>(null)
function openEditTask(task: any) {
    editingTask.value = { ...task }
}

async function saveTask() {
    if (!editingTask.value) return
    try {
        await $fetch(`/api/plan-tasks/${editingTask.value.id}`, {
            method: 'PATCH',
            body: {
                title: editingTask.value.title,
                description: editingTask.value.description,
                priority: editingTask.value.priority,
                difficulty: editingTask.value.difficulty,
                isHumanOnly: editingTask.value.isHumanOnly
            }
        })
        editingTask.value = null
        await refreshTasks()
    } catch (e: any) {
        alert(e.data?.message || 'Failed to update task')
    }
}
</script>

<template>
  <main class="p-6 md:p-8 max-w-4xl mx-auto space-y-8">
    <div class="flex items-center gap-4 mb-4">
        <NuxtLink to="/plans" class="text-gray-400 hover:text-neon-cyan transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
        </NuxtLink>
        <h1 class="text-xs font-black uppercase tracking-[0.2em] text-gray-500">Back to Plans</h1>
    </div>

    <div class="bg-white dark:bg-surface-card rounded-3xl shadow-sm border border-gray-200 dark:border-surface-border p-8 md:p-10">
        <div v-if="!editingPlan">
            <div class="flex justify-between items-start mb-6">
                <div>
                    <div class="flex items-center gap-3 mb-2">
                        <h2 class="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{{ plan.name }}</h2>
                        <span v-if="plan.isPublic" class="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20">Public Plan</span>
                    </div>
                    <p class="text-gray-500 dark:text-gray-400 leading-relaxed">{{ plan.description || 'No description provided.' }}</p>
                </div>
                <button v-if="isOwner" @click="editingPlan = true" class="px-4 py-2 text-sm font-bold uppercase tracking-widest bg-gray-50 dark:bg-surface-raised text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-surface-hover transition-all">
                    Edit Plan Info
                </button>
            </div>
        </div>
        <form v-else @submit.prevent="savePlan" class="space-y-6">
            <div class="space-y-1.5">
                <label class="block text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Plan Name</label>
                <input v-model="editName" type="text" required class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all" />
            </div>
            <div class="space-y-1.5">
                <label class="block text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Description</label>
                <textarea v-model="editDescription" rows="3" class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all resize-none"></textarea>
            </div>
            <div class="flex items-center gap-3">
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" v-model="editIsPublic" class="sr-only peer">
                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-surface-raised peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-neon-cyan"></div>
                    <span class="ml-3 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Public Plan</span>
                </label>
            </div>
            <div class="flex gap-3 pt-4">
                <button type="submit" class="px-6 py-2.5 text-sm font-bold uppercase tracking-widest bg-neon-cyan text-cyan-950 rounded-xl hover:scale-105 transition-all">Save Changes</button>
                <button type="button" @click="editingPlan = false" class="px-6 py-2.5 text-sm font-bold uppercase tracking-widest bg-gray-100 dark:bg-surface-raised text-gray-500 rounded-xl hover:bg-gray-200 transition-all">Cancel</button>
            </div>
        </form>
    </div>

    <div class="space-y-6">
        <div class="flex items-center justify-between ml-1">
            <h3 class="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Plan Tasks ({{ tasks?.length || 0 }})</h3>
            <button v-if="isOwner" @click="showAddTask = true" class="px-4 py-2 text-sm font-bold uppercase tracking-widest bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 rounded-xl hover:bg-neon-cyan/20 transition-all">
                + Add Task
            </button>
        </div>

        <div v-if="!tasks || tasks.length === 0" class="text-center py-16 bg-gray-50/50 dark:bg-surface-card/30 rounded-3xl border border-dashed border-gray-200 dark:border-surface-border">
            <p class="text-sm text-gray-500 dark:text-gray-400">This plan has no tasks yet.</p>
        </div>

        <div v-else class="space-y-3">
            <div
                v-for="task in tasks"
                :key="task.id"
                class="bg-white dark:bg-surface-card rounded-2xl border border-gray-100 dark:border-surface-border p-5 flex items-center justify-between group hover:border-neon-cyan/30 transition-all"
            >
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                        <span :class="{
                            'w-2 h-2 rounded-full': true,
                            'bg-neon-red shadow-[0_0_8px_rgba(255,77,79,0.4)]': task.priority === 'critical',
                            'bg-orange-500': task.priority === 'high',
                            'bg-neon-cyan': task.priority === 'medium',
                            'bg-gray-400': task.priority === 'low'
                        }"></span>
                        <h4 class="font-bold text-gray-900 dark:text-white group-hover:text-neon-cyan transition-colors">{{ task.title }}</h4>
                        <span v-if="task.isHumanOnly" class="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">Human Only</span>
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{{ task.description || 'No description' }}</p>
                </div>
                <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button v-if="isOwner" @click="openEditTask(task)" class="p-2 text-gray-400 hover:text-neon-cyan transition-colors" title="Edit task">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                    </button>
                    <button v-if="isOwner" @click="deleteTask(task.id)" class="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Remove task">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Add Task Modal -->
    <div v-if="showAddTask" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" @mousedown.self="showAddTask = false">
        <div class="bg-white dark:bg-surface-card rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-surface-border animate-in fade-in zoom-in duration-200">
            <div class="p-6 border-b border-gray-100 dark:border-surface-border flex justify-between items-center">
                <h2 class="text-lg font-bold text-gray-900 dark:text-white">Add Task to Plan</h2>
                <button @click="showAddTask = false" class="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors text-2xl leading-none">&times;</button>
            </div>
            <form @submit.prevent="addTask" class="p-6 space-y-4">
                <div class="space-y-1.5">
                    <label class="block text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Task Title</label>
                    <input v-model="newTaskTitle" type="text" required autofocus class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all" />
                </div>
                <div class="space-y-1.5">
                    <label class="block text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Description</label>
                    <textarea v-model="newTaskDescription" rows="3" class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all resize-none"></textarea>
                </div>
                <div class="space-y-1.5">
                    <label class="block text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Priority</label>
                    <select v-model="newTaskPriority" class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all">
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                    </select>
                </div>
                <button type="submit" class="w-full py-4 bg-neon-cyan text-cyan-950 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] hover:scale-[1.02] transition-all shadow-lg shadow-neon-cyan/20">
                    Add Task
                </button>
            </form>
        </div>
    </div>

    <!-- Edit Task Modal -->
    <div v-if="editingTask" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" @mousedown.self="editingTask = null">
        <div class="bg-white dark:bg-surface-card rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-surface-border animate-in fade-in zoom-in duration-200">
            <div class="p-6 border-b border-gray-100 dark:border-surface-border flex justify-between items-center">
                <h2 class="text-lg font-bold text-gray-900 dark:text-white">Edit Task</h2>
                <button @click="editingTask = null" class="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors text-2xl leading-none">&times;</button>
            </div>
            <form @submit.prevent="saveTask" class="p-6 space-y-4">
                <div class="space-y-1.5">
                    <label class="block text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Task Title</label>
                    <input v-model="editingTask.title" type="text" required class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all" />
                </div>
                <div class="space-y-1.5">
                    <label class="block text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Description</label>
                    <textarea v-model="editingTask.description" rows="3" class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all resize-none"></textarea>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-1.5">
                        <label class="block text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Priority</label>
                        <select v-model="editingTask.priority" class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all">
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                        </select>
                    </div>
                    <div class="space-y-1.5">
                        <label class="block text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Difficulty</label>
                        <select v-model="editingTask.difficulty" class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all">
                            <option :value="null">None</option>
                            <option :value="1">1</option>
                            <option :value="2">2</option>
                            <option :value="3">3</option>
                            <option :value="4">4</option>
                            <option :value="5">5</option>
                        </select>
                    </div>
                </div>
                <div class="flex items-center gap-3 py-2">
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" v-model="editingTask.isHumanOnly" class="sr-only peer">
                        <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-surface-raised peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-neon-cyan"></div>
                        <span class="ml-3 text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Human Only</span>
                    </label>
                </div>
                <button type="submit" class="w-full py-4 bg-neon-cyan text-cyan-950 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] hover:scale-[1.02] transition-all shadow-lg shadow-neon-cyan/20">
                    Save Changes
                </button>
            </form>
        </div>
    </div>
  </main>
</template>
