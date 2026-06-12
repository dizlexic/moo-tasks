<script setup lang="ts">
import type { Instruction } from '../../../server/db/schema'

const instrList = ref<Instruction[]>([])
const saving = ref<string | null>(null)
const editContent = ref<Record<string, string>>({})

const typeLabels: Record<string, string> = {
  agent_instructions: 'Agent Instructions',
  task_workflow: 'Task Workflow Prompt',
}

async function fetchInstructions() {
  instrList.value = await $fetch<Instruction[]>('/api/instructions')
  for (const instr of instrList.value) {
    editContent.value[instr.id] = instr.content
  }
}

async function save(instr: Instruction) {
  saving.value = instr.id
  try {
    const updated = await $fetch<Instruction>(`/api/instructions/${instr.id}`, {
      method: 'PUT',
      body: { content: editContent.value[instr.id] },
    })
    const idx = instrList.value.findIndex(i => i.id === instr.id)
    if (idx !== -1) instrList.value[idx] = updated
  } finally {
    saving.value = null
  }
}

async function reset(instr: Instruction) {
  saving.value = instr.id
  try {
    const updated = await $fetch<Instruction>(`/api/instructions/${instr.id}/reset`, { method: 'POST' })
    const idx = instrList.value.findIndex(i => i.id === instr.id)
    if (idx !== -1) {
      instrList.value[idx] = updated
      editContent.value[instr.id] = updated.content
    }
  } finally {
    saving.value = null
  }
}

onMounted(() => fetchInstructions())
</script>

<template>
  <main class="p-6 md:p-8 max-w-4xl mx-auto space-y-8">
    <div class="flex items-center justify-between ml-1">
      <div>
        <h2 class="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Global MCP Instructions</h2>
        <p class="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">These instructions are used by all boards unless overridden.</p>
      </div>
      <NuxtLink to="/dashboard" class="text-sm font-bold uppercase tracking-widest text-neon-cyan hover:underline transition-all">← Back</NuxtLink>
    </div>

    <div v-for="instr in instrList" :key="instr.id" class="bg-white dark:bg-surface-card rounded-3xl border border-gray-200 dark:border-surface-border p-8 shadow-xl dark:shadow-[0_0_40px_rgba(0,0,0,0.3)] space-y-6">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-bold uppercase tracking-widest text-gray-900 dark:text-white">{{ typeLabels[instr.type] || instr.type }}</h3>
        <div class="flex items-center gap-2">
          <span v-if="instr.isDefault" class="text-[10px] font-black uppercase tracking-widest bg-neon-green/10 text-green-600 dark:text-neon-green px-2.5 py-1 rounded-full border border-neon-green/20">Default</span>
          <span v-else class="text-[10px] font-black uppercase tracking-widest bg-neon-orange/10 text-orange-600 dark:text-neon-orange px-2.5 py-1 rounded-full border border-neon-orange/20">Customized</span>
        </div>
      </div>
      <div class="relative group">
        <textarea
          v-model="editContent[instr.id]"
          rows="15"
          class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-dark/50 dark:text-neon-green/90 rounded-2xl px-5 py-4 text-xs font-mono focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none resize-y transition-all leading-relaxed shadow-inner"
          placeholder="Enter global instructions..."
        />
      </div>
      <div class="flex justify-end gap-3 pt-2">
        <button
          v-if="!instr.isDefault"
          @click="reset(instr)"
          :disabled="saving === instr.id"
          class="px-5 py-2.5 text-sm font-bold uppercase tracking-widest text-gray-500 hover:text-red-500 dark:hover:text-neon-red transition-all active:scale-95 disabled:opacity-50"
        >
          Reset to Default
        </button>
        <button
          @click="save(instr)"
          :disabled="saving === instr.id || editContent[instr.id] === instr.content"
          class="px-8 py-2.5 text-sm font-bold uppercase tracking-widest bg-neon-cyan text-cyan-950 dark:text-gray-900 rounded-xl hover:bg-neon-cyan/90 disabled:opacity-50 transition-all shadow-lg shadow-neon-cyan/20 active:scale-95"
        >
          {{ saving === instr.id ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>
    </div>
  </main>
</template>
