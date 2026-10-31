import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { readBody } from 'h3'
import { db } from '../../server/db'
import { requireUserSession } from '../../server/utils/session'

const { readBodyMock } = vi.hoisted(() => ({ readBodyMock: vi.fn() }))

vi.mock('h3', async (importOriginal) => ({
  ...await importOriginal<typeof import('h3')>(),
  readBody: readBodyMock,
}))

vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
  },
}))

vi.mock('../../server/utils/session', () => ({
  requireUserSession: vi.fn(),
}))

describe('favorite reorder API', () => {
  let reorderFavorites: (event: never) => Promise<unknown>
  const update = vi.fn()
  const set = vi.fn()
  const where = vi.fn()
  const transaction = { update }

  beforeAll(async () => {
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('requireUserSession', requireUserSession)
    reorderFavorites = (await import('../../server/api/boards/favorites/reorder.patch')).default
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireUserSession).mockResolvedValue({ user: { id: 'user-1' } } as never)
    vi.mocked(readBody).mockResolvedValue({ boardIds: ['board-b', 'board-a'] })

    const query = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ boardId: 'board-a' }, { boardId: 'board-b' }]),
    }
    ;(db.select as any).mockReturnValue(query)
    set.mockReturnThis()
    where.mockResolvedValue({})
    update.mockReturnValue({ set, where })
    ;(db.transaction as any).mockImplementation(async (callback: (tx: typeof transaction) => unknown) => callback(transaction))
  })

  it('updates favorite positions in the requested order within a transaction', async () => {
    const result = await reorderFavorites({} as never)

    expect(result).toEqual({ success: true })
    expect(db.transaction).toHaveBeenCalledOnce()
    expect(update).toHaveBeenCalledTimes(2)
    expect(set).toHaveBeenNthCalledWith(1, { favoriteOrder: 0 })
    expect(set).toHaveBeenNthCalledWith(2, { favoriteOrder: 1 })
  })

  it('rejects an incomplete order without starting a transaction', async () => {
    vi.mocked(readBody).mockResolvedValue({ boardIds: ['board-a'] })

    await expect(reorderFavorites({} as never)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Favorite board order must include each favorite exactly once',
    })
    expect(db.transaction).not.toHaveBeenCalled()
  })
})