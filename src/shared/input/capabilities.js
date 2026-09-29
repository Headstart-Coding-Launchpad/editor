// What input the student's device offers. Pointer and hover support come from media queries;
// a physical keyboard can't be detected up front, so it is unknown until a hardware keydown
// arrives (or the student says they have one). Pure: pass in matchMedia for testing.
import { detectPlatform } from './platform.js'

export function detectInputCapabilities({
  matchMedia,
  maxTouchPoints = 0,
  userAgent = '',
  userAgentData = null,
} = {}) {
  const query = (q) => {
    try {
      return typeof matchMedia === 'function' ? !!matchMedia(q)?.matches : false
    } catch {
      return false
    }
  }
  return {
    finePointer: query('(any-pointer: fine)'),
    hover: query('(any-hover: hover)'),
    touch: maxTouchPoints > 0 || query('(any-pointer: coarse)'),
    physicalKeyboard: null,
    // Mac / Chromebook / Windows: which names the taught keys have (./platform.js).
    platform: detectPlatform({ userAgent, userAgentData, maxTouchPoints }),
  }
}

// A hardware keydown confirms a physical keyboard; virtual keyboard events don't change it.
export function withKeyEvidence(capabilities, keyEvent) {
  if (keyEvent?.source !== 'hardware' || capabilities.physicalKeyboard) return capabilities
  return { ...capabilities, physicalKeyboard: true }
}

// Which declared requirements this device can't meet. An unknown physical keyboard is not
// treated as missing; activities offer an "I have a keyboard" override and an on-screen
// fallback instead.
export function unmetRequirements(requires = {}, capabilities = {}) {
  const unmet = []
  if (requires.physicalKeyboard && capabilities.physicalKeyboard === false) {
    unmet.push('physicalKeyboard')
  }
  if (requires.finePointer && !capabilities.finePointer) unmet.push('finePointer')
  if (requires.hover && !capabilities.hover) unmet.push('hover')
  return unmet
}
