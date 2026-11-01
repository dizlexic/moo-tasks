import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { hashBearerToken, matchesBearerTokenDigest } from '../../server/utils/token-digests'

describe('bearer token digests', () => {
  it('hashes tokens with SHA-256 and matches the original bearer token', () => {
    const token = 'mab_test-token'
    const digest = hashBearerToken(token)

    expect(digest).toBe(createHash('sha256').update(token).digest('hex'))
    expect(digest).toHaveLength(64)
    expect(matchesBearerTokenDigest(token, digest)).toBe(true)
  })

  it('does not treat a stored plaintext token as a valid digest', () => {
    const token = 'mab_test-token'

    expect(matchesBearerTokenDigest(token, token)).toBe(false)
    expect(matchesBearerTokenDigest(token, null)).toBe(false)
    expect(matchesBearerTokenDigest(token, 'not-a-digest')).toBe(false)
  })
})