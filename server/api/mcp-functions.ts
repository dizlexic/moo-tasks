import { defineEventHandler } from 'h3'
import { MCP_FUNCTIONS } from '#shared/mcp-capabilities'

export default defineEventHandler(() => {
  return MCP_FUNCTIONS
})
