<script setup lang="ts">
const { boards, invitations, sentInvitations, loading, fetchBoards, fetchInvitations, fetchSentInvitations, acceptInvitation, rejectInvitation, cancelInvitation, createBoard, leaveBoard, toggleFavorite } = useBoards()
const { user } = useUserSession()

const currentPage = ref(1)
const pageSize = 10

const favoriteBoards = computed(() => boards.value.filter(b => b.isFavorite))
const otherBoards = computed(() => boards.value.filter(b => !b.isFavorite))

const paginatedBoards = computed(() => {
  const allOtherBoards = [...favoriteBoards.value.slice(6), ...otherBoards.value]
  const start = (currentPage.value - 1) * pageSize
  return allOtherBoards.slice(start, start + pageSize)
})
const totalPages = computed(() => {
  const allOtherBoards = [...favoriteBoards.value.slice(6), ...otherBoards.value]
  return Math.ceil(allOtherBoards.length / pageSize)
})

const showCreate = ref(false)
const importInput = ref<HTMLInputElement | null>(null)
const newName = ref('')
const newDescription = ref('')
const creating = ref(false)
const createError = ref('')
const createModalRef = ref<HTMLElement | null>(null)

function triggerImport() {
  importInput.value?.click()
}

async function importBoard(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async (e) => {
    const content = e.target?.result as string
    const data = JSON.parse(content)
    try {
        await $fetch('/api/boards/import', { method: 'POST', body: data })
        await fetchBoards()
    } catch (e: any) {
        alert(e.data?.message || 'Failed to import board')
    }
  }
  reader.readAsText(file)
}

function onCreateModalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    showCreate.value = false
  }
}

watch(showCreate, (open) => {
  if (open) {
    nextTick(() => createModalRef.value?.focus())
  }
})

onMounted(() => {
  fetchBoards()
  fetchInvitations()
  fetchSentInvitations()
})

async function onCreate() {
  if (!newName.value.trim()) return
  createError.value = ''
  creating.value = true
  try {
    await createBoard({ name: newName.value.trim(), description: newDescription.value.trim() })
    newName.value = ''
    newDescription.value = ''
    showCreate.value = false
  } catch (e: any) {
    createError.value = e.data?.message || e.statusMessage || 'Failed to create board'
  } finally {
    creating.value = false
  }
}

async function onLeave(boardId: string) {
  if (!confirm('Are you sure you want to leave this board?')) return
  try {
    await leaveBoard(boardId, user.value!.id)
  } catch (e: any) {
    alert(e.data?.message || 'Failed to leave board')
  }
}

const boardContextMenu = ref<any>(null)
const editingBoard = ref<any>(null)
const deletingBoard = ref<any>(null)

function openContextMenu(e: MouseEvent, board: any) {
  boardContextMenu.value.open(e, board)
}
function onEdit(board: any) {
  editingBoard.value = board
}
function onDelete(board: any) {
  deletingBoard.value = board
}
</script>

