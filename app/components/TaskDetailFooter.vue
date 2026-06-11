<script setup lang="ts">
defineProps<{
  saving: boolean
  confirmDelete: boolean
  titleValid: boolean
}>()

const emit = defineEmits<{
  cancel: []
  save: []
  delete: []
  toggleConfirmDelete: [val: boolean]
}>()
</script>

<template>
  <div class="border-t pt-6 flex items-center justify-between">
    <div>
      <button v-if="!confirmDelete" type="button" @click="emit('toggleConfirmDelete', true)" class="text-xs font-bold uppercase tracking-widest text-red-500 hover:text-red-700 dark:text-neon-red/70 dark:hover:text-neon-red transition-all">Delete Task</button>
      <div v-else class="flex items-center gap-3" role="alert">
        <span class="text-[10px] font-bold uppercase tracking-widest text-red-600 dark:text-neon-red">Confirm?</span>
        <button type="button" @click="emit('delete')" class="text-[10px] font-bold uppercase tracking-widest text-red-700 dark:text-neon-red hover:underline">Yes, delete</button>
        <button type="button" @click="emit('toggleConfirmDelete', false)" class="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Cancel</button>
      </div>
    </div>
    <div class="flex gap-2">
      <button type="button" @click="emit('cancel')" class="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors" title="Cancel">Cancel</button>
      <button
        type="button"
        @click="emit('save')"
        :disabled="saving || !titleValid"
        class="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-neon-cyan text-cyan-950 dark:text-gray-900 rounded-lg hover:bg-neon-cyan/90 disabled:opacity-50 transition-all shadow-md shadow-neon-cyan/20 active:scale-95"
      >
        {{ saving ? 'Saving...' : 'Save' }}
      </button>
    </div>
  </div>
</template>
