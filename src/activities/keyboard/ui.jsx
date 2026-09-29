import React, { useEffect, useRef, useState } from 'react'
import KeyboardBuilderEditor from './KeyboardBuilderEditor.jsx'
import ItemNav from '../ui/ItemNav.jsx'
import OnScreenKeyboard, { codesForKey } from './OnScreenKeyboard.jsx'
import { NAMED_KEYS, describeItem, gradeKeyboardItem } from './keyboard.js'
import {
  DEFAULT_LAYOUT,
  comboOf,
  createInputRecorder,
  getKeyForChar,
  isModifierKey,
  normalizeCombo,
  normalizeKeyEvent,
  typedCharacters,
  typingStats,
} from '../../shared/input/index.js'

// Keyboard activity UI. Input is recorded from a focused practice area (hardware keys) or the
// on-screen keyboard (source 'virtual'); raw events stay in memory and each item stores a small
// result that keyboard.js grades:
//   type_text: { typed, accuracy, wpm, shiftCapitals, capsLockCapitals, source, done }
//   find_key:  { pressed, source }
//   symbols:   { typedChar, shift, source }
//   shortcuts: { performed, via: 'keyboard' | 'menu', source }
// Keystrokes are continuous changes (synced only while the teacher watches); finishing an
// item is discrete (see classifyChange in definition.js).

const MISSES_BEFORE_HINT = 2
const NATIVE_TEXT_COMBOS = new Set([
  'mod+c',
  'mod+x',
  'mod+v',
  'mod+a',
  'mod+z',
  'mod+y',
  'mod+shift+z',
])
const CLIPBOARD_COMBOS = { copy: 'mod+c', cut: 'mod+x', paste: 'mod+v' }

const MODE_PROMPTS = {
  type_text: () => 'Type this line',
  find_key: (task, item) => item.prompt ?? `Find and press the ${describeItem(task, item)} key`,
  symbols: (task, item) => item.prompt ?? `Type the ${item.char} symbol`,
  shortcuts: (task, item) => item.prompt ?? `Use the shortcut ${describeItem(task, item)}`,
}

function isItemFinished(mode, result) {
  if (!result) return false
  if (mode === 'type_text') return !!result.done
  if (mode === 'find_key') return !!result.pressed
  if (mode === 'symbols') return !!result.typedChar
  return !!result.performed
}

function describeCombo(combo) {
  return String(combo ?? '')
    .split('+')
    .map((part) => (part === 'mod' ? 'Ctrl' : part.length === 1 ? part.toUpperCase() : part))
    .join(' + ')
}

// Does a keydown press the key a find_key item asks for?
function pressesKey(event, itemKey, layout) {
  if (itemKey === 'Space') return event.key === ' ' || event.code === 'Space'
  if (NAMED_KEYS.includes(itemKey)) return event.key === itemKey
  const target = getKeyForChar(itemKey, layout)
  if (target && event.code === target.code) return true
  return String(event.key).toLowerCase() === String(itemKey).toLowerCase()
}

function TargetText({ text, typed }) {
  return (
    <p className="act-target-text" aria-label={`Type: ${text}`}>
      {[...text].map((char, index) => {
        const typedChar = typed[index]
        const cls =
          typedChar === undefined
            ? index === typed.length
              ? 'act-char--next'
              : ''
            : typedChar === char
              ? 'act-char--ok'
              : 'act-char--bad'
        return (
          <span key={index} className={cls} aria-hidden="true">
            {char === ' ' && typedChar !== undefined && typedChar !== char ? '␣' : char}
          </span>
        )
      })}
    </p>
  )
}

