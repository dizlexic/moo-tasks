import { eq } from 'drizzle-orm'
import { db } from '#server/db'
import { boards } from '#server/db/schema'
import { matchesBearerTokenDigest } from '#server/utils/token-digests'
import fs from 'node:fs'
import path from 'node:path'
import { getRouterParam } from 'h3'

export default defineEventHandler(async (event) => {
  const boardId = getRouterParam(event, 'boardId')!

  // Fetch board details
  const boardResults = await db.select().from(boards).where(eq(boards.id, boardId)).execute()
  const board = boardResults[0]
  if (!board) {
    throw createError({ statusCode: 404, message: 'Board not found' })
  }

  // Authorization check
  if (!board.mcpPublic) {
    if (!board.mcpTokenDigest) {
      throw createError({ statusCode: 401, statusMessage: 'MCP endpoint is private and no token is configured.' })
    }

    const authHeader = event.node.req.headers.authorization || ''
    if (!authHeader.startsWith('Bearer ')) {
      throw createError({ statusCode: 401, statusMessage: 'Missing Authorization: Bearer <token> header' })
    }
    const token = authHeader.slice(7).trim()

    if (!matchesBearerTokenDigest(token, board.mcpTokenDigest)) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid bearer token' })
    }
  }

  // Base URL
  const baseUrl = getRequestURL(event).origin

  // Construct mcp.json
  const mcpJson = {
    "mcpServers": {
      "moo-tasks": {
        "type": "streamable-http",
        "url": `${baseUrl}/api/boards/${boardId}/mcp`,
        ...(board.mcpPublic ? {} : {
          "headers": {
            "Authorization": "Bearer <your-bearer-token>"
          }
        }),
      }
    }
  }

  // Read AGENTS.md
  const agentsMdPath = path.resolve(process.cwd(), 'AGENTS.md')
  const agentsMdContent = fs.readFileSync(agentsMdPath, 'utf8')

  return {
    mcpJson,
    agentsMd: agentsMdContent
  }
})
