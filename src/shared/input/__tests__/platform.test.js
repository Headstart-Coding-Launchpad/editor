import { describe, expect, it } from 'vitest'
import { detectInputCapabilities, detectPlatform, keyName, modKeyName } from '../index.js'

const UA = {
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0 Safari/537.36',
  chromeos:
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/128.0 Safari/537.36',
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/128.0',
}

describe('detectPlatform', () => {
  it('reads the user agent', () => {
    expect(detectPlatform({ userAgent: UA.mac })).toBe('mac')
    expect(detectPlatform({ userAgent: UA.chromeos })).toBe('chromeos')
    expect(detectPlatform({ userAgent: UA.windows })).toBe('windows')
    expect(detectPlatform({ userAgent: UA.linux })).toBe('other')
    expect(detectPlatform()).toBe('other')
  })

  it('prefers the client-hint platform, and treats an iPad as other', () => {
    expect(detectPlatform({ userAgentData: { platform: 'Chrome OS' }, userAgent: UA.linux })).toBe(
      'chromeos'
    )
    expect(detectPlatform({ userAgentData: { platform: 'macOS' } })).toBe('mac')
    expect(detectPlatform({ userAgent: UA.ipad, maxTouchPoints: 5 })).toBe('other')
  })

  it('is part of the detected input capabilities', () => {
    expect(detectInputCapabilities({ userAgent: UA.mac }).platform).toBe('mac')
  })
})

describe('key names by platform', () => {
  it('names the taught keys as each keyboard labels them', () => {
    expect(keyName('Backspace', 'mac')).toBe('delete')
    expect(keyName('Delete', 'mac')).toBe('fn + delete')
    expect(keyName('Delete', 'chromeos')).toBe('Alt + Backspace')
    expect(keyName('CapsLock', 'chromeos')).toBe('Alt + Search')
    expect(keyName('Home', 'chromeos')).toBe('Search + ←')
    expect(keyName('End', 'mac')).toBe('fn + →')
    expect(keyName('Delete', 'windows')).toBe('Delete')
    expect(keyName('Enter')).toBe('Enter')
    expect(modKeyName('mac')).toBe('Cmd')
    expect(modKeyName('chromeos')).toBe('Ctrl')
  })
})
