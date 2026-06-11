import { mysqlTable, varchar, text, timestamp, boolean, mysqlEnum, primaryKey, int, json } from 'drizzle-orm/mysql-core'

export const users = mysqlTable('users', {
  id: varchar('id', { length: 191 }).primaryKey(),
  email: varchar('email', { length: 191 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  accountToken: text('account_token'),
  isVerified: boolean('is_verified').notNull().default(false),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const boards = mysqlTable('boards', {
  id: varchar('id', { length: 191 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  ownerId: varchar('owner_id', { length: 191 }).notNull().references(() => users.id),
  mcpToken: text('mcp_token'),
  mcpPublic: boolean('mcp_public').notNull().default(false),
  mcpEnabledFunctions: json('mcp_enabled_functions'),
  showTimeline: boolean('show_timeline').notNull().default(false),
  lastActivityAt: timestamp('last_activity_at'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const boardMembers = mysqlTable('board_members', {
  boardId: varchar('board_id', { length: 191 }).notNull().references(() => boards.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 191 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: mysqlEnum('role', ['owner', 'member']).notNull().default('member'),
  isFavorite: boolean('is_favorite').notNull().default(false),
  lastVisitedAt: timestamp('last_visited_at'),
  joinedAt: timestamp('joined_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.boardId, table.userId] }),
])

export const tasks = mysqlTable('tasks', {
  id: varchar('id', { length: 191 }).primaryKey(),
  boardId: varchar('board_id', { length: 191 }).notNull().references(() => boards.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: mysqlEnum('status', ['backlog', 'todo', 'in_progress', 'review', 'done', 'archive']).notNull().default('backlog'),
  priority: mysqlEnum('priority', ['low', 'medium', 'high', 'critical']).notNull().default('medium'),
  order: int('order').notNull().default(0),
  boardTaskId: int('board_task_id').notNull().default(0),
  assignee: varchar('assignee', { length: 255 }),
  parentTaskId: varchar('parent_task_id', { length: 191 }),
  difficulty: int('difficulty'),
  isHumanOnly: boolean('is_human_only').notNull().default(false),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const instructions = mysqlTable('instructions', {
  id: varchar('id', { length: 191 }).primaryKey(),
  boardId: varchar('board_id', { length: 191 }).references(() => boards.id, { onDelete: 'cascade' }),
  type: mysqlEnum('type', ['agent_instructions', 'task_workflow']).notNull(),
  content: text('content').notNull(),
  isDefault: boolean('is_default').notNull().default(true),
  updatedAt: timestamp('updated_at').notNull(),
  updatedBy: varchar('updated_by', { length: 191 }).references(() => users.id),
})

export const comments = mysqlTable('comments', {
  id: varchar('id', { length: 191 }).primaryKey(),
  taskId: varchar('task_id', { length: 191 }).notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  boardId: varchar('board_id', { length: 191 }).notNull().references(() => boards.id, { onDelete: 'cascade' }),
  author: varchar('author', { length: 255 }).notNull(),
  content: text('content').notNull(),
  attachment: json('attachment'),
  createdAt: timestamp('created_at').notNull(),
})

export const invitations = mysqlTable('invitations', {
  id: varchar('id', { length: 191 }).primaryKey(),
  boardId: varchar('board_id', { length: 191 }).notNull().references(() => boards.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 191 }).notNull(),
  inviterId: varchar('inviter_id', { length: 191 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull(),
})

export const tags = mysqlTable('tags', {
  id: varchar('id', { length: 191 }).primaryKey(),
  boardId: varchar('board_id', { length: 191 }).notNull().references(() => boards.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  color: varchar('color', { length: 255 }).notNull(),
  icon: varchar('icon', { length: 255 }).notNull(),
})

export const taskTags = mysqlTable('task_tags', {
  taskId: varchar('task_id', { length: 191 }).notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  tagId: varchar('tag_id', { length: 191 }).notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.taskId, table.tagId] }),
])

export const taskDependencies = mysqlTable('task_dependencies', {
  taskId: varchar('task_id', { length: 191 }).notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  dependencyId: varchar('dependency_id', { length: 191 }).notNull().references(() => tasks.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.taskId, table.dependencyId] }),
])

export const emailVerificationTokens = mysqlTable('email_verification_tokens', {
  id: varchar('id', { length: 191 }).primaryKey(),
  userId: varchar('user_id', { length: 191 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 191 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
})

export const passwordResetTokens = mysqlTable('password_reset_tokens', {
  id: varchar('id', { length: 191 }).primaryKey(),
  userId: varchar('user_id', { length: 191 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 191 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
})

export const boardLogs = mysqlTable('board_logs', {
  id: varchar('id', { length: 191 }).primaryKey(),
  boardId: varchar('board_id', { length: 191 }).notNull().references(() => boards.id, { onDelete: 'cascade' }),
  type: mysqlEnum('type', ['agent_connection', 'mcp_request', 'user_connection', 'user_action']).notNull(),
  actor: varchar('actor', { length: 255 }).notNull(),
  action: varchar('action', { length: 255 }).notNull(),
  data: json('data'),
  createdAt: timestamp('created_at').notNull(),
})

export const boardColumns = mysqlTable('board_columns', {
  id: varchar('id', { length: 191 }).primaryKey(),
  boardId: varchar('board_id', { length: 191 }).notNull().references(() => boards.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  instructions: text('instructions'),
  status: mysqlEnum('status', ['backlog', 'todo', 'in_progress', 'review', 'done', 'archive']).notNull().default('backlog'),
  order: int('order').notNull().default(0),
  permissions: json('permissions'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const boardTransfers = mysqlTable('board_transfers', {
  id: varchar('id', { length: 191 }).primaryKey(),
  boardId: varchar('board_id', { length: 191 }).notNull().references(() => boards.id, { onDelete: 'cascade' }),
  senderId: varchar('sender_id', { length: 191 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  recipientEmail: varchar('recipient_email', { length: 191 }).notNull(),
  status: mysqlEnum('status', ['pending', 'accepted', 'cancelled']).notNull().default('pending'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Board = typeof boards.$inferSelect
export type NewBoard = typeof boards.$inferInsert
export type BoardMember = typeof boardMembers.$inferSelect
export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
export type BoardColumn = typeof boardColumns.$inferSelect
export type NewBoardColumn = typeof boardColumns.$inferInsert
export type BoardTransfer = typeof boardTransfers.$inferSelect
export type NewBoardTransfer = typeof boardTransfers.$inferInsert
export type Instruction = typeof instructions.$inferSelect
export type NewInstruction = typeof instructions.$inferInsert
export type Comment = typeof comments.$inferSelect
export type NewComment = typeof comments.$inferInsert
export type Invitation = typeof invitations.$inferSelect
export type NewInvitation = typeof invitations.$inferInsert
export type Tag = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert
export type TaskTag = typeof taskTags.$inferSelect
export type NewTaskTag = typeof taskTags.$inferInsert
export type TaskDependency = typeof taskDependencies.$inferSelect
export type NewTaskDependency = typeof taskDependencies.$inferInsert
export type BoardLog = typeof boardLogs.$inferSelect
export type NewBoardLog = typeof boardLogs.$inferInsert
