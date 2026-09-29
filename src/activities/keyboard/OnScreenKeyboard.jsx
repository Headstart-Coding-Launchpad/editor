import React from 'react'
import { DEFAULT_LAYOUT, LAYOUTS, keyLabel } from '../../shared/input/index.js'

// UK on-screen keyboard. Two jobs:
//  - input fallback on devices without a physical keyboard (interactive): each key emits a
//    normalised keydown with source 'virtual', with sticky Shift and Ctrl toggles;
//  - a reference picture (not interactive) that highlights the keys a hint points at.

const ROWS = [
  [
    'Backquote',
    'Digit1',
    'Digit2',
    'Digit3',
    'Digit4',
    'Digit5',
    'Digit6',
    'Digit7',
    'Digit8',
    'Digit9',
    'Digit0',
    'Minus',
    'Equal',
    'Backspace',
  ],
  [
    'Tab',
    'KeyQ',
    'KeyW',
    'KeyE',
    'KeyR',
    'KeyT',
    'KeyY',
    'KeyU',
    'KeyI',
    'KeyO',
    'KeyP',
    'BracketLeft',
    'BracketRight',
  ],
  [
    'CapsLock',
    'KeyA',
    'KeyS',
    'KeyD',
    'KeyF',
    'KeyG',
    'KeyH',
    'KeyJ',
    'KeyK',
    'KeyL',
    'Semicolon',
    'Quote',
    'Backslash',
    'Enter',
  ],
  [
    'ShiftLeft',
    'IntlBackslash',
    'KeyZ',
    'KeyX',
    'KeyC',
    'KeyV',
    'KeyB',
    'KeyN',
    'KeyM',
    'Comma',
    'Period',
    'Slash',
    'ShiftRight',
  ],
  ['ControlLeft', 'Space'],
]

// Mac and Chromebook keyboards label some of these keys differently (see
// src/shared/input/platform.js); the picture uses the student's names.
const PLATFORM_LABELS = {
  mac: { Backspace: '⌫ delete', Enter: 'return ↵', CapsLock: 'caps lock', ControlLeft: '⌘ Cmd' },
  chromeos: { CapsLock: '🔍 Search' },
}

const NAMED = {
  Backspace: { key: 'Backspace', label: '⌫ Backspace' },
  Tab: { key: 'Tab', label: 'Tab' },
  CapsLock: { key: 'CapsLock', label: 'Caps Lock' },
  Enter: { key: 'Enter', label: 'Enter ↵' },
  ShiftLeft: { key: 'Shift', label: '⇧ Shift' },
  ShiftRight: { key: 'Shift', label: '⇧ Shift' },
  ControlLeft: { key: 'Control', label: 'Ctrl' },
  Space: { key: ' ', label: 'Space' },
}

// code -> { plain, shifted } for the character keys of a layout.
export function charsByCode(layout = DEFAULT_LAYOUT) {
  const byCode = {}
  for (const [char, { code, shift }] of Object.entries(LAYOUTS[layout] ?? {})) {
    if (char.length !== 1 || NAMED[code]) continue
    byCode[code] ??= {}
    byCode[code][shift ? 'shifted' : 'plain'] = char
  }
  return byCode
}

// The key codes to highlight for a key name or character (Shift too when it needs Shift).
export function codesForKey(key, layout = DEFAULT_LAYOUT) {
  if (key == null) return []
  if (key === 'Shift') return ['ShiftLeft', 'ShiftRight']
  if (key === 'Space' || key === ' ') return ['Space']
  if (NAMED[key]) return [key]
  const entry = LAYOUTS[layout]?.[key]
  if (!entry) return []
  return entry.shift ? [entry.code, 'ShiftLeft', 'ShiftRight'] : [entry.code]
}

export default function OnScreenKeyboard({
  layout = DEFAULT_LAYOUT,
  interactive = false,
  highlightCodes = [],
  onKey,
  showCtrl = false,
  platform = null,
}) {
  const [shift, setShift] = React.useState(false)
  const [ctrl, setCtrl] = React.useState(false)
  const chars = React.useMemo(() => charsByCode(layout), [layout])
  const highlighted = new Set(highlightCodes)

  function emit(code, key, mods = {}) {
    onKey?.({
      t: Date.now(),
      kind: 'keydown',
      key,
      code,
      mods: {
        shift: !!mods.shift,
        ctrl: !!mods.ctrl,
        alt: false,
        meta: false,
        mod: !!mods.ctrl,
      },
      capsLock: false,
      repeat: false,
      source: 'virtual',
    })
  }

  function press(code) {
    if (code === 'ShiftLeft' || code === 'ShiftRight') {
      if (!shift) emit(code, 'Shift', { shift: true, ctrl })
      setShift((on) => !on)
      return
    }
    if (code === 'ControlLeft') {
      if (!ctrl) emit(code, 'Control', { ctrl: true, shift })
      setCtrl((on) => !on)
      return
    }
    const named = NAMED[code]
    const entry = chars[code]
    const key = named ? named.key : ((shift ? entry?.shifted : entry?.plain) ?? '')
    if (!key) return
    emit(code, key, { shift, ctrl })
    // Shift and Ctrl are one-shot, like a phone keyboard.
    setShift(false)
    setCtrl(false)
  }

  return (
    <div
      className="act-osk"
      role={interactive ? 'group' : 'img'}
      aria-label={interactive ? 'On-screen keyboard' : 'Keyboard picture'}
      data-testid={interactive ? 'on-screen-keyboard' : 'keyboard-picture'}
    >
      {ROWS.map((row, rowIndex) => (
        <div className="act-osk__row" key={rowIndex}>
          {row
            .filter((code) => code !== 'ControlLeft' || showCtrl || !interactive)
            .map((code) => {
              const named = NAMED[code]
              const entry = chars[code]
              const wide = named && code !== 'Space'
              const className = [
                'act-osk__key',
                wide ? 'act-osk__key--wide' : '',
                code === 'Space' ? 'act-osk__key--space' : '',
                highlighted.has(code) ? 'act-osk__key--highlight' : '',
              ]
                .filter(Boolean)
                .join(' ')
              const toggled =
                ((code === 'ShiftLeft' || code === 'ShiftRight') && shift) ||
                (code === 'ControlLeft' && ctrl)
              const content = named ? (
                // The picture of the student's own keyboard uses its key names.
                (!interactive && PLATFORM_LABELS[platform]?.[code]) || named.label
              ) : (
                <>
                  {entry?.shifted && entry.shifted.toLowerCase() !== entry.plain && (
                    <small>{entry.shifted}</small>
                  )}
                  <span>{keyLabel(code)}</span>
                </>
              )
              if (!interactive) {
                return (
                  <span key={code} className={className} data-code={code}>
                    {content}
                  </span>
                )
              }
              const typed = named ? named.label : ((shift ? entry?.shifted : entry?.plain) ?? code)
              return (
                <button
                  key={code}
                  type="button"
                  className={className}
                  data-code={code}
                  aria-label={typed === ' ' ? 'Space' : typed}
                  aria-pressed={
                    code.startsWith('Shift') || code === 'ControlLeft' ? toggled : undefined
                  }
                  // Keep focus (and the practice area's caret) where it is.
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => press(code)}
                >
                  {content}
                </button>
              )
            })}
        </div>
      ))}
    </div>
  )
}
