import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSandboxCodePush } from '../useSandboxCodePush'

function setup(type, session) {
  const setters = {
    setCode: vi.fn(),
    setFiles: vi.fn(),
    setActiveFile: vi.fn(),
    setFsState: vi.fn(),
    setScratchSandboxProject: vi.fn(),
  }
  renderHook(() => useSandboxCodePush({ phase: 'sandbox', lesson: { type }, session, ...setters }))
  return setters
}

describe('useSandboxCodePush', () => {
  it.each(['python', 'arcade', 'electronics', 'turtle'])(
    'loads pushed sandbox code into the code editor for %s',
    (type) => {
      const setters = setup(type, { sandboxCode: 'print(1)', sandboxCodePushedAt: 1 })
      expect(setters.setCode).toHaveBeenCalledWith('print(1)')
    }
  )

  it('parses pushed filesystem state', () => {
    const setters = setup('filesystem', {
      sandboxCode: '{"/":{"type":"dir"}}',
      sandboxCodePushedAt: 1,
    })
    expect(setters.setFsState).toHaveBeenCalledWith({ '/': { type: 'dir' } })
    expect(setters.setCode).not.toHaveBeenCalled()
  })
})
