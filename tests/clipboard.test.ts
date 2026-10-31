import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyTextToClipboard } from '../app/utils/clipboard'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('copyTextToClipboard', () => {
  it('uses the Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await expect(copyTextToClipboard('task-id')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('task-id')
  })

  it('falls back to document copy when the Clipboard API is unavailable', async () => {
    const execCommand = vi.fn().mockReturnValue(true)
    const textarea = {
      value: '',
      style: {} as CSSStyleDeclaration,
      setAttribute: vi.fn(),
      select: vi.fn(),
      remove: vi.fn(),
    }
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('document', {
      createElement: vi.fn(() => textarea),
      body: { appendChild: vi.fn() },
      execCommand,
    })

    await expect(copyTextToClipboard('task-id')).resolves.toBe(true)
    expect(textarea.value).toBe('task-id')
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(textarea.remove).toHaveBeenCalled()
  })

  it('falls back when the Clipboard API rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Clipboard denied'))
    const execCommand = vi.fn().mockReturnValue(true)
    const textarea = {
      value: '',
      style: {} as CSSStyleDeclaration,
      setAttribute: vi.fn(),
      select: vi.fn(),
      remove: vi.fn(),
    }
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    vi.stubGlobal('document', {
      createElement: vi.fn(() => textarea),
      body: { appendChild: vi.fn() },
      execCommand,
    })

    await expect(copyTextToClipboard('task-id')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('task-id')
    expect(execCommand).toHaveBeenCalledWith('copy')
  })
})