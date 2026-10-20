import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SCRUB_OPEN_FILENAME, useScrubAfterPass } from '../useScrubAfterPass.js'

function fakePersistence(files = {}) {
  return {
    files,
    readSavedFile: vi.fn((actor, taskId, name) => files[`${actor}:${taskId}:${name}`] ?? null),
    saveHtmlFile: vi.fn((actor, taskId, name, content) => {
      files[`${actor}:${taskId}:${name}`] = content
    }),
  }
}

const held = { id: 1, scrub: { afterPass: true } }
const open = { id: 2, scrub: true }

function setup(props) {
  return renderHook((p) => useScrubAfterPass(p), {
    initialProps: { actorId: 'kid', checkPassed: false, ...props },
  })
}

describe('useScrubAfterPass (scrub.afterPass)', () => {
  it('holds the values until the first pass, then opens with the cue and remembers it', () => {
    const persistence = fakePersistence()
    const { result, rerender } = setup({ task: held, taskId: 1, persistence })
    expect(result.current.held).toBe(true)
    expect(result.current.justOpened).toBe(false)

    rerender({ task: held, taskId: 1, persistence, actorId: 'kid', checkPassed: true })
    expect(result.current.held).toBe(false)
    expect(result.current.justOpened).toBe(true)
    expect(persistence.saveHtmlFile).toHaveBeenCalledWith(
      'kid',
      1,
      SCRUB_OPEN_FILENAME,
      expect.stringContaining('"at"')
    )

    // A later failed Run (checkPassed back to false) doesn't shut them again.
    rerender({ task: held, taskId: 1, persistence, actorId: 'kid', checkPassed: false })
    expect(result.current.held).toBe(false)

    act(() => result.current.dismissCue())
    expect(result.current.justOpened).toBe(false)
  })

  it('stays open after a reload, without the cue', () => {
    const persistence = fakePersistence({ [`kid:1:${SCRUB_OPEN_FILENAME}`]: '{"at":1}' })
    const { result } = setup({ task: held, taskId: 1, persistence })
    expect(result.current.held).toBe(false)
    expect(result.current.justOpened).toBe(false)
  })

  it("never opens a task from the previous task's pass", () => {
    const persistence = fakePersistence()
    const { result, rerender } = setup({ task: open, taskId: 2, persistence, checkPassed: true })
    // Moving on: checkPassed is still true for a render before the reset.
    rerender({ task: held, taskId: 1, persistence, actorId: 'kid', checkPassed: true })
    expect(result.current.held).toBe(true)
    expect(persistence.saveHtmlFile).not.toHaveBeenCalled()
  })

  it('is never held without afterPass, or in the personal sandbox', () => {
    const persistence = fakePersistence()
    expect(setup({ task: open, taskId: 2, persistence }).result.current.held).toBe(false)
    const sandbox = setup({ task: held, taskId: 1, persistence, inPersonalSandbox: true })
    expect(sandbox.result.current.held).toBe(false)
    sandbox.rerender({
      task: held,
      taskId: 1,
      persistence,
      actorId: 'kid',
      checkPassed: true,
      inPersonalSandbox: true,
    })
    expect(persistence.saveHtmlFile).not.toHaveBeenCalled()
  })
})
