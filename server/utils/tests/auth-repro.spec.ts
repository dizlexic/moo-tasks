import { describe, it, expect, vi } from 'vitest'
import { hashPassword, comparePasswords } from '../../utils/password'

describe('Auth Reproduction', () => {
  it('should work with same normalization as API', async () => {
    const rawEmail = ' Test@Example.com '
    const rawPassword = ' Password123! '
    
    // Registration normalization
    const regEmail = rawEmail.trim().toLowerCase()
    const regPassword = rawPassword // Password NOT trimmed in API
    
    const passwordHash = await hashPassword(regPassword)
    
    // Login normalization
    const loginEmail = rawEmail.trim().toLowerCase()
    const loginPassword = rawPassword
    
    expect(loginEmail).toBe(regEmail)
    
    const valid = await comparePasswords(loginPassword, passwordHash)
    expect(valid).toBe(true)
  })

  it('should fail if email is not trimmed in one place', () => {
    const rawEmail = ' test@example.com '
    const trimmed = rawEmail.trim().toLowerCase()
    const untrimmed = rawEmail.toLowerCase()
    
    expect(trimmed).not.toBe(untrimmed)
  })
})
