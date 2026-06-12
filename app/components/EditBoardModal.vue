<script setup lang="ts">
const props = defineProps<{ boardId: string; initialName: string; initialDescription: string; initialShowTimeline: boolean; initialAllowAiReview: boolean; initialAllowAccountToken: boolean }>()
const emit = defineEmits<{ close: [], updated: [any] }>()

const name = ref(props.initialName)
const description = ref(props.initialDescription)
const showTimeline = ref(props.initialShowTimeline)
const allowAiReview = ref(props.initialAllowAiReview)
const allowAccountToken = ref(props.initialAllowAccountToken)
const saving = ref(false)
const error = ref('')

async function onSave() {
  if (!name.value.trim()) {
    error.value = 'Board name is required.'
    return
  }

  saving.value = true
  try {
    const updatedBoard = await $fetch(`/api/boards/${props.boardId}`, {
        method: 'PATCH',
        body: { name: name.value, description: description.value, showTimeline: showTimeline.value, allowAiReview: allowAiReview.value, allowAccountToken: allowAccountToken.value }
    })
    emit('updated', updatedBoard)
    emit('close')
  } catch (e: any) {
    error.value = e.data?.message || 'Failed to update board'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @mousedown.self="emit('close')">
    <div class="bg-white dark:bg-surface-card rounded-2xl p-6 shadow-xl w-full max-w-md border border-gray-200 dark:border-surface-border">
      <h3 class="text-lg font-black text-gray-900 dark:text-white mb-4">Edit Board</h3>

      <input v-model="name" type="text" class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-3 text-sm mb-4 focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none" placeholder="Board name" />
      <textarea v-model="description" class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-xl px-4 py-3 text-sm mb-4 focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none" placeholder="Description (optional)" rows="3"></textarea>

      <label class="flex items-center gap-2 mb-2">
        <input v-model="showTimeline" type="checkbox" class="accent-neon-cyan" />
        <span class="text-sm text-gray-700 dark:text-gray-300">Show Task Timeline</span>
      </label>

      <label class="flex items-center gap-2 mb-2">
        <input v-model="allowAiReview" type="checkbox" class="accent-neon-cyan" />
        <span class="text-sm text-gray-700 dark:text-gray-300">Allow AI Review</span>
      </label>

      <label class="flex items-center gap-2 mb-4">
        <input v-model="allowAccountToken" type="checkbox" class="accent-neon-cyan" />
        <span class="text-sm text-gray-700 dark:text-gray-300">Allow Account Token Access</span>
      </label>

      <div v-if="error" class="text-red-500 text-xs font-semibold mb-4">{{ error }}</div>

      <div class="flex justify-end gap-3">
        <button @click="emit('close')" class="px-4 py-2 text-sm font-bold uppercase tracking-widest text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">Cancel</button>
        <button
          @click="onSave"
          :disabled="saving"
          class="px-4 py-2 text-sm font-bold uppercase tracking-widest bg-neon-cyan text-cyan-950 rounded-xl hover:bg-neon-cyan/90 disabled:opacity-50 transition-all shadow-md shadow-neon-cyan/20"
        >
          {{ saving ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>
    </div>
  </div>
</template>
