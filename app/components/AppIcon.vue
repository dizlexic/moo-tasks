<template>
  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <title v-if="title">{{ title }}</title>
    <path stroke-linecap="round" stroke-linejoin="round" :d="path" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ name: string; title?: string }>()

const paths: Record<string, string> = {
  x: 'M6 18L18 6M6 6l12 12',
  plus: 'M12 4v16m8-8H4',
  minus: 'M20 12H4',
  select: 'M15 15l-2 5L9 9l11 4-5 2z',
  update: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  check: 'M5 13l4 4L19 7',
}
const path = computed(() => paths[props.name] || '')
</script>
