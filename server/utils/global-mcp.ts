import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { logBoardEvent } from './logs'
import { createBoardWithDefaultColumns } from './board-creation'
import { MCP_INSTALLATION_INSTRUCTIONS } from './mcp-shared'

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
      return { content: [{ type: 'text', text: MCP_INSTALLATION_INSTRUCTIONS }] }
    }
  )

  if (userId) {
    server.tool(
      'create-board',
      'Create a new board on this Moo Tasks instance.',
      {
        name: z.string().trim().min(1).max(255).describe('Board name (maximum 255 characters)'),
        description: z.string().max(10_000).optional().describe('Board description (maximum 10000 characters)'),
      },
      async ({ name, description }) => {
        const newBoard = await createBoardWithDefaultColumns({ name, description, ownerId: userId })

        void logBoardEvent({ boardId: newBoard.id, type: 'user_action', actor: 'AI Agent', action: 'board:created', data: { name: newBoard.name } })
        
        return { content: [{ type: 'text', text: JSON.stringify({ message: 'Board created successfully', board: newBoard }) }] }
      }
    )
  }

  return server
}
