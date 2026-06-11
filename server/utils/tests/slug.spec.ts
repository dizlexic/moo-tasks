import { describe, it, expect } from 'vitest'
import { slugify } from '../slug'

describe('slug utils', () => {
  it('should convert text to lowercase', () => {
    expect(slugify('HELLO')).toBe('hello')
  })

  it('should replace spaces with hyphens', () => {
    expect(slugify('hello world')).toBe('hello-world')
  })

  it('should remove special characters', () => {
    expect(slugify('hello @ world!')).toBe('hello-world')
  })

  it('should normalize accented characters', () => {
    expect(slugify('Héllö Wôrld')).toBe('hello-world')
  })

  it('should handle multiple hyphens', () => {
    expect(slugify('hello---world')).toBe('hello-world')
  })

  it('should trim hyphens from start and end', () => {
    expect(slugify('---hello-world---')).toBe('hello-world')
  })

  it('should replace underscores with hyphens', () => {
    expect(slugify('hello_world')).toBe('hello-world')
  })

  it('should handle complex strings', () => {
    expect(slugify('  Moo Tasks: The Best Board Ever!!!  ')).toBe('moo-tasks-the-best-board-ever')
  })
})
