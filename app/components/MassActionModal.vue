<script setup lang="ts">
const emit = defineEmits<{ close: []; confirm: [status: string] }>()

const selectedStatus = ref('todo')
const statuses = ['backlog', 'todo', 'in_progress', 'review', 'done', 'archive', 'delete']
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="emit('close')"></div>
    <div class="relative w-full max-w-sm bg-white dark:bg-surface-raised rounded-xl shadow-2xl border border-gray-200 dark:border-surface-border p-6">
      <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Mass Action</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">Select a status to assign to the selected tasks.</p>
      
      <div class="space-y-4 mb-6">
        <select v-model="selectedStatus" class="w-full rounded-lg border-gray-300 dark:border-surface-border bg-white dark:bg-surface-card p-2 text-sm text-gray-900 dark:text-white">
          <option v-for="status in statuses" :key="status" :value="status">{{ status }}</option>
        </select>
      </div>

      <div class="flex justify-end gap-3">
        <button @click="emit('close')" class="px-4 py-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Cancel</button>
        <button @click="emit('confirm', selectedStatus)" class="px-4 py-2 text-sm font-bold bg-neon-cyan text-white rounded-lg hover:bg-neon-cyan/90">Confirm</button>
      </div>
    </div>
  </div>
</template>