export function KeyboardStudentView({
  task,
  state,
  onChange,
  onSubmit,
  readOnly = false,
  device = {},
}) {
  const mode = task?.mode ?? 'type_text'
  const layout = task?.layout ?? DEFAULT_LAYOUT
  const items = task?.items ?? []
  const [index, setIndex] = useState(() => {
    const firstOpen = items.findIndex((item) => !isItemFinished(mode, state?.items?.[item.id]))
    return firstOpen === -1 ? 0 : firstOpen
  })
  const [misses, setMisses] = useState({})
  const [lastWrong, setLastWrong] = useState(null)
  const recorderRef = useRef(createInputRecorder())
  const startedAtRef = useRef(null)
  const lastComboRef = useRef({ combo: null, at: 0 })
  const practiceRef = useRef(null)
  const current = items[Math.min(index, items.length - 1)]
  const result = current ? (state?.items?.[current.id] ?? {}) : {}
  const finished = isItemFinished(mode, result)
  const grade = current ? gradeKeyboardItem(task, current, result) : null
  const virtualKeyboard = !!device.virtualKeyboard && !readOnly
  const currentId = current?.id

  // A new item starts a new recording and puts the caret back in the practice area.
  useEffect(() => {
    recorderRef.current.reset()
    startedAtRef.current = null
    setLastWrong(null)
    if (!readOnly && practiceRef.current && typeof practiceRef.current.focus === 'function') {
      practiceRef.current.focus({ preventScroll: true })
    }
  }, [currentId, readOnly])

  if (!current) return <p>This keyboard task has no items yet.</p>

  // Updates the current item's result from the host's latest state (not this render's), so
  // fast typing never drops a key between renders. Returns the new result.
  function updateResult(produce) {
    let produced = null
    onChange?.((prev) => {
      produced = produce(prev?.items?.[current.id] ?? {})
      return { ...(prev ?? { v: 1 }), items: { ...(prev?.items ?? {}), [current.id]: produced } }
    })
    return produced
  }

  function setResult(next) {
    updateResult(() => next)
  }

  function miss(description) {
    setMisses((prev) => ({ ...prev, [current.id]: (prev[current.id] ?? 0) + 1 }))
    setLastWrong(description)
  }

  function advanceAfter(nextItems) {
    const openIndex = items.findIndex((item) => !isItemFinished(mode, nextItems[item.id]))
    if (openIndex === -1) {
      // Everything has a result: mark the task (logs the attempt and shows feedback).
      onSubmit?.()
    } else if (openIndex !== index) {
      setIndex(openIndex)
    }
  }

  function finishItem(next) {
    setResult(next)
    advanceAfter({ ...(state?.items ?? {}), [current.id]: next })
  }

  // ─── Per-mode handling of one normalised keydown ──────────────────────────
  function handleTypeText(event) {
    const text = String(current.text ?? '')
    const printable = event.key.length === 1 && !event.mods.mod && !event.mods.alt
    if (event.key !== 'Backspace' && event.key !== 'Enter' && !printable) return false
    if (startedAtRef.current == null) startedAtRef.current = event.t
    const recorded = recorderRef.current.events()
    const chars = typedCharacters(recorded)
    let justFinished = false
    const next = updateResult((prevResult) => {
      if (prevResult.done) return prevResult
      const typed = String(prevResult.typed ?? '')
      let nextTyped = typed
      let done = false
      if (event.key === 'Backspace') nextTyped = typed.slice(0, -1)
      else if (event.key === 'Enter') done = typed.length > 0
      else nextTyped = typed + event.key
      if (nextTyped.length >= text.length) done = true
      justFinished = done
      const stats = typingStats(text, nextTyped, event.t - startedAtRef.current)
      return {
        typed: nextTyped,
        accuracy: stats.accuracy,
        wpm: stats.wpm,
        shiftCapitals: chars.filter((c) => c.method === 'shift').length,
        capsLockCapitals: chars.filter((c) => c.method === 'caps_lock').length,
        source: recorded.some((e) => e.source === 'virtual') ? 'virtual' : 'hardware',
        done,
      }
    })
    if (justFinished) advanceAfter({ ...(state?.items ?? {}), [current.id]: next })
    return true
  }

  function handleFindKey(event) {
    if (pressesKey(event, current.key, layout)) {
      finishItem({ pressed: true, source: event.source })
    } else if (!event.repeat) {
      miss(`You pressed ${event.key === ' ' ? 'Space' : event.key}.`)
    }
    return true
  }

  function handleSymbols(event) {
    if (isModifierKey(event.key) || event.key.length !== 1) return false
    if (event.key === current.char) {
      finishItem({ typedChar: event.key, shift: event.mods.shift, source: event.source })
    } else {
      miss(`You typed ${event.key === ' ' ? 'a space' : event.key}.`)
    }
    return true
  }

  function handleShortcut(event) {
    const combo = comboOf(event)
    // comboOf only adds a '+' for a real modifier (Shift counts only with a non-typing key).
    if (!combo || !combo.includes('+')) return false
    const target = normalizeCombo(current.combo)
    lastComboRef.current = { combo, at: event.t }
    if (combo === target) {
      finishItem({ performed: true, via: 'keyboard', source: event.source })
      // Native text shortcuts (copy, paste…) still happen in the practice box; anything else
      // (Ctrl+S, Ctrl+P…) must not open the browser's own dialog.
      return !NATIVE_TEXT_COMBOS.has(target)
    }
    miss(`You pressed ${describeCombo(combo)}.`)
    return !NATIVE_TEXT_COMBOS.has(combo)
  }

  // Returns true when the event was handled and the browser's default should be prevented.
  function handleKeyEvent(event) {
    if (readOnly || !current) return false
    recorderRef.current.record(event)
    if (mode === 'type_text') {
      if (finished) return false
      return handleTypeText(event)
    }
    if (finished) return false
    if (mode === 'find_key') return handleFindKey(event)
    if (mode === 'symbols') return handleSymbols(event)
    if (mode === 'shortcuts') return handleShortcut(event)
    return false
  }

  function onPracticeKeyDown(domEvent) {
    const event = normalizeKeyEvent(domEvent)
    // Tab must still be able to leave the practice area unless it is the key being practised.
    const practisesTab =
      (mode === 'find_key' && current.key === 'Tab') ||
      (mode === 'shortcuts' && normalizeCombo(current.combo).split('+').pop() === 'tab')
    if (event.key === 'Tab' && !practisesTab) return
    if (handleKeyEvent(event)) domEvent.preventDefault()
  }

  // Copy/cut/paste done with the mouse (right-click menu or the browser menu) rather than the
  // shortcut still counts as performed, but via 'menu' so the hint asks for the keys.
  function onClipboard(kind) {
    if (readOnly || mode !== 'shortcuts' || finished) return
    const target = normalizeCombo(current.combo)
    if (CLIPBOARD_COMBOS[kind] !== target) return
    const recent = lastComboRef.current
    if (recent.combo === target && Date.now() - recent.at < 1500) return
    finishItem({ performed: true, via: 'menu', source: 'hardware' })
  }

  function retry() {
    recorderRef.current.reset()
    startedAtRef.current = null
    setLastWrong(null)
    setResult({})
    practiceRef.current?.focus?.({ preventScroll: true })
  }

  const statusFor = (item) => {
    const itemResult = state?.items?.[item.id]
    if (!isItemFinished(mode, itemResult)) return null
    return gradeKeyboardItem(task, item, itemResult).correct ? 'done' : 'wrong'
  }

  const missCount = misses[current.id] ?? 0
  const showHint = !finished && missCount >= MISSES_BEFORE_HINT
  const hintKey = mode === 'find_key' ? current.key : mode === 'symbols' ? current.char : null
  const highlightCodes = showHint && hintKey ? codesForKey(hintKey, layout) : []
  const showPicture = !virtualKeyboard && (mode === 'find_key' || mode === 'symbols')

  return (
    <div className="act-panel" data-testid="keyboard-activity">
      <ItemNav
        items={items}
        currentIndex={index}
        onSelect={setIndex}
        statusFor={statusFor}
        noun={mode === 'type_text' ? 'Line' : 'Step'}
      />
      <p className="act-prompt">{MODE_PROMPTS[mode]?.(task, current) ?? 'Keyboard'}</p>

      {mode === 'type_text' && (
        <TargetText text={String(current.text ?? '')} typed={String(result.typed ?? '')} />
      )}

      {mode === 'shortcuts' ? (
        <textarea
          ref={practiceRef}
          className="act-practice"
          aria-label="Practice box: use the shortcut here"
          defaultValue={
            current.practiceText ?? 'Practise here. Select some of this text and try the shortcut.'
          }
          readOnly={readOnly}
          onKeyDown={onPracticeKeyDown}
          onCopy={() => onClipboard('copy')}
          onCut={() => onClipboard('cut')}
          onPaste={() => onClipboard('paste')}
        />
      ) : (
        <div
          ref={practiceRef}
          className="act-practice"
          role="textbox"
          tabIndex={readOnly ? -1 : 0}
          aria-readonly={readOnly || undefined}
          aria-label={
            mode === 'type_text'
              ? 'Typing area: click here and type the line'
              : 'Practice area: click here, then press the key'
          }
          data-testid="keyboard-practice"
          onKeyDown={onPracticeKeyDown}
        >
          {mode === 'type_text' ? (
            <span style={{ whiteSpace: 'pre-wrap' }}>
              {String(result.typed ?? '') || (readOnly ? '' : 'Click here and start typing…')}
            </span>
          ) : finished ? (
            <span>✓ Got it!</span>
          ) : (
            <span>{readOnly ? 'Waiting for a key press' : 'Click here, then press the key.'}</span>
          )}
        </div>
      )}

      {mode === 'type_text' && (result.typed ?? '') !== '' && (
        <p className="act-row" aria-live="polite">
          <span className="act-badge">Accuracy {Math.round((result.accuracy ?? 1) * 100)}%</span>
          {task.targetWpm ? (
            <span className="act-badge">
              {result.wpm ?? 0} words a minute (aim for {task.targetWpm})
            </span>
          ) : null}
        </p>
      )}

      {lastWrong && !finished && <p role="status">{lastWrong}</p>}
      {showHint && (
        <p className="act-hint" role="status">
          💡 Look for {describeItem(task, current) ?? 'the key'} — it is lit up on the keyboard.
        </p>
      )}
      {finished && grade && !grade.correct && grade.hint && (
        <p className="act-hint" role="status">
          💡 {grade.hint}
        </p>
      )}
      {finished && grade?.correct && (
        <p className="act-result act-result--pass" role="status">
          ✓ Well done!
        </p>
      )}

      {(showPicture || virtualKeyboard) && (
        <OnScreenKeyboard
          layout={layout}
          interactive={virtualKeyboard}
          highlightCodes={highlightCodes}
          showCtrl={mode === 'shortcuts'}
          onKey={(event) => {
            handleKeyEvent(event)
          }}
        />
      )}

      {!readOnly && (
        <div className="act-row">
          {finished && (
            <button type="button" className="btn-ghost-outline act-btn" onClick={retry}>
              Try again
            </button>
          )}
          <button type="button" className="btn-primary act-btn" onClick={() => onSubmit?.()}>
            Check my work
          </button>
        </div>
      )}
    </div>
  )
}

export default {
  StudentView: KeyboardStudentView,
  BuilderEditor: KeyboardBuilderEditor,
}
