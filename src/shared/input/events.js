// Normalised input events. Every recogniser, summary and input check works on these plain
// objects rather than DOM events, so they are testable in Node and never hold DOM references.
// Pure: no DOM access at import time.

// Browsers report a virtual (on-screen/IME) keyboard with an Unidentified key or keyCode 229.
function isVirtualKeyEvent(e) {
  return e.isComposing === true || e.key === 'Unidentified' || e.keyCode === 229
}

export function normalizeKeyEvent(e, now = Date.now()) {
  const ctrl = !!e.ctrlKey
  const meta = !!e.metaKey
  return {
    t: now,
    kind: e.type === 'keyup' ? 'keyup' : 'keydown',
    key: e.key ?? '',
    code: e.code ?? '',
    mods: { shift: !!e.shiftKey, ctrl, alt: !!e.altKey, meta, mod: ctrl || meta },
    capsLock: typeof e.getModifierState === 'function' ? !!e.getModifierState('CapsLock') : false,
    repeat: !!e.repeat,
    // The on-screen keyboard passes source: 'virtual' explicitly.
    source: e.source === 'virtual' || isVirtualKeyEvent(e) ? 'virtual' : 'hardware',
  }
}

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'OS'])

export function isModifierKey(key) {
  return MODIFIER_KEYS.has(key)
}

// Canonical combo for a normalised keydown: 'mod+c', 'mod+shift+z', 'shift+tab', 'alt+f4'.
// Ctrl and Cmd both map to 'mod' so one check works on Windows, ChromeOS and Mac. Returns null
// for bare modifier presses.
export function comboOf(event) {
  if (!event || isModifierKey(event.key)) return null
  const parts = []
  if (event.mods.mod) parts.push('mod')
  if (event.mods.alt) parts.push('alt')
  // Shift only counts as part of a combo alongside another modifier or a non-printing key;
  // Shift+a is just typing "A".
  const printable = event.key.length === 1
  if (event.mods.shift && (!printable || event.mods.mod || event.mods.alt)) parts.push('shift')
  const key = event.code?.startsWith('Key')
    ? event.code.slice(3).toLowerCase()
    : event.key.toLowerCase()
  parts.push(key === ' ' ? 'space' : key)
  return parts.join('+')
}

export function normalizeCombo(combo) {
  const parts = String(combo ?? '')
    .toLowerCase()
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part === 'ctrl' || part === 'cmd' || part === 'meta' ? 'mod' : part))
  const key = parts.filter((part) => !['mod', 'alt', 'shift'].includes(part))
  const order = ['mod', 'alt', 'shift'].filter((mod) => parts.includes(mod))
  return [...order, ...key].join('+')
}

// Shortcuts the browser or OS keeps for itself: a web page never receives them reliably, so a
// lesson can't ask students to perform them for real (teach them as a quiz instead).
export const RESERVED_COMBOS = new Set(
  [
    'mod+w',
    'mod+t',
    'mod+n',
    'mod+q',
    'mod+tab',
    'mod+shift+tab',
    'mod+shift+t',
    'mod+shift+n',
    'mod+shift+w',
    'alt+f4',
    'alt+tab',
  ].map(normalizeCombo)
)

export function isReservedCombo(combo) {
  return RESERVED_COMBOS.has(normalizeCombo(combo))
}

function closestInputId(target) {
  const el = target?.closest?.('[data-input-id]')
  return el?.getAttribute?.('data-input-id') ?? null
}

// rect is the bounding box of the activity's root element, used to store positions as 0-1
// fractions so replay and teacher views are resolution independent.
export function normalizePointerEvent(e, rect = null, now = Date.now()) {
  const x = rect?.width ? (e.clientX - rect.left) / rect.width : null
  const y = rect?.height ? (e.clientY - rect.top) / rect.height : null
  return {
    t: now,
    kind: e.type,
    pointerType: e.pointerType || 'mouse',
    button: typeof e.button === 'number' ? e.button : 0,
    targetId: e.targetId ?? closestInputId(e.target),
    px: typeof e.clientX === 'number' ? e.clientX : null,
    py: typeof e.clientY === 'number' ? e.clientY : null,
    x,
    y,
  }
}
