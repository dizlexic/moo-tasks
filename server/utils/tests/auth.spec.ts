import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEmailVerificationToken, createPasswordResetToken } from '../auth'
import { db } from '../../db'

vi.mock('../../db', () => ({
  db: {
    insert: vi.fn(),
  }
}))

describe('auth utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createEmailVerificationToken', () => {
    it('should create an email verification token', async () => {
      const mockInsertChain = {
        values: vi.fn().mockResolvedValue({})
      }
      ;(db.insert as any).mockReturnValue(mockInsertChain)

      const userId = 'user-1'
      const token = await createEmailVerificationToken(userId)

      expect(token).toBeDefined()
      expect(token.length).toBe(32)
      expect(db.insert).toHaveBeenCalled()
      expect(mockInsertChain.values).toHaveBeenCalledWith(expect.objectContaining({
        userId,
        token,
      }))
      
      const val = (mockInsertChain.values as any).mock.calls[0][0]
      expect(val.expiresAt.getTime()).toBeGreaterThan(Date.now())
    })
  })

  describe('createPasswordResetToken', () => {
    it('should create a password reset token', async () => {
      const mockInsertChain = {
        values: vi.fn().mockResolvedValue({})
      }
      ;(db.insert as any).mockReturnValue(mockInsertChain)

      const userId = 'user-2'
      const token = await createPasswordResetToken(userId)

      expect(token).toBeDefined()
      expect(token.length).toBe(32)
      expect(db.insert).toHaveBeenCalled()
      expect(mockInsertChain.values).toHaveBeenCalledWith(expect.objectContaining({
        userId,
        token,
      }))

      const val = (mockInsertChain.values as any).mock.calls[0][0]
      expect(val.expiresAt.getTime()).toBeGreaterThan(Date.now())
    })
  })
})
