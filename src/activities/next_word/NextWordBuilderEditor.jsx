import React from 'react'
import definition from './definition.js'
import { MAX_TEXT_CHARS, describeCount, lastWordOf, modelFor, nextOptions } from './ngram.js'
import {
  Field,
  InlineField,
  RowListEditor,
  ValidationMessages,
  nextItemId,
  useActivityValidation,
} from '../ui/builderKit.jsx'

// Builder editor for Next Word tasks: the texts the student can pick (the first one is the
// text every item `answer` is written for), the paste and temperature switches, and the
// predict-then-reveal items. Each item shows the model's most likely next word(s) for its
// prompt in the first text, so the author can set `answer` correctly. validateTask messages
// show under the item they are about (task and text messages at the top).

const CONTROL = { minHeight: 44 }

// What the first text's model says follows the prompt's last word, in plain words.
export function answerHint(task, prompt) {
  const word = lastWordOf(prompt)
  const body = task?.texts?.[0]?.body
  if (!word) return 'Type a prompt to see the likeliest next word in the first text.'
  if (typeof body !== 'string' || !body.trim()) return 'Add a body to the first text first.'
  const { total, options } = nextOptions(modelFor(body), word)
  if (total === 0) return `Nothing comes after “${word}” in the first text.`
  const top = options.filter((option) => option.count === options[0].count)
  const tied = top.length > 1 ? ' (tied: any of them is accepted)' : ''
  return `Most likely after “${word}” in the first text: ${top
    .map((option) => describeCount(option.word, option.count, total))
    .join(' / ')}${tied}.`
}

function TextRows({ texts, onChange }) {
  const list = Array.isArray(texts) ? texts : []
  const update = (index, patch) =>
    onChange(list.map((text, i) => (i === index ? { ...text, ...patch } : text)))
  return (
    <Field label="Texts" hint="the student picks one; write each item's answer for the first text">
      <div className="te-act-rows">
        {list.map((text, index) => {
          const n = index + 1
          const length = String(text?.body ?? '').length
          return (
            <div key={index} className="te-act-row" data-row={`text-${n}`}>
              <div className="te-act-row__head">
                <span className="te-quiz-answer-badge">{n}</span>
                <label className="te-act-inline">
                  <span>Title</span>
                  <input
                    className="te-input"
                    style={CONTROL}
                    value={text?.title ?? ''}
                    aria-label={`Text ${n} title`}
                    onChange={(e) => update(index, { title: e.target.value })}
                  />
                </label>
                <button
                  type="button"
                  className="te-remove-btn"
                  style={{ minWidth: 44, minHeight: 44 }}
                  onClick={() => onChange(list.filter((_, i) => i !== index))}
                  disabled={list.length <= 1}
                  title="Remove text"
                  aria-label={`Remove text ${n}`}
                >
                  ✕
                </button>
              </div>
              <div className="te-act-row__fields">
                <InlineField label="Body" wide>
                  <textarea
                    className="te-input"
                    style={{ ...CONTROL, minHeight: 96 }}
                    value={text?.body ?? ''}
                    aria-label={`Text ${n} body`}
                    onChange={(e) => update(index, { body: e.target.value })}
                  />
                </InlineField>
                <span className="te-act-note" aria-live="polite">
                  {length} of {MAX_TEXT_CHARS} characters
                </span>
              </div>
            </div>
          )
        })}
        <button
          type="button"
          className="te-add-check-btn"
          style={CONTROL}
          onClick={() => onChange([...list, { title: `Text ${list.length + 1}`, body: '' }])}
        >
          + Add text
        </button>
      </div>
    </Field>
  )
}

function Switch({ label, checked, onChange }) {
  return (
    <label className="te-act-inline" style={CONTROL}>
      <input
        type="checkbox"
        style={{ width: 24, height: 24 }}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

export default function NextWordBuilderEditor({ task, onUpdate }) {
  const validation = useActivityValidation(definition, task)
  return (
    <div className="te-act-editor" data-activity-editor="next_word">
      <ValidationMessages messages={validation.general} />

      <TextRows texts={task.texts} onChange={(texts) => onUpdate({ ...task, texts })} />

      <Field label="Options">
        <Switch
          label="Let students paste their own text (up to 1200 characters)"
          checked={task.allowPaste === true}
          onChange={(allowPaste) => onUpdate({ ...task, allowPaste })}
        />
        <Switch
          label="Show the temperature slider"
          checked={task.showTemperature === true}
          onChange={(showTemperature) => onUpdate({ ...task, showTemperature })}
        />
      </Field>

      <RowListEditor
        label="Items"
        hint="predict the next word after the prompt, then reveal"
        rows={task.items}
        validation={validation}
        onChange={(items) => onUpdate({ ...task, items })}
        makeRow={(items) => ({ id: nextItemId(items), prompt: '', answer: '' })}
        renderRow={(item, update, index) => {
          const n = index + 1
          return (
            <>
              <InlineField label="Prompt" wide>
                <input
                  className="te-input"
                  style={CONTROL}
                  value={item.prompt ?? ''}
                  placeholder="the ball goes into the"
                  aria-label={`Item ${n} prompt`}
                  onChange={(e) => update({ prompt: e.target.value })}
                />
              </InlineField>
              <InlineField label="Answer">
                <input
                  className="te-input"
                  style={CONTROL}
                  value={item.answer ?? ''}
                  aria-label={`Item ${n} answer`}
                  onChange={(e) => update({ answer: e.target.value })}
                />
              </InlineField>
              <span className="te-act-note" data-testid={`next_word-hint-${n}`}>
                {answerHint(task, item.prompt)}
              </span>
            </>
          )
        }}
      />
    </div>
  )
}
