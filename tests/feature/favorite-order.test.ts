import { describe, expect, it } from 'vitest'
import { normalizeFavoriteBoardOrder } from '../../server/utils/favorite-order'

describe('normalizeFavoriteBoardOrder', () => {
  const favoriteBoardIds = ['board-a', 'board-b', 'board-c']

  it('accepts a reordered list containing every favorite exactly once', () => {
    expect(normalizeFavoriteBoardOrder(['board-c', 'board-a', 'board-b'], favoriteBoardIds))
      .toEqual(['board-c', 'board-a', 'board-b'])
  })

  it('rejects malformed IDs, duplicates, missing favorites, and non-favorites', () => {
    expect(normalizeFavoriteBoardOrder('board-a', favoriteBoardIds)).toBeNull()
    expect(normalizeFavoriteBoardOrder(['board-a', 'board-a', 'board-c'], favoriteBoardIds)).toBeNull()
    expect(normalizeFavoriteBoardOrder(['board-a', 'board-b'], favoriteBoardIds)).toBeNull()
    expect(normalizeFavoriteBoardOrder(['board-a', 'board-b', 'other-board'], favoriteBoardIds)).toBeNull()
  })

  it('accepts an empty list when the user has no favorites', () => {
    expect(normalizeFavoriteBoardOrder([], [])).toEqual([])
  })
})