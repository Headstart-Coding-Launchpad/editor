import { beforeEach, describe, expect, it } from 'vitest'
import {
  EXTRA_CLASS_TOOLS_KEY,
  readExtraClassToolsOn,
  setExtraClassToolsOn,
} from '../extraClassToolsSetting'

describe('extraClassToolsSetting', () => {
  beforeEach(() => window.localStorage.removeItem(EXTRA_CLASS_TOOLS_KEY))

  it('is off by default', () => {
    expect(readExtraClassToolsOn()).toBe(false)
  })

  it('stores 1 when on and removes the key when off', () => {
    setExtraClassToolsOn(true)
    expect(window.localStorage.getItem(EXTRA_CLASS_TOOLS_KEY)).toBe('1')
    expect(readExtraClassToolsOn()).toBe(true)
    setExtraClassToolsOn(false)
    expect(window.localStorage.getItem(EXTRA_CLASS_TOOLS_KEY)).toBeNull()
    expect(readExtraClassToolsOn()).toBe(false)
  })
})
