import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSandboxCodePush } from '../useSandboxCodePush'

function setup(type, session, lesson = { type }) {
  const callbacks = { onPushedWork: vi.fn(), onPushedFiles: vi.fn() }
  renderHook(() => useSandboxCodePush({ phase: 'sandbox', lesson, session, ...callbacks }))
  return callbacks
}

describe('useSandboxCodePush', () => {
  it.each(['python', 'arcade', 'electronics', 'turtle'])(
    'loads pushed sandbox code into the code editor for %s',
    (type) => {
      const callbacks = setup(type, { sandboxCode: 'print(1)', sandboxCodePushedAt: 1 })
      expect(callbacks.onPushedWork).toHaveBeenCalledWith('print(1)')
      expect(callbacks.onPushedFiles).not.toHaveBeenCalled()
    }
  )

  it('parses pushed filesystem state', () => {
    const callbacks = setup('filesystem', {
      sandboxCode: '{"/":{"type":"dir"}}',
      sandboxCodePushedAt: 1,
    })
    expect(callbacks.onPushedWork).toHaveBeenCalledWith({ '/': { type: 'dir' } })
  })

  // Plan step 4.6: the push is decoded by the module's wire codec (wire.fromCode).
  it.each([
    ['scratch', '{"Stage":{"blocks":[]}}', { Stage: { blocks: [] } }],
    ['desktop', '{"windows":[]}', { windows: [] }],
  ])('parses pushed %s state through wire.fromCode', (type, sandboxCode, expected) => {
    const callbacks = setup(type, { sandboxCode, sandboxCodePushedAt: 1 })
    expect(callbacks.onPushedWork).toHaveBeenCalledWith(expected)
  })

  it.each(['scratch', 'filesystem', 'desktop'])('ignores a malformed %s push', (type) => {
    const callbacks = setup(type, { sandboxCode: '{not json', sandboxCodePushedAt: 1 })
    expect(callbacks.onPushedWork).not.toHaveBeenCalled()
  })

  it('does nothing outside the sandbox or without pushed code', () => {
    const callbacks = { onPushedWork: vi.fn(), onPushedFiles: vi.fn() }
    renderHook(() =>
      useSandboxCodePush({
        phase: 'lesson',
        lesson: { type: 'python' },
        session: { sandboxCode: 'x', sandboxCodePushedAt: 1 },
        ...callbacks,
      })
    )
    expect(callbacks.onPushedWork).not.toHaveBeenCalled()
    expect(setup('python', { sandboxCode: '' }).onPushedWork).not.toHaveBeenCalled()
  })

  it('decodes pushed html files (file keys and types) on the files channel', () => {
    const callbacks = setup('html', {
      sandboxCode: 'ignored',
      sandboxFiles: { index__dot__html: '<p>', style__dot__css: 'p{}', app__dot__js: 'x' },
      sandboxFilesUpdatedAt: 1,
    })
    expect(callbacks.onPushedWork).not.toHaveBeenCalled()
    expect(callbacks.onPushedFiles).toHaveBeenCalledWith([
      { name: 'index.html', content: '<p>', type: 'html' },
      { name: 'style.css', content: 'p{}', type: 'css' },
      { name: 'app.js', content: 'x', type: 'js' },
    ])
  })

  it("falls back to the lesson's sandbox starter files when none were pushed", () => {
    const starter = [{ name: 'index.html', type: 'html', content: '<h1>' }]
    const callbacks = setup('html', {}, { type: 'html', sandboxStarterFiles: starter })
    expect(callbacks.onPushedFiles).toHaveBeenCalledWith(starter)
  })
})
