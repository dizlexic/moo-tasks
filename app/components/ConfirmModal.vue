<template>
  <div
    class="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-white dark:bg-surface-card rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 dark:border-surface-border p-6">
      <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-4">{{ title }}</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">{{ message }}</p>
      <div class="flex justify-end gap-2">
        <button type="button" @click="emit('cancel')" class="px-3 py-2 text-sm font-bold uppercase tracking-widest text-gray-500">Cancel</button>
        <button type="button" @click="emit('confirm')" class="px-4 py-2 text-sm font-bold uppercase tracking-widest bg-red-500 text-white rounded-lg hover:bg-red-600">Delete</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; message: string }>()
const emit = defineEmits(['confirm', 'cancel'])
</script>
