import { afterEach, describe, expect, it, vi } from 'vitest'
import { debounce } from '../../app/utils/debounce'

afterEach(() => {
  vi.useRealTimers()
})

describe('debounce', () => {
  it('runs once after the delay with the most recent arguments', () => {
    vi.useFakeTimers()
    const callback = vi.fn()
    const debounced = debounce(callback, 100)

    debounced('first')
    vi.advanceTimersByTime(50)
    debounced('last')
    vi.advanceTimersByTime(99)

    expect(callback).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)

    expect(callback).toHaveBeenCalledOnce()
    expect(callback).toHaveBeenCalledWith('last')
  })
})