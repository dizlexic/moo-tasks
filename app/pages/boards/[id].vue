<script setup lang="ts">
import type { Task, Board, BoardLog } from '#server/db/schema'

const route = useRoute()
const boardId = route.params.id as string
const activeBoardTransfer = ref<any>(null)
const currentBoardName = useState<string | null>('currentBoardName')

const { user } = useUserSession()
const userEmail = computed(() => user.value?.email)

const board = ref<(Board & { role: string, transfer: any }) | null>(null)
const { fetchTasks, tasksByStatus, moveTask, createTask, updateTask, deleteTask, startSocket, stopSocket, tasks } = useTasks(boardId)
const { tags, fetchTags } = useTags(boardId)

const boardLogs = ref<BoardLog[]>([])
const exportComments = ref(false)
const recipientEmail = ref('')

async function fetchBoardLogs() {
  boardLogs.value = await $fetch<BoardLog[]>(`/api/boards/${boardId}/logs`)
}

const showCreateForm = ref(false)
const showDeleteModal = ref(false)
const searchQuery = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    await fetchTasks(searchQuery.value)
  }, 300)
})
const selectedTask = ref<Task | null>(null)
const showSettings = ref(false)
const showApplyPlan = ref(false)
const showChangelog = ref(false)
const kanbanBoardRef = ref<{ resetAllSelections: () => void } | null>(null)

