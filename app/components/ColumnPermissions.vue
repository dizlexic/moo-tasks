<script setup lang="ts">
import { useColumns } from '~/composables/useColumns'

const props = defineProps<{ boardId: string }>()
const { columns, fetchColumns } = useColumns(props.boardId)

async function updatePermission(column: any, permission: string, value: boolean) {
  const permissions = column.permissions || { view: true, add: true, move: true, delete: true }
  permissions[permission] = value

  await $fetch(`/api/boards/${props.boardId}/columns/${column.id}`, {
    method: 'PATCH',
    body: { permissions }
  })
  await fetchColumns()
}

onMounted(fetchColumns)
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-sm font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300">Column Permissions</h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div v-for="column in columns" :key="column.id" class="bg-gray-50 dark:bg-surface-raised/30 rounded-xl p-4 border border-gray-100 dark:border-surface-border/50">
        <h4 class="text-sm font-bold text-gray-900 dark:text-white mb-2">{{ column.name }}</h4>
        <div class="space-y-1">
          <div v-for="perm in ['view', 'add', 'move', 'delete']" :key="perm" class="flex items-center justify-between">
            <span class="text-xs text-gray-600 dark:text-gray-400 capitalize">{{ perm }}</span>
            <input
              type="checkbox"
              :checked="(column.permissions || { view: true, add: true, move: true, delete: true })[perm]"
              @change="updatePermission(column, perm, ($event.target as HTMLInputElement).checked)"
              class="rounded border-gray-300 text-neon-cyan focus:ring-neon-cyan"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
