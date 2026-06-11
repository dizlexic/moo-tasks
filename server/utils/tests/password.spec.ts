import { describe, it, expect } from 'vitest'
import { hashPassword, comparePasswords } from '../password'

describe('password utils', () => {
  it('should hash a password', async () => {
    const password = 'my-secret-password'
    const hash = await hashPassword(password)
    
    expect(hash).toContain(':')
    const [salt, hashValue] = hash.split(':')
    expect(salt).toHaveLength(32) // 16 bytes in hex
    expect(hashValue).toHaveLength(128) // 64 bytes in hex
  })

  it('should verify correct password', async () => {
    const password = 'my-secret-password'
    const hash = await hashPassword(password)
    const result = await comparePasswords(password, hash)
    expect(result).toBe(true)
  })

  it('should reject incorrect password', async () => {
    const password = 'my-secret-password'
    const hash = await hashPassword(password)
    const result = await comparePasswords('wrong-password', hash)
    expect(result).toBe(false)
  })

  it('should handle malformed hash', async () => {
    const result = await comparePasswords('password', 'malformed-hash')
    expect(result).toBe(false)
  })

  it('should produce different hashes for same password', async () => {
    const password = 'same-password'
    const hash1 = await hashPassword(password)
    const hash2 = await hashPassword(password)
    expect(hash1).not.toBe(hash2)
  })
})
