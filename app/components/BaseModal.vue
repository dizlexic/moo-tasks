<script setup lang="ts">
defineProps<{ title?: string; maxWidth?: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" @mousedown.self="emit('close')">
    <div :class="['bg-white dark:bg-surface-card rounded-3xl shadow-2xl w-full border border-gray-200 dark:border-surface-border overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh]', maxWidth || 'max-w-lg']">
      <!-- Header -->
      <div v-if="$slots.header || title" class="p-6 border-b border-gray-100 dark:border-surface-border flex justify-between items-center bg-gray-50/50 dark:bg-surface-raised/30">
        <slot name="header">
          <h2 class="text-xl font-black text-gray-900 dark:text-white tracking-tight">{{ title }}</h2>
        </slot>
        <button @click="emit('close')" class="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors text-2xl leading-none">&times;</button>
      </div>

      <!-- Content -->
      <div class="p-6 overflow-y-auto flex-1">
        <slot />
      </div>

      <!-- Footer -->
      <div v-if="$slots.footer" class="p-6 bg-gray-50 dark:bg-surface-raised/30 border-t border-gray-100 dark:border-surface-border">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>
