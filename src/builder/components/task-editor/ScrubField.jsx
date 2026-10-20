import React from 'react'
import { Field } from './TaskEditorFields'

/**
 * Builder control for a task's live scrubbing (`scrub`, src/shared/scrub/; docs/authoring
 * python.md, turtle.md, html.md): on / off, numbers, colours and True / False, and per-line
 * slider ranges.
 */
export default function ScrubField({ task, onUpdate }) {
  const raw = task?.scrub
  const config = raw === true ? { enabled: true } : raw && typeof raw === 'object' ? raw : null
  const enabled = !!config && config.enabled !== false
  const ranges = Array.isArray(config?.ranges) ? config.ranges : []

  function update(next) {
    if (!next) {
      const { scrub: _removed, ...rest } = task
      onUpdate(rest)
      return
    }
    onUpdate({ ...task, scrub: next })
  }

  function setRange(index, patch) {
    const nextRanges = ranges.map((range, i) => (i === index ? { ...range, ...patch } : range))
    update({ ...config, ranges: nextRanges })
  }

  function removeRange(index) {
    const nextRanges = ranges.filter((_range, i) => i !== index)
    const { ranges: _old, ...rest } = config
    update(nextRanges.length > 0 ? { ...rest, ranges: nextRanges } : rest)
  }

  const numberInput = (value, onChange, label) => (
    <input
      type="number"
      className="te-input"
      style={s.number}
      aria-label={label}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
    />
  )

  return (
    <Field label="Live scrubbing" hint="optional">
      <div style={s.wrap}>
        <label className="te-check-toggle" style={{ alignSelf: 'flex-start' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => update(e.target.checked ? { enabled: true } : null)}
          />
          Let students drag numbers and pick colours in the code (drawings redraw live)
        </label>
        {enabled && (
          <>
            <label className="te-check-toggle" style={{ alignSelf: 'flex-start' }}>
              <input
                type="checkbox"
                checked={config.numbers !== false}
                onChange={(e) => update({ ...config, numbers: e.target.checked })}
              />
              Numbers (drag, or tap for a slider)
            </label>
            <label className="te-check-toggle" style={{ alignSelf: 'flex-start' }}>
              <input
                type="checkbox"
                checked={config.colours !== false}
                onChange={(e) => update({ ...config, colours: e.target.checked })}
              />
              Colours (click for a picker)
            </label>
            <label className="te-check-toggle" style={{ alignSelf: 'flex-start' }}>
              <input
                type="checkbox"
                checked={config.booleans !== false}
                onChange={(e) => update({ ...config, booleans: e.target.checked })}
              />
              True and False (click to flip, Python)
            </label>
            <div style={s.rangesHead}>
              Slider ranges by line (optional; otherwise a range around the value)
            </div>
            {ranges.map((range, index) => (
              <div key={index} style={s.row}>
                <span>Line</span>
                {numberInput(range.line, (line) => setRange(index, { line }), 'Line')}
                <span>from</span>
                {numberInput(range.min, (min) => setRange(index, { min }), 'Smallest value')}
                <span>to</span>
                {numberInput(range.max, (max) => setRange(index, { max }), 'Largest value')}
                <button
                  type="button"
                  className="te-remove-btn"
                  aria-label={`Remove the range for line ${range.line ?? ''}`}
                  onClick={() => removeRange(index)}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="te-add-check-btn"
              style={{ alignSelf: 'flex-start' }}
              onClick={() =>
                update({ ...config, ranges: [...ranges, { line: 1, min: 0, max: 100 }] })
              }
            >
              + Add a range
            </button>
          </>
        )}
      </div>
    </Field>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  rangesHead: { fontSize: '0.85rem', color: '#6b7280' },
  row: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: '0.9rem' },
  number: { width: 80 },
}
