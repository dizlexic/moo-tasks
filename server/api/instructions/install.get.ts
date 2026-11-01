import { eq, and } from 'drizzle-orm'
import { db } from '../../db'
import { boards, boardMembers } from '../../db/schema'
import fs from 'node:fs'
import path from 'node:path'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const query = getQuery(event)
  const boardId = query.boardId as string

  if (!boardId) {
    throw createError({ statusCode: 400, message: 'Missing boardId' })
  }

  // Verify user is a member of the board
  const member = await db.select().from(boardMembers).where(
    and(
      eq(boardMembers.boardId, boardId),
      eq(boardMembers.userId, (session.user as any).id)
    )
  ).execute()

  if (member.length === 0) {
    throw createError({ statusCode: 403, message: 'Unauthorized' })
  }

  // Fetch board details
  const board = await db.select().from(boards).where(eq(boards.id, boardId)).execute()
  if (board.length === 0) {
    throw createError({ statusCode: 404, message: 'Board not found' })
  }

  // Base URL
  const baseUrl = getRequestURL(event).origin
  
  // Construct mcp.json
  const mcpJson = {
    "mcpServers": {
      "moo-tasks": {
        "type": "streamable-http",
        "url": `${baseUrl}/api/boards/${boardId}/mcp`,
        ...(board[0].mcpPublic ? {} : {
          "headers": {
            "Authorization": "Bearer <generate-a-token-in-board-settings>"
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
