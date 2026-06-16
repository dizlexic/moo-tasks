<script setup lang="ts">
const props = defineProps<{ boardId: string }>()
const emit = defineEmits<{ close: [], applied: [] }>()

const { data: plans, loading } = await useFetch('/api/plans')

const searchQuery = ref('')
const applying = ref<string | null>(null)
const error = ref('')

const filteredPlans = computed(() => {
  if (!plans.value) return []
  if (!searchQuery.value) return plans.value
  const q = searchQuery.value.toLowerCase()
  return plans.value.filter((p: any) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q))
})

async function applyPlan(planId: string) {
  applying.value = planId
  error.value = ''
  try {
    await $fetch(`/api/boards/${props.boardId}/apply-plan`, {
      method: 'POST',
      body: { planId }
    })
    emit('applied')
    emit('close')
  } catch (e: any) {
    error.value = e.data?.message || 'Failed to apply plan'
  } finally {
    applying.value = null
  }
}
</script>

<template>
  <BaseModal @close="emit('close')">
    <template #header>
        <div>
          <h2 class="text-xl font-black text-gray-900 dark:text-white tracking-tight">Apply Task Plan</h2>
          <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-1">Select a template to populate your board</p>
        </div>
    </template>

    <div class="space-y-4 flex flex-col h-full">
        <div v-if="error" class="p-3 bg-red-50 dark:bg-neon-red/10 border border-red-100 dark:border-neon-red/20 rounded-xl text-xs font-bold text-red-600 dark:text-neon-red">
          {{ error }}
        </div>

        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search plans..."
            class="w-full pl-10 pr-4 py-3 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-surface-raised border border-gray-200 dark:border-surface-border rounded-xl focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 transition-all outline-none"
          />
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div v-if="loading" class="flex justify-center py-12">
            <div class="w-8 h-8 border-2 border-neon-cyan/20 border-t-neon-cyan rounded-full animate-spin"></div>
        </div>

        <div v-else-if="filteredPlans.length === 0" class="text-center py-12">
            <p class="text-sm text-gray-500 dark:text-gray-400">No plans found.</p>
        </div>

        <div v-else class="space-y-3 overflow-y-auto flex-1 pr-2 custom-scrollbar">
          <button
            v-for="plan in filteredPlans"
            :key="plan.id"
            @click="applyPlan(plan.id)"
            :disabled="!!applying"
            class="w-full text-left p-4 bg-white dark:bg-surface-raised/50 border border-gray-100 dark:border-surface-border rounded-2xl hover:border-neon-cyan/50 transition-all group flex items-center justify-between"
          >
            <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                    <h3 class="font-bold text-gray-900 dark:text-white group-hover:text-neon-cyan transition-colors">{{ (plan as any).name }}</h3>
                    <span v-if="(plan as any).isPublic" class="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20">Public</span>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{{ (plan as any).description || 'No description' }}</p>
            </div>
            <div class="ml-4">
                <div v-if="applying === plan.id" class="w-5 h-5 border-2 border-neon-cyan/20 border-t-neon-cyan rounded-full animate-spin"></div>
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-300 group-hover:text-neon-cyan transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
            </div>
          </button>
        </div>
    </div>

    <template #footer>
        <p class="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 text-center">Apply a plan to add its tasks to this board's Todo column</p>
    </template>
  </BaseModal>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 240, 255, 0.1);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 240, 255, 0.3);
}
</style>
