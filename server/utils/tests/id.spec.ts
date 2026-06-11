import { describe, it, expect } from 'vitest'
import { generateId } from '../id'

describe('id utils', () => {
  it('should generate an ID of default size (12)', () => {
    const id = generateId()
    expect(id).toHaveLength(12)
    expect(typeof id).toBe('string')
  })

  it('should generate an ID of custom size', () => {
    const size = 16
    const id = generateId(size)
    expect(id).toHaveLength(size)
  })

  it('should generate different IDs', () => {
    const id1 = generateId()
    const id2 = generateId()
    expect(id1).not.toBe(id2)
  })
})
