<template>
  <div class="flex flex-wrap gap-2">
    <div
      v-for="tag in tags"
      :key="tag.id"
      class="px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
      :class="isSelected(tag.id) ? 'ring-2 ring-offset-2 ring-neon-cyan dark:ring-offset-surface-card' : 'opacity-70 hover:opacity-100'"
      :style="{ backgroundColor: tag.color, color: 'white' }"
      @click="toggleTag(tag.id)"
    >
      <Icon :name="getIcon(tag.icon)" />
      <span>{{ tag.name }}</span>
      <Icon name="mdi:close" @click.stop="confirmDeleteTag(tag.id)" class="hover:text-red-500 cursor-pointer" />
    </div>
    <button
      type="button"
      @click="showCreateTagModal = true"
      class="px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 opacity-50 hover:opacity-100 border border-dashed border-gray-400 dark:border-gray-600 text-gray-500 dark:text-gray-400"
    >
      + New Tag
    </button>
    <CreateTagModal v-if="showCreateTagModal" :boardId="boardId" @close="showCreateTagModal = false" @created="onTagCreated" />
    <ConfirmModal
      v-if="showDeleteConfirm"
      title="Delete Tag"
      message="Are you sure you want to delete this tag? This action cannot be undone."
      @confirm="deleteConfirmed"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>

<script setup lang="ts">
import { getIcon } from '../utils/icons'

const props = defineProps<{
  selectedTagIds: string[]
  boardId: string
}>()

const emit = defineEmits(['update:selectedTagIds'])
const showCreateTagModal = ref(false)
const showDeleteConfirm = ref(false)
const tagToDelete = ref<string | null>(null)
const { tags, fetchTags, deleteTag } = useTags(props.boardId)

onMounted(() => {
  fetchTags()
})

function confirmDeleteTag(tagId: string) {
  tagToDelete.value = tagId
  showDeleteConfirm.value = true
}

async function deleteConfirmed() {
  if (tagToDelete.value) {
    await deleteTag(tagToDelete.value)
    showDeleteConfirm.value = false
    tagToDelete.value = null
  }
}

function isSelected(tagId: string) {
  return props.selectedTagIds.includes(tagId)
}

function toggleTag(tagId: string) {
  const newSelection = [...props.selectedTagIds]
  if (newSelection.includes(tagId)) {
    newSelection.splice(newSelection.indexOf(tagId), 1)
  } else {
    newSelection.push(tagId)
  }
  emit('update:selectedTagIds', newSelection)
}

function onTagCreated(tag: any) {
  console.log('Tag created event received in TagPicker:', tag)
  const newSelection = [...props.selectedTagIds, tag.id]
  emit('update:selectedTagIds', newSelection)
}
</script>
