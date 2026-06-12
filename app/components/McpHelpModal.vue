<script setup lang="ts">
const props = defineProps<{ boardId: string; mcpToken: string | null; isPublic: boolean }>()
const emit = defineEmits<{ close: [], 'open-agents': [] }>()

const origin = ref('')
const copied = ref(false)

onMounted(() => {
  origin.value = window.location.origin
})

const mcpUrl = computed(() => {
  return `${origin.value}/api/boards/${props.boardId}/mcp`
})

const copyToClipboard = async (text: string) => {
  await navigator.clipboard.writeText(text)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

const configSnippet = computed(() => {
  const config: any = {
    mcpServers: {
      "moo-tasks": {
        type: "streamable-http",
        url: mcpUrl.value
      }
    }
  }

  if (!props.isPublic) {
    config.mcpServers["moo-tasks"].headers = {
      Authorization: `Bearer <your-bearer-token>`
    }
  }

  return JSON.stringify(config, null, 2)
})
</script>

<template>
  <div class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" @mousedown.self="emit('close')">
    <div class="bg-white dark:bg-surface-card rounded-3xl p-8 shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-surface-border overflow-y-auto max-h-[90vh] animate-in fade-in zoom-in duration-200">
      <div class="flex items-center justify-between mb-8">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-neon-cyan/10 rounded-2xl flex items-center justify-center text-2xl border border-neon-cyan/20">
            🤖
          </div>
          <div>
            <h3 class="text-xl font-black text-gray-900 dark:text-white">MCP Server Guide</h3>
            <p class="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Board ID: {{ boardId }}</p>
          </div>
        </div>
        <button @click="emit('close')" class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-surface-hover text-gray-400 hover:text-gray-600 dark:hover:text-white transition-all text-2xl">&times;</button>
      </div>

      <div class="space-y-8 text-left">
        <!-- Overview -->
        <section>
          <div class="flex items-center gap-2 mb-3">
            <div class="w-1 h-4 bg-neon-cyan rounded-full"></div>
            <h4 class="text-sm font-black uppercase tracking-[0.2em] text-gray-900 dark:text-white">What is this?</h4>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            Moo Tasks is an <strong class="text-gray-900 dark:text-white">MCP Server</strong> (Model Context Protocol). It allows AI agents like Claude, Cursor, and VS Code to interact directly with this board to manage tasks, read instructions, and follow workflows.
          </p>
        </section>

        <!-- AGENTS.md -->
        <section class="space-y-4">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-1 h-4 bg-neon-cyan rounded-full"></div>
            <h4 class="text-sm font-black uppercase tracking-[0.2em] text-gray-900 dark:text-white">Project Integration</h4>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            Copy <code class="font-mono bg-gray-100 dark:bg-surface-raised px-1 py-0.5 rounded">AGENTS.md</code> to your project root to enable task discovery and MCP integration.
          </p>
          <button
            @click="emit('open-agents')"
            class="text-sm font-bold uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all shadow-sm bg-neon-purple/10 text-neon-purple border border-neon-purple/20 hover:bg-neon-purple/20"
          >
            📄 View AGENTS.md
          </button>
        </section>

        <!-- Board Scoped -->
        <section class="bg-neon-cyan/5 border border-neon-cyan/20 rounded-2xl p-6 relative overflow-hidden group">
          <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <span class="text-4xl">🎯</span>
          </div>
          <h4 class="text-sm font-black uppercase tracking-[0.2em] text-cyan-600 dark:text-neon-cyan mb-2">Board-Scoped API</h4>
          <p class="text-[13px] text-cyan-900 dark:text-cyan-100/80 leading-relaxed relative z-10">
            Everything is scoped to <strong class="dark:text-white">this specific board</strong>. There are no global queries. When you connect an agent, it will only see and manage tasks for this project, ensuring focus and security.
          </p>
        </section>

        <!-- Connection Details -->
        <section class="space-y-4">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-1 h-4 bg-neon-cyan rounded-full"></div>
            <h4 class="text-sm font-black uppercase tracking-[0.2em] text-gray-900 dark:text-white">Connection Details</h4>
          </div>

          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-gray-500 block ml-1">MCP Endpoint URL</label>
            <div class="flex items-center gap-2 bg-gray-50 dark:bg-surface-dark/50 border border-gray-200 dark:border-surface-border rounded-xl px-4 py-3 group">
              <code class="flex-1 text-[11px] font-mono text-gray-700 dark:text-neon-cyan/90 truncate">{{ mcpUrl }}</code>
              <button
                @click="copyToClipboard(mcpUrl)"
                class="px-3 py-1.5 bg-white dark:bg-surface-raised border border-gray-200 dark:border-surface-border rounded-lg text-sm font-bold uppercase tracking-widest hover:border-neon-cyan/50 transition-all active:scale-95"
              >
                {{ copied ? '✅ Copied' : '📋 Copy' }}
              </button>
            </div>
          </div>

          <p v-if="!isPublic && !mcpToken" class="text-[11px] font-bold text-red-500 dark:text-neon-red/80 flex items-center gap-2 bg-red-500/5 p-3 rounded-xl border border-red-500/10">
            <span>⚠️</span> This board is private. Generate a Bearer Token in settings to use this URL.
          </p>
        </section>

        <!-- Client Config -->
        <section class="space-y-4">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-1 h-4 bg-neon-cyan rounded-full"></div>
            <h4 class="text-sm font-black uppercase tracking-[0.2em] text-gray-900 dark:text-white">Client Configuration</h4>
          </div>

          <div class="grid grid-cols-1 gap-6">
            <!-- Claude Code -->
            <div class="bg-gray-50 dark:bg-surface-raised/30 border border-gray-100 dark:border-surface-border/50 rounded-2xl p-5">
              <div class="flex items-center justify-between mb-4">
                <h5 class="text-[11px] font-black uppercase tracking-widest text-gray-900 dark:text-white flex items-center gap-2">
                  <span class="w-2 h-2 bg-orange-500 rounded-full"></span>
                  Claude Code / cursor
                </h5>
                <button @click="copyToClipboard(configSnippet)" class="text-[10px] font-bold text-neon-cyan hover:underline uppercase tracking-widest">Copy JSON</button>
              </div>
              <pre class="text-[10px] font-mono text-gray-600 dark:text-neon-green/80 bg-white dark:bg-surface-dark p-4 rounded-xl border border-gray-200 dark:border-surface-border overflow-x-auto shadow-inner">
{{ configSnippet }}</pre>
            </div>
          </div>
        </section>

        <div class="pt-6 border-t border-gray-100 dark:border-surface-border flex justify-end">
          <button @click="emit('close')" class="px-8 py-3.5 text-sm font-black uppercase tracking-[0.2em] bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl hover:scale-[1.02] transition-all active:scale-95 shadow-xl shadow-gray-950/10 dark:shadow-white/5">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
