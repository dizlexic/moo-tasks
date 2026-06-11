import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { generateId } from '../id'
import { slugify } from '../slug'

describe('utility functions fuzz testing', () => {
  it('generateId should always return a string of requested length', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (size) => {
        const id = generateId(size)
        expect(id).toHaveLength(size)
        expect(typeof id).toBe('string')
      })
    )
  })

  it('slugify should always return a valid slug', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const slug = slugify(text)
        // Slug should only contain lowercase letters, numbers, and hyphens
        expect(slug).toMatch(/^[a-z0-9-]*$/)
        // Slug should not start or end with a hyphen
        if (slug.length > 0) {
          expect(slug[0]).not.toBe('-')
          expect(slug[slug.length - 1]).not.toBe('-')
        }
      })
    )
  })
  
  it('slugify should handle very long strings', () => {
    fc.assert(
        fc.property(fc.string({ minLength: 1000, maxLength: 5000 }), (text) => {
            const slug = slugify(text)
            expect(slug).toMatch(/^[a-z0-9-]*$/)
        })
    )
  })
})
