<template>
  <div
    class="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
    role="dialog"
    aria-modal="true"
    @mousedown.self="emit('close')"
  >
    <div class="bg-white dark:bg-surface-card rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 dark:border-surface-border p-6">
      <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Create New Tag</h2>
      <form @submit.prevent="onSubmit" class="space-y-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Name</label>
          <input v-model="name" type="text" required class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Color (e.g. #ff0000)</label>
          <input v-model="color" type="color" required class="w-full h-10 border border-gray-200 dark:border-surface-border dark:bg-surface-raised rounded-lg" />
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Icon</label>
          <button
            type="button"
            @click="isDropdownOpen = !isDropdownOpen"
            class="w-full flex items-center justify-between border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-lg px-3 py-2 text-lg hover:border-neon-cyan"
          >
            <span>{{ iconMap[icon as keyof typeof iconMap] }}</span>
            <span class="text-xs text-gray-500">{{ isDropdownOpen ? '▲' : '▼' }}</span>
          </button>

          <div v-if="isDropdownOpen" class="grid grid-cols-5 gap-2 mt-2 p-2 border border-gray-200 dark:border-surface-border rounded-lg bg-white dark:bg-surface-raised">
            <button
              v-for="(emoji, name) in iconMap"
              :key="name"
              type="button"
              @click="icon = name; isDropdownOpen = false"
              :class="icon === name ? 'border-neon-cyan bg-neon-cyan/10' : 'border-gray-200 dark:border-surface-border'"
              class="w-full aspect-square flex items-center justify-center border rounded-lg text-lg hover:border-neon-cyan"
            >
              {{ emoji }}
            </button>
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-6">
          <button type="button" @click="emit('close')" class="px-3 py-2 text-xs font-bold uppercase tracking-widest text-gray-500">Cancel</button>
          <button type="submit" class="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-neon-cyan text-cyan-950 rounded-lg hover:bg-neon-cyan/90">Create</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { iconMap } from '../utils/icons'
const props = defineProps<{ boardId: string }>()
const emit = defineEmits<{ close: []; created: [tag: any] }>()
const { createTag, fetchTags } = useTags(props.boardId)
const name = ref('')
const color = ref('#3b82f6')
const icon = ref('tag')
const isDropdownOpen = ref(false)

async function onSubmit() {
  try {
    console.log('Creating tag:', { name: name.value, color: color.value, icon: icon.value })
    const tag = await createTag({ name: name.value, color: color.value, icon: icon.value })
    console.log('Tag created successfully:', tag)
    emit('created', tag)
    emit('close')
  } catch (e: any) {
    console.error('Error creating tag:', e)
    alert(e.data?.statusMessage || 'Failed to create tag')
  }
}
</script>
