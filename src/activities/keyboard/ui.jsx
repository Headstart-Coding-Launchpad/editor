import React, { useEffect, useRef, useState } from 'react'
import KeyboardBuilderEditor from './KeyboardBuilderEditor.jsx'
import ItemNav from '../ui/ItemNav.jsx'
import OnScreenKeyboard, { codesForKey } from './OnScreenKeyboard.jsx'
import { NAMED_KEYS, describeComboPart, describeItem, gradeKeyboardItem } from './keyboard.js'
import { applyEditKey, initialEditModel } from './editText.js'
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
//   edit_text: { text, orig, caret, anchor, used, source, done }   (see editText.js)
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
// A Tab shortcut (Shift+Tab) is practised in a row of fields, so focus has somewhere to move.
const TAB_FIELDS = ['First name', 'Last name', 'Class']

const MODE_PROMPTS = {
  type_text: () => 'Type this line',
  find_key: (task, item, platform) =>
    item.prompt ?? `Find and press the ${describeItem(task, item, platform)} key`,
  symbols: (task, item) => item.prompt ?? `Type the ${item.char} symbol`,
  shortcuts: (task, item, platform) =>
    item.prompt ?? `Use the shortcut ${describeItem(task, item, platform)}`,
  edit_text: (task, item) => item.prompt ?? 'Fix the mistakes in this line',
}

function isItemFinished(mode, result) {
  if (!result) return false
  if (mode === 'type_text' || mode === 'edit_text') return !!result.done
  if (mode === 'find_key') return !!result.pressed
  if (mode === 'symbols') return !!result.typedChar
  return !!result.performed
}

