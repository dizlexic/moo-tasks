import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { logBoardEvent } from './logs'
import { createBoardWithDefaultColumns } from './board-creation'
import { MCP_INSTALLATION_INSTRUCTIONS } from './mcp-shared'

type GlobalToolDefinition = [string, ...any[]]
const globalToolDefinitionCache = new Map<string, GlobalToolDefinition[]>()
const GLOBAL_TOOL_DEFINITION_CACHE_MAX_SIZE = 500

export async function createGlobalMcpServer(userId?: string): Promise<McpServer> {
  const serverConstructionStartedAt = performance.now()
  const server = new McpServer({
    name: `moo-tasks-global`,
    version: '1.0.0',
  })
  const cacheKey = userId ?? ''
  let definitions = globalToolDefinitionCache.get(cacheKey)
  const registrationCacheHit = definitions !== undefined

  if (definitions) {
    globalToolDefinitionCache.delete(cacheKey)
    globalToolDefinitionCache.set(cacheKey, definitions)
    for (const definition of definitions) {
      ;(server.tool as (...args: any[]) => unknown)(...definition)
    }
  } else {
    definitions = []
    const registerTool = (server.tool as (...args: any[]) => unknown).bind(server)
    ;(server as any).tool = (...args: any[]) => {
      definitions!.push(args as GlobalToolDefinition)
      return registerTool(...args)
    }

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

    globalToolDefinitionCache.set(cacheKey, definitions)
    while (globalToolDefinitionCache.size > GLOBAL_TOOL_DEFINITION_CACHE_MAX_SIZE) {
      const oldestUserId = globalToolDefinitionCache.keys().next().value
      if (oldestUserId === undefined) break
      globalToolDefinitionCache.delete(oldestUserId)
    }
    ;(server as any).tool = registerTool
  }

  if (process.env.MCP_PROFILE_SERVER_CONSTRUCTION === 'true') {
    console.info('[MCP] Global server construction and registration completed', {
      durationMs: Number((performance.now() - serverConstructionStartedAt).toFixed(2)),
      registrationCacheHit,
      toolCount: Object.keys((server as any)._registeredTools).length,
    })
  }

  return server
}
