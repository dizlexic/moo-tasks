<script setup lang="ts">
import type { Board } from '../../../server/db/schema'

const props = defineProps<{
  board: Board
  mcpToken: string | null
}>()

const emit = defineEmits(['close'])

const { public: { siteName } } = useRuntimeConfig()
const copied = ref(false)

const toolNames = [
  'list-tasks',
  'get-task',
  'get-comments',
  'accept-task',
  'add-comment',
  'update-task-status',
  'submit-for-review',
  'request-corrections',
  'reject-task',
  'create-task',
  'delete-task',
  'generate-changelog',
  'list-plans',
  'apply-plan',
  'create-board',
  'get-installation-instructions'
] as const

const resourcePrompts: Record<string, string> = {
  'board-state': '`moo-tasks://<boardId>/board-state` — full board snapshot',
  'agent-instructions': '`moo-tasks://<boardId>/agent-instructions` — board-specific guidance',
  'task-workflow': '`task-workflow` — guided workflow for picking up & finishing tasks'
}

const markdown = computed(() => {
  const origin = import.meta.client ? window.location.origin : 'https://mootasks.dev'
  const boardId = props.board.id
  const enabledFunctions = (props.board.mcpEnabledFunctions as Record<string, boolean>) || {}
  
  const enabledTools = toolNames.filter(tool => enabledFunctions[tool] !== false)
  const enabledResources = Object.keys(resourcePrompts).filter(res => enabledFunctions[res] !== false)

  const toolsList = enabledTools.map(tool => `\`${tool}\``).join(', ')

  let resourcesSection = ''
  if (enabledResources.length > 0) {
    resourcesSection = '\n## Board resources and prompts\n\n'
    enabledResources.forEach(res => {
      resourcesSection += `- ${resourcePrompts[res].replace('<boardId>', boardId)}\n`
    })
  }

  const tokenPlaceholder = '<your-bearer-token>'

  return `# Moo Tasks

Use this board for tasks you were asked to work on. Follow repository guidance as well as any board-specific instructions.

## Connect

Configure the MCP server with the board's URL and bearer token:

\`\`\`json
{
  "mcpServers": {
    "moo-tasks": {
      "type": "streamable-http",
      "url": "${origin}/api/boards/${boardId}/mcp",
      "headers": {
        "Authorization": "Bearer ${tokenPlaceholder}"
      }
    }
  }
}
\`\`\`

Keep the bearer token secret; pass it in the \`Authorization\` header, never in the URL.

## Board tools

Only the tools listed here are enabled: ${toolsList || 'none'}.
${resourcesSection}
## Workflow

1. If available, read the board-specific instructions and task-workflow prompt before starting.
2. Find an unclaimed \`todo\` task with \`list-tasks\`; prioritize critical/high tasks. Read it with \`get-task\` and check its comments with \`get-comments\` (\`todo\` lists return up to 10 by default).
3. If the task is unclear, ask via \`add-comment\` and leave it in \`todo\`. Otherwise, claim it with \`accept-task\` using a stable \`agentName\` before editing. Don't take a task already claimed by someone else.
4. Follow repository instructions while working. Comment on blockers or important decisions.
5. Add a concise **Task Result** comment and call \`submit-for-review\` when finished. Do not move your task directly to \`done\`; reviewers handle that.

If explicitly asked to review a task, use \`update-task-status\` to move a passing task to \`done\`, or \`reject-task\` with a reason if it fails. Don't create or pick up extra tasks just because the board is empty.
`
})

async function copyMarkdown() {
  await navigator.clipboard.writeText(markdown.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<template>
  <div class="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="absolute inset-0 bg-gray-950/60 backdrop-blur-sm" @mousedown="emit('close')"></div>
    
    <div class="relative w-full max-w-3xl bg-white dark:bg-surface-card rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-100 dark:border-surface-border">
      <!-- Header -->
      <div class="p-6 border-b border-gray-100 dark:border-surface-border/50 flex items-center justify-between shrink-0 bg-gray-50/50 dark:bg-surface-raised/20">
        <div>
          <h2 id="modal-title" class="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
            <span class="text-neon-cyan">📄</span> AGENTS.md Example
          </h2>
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">Copy this file to your repository to guide AI agents.</p>
        </div>
        <button 
          @click="emit('close')"
          class="p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-surface-hover transition-all text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        <div class="relative group">
          <div class="absolute -inset-0.5 bg-gradient-to-r from-neon-cyan to-neon-purple rounded-2xl blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
          <div class="relative bg-gray-950 rounded-2xl p-6 font-mono text-xs leading-relaxed overflow-x-auto text-gray-300 border border-gray-800 shadow-inner">
            <pre class="whitespace-pre-wrap">{{ markdown }}</pre>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-6 border-t border-gray-100 dark:border-surface-border/50 flex items-center justify-end gap-3 shrink-0">
        <button 
          @click="copyMarkdown"
          class="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-neon-cyan text-cyan-950 dark:text-gray-900 font-bold text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-neon-cyan/20"
        >
          <svg v-if="!copied" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-3 8h4m-2-2v4" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          {{ copied ? 'Copied!' : 'Copy Markdown' }}
        </button>
      </div>
    </div>
  </div>
</template>