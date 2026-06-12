<script setup lang="ts">
const props = defineProps<{ boardId: string; isOwner: boolean }>()

interface InstructionWithSource {
  id: string
  boardId: string | null
  type: string
  content: string
  isDefault: boolean
  source: 'board' | 'global'
  collapsed: boolean
}

const instrList = ref<InstructionWithSource[]>([])
const saving = ref<string | null>(null)
const editContent = ref<Record<string, string>>({})

const typeLabels: Record<string, string> = {
  agent_instructions: 'Agent Instructions',
  task_workflow: 'Task Workflow Prompt',
}

async function fetchInstructions() {
  const data = await $fetch<InstructionWithSource[]>(`/api/boards/${props.boardId}/instructions`)
  instrList.value = data.map(instr => ({ ...instr, collapsed: true }))
  for (const instr of instrList.value) {
    editContent.value[instr.id] = instr.content
  }
}

async function save(instr: InstructionWithSource) {
  saving.value = instr.id
  try {
    const updated = await $fetch(`/api/boards/${props.boardId}/instructions/${instr.id}`, {
      method: 'PUT',
      body: { content: editContent.value[instr.id] },
    }) as InstructionWithSource
    await fetchInstructions()
  } finally {
    saving.value = null
  }
}

async function reset(instr: InstructionWithSource) {
  if (instr.source !== 'board') return
  saving.value = instr.id
  try {
    await $fetch(`/api/boards/${props.boardId}/instructions/${instr.id}/reset`, { method: 'POST' })
    await fetchInstructions()
  } finally {
    saving.value = null
  }
}

onMounted(() => fetchInstructions())
</script>

<template>
  <div class="space-y-6">
    <div class="ml-1">
      <h3 class="text-sm font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300 mb-1">MCP Instructions</h3>
      <p class="text-[10px] font-medium text-gray-500 dark:text-gray-400 leading-relaxed">Override global instructions for this board. Reset removes the override and falls back to global.</p>
    </div>

    <div v-for="instr in instrList" :key="instr.id" class="bg-gray-50 dark:bg-surface-raised/30 rounded-2xl p-5 border border-gray-100 dark:border-surface-border/50 space-y-4 transition-all">
      <div class="flex items-center justify-between cursor-pointer" @click="instr.collapsed = !instr.collapsed">
        <div class="flex items-center gap-2">
           <span class="text-gray-400">{{ instr.collapsed ? '▶' : '▼' }}</span>
           <span class="text-xs font-bold text-gray-900 dark:text-white">{{ typeLabels[instr.type] || instr.type }}</span>
        </div>
        <div class="flex items-center gap-2" @click.stop>
          <span v-if="instr.source === 'global'" class="text-[9px] font-black uppercase tracking-widest bg-gray-100 dark:bg-surface-dark/50 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded border border-gray-200 dark:border-surface-border">Using Global</span>
          <span v-else-if="instr.isDefault" class="text-[9px] font-black uppercase tracking-widest bg-neon-green/10 text-green-600 dark:text-neon-green px-2 py-0.5 rounded border border-neon-green/20">Default</span>
          <span v-else class="text-[9px] font-black uppercase tracking-widest bg-neon-orange/10 text-orange-600 dark:text-neon-orange px-2 py-0.5 rounded border border-neon-orange/20">Board Override</span>
        </div>
      </div>
      <div v-if="!instr.collapsed" class="relative group">
        <textarea
          v-model="editContent[instr.id]"
          rows="6"
          :disabled="!isOwner"
          class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-dark/50 dark:text-neon-green/90 rounded-xl px-4 py-3 text-[11px] font-mono focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none resize-y disabled:opacity-60 transition-all leading-relaxed shadow-inner"
          placeholder="Enter custom instructions..."
        />
      </div>
      <div v-if="!instr.collapsed && isOwner" class="flex justify-end gap-3 pt-1">
        <button
          v-if="instr.source === 'board'"
          @click="reset(instr)"
          :disabled="saving === instr.id"
          class="px-4 py-2 text-sm font-bold uppercase tracking-widest text-gray-500 hover:text-red-500 dark:hover:text-neon-red transition-all active:scale-95 disabled:opacity-50"
        >
          Reset to Global
        </button>
        <button
          @click="save(instr)"
          :disabled="saving === instr.id || editContent[instr.id] === instr.content"
          class="px-5 py-2 text-sm font-bold uppercase tracking-widest bg-neon-cyan text-cyan-950 dark:text-gray-900 rounded-xl hover:bg-neon-cyan/90 disabled:opacity-50 transition-all shadow-md shadow-neon-cyan/10 active:scale-95"
        >
          {{ saving === instr.id ? 'Saving...' : (instr.source === 'global' ? 'Create Override' : 'Save Changes') }}
        </button>
      </div>
    </div>
  </div>
</template>
