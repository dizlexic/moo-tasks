import { defineEventHandler, readBody, createError } from 'h3'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { users } from '../../db/schema'
import { createGlobalMcpServer } from '../../utils/global-mcp'

export default defineEventHandler(async (event) => {
  const authHeader = event.node.req.headers.authorization || ''
  let userId: string | undefined

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    const userResults = await db.select().from(users).where(eq(users.accountToken, token))
    const user = userResults[0]
    if (user) {
      userId = user.id
    }
  }

  // Get the Node.js req/res from h3
  const req = event.node.req
  const res = event.node.res

  // Browser redirect
  const accept = req.headers.accept || ''
  if (accept.includes('text/html') && !accept.includes('text/event-stream') && !accept.includes('application/json')) {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(`<meta http-equiv="refresh" content="0; url=/">`)
    return
  }

  try {
    let parsedBody: unknown
    if (req.method === 'POST') {
      parsedBody = await readBody(event)
    }

    const mcpServer = await createGlobalMcpServer(userId)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless mode
    })
    await mcpServer.connect(transport)
    await transport.handleRequest(req, res, parsedBody)
  } catch (e: any) {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
  }
})
