import { describe, it, expect } from 'vitest'
import { hashPassword, comparePasswords } from '../../lib/password'

describe('Password Characters', () => {
  const passwords = [
    'standard-password',
    'password with spaces ',
    ' spaces at start',
    'pass:word', // contains separator
    'pass:word:with:many:colons',
    'p@$$w0rd!',
    '密码', // Chinese
    '🔑🔓', // Emojis
    'Cyrillic: Пароль',
    'Very'.repeat(50) + 'Long', // Long password
    '', // Empty string (though API blocks it)
  ]

  for (const pw of passwords) {
    it(`should correctly hash and compare: "${pw}"`, async () => {
      const hash = await hashPassword(pw)
      const valid = await comparePasswords(pw, hash)
      expect(valid).toBe(true)
      
      const invalid = await comparePasswords(pw + '_wrong', hash)
      expect(invalid).toBe(false)
    })
  }
})
