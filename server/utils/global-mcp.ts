import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { boards } from '../db/schema'
import { generateId } from './id'
import { logBoardEvent } from './logs'

export async function createGlobalMcpServer(userId?: string): Promise<McpServer> {
  const server = new McpServer({
    name: `moo-tasks-global`,
    version: '1.0.0',
  })

  server.tool(
    'get-installation-instructions',
    'Get instructions on how to install and set up Moo Tasks locally or use the cloud version.',
    {},
    async () => {
      const instructions = `
# Moo Tasks Installation & Setup

Moo Tasks can be run locally via Docker or used as a hosted service at https://mootasks.dev.

## 1. Cloud Version (mootasks.dev)
1. Go to https://mootasks.dev and sign up/login.
2. Create a new board on the dashboard.
3. In Board Settings, generate an MCP Token.
4. Use the provided MCP URL and Token in your AI agent's configuration.

## 2. Local Installation (Docker)
1. Clone the repository: \`git clone https://github.com/dizlexic/moo-agent-board.git\`
2. Create a \`.env\` file from \`.env.example\`.
3. Set \`NUXT_SESSION_PASSWORD\` (min 32 chars).
4. Run \`docker-compose up -d\`.
5. Access the UI at \`http://localhost:3000\`.
6. Follow the same steps as the Cloud version to create a board and connect an agent.

## 3. Local Installation (Manual)
1. Ensure you have Node.js 22+ and MySQL 8+ installed.
2. Run \`npm install\`.
3. Configure \`.env\`.
4. Run migrations: \`npm run db:migrate\`.
5. Start the server: \`npm run dev\`.

## 4. Connecting an Agent
Each board provides its own MCP endpoint. Copy the configuration snippet from Board Settings into your agent's config (e.g., \`~/.claude.json\` for Claude Code, or \`.cursor/mcp.json\` for Cursor).
`;
      return { content: [{ type: 'text', text: instructions }] }
    }
  )

  if (userId) {
    server.tool(
      'create-board',
      'Create a new board on this Moo Tasks instance.',
      {
        name: z.string().min(1).describe('Board name'),
        description: z.string().optional().describe('Board description'),
      },
      async ({ name, description }) => {
        const boardId = generateId()
        const now = new Date()
        const newBoard = {
          id: boardId,
          name: name.trim(),
          description: description?.trim() || null,
          ownerId: userId,
          createdAt: now,
          updatedAt: now,
        }
        await db.insert(boards).values(newBoard)
        
        // Also create default columns
        const { boardColumns } = await import('../db/schema')
        const { nanoid } = await import('nanoid')
        const columns = ['backlog', 'todo', 'in_progress', 'review', 'done']
        for (let i = 0; i < columns.length; i++) {
            await db.insert(boardColumns).values({
            id: nanoid(12),
            boardId: boardId,
            name: columns[i].charAt(0).toUpperCase() + columns[i].slice(1),
            status: columns[i] as any,
            order: i,
            createdAt: now,
            updatedAt: now,
            })
        }

        void logBoardEvent({ boardId, type: 'user_action', actor: 'AI Agent', action: 'board:created', data: { name } })
        
        return { content: [{ type: 'text', text: JSON.stringify({ message: 'Board created successfully', board: newBoard }) }] }
      }
    )
  }

  return server
}