function toggleSettings() {
  showSettings.value = !showSettings.value
  if (showSettings.value) {
    nextTick(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }
}
const activeTab = ref<'general' | 'mcp' | 'logs'>('general')
const showHelpModal = ref(false)
const showMcpConfig = ref(false)
const showAgentsMarkdown = ref(false)
const allFunctionsEnabled = ref(true)
const newName = ref('')
const newDescription = ref('')

const currentBoardDescription = useState<string | null>('currentBoardDescription')

watch(() => board.value, (newBoard) => {
  if (newBoard) {
    currentBoardName.value = newBoard.name
    currentBoardDescription.value = newBoard.description
    newName.value = newBoard.name
    newDescription.value = newBoard.description || ''
    activeBoardTransfer.value = newBoard.transfer
    const enabledFunctions = (newBoard.mcpEnabledFunctions as Record<string, boolean>) || {}
    allFunctionsEnabled.value = !Object.values(enabledFunctions).includes(false)
  }
}, { immediate: true })

const viewMode = ref<'board' | 'list'>('board')
const showArchive = ref(false)

const showMassActionModal = ref(false)
const tasksToUpdate = ref<string[]>([])

function openMassAction(taskIds: string[]) {
  tasksToUpdate.value = taskIds
  showMassActionModal.value = true
}

async function performMassUpdate(status: string) {
  try {
    await $fetch('/api/tasks', {
      method: 'POST',
      body: { taskIds: tasksToUpdate.value, status }
    })
    showMassActionModal.value = false
    tasksToUpdate.value = []
    kanbanBoardRef.value?.resetAllSelections()
    await fetchTasks()
  } catch (e: any) {
    alert(e.data?.message || 'Failed to update tasks')
  }
}

async function requestTransfer() {
  if (!recipientEmail.value) return
  try {
    await $fetch(`/api/boards/${boardId}/transfer`, { method: 'POST', body: { email: recipientEmail.value } })
    window.location.reload()
  } catch (e: any) {
    alert(e.data?.message || 'Failed to request transfer')
  }
}

async function cancelTransfer() {
  try {
    await $fetch(`/api/boards/${boardId}/transfer/cancel`, { method: 'POST' })
    window.location.reload()
  } catch (e: any) {
    alert(e.data?.message || 'Failed to cancel transfer')
  }
}

async function acceptTransfer() {
  try {
    await $fetch(`/api/boards/${boardId}/transfer/accept`, { method: 'POST' })
    window.location.reload()
  } catch (e: any) {
    alert(e.data?.message || 'Failed to accept transfer')
  }
}

const mcpConfigCopied = ref(false)
const mcpToken = ref<string | null>(null)
const tokenLoading = ref(false)
const showToken = ref(false)
const tokenCopied = ref(false)
const mcpFunctions = ref<string[]>([])

async function togglePublicMcp() {
  if (!board.value || board.value.role !== 'owner') return
  const newValue = !board.value.mcpPublic
  try {
    const updated = await $fetch<Board & { role: string }>(`/api/boards/${boardId}`, {
      method: 'PATCH',
      body: { mcpPublic: newValue }
    })
    board.value.mcpPublic = updated.mcpPublic
  } catch (e: any) {
    alert(e.data?.message || 'Failed to update MCP privacy setting')
  }
}

async function toggleMcpFunction(fn: string) {
  if (!board.value || board.value.role !== 'owner') return
  const currentFunctions = (board.value.mcpEnabledFunctions as Record<string, boolean>) || {}
  const newValue = currentFunctions[fn] !== false
  const newFunctions = { ...currentFunctions, [fn]: !newValue }

  try {
    const updated = await $fetch<Board & { role: string }>(`/api/boards/${boardId}`, {
      method: 'PATCH',
      body: { mcpEnabledFunctions: newFunctions }
    })
    board.value.mcpEnabledFunctions = updated.mcpEnabledFunctions
  } catch (e: any) {
    alert(e.data?.message || 'Failed to update MCP function setting')
  }
}

async function updateBoardInfo() {
  if (!board.value || board.value.role !== 'owner' || !newName.value) return
  try {
    const updated = await $fetch<Board & { role: string }>(`/api/boards/${boardId}`, {
      method: 'PATCH',
      body: {
        name: newName.value.trim(),
        description: newDescription.value.trim()
      }
    })
    board.value.name = updated.name
    currentBoardName.value = updated.name
    board.value.description = updated.description
  } catch (e: any) {
    alert(e.data?.message || 'Failed to update board information')
  }
}

async function copyToken() {
  if (!mcpToken.value) return
  await navigator.clipboard.writeText(mcpToken.value)
  tokenCopied.value = true
  setTimeout(() => { tokenCopied.value = false }, 2000)
}

const mcpConfig = computed(() => {
  const origin = import.meta.client ? window.location.origin : ''
  const url = `${origin}/api/boards/${boardId}/mcp`

  const server: Record<string, any> = {
    type: 'streamable-http',
    url
  }
  if (mcpToken.value) {
    server.headers = {
      Authorization: `Bearer ${mcpToken.value}`
    }
  }

  const config = {
    mcpServers: {
      'moo-tasks': server
    }
  }
  return JSON.stringify(config, null, 2)
})

async function copyMcpConfig() {
  await navigator.clipboard.writeText(mcpConfig.value)
  mcpConfigCopied.value = true
  setTimeout(() => { mcpConfigCopied.value = false }, 2000)
}

async function generateToken() {
  tokenLoading.value = true
  try {
    const res = await $fetch<{ token: string }>(`/api/boards/${boardId}/token`, { method: 'POST' })
    mcpToken.value = res.token
    showToken.value = false
  } finally {
    tokenLoading.value = false
  }
}

async function revokeToken() {
  tokenLoading.value = true
  try {
    await $fetch(`/api/boards/${boardId}/token`, { method: 'DELETE' })
    mcpToken.value = null
    showToken.value = false
  } finally {
    tokenLoading.value = false
  }
}

async function exportBoard() {
  const url = `/api/boards/${boardId}/export` + (exportComments.value ? '?exportComments=true' : '')
  const data = await $fetch(url)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const urlObj = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = urlObj
  a.download = `${board.value!.name}.json`
  a.click()
}

async function loadBoard() {
  try {
    const data = await $fetch<Board & { role: string }>(`/api/boards/${boardId}`)
    board.value = data
    mcpToken.value = (data as any).mcpToken || null
  } catch {
    await navigateTo('/dashboard')
  }
}

onMounted(async () => {
  await loadBoard()
  mcpFunctions.value = await $fetch<string[]>('/api/mcp-functions')
  await fetchTasks()

  const taskId = route.query.taskId || route.query.taskid || route.query.task_id
  if (taskId && typeof taskId === 'string') {
    const task = tasks.value.find(t => t.id === taskId)
    if (task) {
      selectedTask.value = task
    }
  }

  startSocket()

  if (import.meta.client) {
    const savedView = localStorage.getItem('viewMode')
    if (savedView === 'board' || savedView === 'list') {
      viewMode.value = savedView
    }
  }
})

watch(activeTab, async (newTab) => {
  if (newTab === 'logs') {
    await fetchBoardLogs()
  }
})

onUnmounted(() => stopSocket())
</script>

<template>
  <main v-if="board" class="w-full min-h-screen flex flex-col px-6">
    <div class="flex-1 flex flex-col w-full max-w-[1600px] mx-auto">
      <Teleport to="#board-actions-teleport">
        <div class="flex items-center gap-3">
          <div class="relative">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search tasks..."
              class="pl-9 pr-4 py-2 text-xs text-gray-900 dark:text-gray-100 bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-xl focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 transition-all w-48"
            />
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div class="flex bg-gray-100 dark:bg-surface-raised p-1 rounded-xl border border-gray-200 dark:border-surface-border">
            <button
              @click="viewMode = 'board'"
              class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg transition-all"
              :class="viewMode === 'board' ? 'bg-white dark:bg-surface-card text-gray-900 dark:text-white shadow-md shadow-black/5 dark:shadow-neon-cyan/5' : ''"
              title="Board view"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              @click="viewMode = 'list'"
              class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg transition-all"
              :class="viewMode === 'list' ? 'bg-white dark:bg-surface-card text-gray-900 dark:text-white shadow-md shadow-black/5 dark:shadow-neon-cyan/5' : ''"
              title="List view"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>
          <button
            @click="showArchive = !showArchive"
            class="p-2.5 rounded-xl border border-gray-200 dark:border-surface-border transition-all active:scale-95 shadow-sm"
            :class="showArchive ? 'bg-gray-200 dark:bg-surface-hover text-gray-900 dark:text-white' : 'bg-white dark:bg-surface-card text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-raised'"
            :title="showArchive ? 'Hide Archive' : 'View Archive'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </button>
          <button
            @click="showApplyPlan = true"
            class="p-2.5 text-gray-600 dark:text-gray-300 bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-xl hover:bg-gray-50 dark:hover:bg-surface-raised transition-all active:scale-95 shadow-sm"
            title="Apply Task Plan"
          >
            <span class="text-sm">📋</span>
          </button>
          <button
            @click="showSettings = !showSettings"
            class="p-2.5 text-gray-600 dark:text-gray-300 bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-xl hover:bg-gray-50 dark:hover:bg-surface-raised transition-all active:scale-95 shadow-sm"
            :class="{ 'ring-2 ring-neon-cyan/30 border-neon-cyan/50': showSettings }"
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            @click="showCreateForm = true"
            class="flex items-center gap-2 px-2.5 sm:px-6 py-2.5 text-sm font-bold uppercase tracking-widest bg-neon-cyan text-cyan-950 dark:text-gray-900 rounded-xl hover:bg-neon-cyan/90 transition-all hover:shadow-lg hover:shadow-neon-cyan/20 active:scale-95"
            title="Create new task"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span class="hidden sm:inline">New Task</span>
          </button>
        </div>
      </Teleport>

    <!-- Delete Board Modal -->
    <DeleteBoardModal
      v-if="showDeleteModal"
      :board-id="boardId"
      :board-name="board.name"
      @close="showDeleteModal = false"
    />

    <!-- MCP Help Modal -->
    <McpHelpModal
      v-if="showHelpModal"
      :board-id="boardId"
      :mcp-token="mcpToken"
      :is-public="board.mcpPublic"
      @close="showHelpModal = false"
      @open-agents="showAgentsMarkdown = true"
    />

    <AgentsMarkdownModal
      v-if="showAgentsMarkdown"
      :board="board"
      :mcp-token="mcpToken"
      @close="showAgentsMarkdown = false"
    />

    <!-- Settings Panel -->
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform -translate-y-4 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform -translate-y-4 opacity-0"
    >
      <div v-if="showSettings" class="mb-8 bg-white dark:bg-surface-card rounded-2xl border border-gray-200 dark:border-surface-border p-6 shadow-xl dark:shadow-[0_0_40px_rgba(0,0,0,0.3)]">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <h3 class="text-sm font-bold uppercase tracking-widest text-gray-900 dark:text-white">Board Settings</h3>
            <button
              @click="showHelpModal = true"
              class="w-6 h-6 flex items-center justify-center rounded-full bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 hover:bg-neon-cyan/20 transition-all text-xs"
              title="MCP Help Guide"
            >
              ❓
            </button>
          </div>
          <button
            @click="showSettings = false"
            class="w-10 h-10 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-surface-hover transition-all"
            title="Close Settings"
          >
            <span class="text-2xl">&times;</span>
          </button>
        </div>


        <!-- Tabs -->
        <div class="flex items-center gap-6 mb-6 border-b border-gray-200 dark:border-surface-border">
          <button
            @click="activeTab = 'general'"
            class="pb-2 text-sm font-bold uppercase tracking-widest transition-colors"
            :class="activeTab === 'general' ? 'text-neon-cyan border-b-2 border-neon-cyan' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white'"
          >
            General
          </button>
          <button
            @click="activeTab = 'mcp'"
            class="pb-2 text-sm font-bold uppercase tracking-widest transition-colors"
            :class="activeTab === 'mcp' ? 'text-neon-cyan border-b-2 border-neon-cyan' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white'"
          >
            MCP
          </button>
          <button
            @click="activeTab = 'logs'"
            class="pb-2 text-sm font-bold uppercase tracking-widest transition-colors"
            :class="activeTab === 'logs' ? 'text-neon-cyan border-b-2 border-neon-cyan' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white'"
          >
            Logs
          </button>
        </div>

        <div v-show="activeTab === 'general'" class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div class="space-y-6">
            <!-- General Board Settings -->
            <div v-if="board.role === 'owner'" class="space-y-4">
              <div class="space-y-3">
                <label class="text-sm font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300 block ml-1">Board Name</label>
                <input
                  v-model="newName"
                  type="text"
                  class="w-full bg-gray-50 dark:bg-surface-dark/50 border border-gray-200 dark:border-surface-border rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 transition-all"
                  placeholder="Board Name"
                />
              </div>

              <div class="space-y-3">
                <label class="text-sm font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300 block ml-1">Board Description</label>
                <textarea
                  v-model="newDescription"
                  class="w-full bg-gray-50 dark:bg-surface-dark/50 border border-gray-200 dark:border-surface-border rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 transition-all"
                  placeholder="Board Description"
                  rows="3"
                />
              </div>

              <button
                @click="updateBoardInfo"
                :disabled="!newName || (newName === board.name && newDescription === (board.description || ''))"
                class="w-full text-sm font-bold uppercase tracking-widest px-4 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-200 transition-all disabled:opacity-50 shadow-sm active:scale-95"
              >
                Save Changes
              </button>

              <div class="mt-8 border-t border-gray-200 dark:border-surface-border pt-8">
                <h3 class="text-sm font-bold uppercase tracking-widest text-gray-900 dark:text-white mb-4">Transfer Ownership</h3>
                <div v-if="activeBoardTransfer" class="bg-neon-orange/10 border border-neon-orange/20 rounded-xl p-4">
                  <p class="text-sm text-gray-700 dark:text-gray-300">A pending transfer to {{ activeBoardTransfer.recipientEmail }} exists.</p>
                  <button @click="cancelTransfer" class="mt-2 text-xs font-bold text-red-600 dark:text-neon-red">Cancel Transfer</button>
                </div>
                <div v-else class="flex gap-2">
                  <input v-model="recipientEmail" type="email" placeholder="Recipient email" class="flex-1 bg-gray-50 dark:bg-surface-dark/50 border border-gray-200 dark:border-surface-border rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white" />
                  <button @click="requestTransfer" class="text-sm font-bold uppercase tracking-widest px-4 py-2 rounded-xl bg-neon-cyan text-white">Transfer</button>
                </div>
              </div>

              <div v-if="activeBoardTransfer && activeBoardTransfer.recipientEmail === userEmail" class="mt-8 border-t border-gray-200 dark:border-surface-border pt-8">
                <h3 class="text-sm font-bold uppercase tracking-widest text-gray-900 dark:text-white mb-4">Accept Ownership</h3>
                <button @click="acceptTransfer" class="text-sm font-bold uppercase tracking-widest px-4 py-2 rounded-xl bg-neon-cyan text-white">Accept Ownership</button>
              </div>
            </div>
          </div>

          <div class="space-y-6">
            <BoardMembers :board-id="boardId" :is-owner="board.role === 'owner'" />
          </div>
        </div>

        <div v-show="activeTab === 'logs'" class="space-y-4">
          <div v-if="boardLogs.length === 0" class="text-xs text-gray-500 dark:text-gray-400">No logs found.</div>
          <div v-for="log in boardLogs" :key="log.id" class="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-surface-dark/50 p-3 rounded-lg border border-gray-100 dark:border-surface-border">
             <div class="flex gap-2">
                <span class="font-bold text-neon-cyan">{{ log.type }}</span>
                <span>{{ log.action }}</span>
                <span class="ml-auto text-gray-400">{{ new Date(log.createdAt).toLocaleString() }}</span>
             </div>
             <div v-if="log.data" class="mt-1 font-mono text-[10px] text-gray-500 overflow-x-auto">{{ JSON.stringify(log.data) }}</div>
          </div>
        </div>

        <div v-show="activeTab === 'mcp'" class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div class="space-y-6">
            <!-- MCP Bearer Token, Privacy, Functions -->
            <div v-if="board.role === 'owner'" class="space-y-3">
              <label class="text-sm font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300 block ml-1">MCP Bearer Token</label>
              <div v-if="mcpToken" class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div class="flex-1 flex items-center gap-3 bg-gray-50 dark:bg-surface-dark/50 border border-gray-200 dark:border-surface-border rounded-xl px-4 py-2.5">
                  <code class="flex-1 text-[11px] font-mono truncate text-gray-700 dark:text-neon-cyan/80">
                    {{ showToken ? mcpToken : '••••••••••••••••••••••••••••••••' }}
                  </code>
                  <div class="flex items-center gap-1">
                    <button
                      @click="showToken = !showToken"
                      class="p-1.5 hover:bg-gray-200 dark:hover:bg-surface-hover rounded-lg transition-colors text-xs"
                      :title="showToken ? 'Hide token' : 'Show token'"
                    >
                      {{ showToken ? '👁️' : '🙈' }}
                    </button>
                    <button
                      @click="copyToken"
                      class="p-1.5 hover:bg-gray-200 dark:hover:bg-surface-hover rounded-lg transition-colors text-xs"
                      :title="tokenCopied ? 'Copied!' : 'Copy token'"
                    >
                      {{ tokenCopied ? '✅' : '📋' }}
                    </button>
                  </div>
                </div>
                <div class="flex gap-2">
                  <button @click="generateToken" :disabled="tokenLoading" class="flex-1 sm:flex-none text-sm font-bold uppercase tracking-widest px-4 py-2.5 rounded-xl border border-neon-orange/20 bg-neon-orange/5 text-orange-600 dark:text-neon-orange hover:bg-neon-orange/15 transition-all disabled:opacity-50">
                    🔄 Rotate
                  </button>
                  <button @click="revokeToken" :disabled="tokenLoading" class="flex-1 sm:flex-none text-sm font-bold uppercase tracking-widest px-4 py-2.5 rounded-xl border border-neon-red/20 bg-neon-red/5 text-red-600 dark:text-neon-red hover:bg-neon-red/15 transition-all disabled:opacity-50">
                    🗑 Revoke
                  </button>
                </div>
              </div>
              <div v-else>
                <button @click="generateToken" :disabled="tokenLoading" class="text-sm font-bold uppercase tracking-widest px-5 py-2.5 rounded-xl border border-neon-cyan/20 bg-neon-cyan/5 text-cyan-600 dark:text-neon-cyan hover:bg-neon-cyan/15 transition-all disabled:opacity-50 shadow-sm shadow-neon-cyan/5">
                  🔑 Generate Token
                </button>
                <p v-if="!board.mcpPublic" class="text-[10px] font-semibold text-red-500 dark:text-neon-red/80 mt-2 ml-1">
                  The MCP endpoint is private. A token is required for access.
                </p>
              </div>
            </div>

            <!-- MCP Privacy Setting -->
            <div v-if="board.role === 'owner'" class="bg-gray-50 dark:bg-surface-raised/30 rounded-xl p-4 border border-gray-100 dark:border-surface-border/50">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <label class="text-sm font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300 block mb-1">Public MCP Endpoint</label>
                  <p class="text-[10px] font-medium text-gray-500 dark:text-gray-500 leading-relaxed">Allow access to this board's MCP server without a bearer token.</p>
                </div>
                <button
                  @click="togglePublicMcp"
                  class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                  :class="board.mcpPublic ? 'bg-neon-cyan shadow-[0_0_10px_rgba(0,240,255,0.3)]' : 'bg-gray-200 dark:bg-surface-raised'"
                >
                  <span
                    class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200 ease-in-out"
                    :class="board.mcpPublic ? 'translate-x-5' : 'translate-x-0'"
                  />
                </button>
              </div>

              <!-- MCP Functions Settings -->
              <div class="mt-4 pt-4 border-t border-gray-100 dark:border-surface-border">
                <ColumnPermissions :board-id="boardId" />
                <div class="flex items-center justify-between mb-3 mt-6">
                  <label class="text-sm font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300 block">Enabled MCP Functions</label>
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] text-gray-500 uppercase tracking-widest">All</span>
                    <button
                      @click="allFunctionsEnabled = !allFunctionsEnabled"
                      class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                      :class="allFunctionsEnabled ? 'bg-neon-cyan' : 'bg-gray-200 dark:bg-surface-raised'"
                    >
                      <span
                        class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition duration-200 ease-in-out"
                        :class="allFunctionsEnabled ? 'translate-x-4' : 'translate-x-0'"
                      />
                    </button>
                  </div>
                </div>
                <div v-if="!allFunctionsEnabled" class="space-y-2">
                  <div v-for="fn in mcpFunctions" :key="fn" class="flex items-center justify-between">
                    <span class="text-xs text-gray-600 dark:text-gray-400">{{ fn }}</span>
                    <button
                      @click="toggleMcpFunction(fn)"
                      class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                      :class="((board.mcpEnabledFunctions as Record<string, boolean>) || {})[fn] !== false ? 'bg-neon-cyan' : 'bg-gray-200 dark:bg-surface-raised'"
                    >
                      <span
                        class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition duration-200 ease-in-out"
                        :class="((board.mcpEnabledFunctions as Record<string, boolean>) || {})[fn] !== false ? 'translate-x-4' : 'translate-x-0'"
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="space-y-6">
             <!-- MCP Project Setup -->
            <div class="space-y-4">
              <div class="space-y-2 ml-1">
                <label class="text-sm font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300">Project Integration</label>
                <p class="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  Copy <code class="font-mono bg-gray-100 dark:bg-surface-raised px-1 py-0.5 rounded">AGENTS.md</code> to your project root to enable task discovery and MCP integration.
                </p>
                <button
                  @click="showAgentsMarkdown = true"
                  class="text-sm font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all shadow-sm bg-neon-purple/10 text-neon-purple border border-neon-purple/20 hover:bg-neon-purple/20"
                >
                  📄 View AGENTS.md
                </button>
              </div>

              <!-- MCP Config Snippet -->
              <div class="space-y-3">
                <div class="flex items-center justify-between ml-1 cursor-pointer" @click="showMcpConfig = !showMcpConfig">
                  <div class="flex items-center gap-2">
                    <span class="text-gray-400">{{ showMcpConfig ? '▼' : '▶' }}</span>
                    <label class="text-sm font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300">MCP Client Configuration</label>
                  </div>
                  <div class="flex gap-2" @click.stop>
                    <button
                      @click="copyMcpConfig"
                      class="text-sm font-bold uppercase tracking-widest px-4 py-2 rounded-xl transition-all shadow-sm"
                      :class="mcpConfigCopied
                        ? 'bg-neon-green text-gray-900 shadow-neon-green/20'
                        : 'bg-gray-100 dark:bg-surface-raised text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'"
                    >
                      {{ mcpConfigCopied ? '✓ Copied' : '📋 Copy JSON' }}
                    </button>
                  </div>
                </div>
                <div v-if="showMcpConfig" class="relative group">
                  <pre class="bg-gray-900 dark:bg-surface-dark/80 text-neon-green text-[11px] rounded-xl p-5 overflow-x-auto border border-transparent dark:border-surface-border shadow-inner dark:shadow-black transition-all hover:border-neon-green/30"><code>{{ mcpConfig }}</code></pre>
                  <div class="absolute inset-0 bg-neon-green/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity rounded-xl"></div>
                  <p class="text-[10px] font-medium text-gray-400 dark:text-gray-500 leading-relaxed ml-1 mt-2">Add this to your MCP client configuration (e.g. Claude Code, Cursor, VS Code).</p>
                </div>
              </div>
          </div>

            <BoardInstructions :board-id="boardId" :is-owner="board.role === 'owner'" />
          </div>
        </div>

        <!-- Settings Footer (Export/Delete) -->
        <div class="mt-8 pt-8 border-t border-gray-200 dark:border-surface-border flex items-center justify-end gap-4">
          <!-- Export Board -->
          <div class="flex items-center gap-2">
            <input type="checkbox" v-model="exportComments" id="export-comments" class="rounded border-gray-300 text-neon-cyan focus:ring-neon-cyan" />
            <label for="export-comments" class="text-sm font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300 cursor-pointer">Export Comments</label>
          </div>
          <button
            @click="exportBoard"
            class="px-4 py-2 text-sm font-bold uppercase tracking-widest bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-200 transition-all active:scale-95"
          >
            Export Board
          </button>
          <!-- Delete Board -->
          <button
            @click="showDeleteModal = true"
            class="px-4 py-2 text-sm font-bold uppercase tracking-widest bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all active:scale-95"
          >
            Delete Board
          </button>
        </div>
      </div>
    </transition>

    <div class="relative min-h-[60vh]">
      <KanbanBoard v-if="viewMode === 'board'"
                   ref="kanbanBoardRef"
                   :board-id="boardId"
                   :show-archive="showArchive"
                   :search-query="searchQuery"
                   :tags="tags"
                   @task-click="selectedTask = $event"
                   @open-mass-action="openMassAction"
                   @generate-changelog="showChangelog = true"
      />
      <TaskListView v-else
                    ref="kanbanBoardRef"
                    :board-id="boardId"
                    :show-archive="showArchive"
                    :search-query="searchQuery"
                    @task-click="selectedTask = $event"
                    @open-mass-action="openMassAction"
                    @generate-changelog="showChangelog = true"
      />
    </div>

    <transition
      enter-active-class="modal-enter-active"
      enter-from-class="modal-enter-from"
      leave-active-class="modal-leave-active"
      leave-to-class="modal-leave-to"
    >
      <CreateTaskForm v-if="showCreateForm" :board-id="boardId" @close="showCreateForm = false" />
    </transition>

    <transition
      enter-active-class="modal-enter-active"
      enter-from-class="modal-enter-from"
      leave-active-class="modal-leave-active"
      leave-to-class="modal-leave-to"
    >
      <TaskDetailModal v-if="selectedTask" :task="selectedTask" :board-id="boardId" @close="selectedTask = null" @open-task="selectedTask = $event" />
    </transition>

    <transition
      enter-active-class="modal-enter-active"
      enter-from-class="modal-enter-from"
      leave-active-class="modal-leave-active"
      leave-to-class="modal-leave-to"
    >
      <MassActionModal v-if="showMassActionModal" @close="showMassActionModal = false" @confirm="performMassUpdate" />
    </transition>

    <ApplyPlanModal v-if="showApplyPlan" :board-id="boardId" @close="showApplyPlan = false" @applied="fetchTasks" />
    <ChangelogModal v-if="showChangelog" :board-id="boardId" @close="showChangelog = false" />
    </div>
  </main>
</template>
