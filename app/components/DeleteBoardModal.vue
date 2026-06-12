<script setup lang="ts">
const props = defineProps<{ boardId: string; boardName: string }>()
const emit = defineEmits<{ close: [], deleted: [] }>()

const typedName = ref('')
const deleting = ref(false)
const error = ref('')

async function onDelete() {
  if (typedName.value !== props.boardName) {
    error.value = 'Board name does not match.'
    return
  }

  deleting.value = true
  try {
    await $fetch(`/api/boards/${props.boardId}`, { method: 'DELETE' })
    emit('deleted')
    emit('close')
    navigateTo('/dashboard')
  } catch (e: any) {
    error.value = e.data?.message || 'Failed to delete board'
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @mousedown.self="emit('close')">
    <div class="bg-white dark:bg-surface-card rounded-2xl p-6 shadow-xl w-full max-w-md border border-gray-200 dark:border-surface-border">
      <h3 class="text-lg font-black text-gray-900 dark:text-white mb-4">Delete Board</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Are you sure you want to delete <strong class="text-gray-900 dark:text-white">{{ boardName }}</strong>? This action cannot be undone.
        <br>Please type <strong>{{ boardName }}</strong> to confirm.
      </p>

      <input v-model="typedName" type="text" class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-3 text-sm mb-4 focus:ring-2 focus:ring-red-500/30 focus:border-red-500/50 outline-none" placeholder="Board name" />

      <div v-if="error" class="text-red-500 text-xs font-semibold mb-4">{{ error }}</div>

      <div class="flex justify-end gap-3">
        <button @click="emit('close')" class="px-4 py-2 text-sm font-bold uppercase tracking-widest text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">Cancel</button>
        <button
          @click="onDelete"
          :disabled="deleting || typedName !== boardName"
          class="px-4 py-2 text-sm font-bold uppercase tracking-widest bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 transition-all shadow-md shadow-red-600/20"
        >
          {{ deleting ? 'Deleting...' : 'Delete Board' }}
        </button>
      </div>
    </div>
  </div>
</template>
