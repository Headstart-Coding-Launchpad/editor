import { describe, expect, it } from 'vitest'
import pythonModule from '../index'

describe('python module completion checks', () => {
  it('uses an output check by default in run mode', () => {
    expect(pythonModule.defaultCheck('run')).toEqual([
      { type: 'output_contains', value: '' },
    ])
  })

  it('uses a code check by default in submit mode', () => {
    expect(pythonModule.defaultCheck('submit')).toEqual([
      { type: 'code_contains', value: '' },
    ])
  })
})
