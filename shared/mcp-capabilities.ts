export const MCP_CAPABILITIES = [
  { name: 'list-tasks', kind: 'tool', description: 'List task summaries with cursor pagination.' },
  { name: 'get-task', kind: 'tool', description: 'Get full details of a task.' },
  { name: 'create-task', kind: 'tool', access: 'write', description: 'Create a task on the board.' },
  { name: 'update-task-status', kind: 'tool', access: 'write', description: 'Update a task status.' },
  { name: 'submit-for-review', kind: 'tool', access: 'write', description: 'Submit a task for review.' },
  { name: 'request-corrections', kind: 'tool', access: 'write', description: 'Create a linked correction task.' },
  { name: 'reject-task', kind: 'tool', access: 'write', description: 'Reject a task review.' },
  { name: 'accept-task', kind: 'tool', access: 'write', description: 'Claim a task.' },
  { name: 'add-comment', kind: 'tool', access: 'write', description: 'Add a comment to a task.' },
  { name: 'add-comment-with-attachment', kind: 'tool', access: 'write', description: 'Add an attachment comment to a task.' },
  { name: 'delete-task', kind: 'tool', access: 'write', description: 'Delete a task.' },
  { name: 'get-comments', kind: 'tool', description: 'List task comments with cursor pagination.' },
  { name: 'generate-changelog', kind: 'tool', description: 'Generate a changelog from completed tasks.' },
  { name: 'get-installation-instructions', kind: 'tool', description: 'Get Moo Tasks setup instructions.' },
  { name: 'create-board', kind: 'tool', access: 'write', description: 'Create a board.' },
  { name: 'list-plans', kind: 'tool', description: 'Discover available task plans.' },
  { name: 'apply-plan', kind: 'tool', access: 'write', description: 'Apply a task plan to a board.' },
  { name: 'board-state', kind: 'resource', description: 'A board snapshot with status counts and deterministic task samples.' },
  { name: 'agent-instructions', kind: 'resource', description: 'Workflow instructions for agents on this board.' },
  { name: 'task-workflow', kind: 'prompt', description: 'Guided workflow for completing tasks.' },
] as const

export const MCP_FUNCTIONS = MCP_CAPABILITIES.map(capability => capability.name)

export type McpFunction = typeof MCP_CAPABILITIES[number]['name']