<template>
  <main class="p-6 md:p-8 max-w-6xl mx-auto space-y-12">
    <!-- Invitations Section -->
    <div v-if="invitations.length > 0" class="space-y-5">
      <h2 class="text-sm font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 flex items-center gap-2 ml-1">
        <span class="flex h-2 w-2 rounded-full bg-neon-cyan shadow-[0_0_8px_rgba(0,240,255,0.6)] animate-pulse"></span>
        Pending Invitations
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="invitation in invitations"
          :key="invitation.id"
          class="bg-white dark:bg-surface-card rounded-2xl shadow-xl border border-neon-cyan/20 dark:border-neon-cyan/10 p-6 flex flex-col justify-between transition-all hover:border-neon-cyan/40"
        >
          <div>
            <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-1 tracking-tight">{{ invitation.boardName }}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">Invited by <span class="text-gray-900 dark:text-gray-200">{{ invitation.inviterName }}</span></p>
          </div>
          <div class="flex gap-3 mt-6">
            <button
              @click="acceptInvitation(invitation.id)"
              class="flex-1 px-4 py-2.5 text-sm font-bold uppercase tracking-widest bg-neon-cyan text-cyan-950 rounded-xl hover:bg-neon-cyan/90 transition-all shadow-lg shadow-neon-cyan/10 active:scale-95"
            >
              Accept
            </button>
            <button
              @click="rejectInvitation(invitation.id)"
              class="flex-1 px-4 py-2.5 text-sm font-bold uppercase tracking-widest bg-gray-50 dark:bg-surface-raised text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-surface-border rounded-xl hover:bg-gray-100 dark:hover:bg-surface-hover transition-all active:scale-95"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Sent Invitations Section -->
    <div v-if="sentInvitations.length > 0" class="space-y-5">
      <h2 class="text-sm font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 ml-1">
        Sent Invitations
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="invitation in sentInvitations"
          :key="invitation.id"
          class="bg-white dark:bg-surface-card rounded-2xl shadow-sm border border-gray-100 dark:border-surface-border p-6 flex flex-col justify-between"
        >
          <div>
            <div class="flex justify-between items-start">
              <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-1 tracking-tight">{{ invitation.boardName }}</h3>
              <span class="text-[9px] bg-gray-100 dark:bg-surface-raised text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full uppercase tracking-widest font-black border border-gray-200 dark:border-surface-border">Pending</span>
            </div>
            <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">Sent to <span class="text-gray-900 dark:text-gray-200">{{ invitation.email }}</span></p>
          </div>
          <div class="mt-6">
            <button
              @click="cancelInvitation(invitation.id)"
              class="w-full px-4 py-2 text-sm font-bold uppercase tracking-widest text-red-500 hover:text-red-700 dark:text-neon-red/70 dark:hover:text-neon-red transition-all"
            >
              Cancel Invitation
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="space-y-8">
      <div class="flex items-center justify-between ml-1">
        <h2 class="text-sm font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">My Boards</h2>
        <div class="flex gap-2">
            <NuxtLink
                to="/plans"
                class="px-4 py-2.5 text-sm font-bold uppercase tracking-widest bg-gray-50 dark:bg-surface-raised/50 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-surface-border rounded-xl hover:bg-gray-100 dark:hover:bg-surface-hover hover:text-neon-cyan transition-all active:scale-95 flex items-center gap-2"
            >
                <span class="text-xs">📋</span>
                Plans
            </NuxtLink>
            <button
                @click="triggerImport"
                class="px-4 py-2.5 text-sm font-bold uppercase tracking-widest bg-gray-100 dark:bg-surface-raised text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-surface-hover transition-all active:scale-95"
            >
                Import
            </button>
            <input type="file" ref="importInput" class="hidden" accept=".json" @change="importBoard" />
            <button
              @click="showCreate = true"
              class="px-6 py-2.5 text-sm font-bold uppercase tracking-widest bg-neon-cyan text-cyan-950 dark:text-gray-900 rounded-xl hover:bg-neon-cyan/90 transition-all hover:shadow-lg hover:shadow-neon-cyan/20 active:scale-95"
            >
              + New Board
            </button>
        </div>
      </div>

      <div v-if="loading" class="flex justify-center py-20">
        <div class="w-8 h-8 border-2 border-neon-cyan/20 border-t-neon-cyan rounded-full animate-spin"></div>
      </div>

      <div v-else-if="boards.length === 0" class="text-center py-24 bg-white dark:bg-surface-card rounded-3xl border-2 border-dashed border-gray-200 dark:border-surface-border/50 shadow-inner">
        <div class="text-4xl mb-6">🐄</div>
        <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">No boards yet</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-xs mx-auto">Create your first board to start managing tasks with your agents.</p>
        <button
          @click="showCreate = true"
          class="px-8 py-3 text-xs font-bold uppercase tracking-widest bg-neon-cyan text-cyan-950 dark:text-gray-900 rounded-2xl hover:bg-neon-cyan/90 transition-all hover:shadow-xl hover:shadow-neon-cyan/20 active:scale-95"
        >
          Create first board
        </button>
      </div>

      <div v-else class="space-y-12">
        <div v-if="favoriteBoards.length > 0">
            <h2 class="text-sm font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 ml-1 mb-6">Favorite Boards</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <NuxtLink
                  v-for="board in favoriteBoards.slice(0, 6)"
                  :key="board.id"
                  :to="`/boards/${board.id}`"
                  class="group relative bg-white dark:bg-surface-card rounded-3xl shadow-sm dark:shadow-xl border border-gray-200 dark:border-surface-border p-8 hover:border-neon-cyan/40 dark:hover:border-neon-cyan/30 transition-all hover:-translate-y-1 hover:shadow-2xl dark:hover:shadow-neon-cyan/10 flex flex-col min-h-[220px]"
                >
                  <div v-if="board.lastActivityAt && (!board.lastVisitedAt || new Date(board.lastActivityAt) > new Date(board.lastVisitedAt))" class="absolute top-4 left-4">
                    <span class="flex h-3 w-3 rounded-full bg-neon-cyan shadow-[0_0_8px_rgba(0,240,255,0.6)] animate-pulse"></span>
                  </div>
                  <div class="mb-4 flex-1 min-w-0">
                    <h3 class="text-xl font-black text-gray-900 dark:text-white mb-2 tracking-tight group-hover:text-neon-cyan transition-colors truncate" :title="board.name">{{ board.name }}</h3>
                    <p v-if="board.description" class="text-sm font-medium text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed">{{ board.description }}</p>
                  </div>

                  <div class="flex items-center justify-between mt-auto pt-6 border-t border-gray-100 dark:border-surface-border/50">
                    <button @click.prevent="toggleFavorite(board.id, !board.isFavorite)" class="text-sm font-bold uppercase tracking-widest text-yellow-500 hover:text-yellow-700 transition-all">
                      {{ board.isFavorite ? '★ Unfavorite' : '☆ Favorite' }}
                    </button>
                    <span class="text-xs opacity-0 group-hover:opacity-100 transition-opacity text-neon-cyan">Open →</span>
                  </div>
                </NuxtLink>
            </div>
        </div>

        <div>
            <h2 class="text-sm font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 ml-1 mb-6">Other Boards</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <NuxtLink
                  v-for="board in paginatedBoards"
                  :key="board.id"
                  :to="`/boards/${board.id}`"
                  class="group relative bg-white dark:bg-surface-card rounded-3xl shadow-sm dark:shadow-xl border border-gray-200 dark:border-surface-border p-8 hover:border-neon-cyan/40 dark:hover:border-neon-cyan/30 transition-all hover:-translate-y-1 hover:shadow-2xl dark:hover:shadow-neon-cyan/10 flex flex-col min-h-[220px]"
                >
                  <div v-if="board.lastActivityAt && (!board.lastVisitedAt || new Date(board.lastActivityAt) > new Date(board.lastVisitedAt))" class="absolute top-4 left-4">
                    <span class="flex h-3 w-3 rounded-full bg-neon-cyan shadow-[0_0_8px_rgba(0,240,255,0.6)] animate-pulse"></span>
                  </div>
                  <div class="mb-4 flex-1 min-w-0">
                    <h3 class="text-xl font-black text-gray-900 dark:text-white mb-2 tracking-tight group-hover:text-neon-cyan transition-colors truncate" :title="board.name">{{ board.name }}</h3>
                    <p v-if="board.description" class="text-sm font-medium text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed">{{ board.description }}</p>
                  </div>

                  <div class="flex items-center justify-between mt-auto pt-6 border-t border-gray-100 dark:border-surface-border/50">
                    <button @click.prevent="toggleFavorite(board.id, !board.isFavorite)" class="text-sm font-bold uppercase tracking-widest text-yellow-500 hover:text-yellow-700 transition-all">
                      {{ board.isFavorite ? '★ Unfavorite' : '☆ Favorite' }}
                    </button>
                    <span class="text-xs opacity-0 group-hover:opacity-100 transition-opacity text-neon-cyan">Open →</span>
                  </div>
                </NuxtLink>
            </div>

            <div v-if="totalPages > 1" class="flex justify-center mt-8 gap-2">
                <button
                    :disabled="currentPage === 1"
                    @click="currentPage--"
                    class="px-4 py-2 text-xs font-bold uppercase rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                >Prev</button>
                <span class="px-4 py-2 text-xs font-bold">{{ currentPage }} / {{ totalPages }}</span>
                <button
                    :disabled="currentPage === totalPages"
                    @click="currentPage++"
                    class="px-4 py-2 text-xs font-bold uppercase rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                >Next</button>
            </div>
        </div>
      </div>
    </div>

    <!-- Create Board Modal -->
    <BoardContextMenu ref="boardContextMenu" @edit="onEdit" @delete="onDelete" />
    <EditBoardModal v-if="editingBoard" :board-id="editingBoard.id" :initial-name="editingBoard.name" :initial-description="editingBoard.description || ''" :initial-show-timeline="!!editingBoard.showTimeline" :initial-allow-ai-review="!!editingBoard.allowAiReview" :initial-allow-account-token="!!editingBoard.allowAccountToken" @close="editingBoard = null" @updated="fetchBoards" />
    <DeleteBoardModal v-if="deletingBoard" :board-id="deletingBoard.id" :board-name="deletingBoard.name" @close="deletingBoard = null" @deleted="fetchBoards" />

    <transition
      enter-active-class="modal-enter-active"
      enter-from-class="modal-enter-from"
      leave-active-class="modal-leave-active"
      leave-to-class="modal-leave-to"
    >
      <div
        v-if="showCreate"
        ref="createModalRef"
        class="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-board-title"
        tabindex="-1"
        @mousedown.self="showCreate = false"
        @keydown="onCreateModalKeydown"
      >
        <div class="modal-panel bg-white dark:bg-surface-card rounded-3xl shadow-2xl dark:shadow-[0_0_40px_rgba(0,0,0,0.5)] w-full max-w-md border border-gray-200 dark:border-surface-border overflow-hidden">
          <div class="p-8">
            <h2 id="create-board-title" class="text-2xl font-black text-gray-900 dark:text-white mb-8 tracking-tight">Create New Board</h2>

            <div v-if="createError" role="alert" class="bg-red-50 dark:bg-neon-red/10 text-red-600 dark:text-neon-red text-sm font-medium rounded-xl px-4 py-3 mb-8 border border-red-200 dark:border-neon-red/20 shadow-sm shadow-neon-red/5">{{ createError }}</div>

            <form @submit.prevent="onCreate" class="space-y-6">
              <div class="space-y-1.5">
                <label for="board-name" class="block text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Board Name *</label>
                <input id="board-name" v-model="newName" type="text" required autofocus class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-3 text-base font-medium focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none transition-all placeholder:text-gray-400" placeholder="e.g. Project X" />
              </div>
              <div class="space-y-1.5">
                <label for="board-description" class="block text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ml-1">Description</label>
                <textarea id="board-description" v-model="newDescription" rows="3" class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none resize-none transition-all placeholder:text-gray-400" placeholder="What's this board for?" />
              </div>
              <div class="flex justify-end gap-3 pt-4">
                <button type="button" @click="showCreate = false" class="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">Cancel</button>
                <button
                  type="submit"
                  :disabled="creating || !newName.trim()"
                  class="px-8 py-2.5 text-xs font-bold uppercase tracking-widest bg-neon-cyan text-cyan-950 dark:text-gray-900 rounded-xl hover:bg-neon-cyan/90 transition-all shadow-lg shadow-neon-cyan/20 active:scale-95"
                >
                  {{ creating ? 'Creating...' : 'Create Board' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </transition>
  </main>
</template>
