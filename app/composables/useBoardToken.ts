import { ref, computed } from 'vue'

export function useBoardToken(boardId: string) {
  const mcpToken = ref<string | null>(null)
  const tokenLoading = ref(false)

  async function generateToken() {
    tokenLoading.value = true
    try {
      const res = await $fetch<{ token: string }>(`/api/boards/${boardId}/token`, { method: 'POST' })
      mcpToken.value = res.token
    } finally {
      tokenLoading.value = false
    }
  }

  async function revokeToken() {
    tokenLoading.value = true
    try {
      await $fetch(`/api/boards/${boardId}/token`, { method: 'DELETE' })
      mcpToken.value = null
    } finally {
      tokenLoading.value = false
    }
  }

  const mcpConfig = computed(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const server = {
      type: 'streamable-http',
      url: `${origin}/api/boards/${boardId}/mcp`,
      headers: {
        Authorization: `Bearer ${mcpToken.value || '<your-bearer-token>'}`
      }
    }
    const config = {
      mcpServers: {
        'moo-tasks': server
      }
    }
    return JSON.stringify(config, null, 2)
  })

  return {
    mcpToken,
    tokenLoading,
    generateToken,
    revokeToken,
    mcpConfig
  }
}
