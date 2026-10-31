export function normalizeFavoriteBoardOrder(boardIds: unknown, favoriteBoardIds: string[]): string[] | null {
  if (!Array.isArray(boardIds) || !boardIds.every((id): id is string => typeof id === 'string')) {
    return null
  }

  if (boardIds.length !== favoriteBoardIds.length || new Set(boardIds).size !== boardIds.length) {
    return null
  }

  const favoriteIds = new Set(favoriteBoardIds)
  return boardIds.every(id => favoriteIds.has(id)) ? boardIds : null
}