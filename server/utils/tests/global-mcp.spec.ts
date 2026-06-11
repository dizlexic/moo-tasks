import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createGlobalMcpServer } from '../global-mcp'
import { db } from '../../db'

vi.mock('../../db', () => ({
  db: {
    insert: vi.fn(),
  }
}))

vi.mock('../id', () => ({
  generateId: vi.fn().mockReturnValue('mocked-id'),
}))

vi.mock('../logs', () => ({
  logBoardEvent: vi.fn(),
}))

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('mocked-column-id'),
}))

// Mock schema imports dynamically if needed, but since we mock db, we might just mock the return values
vi.mock('../../db/schema', () => ({
  boards: {},
  boardColumns: {}
}))

describe('global-mcp utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createGlobalMcpServer', () => {
    it('should create an McpServer instance with correct tools', async () => {
      const server = await createGlobalMcpServer()
      // @ts-ignore
      const registeredTools = server._registeredTools
      expect(registeredTools).toHaveProperty('get-installation-instructions')
      expect(registeredTools).not.toHaveProperty('create-board')
    })

    it('should register create-board if userId is provided', async () => {
      const server = await createGlobalMcpServer('user-1')
      // @ts-ignore
      const registeredTools = server._registeredTools
      expect(registeredTools).toHaveProperty('create-board')
    })

    it('should implement create-board correctly', async () => {
      const server = await createGlobalMcpServer('user-1')
      
      // @ts-ignore
      const createBoardHandler = server._registeredTools['create-board'].handler
      
      ;(db.insert as any).mockReturnValue({
        values: vi.fn().mockResolvedValue({}),
      })

      const result = await createBoardHandler({ name: 'New Board', description: 'Test description' })
      const parsedResult = JSON.parse(result.content[0].text)
      
      expect(parsedResult.board.name).toBe('New Board')
      expect(parsedResult.board.ownerId).toBe('user-1')
    })
  })
})
