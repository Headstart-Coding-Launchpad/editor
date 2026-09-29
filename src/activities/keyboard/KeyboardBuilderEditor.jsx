import React from 'react'
import definition, { KEYBOARD_MODE_LABELS } from './definition.js'
import { KEYBOARD_MODES, NAMED_KEYS } from './keyboard.js'
import { EDIT_REQUIRE_KEYS } from './editText.js'
import { DEFAULT_LAYOUT } from '../../shared/input/index.js'
import {
  Field,
  InlineField,
  RowListEditor,
  ValidationMessages,
  nextItemId,
  readNumber,
  useActivityValidation,
} from '../ui/builderKit.jsx'

// Builder editor for Keyboard tasks (plan step 2.4): mode, the fixed UK layout, the type_text
// options, and per-mode items with a hardwareOnly toggle. validateTask messages (e.g. a
// browser-reserved shortcut) show under the item they are about.

const TYPE_TEXT_OPTIONS = ['requireShiftForCapitals', 'minAccuracy', 'targetWpm']
const EDIT_TEXT_OPTIONS = ['minKept', 'showTarget']
const REQUIRE_KEY_LABELS = { select: 'Shift selection' }

export function defaultKeyboardItem(mode, id) {
  switch (mode) {
    case 'find_key':
      return { id, key: 'Enter' }
    case 'symbols':
      return { id, char: '@' }
    case 'shortcuts':
      return { id, combo: 'Ctrl+C', prompt: 'Select a word and copy it' }
    case 'edit_text':
      return { id, start: 'the cat sat on teh mat', target: 'The cat sat on the mat.' }
    default:
      return { id, text: 'Hello World' }
  }
}

// Switching mode keeps item ids and hardwareOnly flags; mode-specific fields start again.
export function changeKeyboardMode(task, mode) {
  const next = { ...task, mode }
  if (mode !== 'type_text') for (const field of TYPE_TEXT_OPTIONS) delete next[field]
  if (mode !== 'edit_text') for (const field of EDIT_TEXT_OPTIONS) delete next[field]
  const items = (task.items ?? []).filter((item) => item?.id != null && item.id !== '')
  next.items = (items.length ? items : [{ id: 'a' }]).map((item) => ({
    ...defaultKeyboardItem(mode, item.id),
    ...(item.hardwareOnly ? { hardwareOnly: true } : {}),
  }))
  return next
}

