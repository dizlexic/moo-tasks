import { createHash, timingSafeEqual } from 'node:crypto'

export function hashBearerToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function matchesBearerTokenDigest(token: string, digest: string | null | undefined): boolean {
  if (!digest || !/^[a-f0-9]{64}$/i.test(digest)) return false

  const candidate = Buffer.from(hashBearerToken(token), 'hex')
  const stored = Buffer.from(digest, 'hex')
  return timingSafeEqual(candidate, stored)
}