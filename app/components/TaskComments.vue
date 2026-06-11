<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import type { Comment } from '../../server/db/schema'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt()
const props = defineProps<{ taskId: string; boardId: string }>()
const emit = defineEmits<{ 'comment-added': [] }>()
const { addComment, fetchComments } = useTasks(props.boardId)

const comments = ref<Comment[]>([])
const commentMarkdownStates = reactive<Record<string, boolean>>({})

function renderMarkdown(content: string) {
  return md.render(content)
}

const newComment = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const loading = ref(false)
const submitting = ref(false)
const error = ref('')

async function loadComments() {
  loading.value = true
  try {
    const fetchedComments = await fetchComments(props.taskId)
    comments.value = fetchedComments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  } catch (e: any) {
    console.error('Failed to load comments:', e)
  } finally {
    loading.value = false
  }
}

async function onSubmit() {
  if (!newComment.value.trim() || submitting.value) return
  submitting.value = true
  error.value = ''
  try {
    const comment = await addComment(props.taskId, newComment.value.trim())
    comments.value.push(comment as Comment)
    newComment.value = ''
    emit('comment-added')
  } catch (e: any) {
    error.value = e.data?.message || 'Failed to add comment'
  } finally {
    submitting.value = false
  }
}

function formatDate(date: string | Date) {
  return new Date(date).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function focusInput() {
  textareaRef.value?.focus()
}

defineExpose({ focusInput })

onMounted(loadComments)
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-2">
      <span class="text-neon-cyan" aria-hidden="true">💬</span>
      <h3 class="text-sm font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300">Comments</h3>
    </div>

    <!-- Comment List -->
    <div class="space-y-4">
      <div v-if="loading" class="flex justify-center py-4">
        <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-neon-cyan"></div>
      </div>
      <div v-else-if="comments.length === 0" class="text-center py-8 bg-gray-50 dark:bg-surface-raised/10 rounded-2xl border border-dashed border-gray-200 dark:border-surface-border/50">
        <p class="text-xs text-gray-400 dark:text-gray-500 font-medium">No comments yet. Be the first to say something!</p>
      </div>
      <div v-else class="space-y-4">
        <div v-for="comment in comments" :key="comment.id" class="group flex gap-4">
          <div class="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-neon-cyan to-neon-purple flex items-center justify-center text-xs font-black text-white shadow-sm">
            {{ comment.author.charAt(0).toUpperCase() }}
          </div>
          <div class="flex-1 space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-gray-900 dark:text-white">{{ comment.author }}</span>
              <div class="flex items-center gap-2">
                <button @click="commentMarkdownStates[comment.id] = !commentMarkdownStates[comment.id]" class="text-[10px] text-gray-400 hover:text-neon-cyan">
                  {{ commentMarkdownStates[comment.id] ? 'Raw' : 'Rendered' }}
                </button>
                <span class="text-[10px] font-medium text-gray-400 dark:text-gray-600">{{ formatDate(comment.createdAt) }}</span>
              </div>
            </div>
            <div class="bg-gray-50 dark:bg-surface-raised/40 rounded-2xl rounded-tl-none px-4 py-3 border border-gray-100 dark:border-surface-border/30">
              <p v-if="commentMarkdownStates[comment.id]" class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{{ comment.content }}</p>
              <div v-else class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed" v-html="renderMarkdown(comment.content)"></div>
              <div v-if="comment.attachment" class="mt-2 pt-2 border-t border-gray-100 dark:border-surface-border/50">
                <a :href="(comment.attachment as any).url" target="_blank" class="text-xs text-neon-cyan hover:underline flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.586 6.586a6 6 0 108.486 8.486L18 13" />
                  </svg>
                  Attachment
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Comment -->
    <div class="pt-4 border-t border-gray-100 dark:border-surface-border/50">
      <form @submit.prevent="onSubmit" class="space-y-3">
        <div v-if="error" class="text-xs text-neon-red font-bold mb-2">{{ error }}</div>
        <div class="relative">
          <textarea
            ref="textareaRef"
            v-model="newComment"
            rows="2"
            class="w-full border border-gray-200 dark:border-surface-border dark:bg-surface-raised dark:text-white rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-neon-cyan/30 focus:border-neon-cyan/50 outline-none resize-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600 shadow-sm"
            placeholder="Write a comment..."
            @keydown.enter.ctrl.prevent="onSubmit"
            @keydown.enter.meta.prevent="onSubmit"
          />
          <div class="absolute bottom-3 right-3 flex items-center gap-2">
             <span class="text-[9px] text-gray-400 dark:text-gray-600 font-bold uppercase tracking-tighter hidden sm:inline">⌘ + Enter</span>
             <button
              type="submit"
              :disabled="submitting || !newComment.trim()"
              class="p-1.5 rounded-lg bg-neon-cyan text-cyan-950 dark:text-gray-900 hover:bg-neon-cyan/90 disabled:opacity-50 transition-all shadow-md shadow-neon-cyan/10"
              title="Post comment"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>