function describeCombo(combo, platform) {
  return String(combo ?? '')
    .split('+')
    .map((part) => describeComboPart(part, platform))
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

// The edit_text line: every character, the text cursor and any Shift selection. Clicking a
// character puts the cursor before it.
function EditLine({ model, readOnly, onPlaceCaret }) {
  const chars = [...model.text]
  const from = model.anchor == null ? model.caret : Math.min(model.anchor, model.caret)
  const to = model.anchor == null ? model.caret : Math.max(model.anchor, model.caret)
  const caret = !readOnly && <span className="act-caret" aria-hidden="true" />
  return (
    <span className="act-edit-line" style={{ whiteSpace: 'pre' }}>
      {chars.map((char, index) => (
        <React.Fragment key={index}>
          {index === model.caret && caret}
          <span
            aria-hidden="true"
            className={index >= from && index < to ? 'act-char--selected' : undefined}
            onPointerDown={readOnly ? undefined : () => onPlaceCaret(index)}
          >
            {char}
          </span>
        </React.Fragment>
      ))}
      {model.caret >= chars.length && caret}
    </span>
  )
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
  // Keys are named as the student's keyboard names them: this device's platform while working,
  // the student's recorded one in the teacher's read-only view.
  const platform = readOnly ? state?.device?.platform : device.platform
  const grade = current ? gradeKeyboardItem(task, current, result, { platform }) : null
  const virtualKeyboard = !!device.virtualKeyboard && !readOnly
  const currentId = current?.id
  const targetCombo = mode === 'shortcuts' ? normalizeCombo(current?.combo) : ''
  const tabPractice = targetCombo.split('+').pop() === 'tab'
  const pageKeyRef = useRef(null)

  // A new item starts a new recording and puts the caret back in the practice area.
  useEffect(() => {
    recorderRef.current.reset()
    startedAtRef.current = null
    setLastWrong(null)
    if (!readOnly && practiceRef.current && typeof practiceRef.current.focus === 'function') {
      practiceRef.current.focus({ preventScroll: true })
    }
  }, [currentId, readOnly])

  // A shortcut pressed anywhere on the page, not just in the practice area, still counts, and
  // the browser must not act on it (Ctrl+S would open its save dialog). See pageKeyRef below.
  useEffect(() => {
    if (readOnly || mode !== 'shortcuts') return undefined
    const onPageKeyDown = (domEvent) => pageKeyRef.current?.(domEvent)
    window.addEventListener('keydown', onPageKeyDown)
    return () => window.removeEventListener('keydown', onPageKeyDown)
  }, [mode, readOnly])

  if (!current) return <p>This keyboard task has no items yet.</p>

  // Updates the current item's result from the host's latest state (not this render's), so
  // fast typing never drops a key between renders. Returns the new result.
  function updateResult(produce) {
    let produced = null
    onChange?.((prev) => {
      produced = produce(prev?.items?.[current.id] ?? {})
      return {
        ...(prev ?? { v: 1 }),
        // Recorded so the teacher sees which computer (Mac, Chromebook…) the work was done on.
        ...(device.platform
          ? { device: { ...(prev?.device ?? {}), platform: device.platform } }
          : {}),
        items: { ...(prev?.items ?? {}), [current.id]: produced },
      }
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

  // The line as the student has left it (their saved result, or the item's start).
  function editModelOf(itemResult) {
    return itemResult?.text != null
      ? {
          text: itemResult.text,
          orig: itemResult.orig ?? '',
          caret: itemResult.caret ?? itemResult.text.length,
          anchor: itemResult.anchor ?? null,
        }
      : initialEditModel(current)
  }

  function handleEditText(event) {
    let handled = false
    let justFinished = false
    const next = updateResult((prevResult) => {
      if (prevResult.done) return prevResult
      const applied = applyEditKey(editModelOf(prevResult), event)
      if (!applied) return prevResult
      handled = true
      const used = new Set(prevResult.used ?? [])
      if (applied.used) used.add(applied.used)
      const done = applied.model.text === String(current.target ?? '')
      justFinished = done
      return {
        ...applied.model,
        used: [...used],
        source:
          prevResult.source === 'virtual' || event.source === 'virtual' ? 'virtual' : 'hardware',
        done,
      }
    })
    if (justFinished) advanceAfter({ ...(state?.items ?? {}), [current.id]: next })
    return handled
  }

  function placeCaret(caret) {
    practiceRef.current?.focus?.({ preventScroll: true })
    updateResult((prevResult) =>
      prevResult.done
        ? prevResult
        : { ...prevResult, ...editModelOf(prevResult), caret, anchor: null }
    )
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
      // Native text shortcuts (copy, paste…) still happen in the practice box, and Shift+Tab
      // really moves focus back a field; anything else (Ctrl+S, Ctrl+P…) must not open the
      // browser's own dialog.
      return !NATIVE_TEXT_COMBOS.has(target) && !tabPractice
    }
    miss(`You pressed ${describeCombo(combo, platform)}.`)
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
    if (mode === 'edit_text') {
      if (finished) return false
      return handleEditText(event)
    }
    if (finished) return false
    if (mode === 'find_key') return handleFindKey(event)
    if (mode === 'symbols') return handleSymbols(event)
    if (mode === 'shortcuts') return handleShortcut(event)
    return false
  }

  // A Mac only sends a Caps Lock keydown when turning it on; turning it off sends just a keyup,
  // so a find_key Caps Lock item also counts the keyup.
  function onPracticeKeyUp(domEvent) {
    if (readOnly || finished || mode !== 'find_key' || current.key !== 'CapsLock') return
    const event = normalizeKeyEvent(domEvent)
    if (event.key === 'CapsLock') finishItem({ pressed: true, source: event.source })
  }

  function onPracticeKeyDown(domEvent) {
    const event = normalizeKeyEvent(domEvent)
    // Tab must still be able to leave the practice area unless it is the key being practised.
    const practisesTab = (mode === 'find_key' && current.key === 'Tab') || tabPractice
    if (event.key === 'Tab' && !practisesTab) return
    if (handleKeyEvent(event)) domEvent.preventDefault()
  }

  // Keys pressed outside the practice area (which handles its own): only the current shortcut is
  // caught. Copy/paste and friends act on text, so they only count in the practice box.
  pageKeyRef.current = (domEvent) => {
    if (domEvent.defaultPrevented || domEvent.target?.closest?.('[data-keyboard-practice]')) return
    if (finished || !targetCombo || NATIVE_TEXT_COMBOS.has(targetCombo) || tabPractice) return
    const event = normalizeKeyEvent(domEvent)
    if (comboOf(event) !== targetCombo) return
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
    return gradeKeyboardItem(task, item, itemResult, { platform }).correct ? 'done' : 'wrong'
  }

  const missCount = misses[current.id] ?? 0
  const showHint = !finished && missCount >= MISSES_BEFORE_HINT
  const hintKey = mode === 'find_key' ? current.key : mode === 'symbols' ? current.char : null
  const highlightCodes = showHint && hintKey ? codesForKey(hintKey, layout) : []
  const showPicture = !virtualKeyboard && (mode === 'find_key' || mode === 'symbols')
  // edit_text needs arrow keys and Delete, which the on-screen keyboard doesn't have (v1).
  const needsRealKeyboard = mode === 'edit_text' && virtualKeyboard

  return (
    <div className="act-panel" data-testid="keyboard-activity">
      <ItemNav
        items={items}
        currentIndex={index}
        onSelect={setIndex}
        statusFor={statusFor}
        noun={mode === 'type_text' || mode === 'edit_text' ? 'Line' : 'Step'}
      />
      <p className="act-prompt">{MODE_PROMPTS[mode]?.(task, current, platform) ?? 'Keyboard'}</p>

      {mode === 'type_text' && (
        <TargetText text={String(current.text ?? '')} typed={String(result.typed ?? '')} />
      )}

      {mode === 'edit_text' && task.showTarget !== false && (
        <p className="act-target-text">
          <span className="act-edit-label">Make it say: </span>
          {String(current.target ?? '')}
        </p>
      )}

      {needsRealKeyboard ? (
        <p className="act-hint" role="status" data-testid="keyboard-needs-keyboard">
          ⌨️ This one needs a real keyboard with arrow keys and a Delete key.
        </p>
      ) : mode === 'edit_text' ? (
        <div
          ref={practiceRef}
          className="act-practice act-practice--edit"
          role="textbox"
          tabIndex={readOnly ? -1 : 0}
          aria-readonly={readOnly || undefined}
          aria-label={`Edit box: ${editModelOf(result).text}. Use the arrow keys, Backspace and Delete to fix it.`}
          data-keyboard-practice="true"
          data-testid="keyboard-edit"
          onKeyDown={onPracticeKeyDown}
          onPaste={(e) => e.preventDefault()}
          onDrop={(e) => e.preventDefault()}
        >
          <EditLine
            model={editModelOf(result)}
            readOnly={readOnly || finished}
            onPlaceCaret={placeCaret}
          />
        </div>
      ) : tabPractice ? (
        <div
          className="act-row"
          role="group"
          aria-label="Practice fields: use the shortcut here"
          data-keyboard-practice="true"
          data-testid="keyboard-tab-fields"
        >
          <p style={{ flexBasis: '100%', margin: 0 }}>
            {readOnly ? 'Practice fields' : 'Click in the last box, then use the shortcut.'}
          </p>
          {TAB_FIELDS.map((label, i) => (
            <label key={label} style={{ display: 'grid', gap: 4 }}>
              <span>{label}</span>
              <input
                ref={i === TAB_FIELDS.length - 1 ? practiceRef : undefined}
                type="text"
                className="act-practice act-practice--field"
                readOnly={readOnly}
                onKeyDown={onPracticeKeyDown}
              />
            </label>
          ))}
        </div>
      ) : mode === 'shortcuts' ? (
        <textarea
          data-keyboard-practice="true"
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
          onKeyUp={onPracticeKeyUp}
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
          💡 Look for {describeItem(task, current, platform) ?? 'the key'} — it is lit up on the
          keyboard.
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

      {(showPicture || virtualKeyboard) && !needsRealKeyboard && (
        <OnScreenKeyboard
          layout={layout}
          interactive={virtualKeyboard}
          highlightCodes={highlightCodes}
          showCtrl={mode === 'shortcuts'}
          platform={platform}
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
