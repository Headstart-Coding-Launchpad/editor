// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { sandboxModuleLabel } from '../sandboxModuleLabel'
import { getModuleDefinition } from '../../../../modules/definitions'

describe('sandboxModuleLabel', () => {
  const python = getModuleDefinition('python').meta.label

  it('never shows the raw type twice', () => {
    expect(sandboxModuleLabel({ id: 'python', type: 'python' })).toBe(python)
    expect(sandboxModuleLabel({ id: 'm1', type: 'python', title: 'python' })).toBe(python)
    expect(sandboxModuleLabel({ id: 'm1', type: 'python', title: python })).toBe(python)
  })

  it('keeps a real title, with the module label after it', () => {
    expect(sandboxModuleLabel({ id: 'm1', type: 'python', title: 'Warm-up' })).toBe(
      `Warm-up (${python})`
    )
  })
})
