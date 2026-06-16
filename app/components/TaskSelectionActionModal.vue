<script setup lang="ts">
const props = defineProps<{ taskIds: string[], boardId: string }>()
const emit = defineEmits<{ close: [], confirm: [action: string, payload?: any] }>()

const action = ref<'status' | 'create-plan' | 'add-to-plan'>('status')
const selectedStatus = ref('todo')
const statuses = ['backlog', 'todo', 'in_progress', 'review', 'done', 'archive', 'delete']

const planName = ref('')
const selectedPlanId = ref('')
const { data: plans } = await useFetch('/api/plans')

</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="emit('close')"></div>
    <div class="relative w-full max-w-sm bg-white dark:bg-surface-raised rounded-xl shadow-2xl border border-gray-200 dark:border-surface-border p-6">
      <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Task Actions ({{ taskIds.length }})</h2>
      
      <div class="space-y-4 mb-6">
        <select v-model="action" class="w-full rounded-lg border-gray-300 dark:border-surface-border bg-white dark:bg-surface-card p-2 text-sm text-gray-900 dark:text-white">
          <option value="status">Change Status</option>
          <option value="create-plan">Create New Plan</option>
          <option value="add-to-plan">Add to Existing Plan</option>
        </select>

        <div v-if="action === 'status'" class="space-y-2">
            <select v-model="selectedStatus" class="w-full rounded-lg border-gray-300 dark:border-surface-border bg-white dark:bg-surface-card p-2 text-sm text-gray-900 dark:text-white">
            <option v-for="status in statuses" :key="status" :value="status">{{ status }}</option>
            </select>
        </div>

        <div v-if="action === 'create-plan'" class="space-y-2">
            <input v-model="planName" type="text" placeholder="Plan Name" class="w-full rounded-lg border-gray-300 dark:border-surface-border bg-white dark:bg-surface-card p-2 text-sm text-gray-900 dark:text-white" />
        </div>

        <div v-if="action === 'add-to-plan'" class="space-y-2">
            <select v-model="selectedPlanId" class="w-full rounded-lg border-gray-300 dark:border-surface-border bg-white dark:bg-surface-card p-2 text-sm text-gray-900 dark:text-white">
                <option value="" disabled>Select a plan</option>
                <option v-for="plan in plans" :key="(plan as any).id" :value="(plan as any).id">{{ (plan as any).name }}</option>
            </select>
        </div>
      </div>

      <div class="flex justify-end gap-3">
        <button @click="emit('close')" class="px-4 py-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Cancel</button>
        <button @click="emit('confirm', action, action === 'status' ? selectedStatus : (action === 'create-plan' ? planName : selectedPlanId))" class="px-4 py-2 text-sm font-bold bg-neon-cyan text-white rounded-lg hover:bg-neon-cyan/90">Confirm</button>
      </div>
    </div>
  </div>
</template>
