import { afterEach, describe, expect, it, vi } from 'vitest'
import { throttle } from '../../app/utils/throttle'

afterEach(() => {
  vi.useRealTimers()
})

describe('throttle', () => {
  it('runs immediately and ignores calls until the limit expires', () => {
    vi.useFakeTimers()
    const callback = vi.fn()
    const throttled = throttle(callback, 100)

    throttled('first')
    vi.advanceTimersByTime(50)
    throttled('ignored')

    expect(callback).toHaveBeenCalledOnce()
    expect(callback).toHaveBeenCalledWith('first')

    vi.advanceTimersByTime(50)
    throttled('after-limit')

    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenLastCalledWith('after-limit')
  })
})