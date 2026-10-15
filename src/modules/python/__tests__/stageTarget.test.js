import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../pyodide.js', () => ({
  renderStage: vi.fn(),
  isPythonRunning: vi.fn(() => false),
}))

import {
  clearStageTargetCache,
  getCachedStageTarget,
  loadStageTarget,
  stageTargetCode,
  stageTargetGhostOn,
} from '../stageTarget.js'

describe('stageTarget cache', () => {
  beforeEach(() => clearStageTargetCache())

  it('reads the task field', () => {
    expect(stageTargetCode({ stageTarget: { code: 'from stage import *' } })).toBe(
      'from stage import *'
    )
    expect(stageTargetCode({ stageTarget: { code: '  ' } })).toBeNull()
    expect(stageTargetCode(null)).toBeNull()
    expect(stageTargetGhostOn({ stageTarget: { code: 'x' } })).toBe(true)
    expect(stageTargetGhostOn({ stageTarget: { code: 'x', ghost: false } })).toBe(false)
  })

  it('draws a target once and shares it', async () => {
    const result = { status: 'success', commands: [{ type: 'clear' }], error: null }
    const render = vi.fn(() => Promise.resolve(result))
    const [a, b] = await Promise.all([
      loadStageTarget('code', render),
      loadStageTarget('code', render),
    ])
    expect(a).toBe(result)
    expect(b).toBe(result)
    expect(await loadStageTarget('code', render)).toBe(result)
    expect(render).toHaveBeenCalledTimes(1)
    expect(getCachedStageTarget('code')).toBe(result)
  })

  it('tries again later when Python could not draw it', async () => {
    const render = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ commands: [] })
    expect(await loadStageTarget('code', render)).toBeNull()
    expect(getCachedStageTarget('code')).toBeNull()
    expect(await loadStageTarget('code', render)).toEqual({ commands: [] })
    expect(render).toHaveBeenCalledTimes(2)
  })
})
