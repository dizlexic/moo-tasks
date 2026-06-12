<script setup lang="ts">
const props = defineProps<{ boardId: string }>()
const emit = defineEmits<{ close: [] }>()

const template = ref('simple')
const copied = ref(false)

const { data, refresh, pending } = await useFetch(() => `/api/boards/${props.boardId}/changelog?template=${template.value}`)

const changelog = computed(() => data.value?.changelog || '')

async function copyChangelog() {
  if (!changelog.value) return
  await navigator.clipboard.writeText(changelog.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

function downloadChangelog() {
  if (!changelog.value) return
  const blob = new Blob([changelog.value], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `changelog-${new Date().toISOString().split('T')[0]}.md`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="changelog-modal-title">
    <div class="absolute inset-0 bg-gray-950/60 backdrop-blur-sm" @mousedown="emit('close')"></div>

    <div class="relative w-full max-w-3xl bg-white dark:bg-surface-card rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-100 dark:border-surface-border animate-in fade-in zoom-in duration-200">
      <!-- Header -->
      <div class="p-6 border-b border-gray-100 dark:border-surface-border/50 flex items-center justify-between shrink-0 bg-gray-50/50 dark:bg-surface-raised/20">
        <div>
          <h2 id="changelog-modal-title" class="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
            <span class="text-neon-cyan">📝</span> Generate Changelog
          </h2>
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">Summarize completed tasks into a markdown report.</p>
        </div>
        <button
          @click="emit('close')"
          class="p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-surface-hover transition-all text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Settings -->
      <div class="px-6 py-4 border-b border-gray-100 dark:border-surface-border/50 flex items-center gap-4 bg-gray-50/30 dark:bg-surface-dark/10">
        <label class="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Template:</label>
        <div class="flex gap-2">
          <button
            v-for="t in ['simple', 'detailed', 'priority']"
            :key="t"
            @click="template = t"
            class="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border"
            :class="template === t
              ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30 shadow-sm shadow-neon-cyan/10'
              : 'bg-white dark:bg-surface-raised text-gray-400 dark:text-gray-500 border-gray-200 dark:border-surface-border hover:text-gray-600 dark:hover:text-gray-300'"
          >
            {{ t }}
          </button>
        </div>
        <div v-if="pending" class="ml-auto">
          <div class="w-4 h-4 border-2 border-neon-cyan/20 border-t-neon-cyan rounded-full animate-spin"></div>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        <div class="relative group">
          <div class="absolute -inset-0.5 bg-gradient-to-r from-neon-cyan to-neon-purple rounded-2xl blur opacity-5 group-hover:opacity-10 transition duration-1000"></div>
          <div class="relative bg-gray-950 rounded-2xl p-6 font-mono text-xs leading-relaxed overflow-x-auto text-gray-300 border border-gray-800 shadow-inner min-h-[200px]">
            <pre v-if="!pending" class="whitespace-pre-wrap">{{ changelog }}</pre>
            <div v-else class="flex items-center justify-center h-48 opacity-20">
               Generating...
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-6 border-t border-gray-100 dark:border-surface-border/50 flex items-center justify-end gap-3 shrink-0">
        <button
          @click="downloadChangelog"
          :disabled="pending"
          class="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-gray-200 dark:border-surface-border text-gray-600 dark:text-gray-300 font-bold text-xs uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-surface-hover transition-all disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download .md
        </button>
        <button
          @click="copyChangelog"
          :disabled="pending"
          class="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-neon-cyan text-cyan-950 dark:text-gray-900 font-bold text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-neon-cyan/20 disabled:opacity-50"
        >
          <svg v-if="!copied" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-3 8h4m-2-2v4" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          {{ copied ? 'Copied!' : 'Copy to Clipboard' }}
        </button>
      </div>
    </div>
  </div>
</template>