function TextInput({ value, onChange, ariaLabel, placeholder, code = false, list }) {
  return (
    <input
      className={code ? 'te-input te-act-code' : 'te-input'}
      value={value ?? ''}
      aria-label={ariaLabel}
      placeholder={placeholder}
      list={list}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function ItemFields({ mode, item, update, index }) {
  const n = index + 1
  const setOptional = (field, value) => update({ [field]: value === '' ? undefined : value })
  const prompt = (
    <InlineField label="Prompt" wide>
      <TextInput
        value={item.prompt}
        ariaLabel={`Item ${n} prompt`}
        placeholder={mode === 'shortcuts' ? 'What the shortcut does' : 'Optional instruction'}
        onChange={(value) => setOptional('prompt', value)}
      />
    </InlineField>
  )
  const hardwareOnly = (
    <label className="te-check-toggle">
      <input
        type="checkbox"
        checked={item.hardwareOnly === true}
        onChange={(e) => update({ hardwareOnly: e.target.checked ? true : undefined })}
      />
      Real keyboard only
    </label>
  )
  if (mode === 'find_key') {
    return (
      <>
        <InlineField label="Key">
          <TextInput
            code
            value={item.key}
            ariaLabel={`Item ${n} key`}
            list="te-keyboard-named-keys"
            placeholder="A character or Enter, Space…"
            onChange={(key) => update({ key })}
          />
        </InlineField>
        {prompt}
        {hardwareOnly}
      </>
    )
  }
  if (mode === 'symbols') {
    return (
      <>
        <InlineField label="Symbol">
          <TextInput
            code
            value={item.char}
            ariaLabel={`Item ${n} symbol`}
            onChange={(char) => update({ char })}
          />
        </InlineField>
        {prompt}
        {hardwareOnly}
      </>
    )
  }
  if (mode === 'edit_text') {
    const required = new Set(item.requireKeys ?? [])
    const toggleKey = (key, on) => {
      const next = EDIT_REQUIRE_KEYS.filter((k) => (k === key ? on : required.has(k)))
      update({ requireKeys: next.length ? next : undefined })
    }
    return (
      <>
        <InlineField label="Starts as (with mistakes)" wide>
          <TextInput
            code
            value={item.start}
            ariaLabel={`Item ${n} start`}
            onChange={(start) => update({ start })}
          />
        </InlineField>
        <InlineField label="Fixed line" wide>
          <TextInput
            code
            value={item.target}
            ariaLabel={`Item ${n} target`}
            onChange={(target) => update({ target })}
          />
        </InlineField>
        {prompt}
        <fieldset className="te-act-inline-row" aria-label={`Item ${n} keys to use`}>
          <span className="te-act-note">Must use:</span>
          {EDIT_REQUIRE_KEYS.map((key) => (
            <label key={key} className="te-check-toggle">
              <input
                type="checkbox"
                checked={required.has(key)}
                onChange={(e) => toggleKey(key, e.target.checked)}
              />
              {REQUIRE_KEY_LABELS[key] ?? key}
            </label>
          ))}
        </fieldset>
      </>
    )
  }
  if (mode === 'shortcuts') {
    return (
      <>
        <InlineField label="Shortcut">
          <TextInput
            code
            value={item.combo}
            ariaLabel={`Item ${n} shortcut`}
            placeholder="Ctrl+C"
            onChange={(combo) => update({ combo })}
          />
        </InlineField>
        {prompt}
        <InlineField label="Practice text" wide>
          <TextInput
            value={item.practiceText}
            ariaLabel={`Item ${n} practice text`}
            placeholder="Optional text for the practice box"
            onChange={(value) => setOptional('practiceText', value)}
          />
        </InlineField>
        {hardwareOnly}
      </>
    )
  }
  return (
    <>
      <InlineField label="Text to type" wide>
        <TextInput
          value={item.text}
          ariaLabel={`Item ${n} text`}
          onChange={(text) => update({ text })}
        />
      </InlineField>
      {hardwareOnly}
    </>
  )
}

export default function KeyboardBuilderEditor({ task, onUpdate }) {
  const validation = useActivityValidation(definition, task)
  const mode = task.mode ?? 'type_text'
  const setOptional = (field, value) => {
    const next = { ...task }
    if (value === undefined) delete next[field]
    else next[field] = value
    onUpdate(next)
  }

  return (
    <div className="te-act-editor" data-activity-editor="keyboard">
      <ValidationMessages messages={validation.general} />

      <Field label="Mode">
        <select
          className="te-select"
          value={mode}
          aria-label="Keyboard mode"
          onChange={(e) => onUpdate(changeKeyboardMode(task, e.target.value))}
        >
          {KEYBOARD_MODES.map((value) => (
            <option key={value} value={value}>
              {KEYBOARD_MODE_LABELS[value] ?? value}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Keyboard layout">
        <span className="te-act-note">
          {String(task.layout ?? DEFAULT_LAYOUT).toUpperCase()}: UK is the only layout so far.
          Symbols such as <code>@</code>, <code>&quot;</code> and <code>£</code> are checked against
          a UK keyboard.
        </span>
      </Field>

      {mode === 'type_text' && (
        <Field label="Typing options">
          <div className="te-act-inline-row">
            <label className="te-check-toggle">
              <input
                type="checkbox"
                checked={task.requireShiftForCapitals === true}
                onChange={(e) =>
                  setOptional('requireShiftForCapitals', e.target.checked ? true : undefined)
                }
              />
              Capitals need Shift (not Caps Lock)
            </label>
            <InlineField label="Min accuracy (0–1)">
              <input
                className="te-input te-act-narrow"
                type="number"
                min="0.05"
                max="1"
                step="0.05"
                value={task.minAccuracy ?? ''}
                placeholder="1"
                aria-label="Minimum accuracy"
                onChange={(e) => setOptional('minAccuracy', readNumber(e.target.value))}
              />
            </InlineField>
            <InlineField label="Target words a minute">
              <input
                className="te-input te-act-narrow"
                type="number"
                min="1"
                step="1"
                value={task.targetWpm ?? ''}
                placeholder="none"
                aria-label="Target words a minute"
                onChange={(e) => setOptional('targetWpm', readNumber(e.target.value))}
              />
            </InlineField>
          </div>
        </Field>
      )}

      {mode === 'edit_text' && (
        <Field label="Editing options">
          <div className="te-act-inline-row">
            <label className="te-check-toggle">
              <input
                type="checkbox"
                checked={task.showTarget !== false}
                onChange={(e) => setOptional('showTarget', e.target.checked ? undefined : false)}
              />
              Show the fixed line to students
            </label>
            <InlineField label="Must keep (0–1)">
              <input
                className="te-input te-act-narrow"
                type="number"
                min="0.05"
                max="1"
                step="0.05"
                value={task.minKept ?? ''}
                placeholder="0.9"
                aria-label="Share of original characters to keep"
                onChange={(e) => setOptional('minKept', readNumber(e.target.value))}
              />
            </InlineField>
          </div>
          <span className="te-act-note">
            Retyping the line fails: students must keep this share of the letters that were already
            right. Items need a real keyboard (the on-screen keyboard has no arrow keys).
          </span>
        </Field>
      )}

      <datalist id="te-keyboard-named-keys">
        {NAMED_KEYS.map((key) => (
          <option key={key} value={key} />
        ))}
      </datalist>

      <RowListEditor
        label="Items"
        hint="each needs a unique id"
        rows={task.items}
        validation={validation}
        onChange={(items) => onUpdate({ ...task, items })}
        makeRow={(items) => defaultKeyboardItem(mode, nextItemId(items))}
        renderRow={(item, update, index) => (
          <ItemFields mode={mode} item={item} update={update} index={index} />
        )}
      />
    </div>
  )
}
