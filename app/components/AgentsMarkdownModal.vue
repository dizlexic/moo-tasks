<script setup lang="ts">
import type { Board } from '../../../server/db/schema'

const props = defineProps<{
  board: Board
  mcpToken: string | null
}>()

const emit = defineEmits(['close'])

const { public: { siteName } } = useRuntimeConfig()
const copied = ref(false)

const toolDescriptions: Record<string, string> = {
  'list-tasks': 'Discover open tasks (filter by status/priority/limit)',
  'get-task': 'Read full details of a single task',
  'get-comments': 'Read all comments on a task',
  'accept-task': 'Claim a task — assigns you and sets `in_progress`',
  'add-comment': 'Post progress notes / questions on a task',
  'update-task-status': 'Move a task between columns',
  'submit-for-review': 'Mark a task ready for human review',
  'request-corrections': 'Create a linked correction task off a reviewed task',
  'reject-task': 'Reject a task review and move it back to todo (AI review)',
  'create-task': 'File a new task on the board',
  'delete-task': 'Remove a task (use sparingly)',
  'generate-changelog': 'Generate a markdown changelog based on completed (done) tasks',
  'create-board': 'Create a new board (requires account token or board owner context)',
  'get-installation-instructions': 'Get instructions for installing/setting up Moo Tasks'
}

const resourcePrompts: Record<string, string> = {
  'board-state': '`moo-tasks://<boardId>/board-state` — full board snapshot',
  'agent-instructions': '`moo-tasks://<boardId>/agent-instructions` — board-specific guidance',
  'task-workflow': '`task-workflow` — guided workflow for picking up & finishing tasks'
}

const markdown = computed(() => {
  const origin = import.meta.client ? window.location.origin : 'https://mootasks.dev'
  const boardId = props.board.id
  const enabledFunctions = (props.board.mcpEnabledFunctions as Record<string, boolean>) || {}
  
  const enabledTools = Object.keys(toolDescriptions).filter(tool => enabledFunctions[tool] !== false)
  const enabledResources = Object.keys(resourcePrompts).filter(res => enabledFunctions[res] !== false)

  let toolsTable = '| Tool                  | Purpose                                               |\n'
  toolsTable += '|-----------------------|-------------------------------------------------------|\n'
  enabledTools.forEach(tool => {
    toolsTable += `| \`${tool}\` | ${toolDescriptions[tool]} |\n`
  })

  let resourcesSection = ''
  if (enabledResources.length > 0) {
    resourcesSection = '\nPlus resources/prompts:\n\n'
    enabledResources.forEach(res => {
      resourcesSection += `- ${resourcePrompts[res].replace('<boardId>', boardId)}\n`
    })
  }

  const tokenPlaceholder = '<your-bearer-token>'

  return `# AGENTS.md

> Drop this file into the root of any project that uses a **Moo Tasks** board as
> its task queue. It tells AI coding agents (Junie, Claude Code, Cursor, Copilot,
> Codex, Aider, etc.) how to discover, accept, and complete work for this
> repository through the board's MCP server.

---

## 1. What is the Moo Tasks board?

Moo Tasks is a kanban board that exposes each board as its own
[Model Context Protocol](https://modelcontextprotocol.io/specification/2025-11-25)
(MCP) server. The endpoint is **scoped to a single board** — an agent connected
to one board can never see or modify tasks on any other board.

Each task on the board has two identifiers:
- **ID**: A unique, permanent string ID (e.g., \`A86rlBBUBe3f\`) used in tool calls.
- **Board Task ID**: A sequential numeric ID specific to the board (e.g., \`1\`, \`2\`). Use this for easier reference in conversation.

- **Endpoint URL:** \`${origin}/api/boards/${boardId}/mcp\`
- **Global Endpoint:** \`${origin}/api/mcp\` (requires account token)
- **Transport:** \`streamable-http\`
- **Auth:** \`Authorization: Bearer <token>\` (per
  [MCP basic spec](https://modelcontextprotocol.io/specification/2025-11-25/basic))

> ⚠️ Tokens via \`?token=\` query string are **not supported**. Always use the
> \`Authorization\` header.

---

## 2. Connecting your agent

On the board page, click **Show MCP Config → 📋 Copy JSON**. Paste the snippet
into your MCP client's config:

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

Common locations:

 Client       | Path                            |
--------------|---------------------------------|
 Claude Code  | \`~/.claude.json\` or project \`.mcp.json\` |
 Cursor       | \`.cursor/mcp.json\`              |
 VS Code      | \`.vscode/mcp.json\`              |
 JetBrains    | Settings → Tools → MCP Servers  |
 Junie        | Settings → MCP Servers          |

---

## 3. Available MCP tools

Once connected, the following tools are available (subject to per-board
toggles in board settings):

${toolsTable}${resourcesSection}
---

## 4. Recommended workflow for agents

When a human asks you to "work on the board" (or whenever you have idle
capacity on this project), follow this loop:

1. **Read instructions first.** Fetch the
   \`moo-tasks://${boardId}/agent-instructions\` resource and the \`task-workflow\`
   prompt — these may contain project-specific rules that override this file.
2. **Discover work.** Call \`list-tasks\` (filter \`status=todo\`, sort by priority)
   to find unclaimed tasks. Note: \`todo\` results are limited to 10 by default; 
   use the \`limit\` parameter to see more. If AI review is enabled, you can 
   also filter by \`status=review\` to find tasks that need verification.
3. **Pick one task.** Prefer \`critical\` > \`high\` > \`medium\` > \`low\`. Read the
   full task with \`get-task\` and any prior \`get-comments\`.
4. **Accept it.** Call \`accept-task\` with a stable \`agentName\` (e.g. your
   model + handle, like \`"junie"\` or \`"claude-code"\`). This locks the task to
   you and moves it to \`in_progress\`.
5. **Work in this repository.** Make the code changes the task describes, or 
   if you are reviewing, verify the implementation.
6. **Communicate.** Use \`add-comment\` for non-trivial decisions, blockers,
   or questions. Comments are visible to humans on the board in real time.
7. **Submit for review.** When done, call \`submit-for-review\` with the task ID. 
   If you were reviewing, call \`update-task-status\` to move it to \`done\` if it passes, 
   or \`reject-task\` if it fails.
   Do **not** mark tasks \`done\` yourself unless you are reviewing another agent's task — humans (or a reviewer agent) move
   tasks from \`review\` to \`done\` after verifying.
8. **Handle corrections.** If a human creates a correction task linked to your
   original (parent) task, treat it as a new top-priority item: accept it,
   address the feedback, and submit it for review.

### Rules of thumb

- ✅ Always \`accept-task\` **before** writing code, so humans see who's working.
- ✅ One task at a time per agent identity.
- ✅ If a task is unclear, leave a comment asking for clarification rather than
  guessing — and leave the task in \`todo\` (don't accept it yet).
- ❌ Don't \`delete-task\` unless explicitly told to.
- ❌ Don't move tasks straight to \`done\` — always go through \`review\`.
- ❌ Don't try to access tasks from other boards; this token only works for
  the single board it was issued for.

---

## 5. Security notes for humans

- Treat the bearer token like a password. Anyone with it can act as an agent
  on your board.
- Rotate tokens from the board settings drawer if a token leaks; revocation
  is instant.
- Prefer per-agent or per-environment tokens if your deployment supports it.
- Public boards (\`mcpPublic = true\`) skip auth entirely and should only be
  used for read-only demos.
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