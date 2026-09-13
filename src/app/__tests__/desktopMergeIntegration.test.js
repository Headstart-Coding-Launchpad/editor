import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { resolveRemoteResetTarget } from '../studentTaskContent'
import { useSandboxCodePush } from '../hooks/useSandboxCodePush'

// Main moved remote-reset resolution into resolveRemoteResetTarget and sandbox pushes into
// useSandboxCodePush while the Desktop module was on its own branch. These keep Desktop
// wired into both after the merge.

const desktop = (name) => ({ fs: { '/': { type: 'dir' }, [`/${name}.txt`]: { type: 'file' } } })

describe('Desktop remote reset', () => {
  const task = {
    starterDesktop: desktop('starter'),
    completeDesktop: desktop('complete'),
    codeStages: [{ label: 'Hint', desktop: desktop('stage') }],
  }
  const defaults = { desktop: desktop('default') }

  it('resolves starter, complete and stage targets', () => {
    expect(resolveRemoteResetTarget(task, 'starter', 'desktop', defaults)).toEqual({
      desktop: task.starterDesktop,
    })
    expect(resolveRemoteResetTarget(task, 'complete', 'desktop', defaults)).toEqual({
      desktop: task.completeDesktop,
    })
    expect(resolveRemoteResetTarget(task, 'stage_0', 'desktop', defaults)).toEqual({
      desktop: task.codeStages[0].desktop,
    })
  })

  it('falls back to the default desktop when the task has none', () => {
    expect(resolveRemoteResetTarget({}, 'starter', 'desktop', defaults)).toEqual({
      desktop: defaults.desktop,
    })
  })
})

describe('Desktop sandbox push', () => {
  it('loads the pushed desktop state', () => {
    const setDesktopState = vi.fn()
    const pushed = desktop('pushed')
    renderHook(() =>
      useSandboxCodePush({
        phase: 'sandbox',
        lesson: { type: 'desktop' },
        session: { sandboxCode: JSON.stringify(pushed), sandboxCodePushedAt: 1 },
        setCode: vi.fn(),
        setFiles: vi.fn(),
        setActiveFile: vi.fn(),
        setFsState: vi.fn(),
        setDesktopState,
        setScratchSandboxProject: vi.fn(),
      })
    )
    expect(setDesktopState).toHaveBeenCalledWith(pushed)
  })
})
