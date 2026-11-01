import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createGlobalMcpServer } from '../../server/utils/global-mcp'
import { db } from '../../server/db'

vi.mock('../../server/db', () => ({
  db: {
    insert: vi.fn(),
    transaction: vi.fn(),
  }
}))

vi.mock('../../server/utils/id', () => ({
  generateId: vi.fn().mockReturnValue('mocked-id'),
}))

vi.mock('../../server/utils/logs', () => ({
  logBoardEvent: vi.fn(),
}))

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('mocked-column-id'),
}))

// Mock schema imports dynamically if needed, but since we mock db, we might just mock the return values
vi.mock('../../server/db/schema', () => ({
  boards: {},
  boardColumns: {}
}))

describe('global-mcp utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(db.transaction as any).mockImplementation((callback: any) => callback({ insert: db.insert }))
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
      expect(db.transaction).toHaveBeenCalledTimes(1)
      expect(db.insert).toHaveBeenCalledTimes(2)
    })

    it('should implement create-board with minimal fields (no description)', async () => {
      const server = await createGlobalMcpServer('user-2')
      const createBoardHandler = server._registeredTools['create-board'].handler
      
      ;(db.insert as any).mockReturnValue({
        values: vi.fn().mockResolvedValue({}),
      })

      const result = await createBoardHandler({ name: 'Minimal Board' })
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.board.name).toBe('Minimal Board')
      expect(parsed.board.description).toBeNull()
      expect(db.transaction).toHaveBeenCalledTimes(1)
    })

    it('should reject oversized board names and descriptions', async () => {
      const server = await createGlobalMcpServer('user-4')
      // @ts-ignore
      const schema = server._registeredTools['create-board'].inputSchema

      expect(schema.safeParse({ name: 'n'.repeat(256) }).success).toBe(false)
      expect(schema.safeParse({ name: 'Valid board', description: 'd'.repeat(10_001) }).success).toBe(false)
    })

    it('get-installation-instructions always returns setup content (core logic + edge: no userId path)', async () => {
      const serverNoUser = await createGlobalMcpServer()
      const serverWithUser = await createGlobalMcpServer('user-3')

      const noUserInstr = serverNoUser._registeredTools['get-installation-instructions'].handler
      const withUserInstr = serverWithUser._registeredTools['get-installation-instructions'].handler

      const r1 = await noUserInstr({})
      const r2 = await withUserInstr({})

      const text1 = r1.content[0].text
      const text2 = r2.content[0].text

      expect(text1).toContain('Moo Tasks Installation')
      expect(text1).toContain('docker-compose')
      expect(text1).toContain('Connecting an Agent')
      expect(text2).toContain('Cloud Version (mootasks.dev)')
      // create-board presence is tested separately
    })
  })
})
