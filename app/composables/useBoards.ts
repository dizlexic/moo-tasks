import type { Board } from '../../server/db/schema'

export interface BoardWithActivity extends Board {
  lastVisitedAt: string | null
  lastActivityAt: string | null
  isFavorite: boolean
  favoritedAt: string | null
  favoriteOrder: number
}

export interface Invitation {
  id: string
  boardId: string
  boardName: string
  inviterName?: string
  email?: string
  createdAt: string
}

export function useBoards() {
  const boards = useState<BoardWithActivity[]>('boards', () => [])
  const invitations = useState<Invitation[]>('invitations', () => [])
  const sentInvitations = useState<Invitation[]>('sent-invitations', () => [])
  const loading = useState('boards-loading', () => false)

  async function fetchBoards() {
    loading.value = true
    try {
      boards.value = await $fetch<BoardWithActivity[]>('/api/boards')
    } finally {
      loading.value = false
    }
  }

  async function fetchInvitations() {
    invitations.value = await $fetch<Invitation[]>('/api/invitations')
  }

  async function fetchSentInvitations() {
    sentInvitations.value = await $fetch<Invitation[]>('/api/invitations/sent')
  }

  async function acceptInvitation(id: string) {
    await $fetch(`/api/invitations/${id}/accept`, { method: 'POST' })
    await Promise.all([fetchInvitations(), fetchBoards()])
  }

  async function rejectInvitation(id: string) {
    await $fetch(`/api/invitations/${id}/reject`, { method: 'POST' })
    await fetchInvitations()
  }

  async function cancelInvitation(id: string) {
    await $fetch(`/api/invitations/${id}`, { method: 'DELETE' })
    await fetchSentInvitations()
  }

  async function createBoard(data: { name: string; description?: string }) {
    const board = await $fetch<Board>('/api/boards', { method: 'POST', body: data })
    boards.value.push(board)
    return board
  }

  async function deleteBoard(id: string) {
    await $fetch(`/api/boards/${id}`, { method: 'DELETE' })
    boards.value = boards.value.filter(b => b.id !== id)
  }

  async function leaveBoard(id: string, userId: string) {
    await $fetch(`/api/boards/${id}/members/${userId}`, { method: 'DELETE' })
    boards.value = boards.value.filter(b => b.id !== id)
  }

  async function toggleFavorite(id: string, isFavorite: boolean) {
    await $fetch(`/api/boards/${id}/favorite`, { method: 'PATCH', body: { isFavorite } })
    const board = boards.value.find(b => b.id === id)
    if (board) {
      board.isFavorite = isFavorite
      board.favoritedAt = isFavorite ? new Date().toISOString() : null
      board.favoriteOrder = 0
    }
  }

  async function reorderFavorites(boardIds: string[]) {
    const previousOrders = new Map(boards.value.map(board => [board.id, board.favoriteOrder]))
    boardIds.forEach((id, index) => {
      const board = boards.value.find(candidate => candidate.id === id)
      if (board) board.favoriteOrder = index
    })

    try {
      await $fetch('/api/boards/favorites/reorder', { method: 'PATCH', body: { boardIds } })
    } catch (error) {
      boards.value.forEach(board => {
        const previousOrder = previousOrders.get(board.id)
        if (previousOrder !== undefined) board.favoriteOrder = previousOrder
      })
      throw error
    }
  }

  return { 
    boards, 
    invitations, 
    sentInvitations,
    loading, 
    fetchBoards, 
    fetchInvitations, 
    fetchSentInvitations,
    acceptInvitation, 
    rejectInvitation, 
    cancelInvitation,
    createBoard, 
    deleteBoard,
    leaveBoard,
    toggleFavorite,
    reorderFavorites
  }
}
