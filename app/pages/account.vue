<script setup lang="ts">
const { user } = useUserSession()
const accountInfo = ref<{ id: string, email: string, name: string, hasAccountToken: boolean } | null>(null)
const mcpToken = ref<string | null>(null)
const loading = ref(false)
const tokenLoading = ref(false)
const showToken = ref(false)
const tokenCopied = ref(false)

onMounted(async () => {
  fetchAccountInfo()
})

async function fetchAccountInfo() {
  loading.value = true
  try {
    accountInfo.value = await $fetch('/api/user')
  } catch (e) {
    console.error('Failed to fetch account info', e)
  } finally {
    loading.value = false
  }
}

async function generateToken() {
  tokenLoading.value = true
  try {
    const res = await $fetch<{ token: string }>('/api/user/token', { method: 'POST' })
    mcpToken.value = res.token
    showToken.value = true
    if (accountInfo.value) accountInfo.value.hasAccountToken = true
  } catch (e) {
    alert('Failed to generate token')
  } finally {
    tokenLoading.value = false
  }
}

async function revokeToken() {
  if (!confirm('Are you sure you want to revoke your account token? All agents using this token will lose access to your boards.')) return
  tokenLoading.value = true
  try {
    await $fetch('/api/user/token', { method: 'DELETE' })
    mcpToken.value = null
    showToken.value = false
    if (accountInfo.value) accountInfo.value.hasAccountToken = false
  } catch (e) {
    alert('Failed to revoke token')
  } finally {
    tokenLoading.value = false
  }
}

async function copyToken() {
  if (!mcpToken.value) return
  await navigator.clipboard.writeText(mcpToken.value)
  tokenCopied.value = true
  setTimeout(() => { tokenCopied.value = false }, 2000)
}

const globalMcpUrl = computed(() => {
  if (import.meta.client) {
    return `${window.location.origin}/api/mcp`
  }
  return ''
})

const mcpConfig = computed(() => {
  const server: any = {
    type: 'streamable-http',
    url: globalMcpUrl.value
  }
  if (mcpToken.value) {
    server.headers = {
      Authorization: `Bearer ${mcpToken.value}`
    }
  } else {
    server.headers = {
      Authorization: `Bearer <your-account-token>`
    }
  }

  return JSON.stringify({
    mcpServers: {
      'moo-tasks-global': server
    }
  }, null, 2)
})

async function copyMcpConfig() {
  await navigator.clipboard.writeText(mcpConfig.value)
}
</script>

<template>
  <div class="max-w-4xl mx-auto px-6 py-12">
    <div class="mb-12">
      <h1 class="text-4xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">Account Settings</h1>
      <p class="text-gray-500 dark:text-gray-400 font-medium">Manage your personal account and global AI agent access.</p>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-cyan"></div>
    </div>

    <div v-else-if="accountInfo" class="space-y-8">
      <!-- Profile Info -->
      <section class="bg-white dark:bg-surface-card rounded-3xl p-8 shadow-sm border border-gray-200 dark:border-surface-border">
        <h2 class="text-sm font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-6 flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-neon-cyan"></span>
          Profile Information
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label class="block text-sm font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">Full Name</label>
            <div class="text-lg font-bold text-gray-900 dark:text-white px-4 py-3 bg-gray-50 dark:bg-surface-raised/50 rounded-2xl border border-gray-100 dark:border-surface-border/50">
              {{ accountInfo.name }}
            </div>
          </div>
          <div>
            <label class="block text-sm font-black uppercase tracking-widest text-gray-400 mb-1 ml-1">Email Address</label>
            <div class="text-lg font-bold text-gray-900 dark:text-white px-4 py-3 bg-gray-50 dark:bg-surface-raised/50 rounded-2xl border border-gray-100 dark:border-surface-border/50">
              {{ accountInfo.email }}
            </div>
          </div>
        </div>
      </section>

      <!-- Global MCP Token -->
      <section class="bg-white dark:bg-surface-card rounded-3xl p-8 shadow-sm border border-gray-200 dark:border-surface-border">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-sm font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full bg-neon-purple"></span>
            Global MCP Access
          </h2>
        </div>

        <div class="space-y-6">
          <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            Generate a global account token to allow an AI agent to manage <strong class="text-gray-900 dark:text-white">all your boards</strong>.
            This token also enables global tools like creating new boards via the MCP server.
          </p>

          <div v-if="accountInfo.hasAccountToken || mcpToken" class="space-y-4">
            <div v-if="mcpToken" class="p-6 bg-neon-green/5 border border-neon-green/20 rounded-2xl">
              <label class="block text-sm font-black uppercase tracking-widest text-neon-green mb-2 ml-1">Your New Account Token</label>
              <div class="flex items-center gap-3">
                <code class="flex-1 font-mono text-sm bg-white dark:bg-surface-dark px-4 py-3 rounded-xl border border-neon-green/30 text-gray-900 dark:text-neon-green truncate shadow-inner">
                  {{ mcpToken }}
                </code>
                <button
                  @click="copyToken"
                  class="px-4 py-3 rounded-xl bg-neon-green text-gray-900 font-bold text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-neon-green/20"
                >
                  {{ tokenCopied ? '✓ Copied' : '📋 Copy' }}
                </button>
              </div>
              <p class="text-[10px] font-bold text-red-500 mt-3 ml-1 flex items-center gap-1">
                <span>⚠️</span> Copy this now! You won't be able to see it again.
              </p>
            </div>

            <div class="flex flex-wrap gap-3">
              <button @click="generateToken" :disabled="tokenLoading" class="text-sm font-bold uppercase tracking-widest px-5 py-2.5 rounded-xl bg-neon-purple/10 text-neon-purple border border-neon-purple/20 hover:bg-neon-purple/20 transition-all disabled:opacity-50">
                🔄 Regenerate Token
              </button>
              <button @click="revokeToken" :disabled="tokenLoading" class="text-sm font-bold uppercase tracking-widest px-5 py-2.5 rounded-xl border border-neon-red/20 bg-neon-red/5 text-red-600 dark:text-neon-red hover:bg-neon-red/15 transition-all disabled:opacity-50">
                🗑 Revoke Token
              </button>
            </div>
          </div>

          <div v-else>
            <button @click="generateToken" :disabled="tokenLoading" class="text-sm font-bold uppercase tracking-widest px-6 py-3 rounded-xl bg-neon-purple text-white hover:bg-neon-purple/90 transition-all shadow-lg shadow-neon-purple/20 active:scale-95">
              🔑 Generate Account Token
            </button>
          </div>

          <div v-if="accountInfo.hasAccountToken || mcpToken" class="mt-8 pt-8 border-t border-gray-100 dark:border-surface-border/50">
            <h3 class="text-sm font-bold text-gray-900 dark:text-white mb-4">Global MCP Configuration</h3>
            <div class="relative group">
                <pre class="bg-gray-900 dark:bg-surface-dark/80 text-neon-green text-[11px] rounded-xl p-5 overflow-x-auto border border-transparent dark:border-surface-border shadow-inner dark:shadow-black transition-all hover:border-neon-green/30"><code>{{ mcpConfig }}</code></pre>
                <button @click="copyMcpConfig" class="absolute top-4 right-4 text-[10px] font-bold text-neon-green hover:underline uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Copy JSON</button>
            </div>
            <p class="text-[10px] font-medium text-gray-500 mt-4 ml-1">
                Endpoint URL: <code class="text-neon-cyan">{{ globalMcpUrl }}</code>
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
