import { describe, it, expect } from 'vitest'
import { getVerificationEmail, getInvitationEmail, getPasswordResetEmail } from '../email-templates'

describe('email templates', () => {
  it('should return a verification email object', () => {
    const url = 'https://example.com/verify'
    const email = getVerificationEmail(url)
    expect(email.subject).toBe('Verify your email address')
    expect(email.text).toContain(url)
    expect(email.html).toContain(url)
    expect(email.html).toContain('Moo Tasks')
  })

  it('should return an invitation email object', () => {
    const boardName = 'Test Board'
    const url = 'https://example.com/board'
    const email = getInvitationEmail(boardName, url)
    expect(email.subject).toContain(boardName)
    expect(email.text).toContain(boardName)
    expect(email.text).toContain(url)
    expect(email.html).toContain(boardName)
    expect(email.html).toContain(url)
  })

  it('should return a password reset email object', () => {
    const url = 'https://example.com/reset'
    const email = getPasswordResetEmail(url)
    expect(email.subject).toBe('Reset your password')
    expect(email.text).toContain(url)
    expect(email.html).toContain(url)
  })
})
