import React, { useEffect, useState } from 'react'
import { Field } from './TaskEditorFields'
import {
  formatNameList,
  formatTargetLines,
  hasPredictionCheck,
  parseNameList,
  parseTargetLines,
  setPredictionCheck,
  setShowVariablesEnabled,
  updateShowVariables,
} from '../../showVariablesAuthoring'

// How a list of rows the Stage's grid() drew shows in the panel (showVariables.stageLists). A
// flat list drawn with width= always wraps at that width.
const STAGE_LISTS = [
  ['size', 'just its size (the Stage shows the picture)'],
  ['picture', 'as a small picture too (colour names; numbers stay a table)'],
  ['tiles', 'as rows of tiles'],
]

const MODE_OPTIONS = [
  ['view', 'Show the variables after Run'],
  ['predict', 'Predict first, then Run to check'],
  ['target', 'Aim for target values'],
]

/**
 * Builder control for a Python / Turtle task's name-tag panel (`showVariables`,
 * docs/authoring/python.md "Name-tag panel"). Text inputs keep their own draft and save on
 * blur, so typing a list doesn't fight the stored field.
 */
export default function ShowVariablesField({ task, onUpdate }) {
  const config = task?.showVariables ?? null
  const enabled = !!config
  const mode = config?.mode ?? 'view'

  return (
    <Field label="Name-tag panel" hint="optional">
      <div style={s.wrap}>
        <label className="te-check-toggle" style={{ alignSelf: 'flex-start' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onUpdate(setShowVariablesEnabled(task, e.target.checked))}
          />
          Show students what is in their variables (a name tag per variable)
        </label>
        {enabled && (
          <>
            <div style={s.row}>
              <label style={s.label}>
                Mode
                <select
                  className="te-select"
                  value={mode}
                  onChange={(e) => onUpdate(updateShowVariables(task, { mode: e.target.value }))}
                >
                  {MODE_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={s.label}>
                Show the values
                <select
                  className="te-select"
                  value={config.at === 'marker' ? 'marker' : 'end'}
                  onChange={(e) => onUpdate(updateShowVariables(task, { at: e.target.value }))}
                >
                  <option value="end">when the program ends</option>
                  <option value="marker">at the #@peek line</option>
                </select>
              </label>
            </div>
            {config.at === 'marker' && (
              <p style={s.help}>
                Put a line reading <code>#@peek</code> in the starter code just above the line to
                stop at. Students never see it; the panel shows the variables the first time the
                program is about to run that line.
              </p>
            )}
            <div style={s.row}>
              <label className="te-check-toggle" style={{ alignSelf: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={config.visuals !== false}
                  onChange={(e) =>
                    onUpdate(updateShowVariables(task, { visuals: e.target.checked }))
                  }
                />
                Draw lists and dicts (colour swatches, bars, pictures, cards)
              </label>
              <label className="te-check-toggle" style={{ alignSelf: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={config.link !== false}
                  onChange={(e) => onUpdate(updateShowVariables(task, { link: e.target.checked }))}
                />
                Link each tag to its variable in the code (same colour and number)
              </label>
              {config.visuals !== false && (
                <label style={s.label}>
                  A list drawn with grid() shows
                  <select
                    className="te-select"
                    value={
                      STAGE_LISTS.some(([value]) => value === config.stageLists)
                        ? config.stageLists
                        : 'size'
                    }
                    onChange={(e) =>
                      onUpdate(updateShowVariables(task, { stageLists: e.target.value }))
                    }
                  >
                    {STAGE_LISTS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <DraftInput
              label="Hide these names"
              placeholder="e.g. answer2, temp"
              value={formatNameList(config.hide)}
              onCommit={(text) =>
                onUpdate(updateShowVariables(task, { hide: parseNameList(text) }))
              }
            />
            {mode === 'predict' && (
              <>
                <DraftInput
                  label="Students predict"
                  placeholder="e.g. score, lives"
                  value={formatNameList(config.predict)}
                  onCommit={(text) =>
                    onUpdate(updateShowVariables(task, { predict: parseNameList(text) }))
                  }
                />
                <label className="te-check-toggle" style={{ alignSelf: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={hasPredictionCheck(task)}
                    onChange={(e) => onUpdate(setPredictionCheck(task, e.target.checked))}
                  />
                  Complete the task when every prediction is right (a variables_predicted check)
                </label>
                <label className="te-check-toggle" style={{ alignSelf: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={config.lockRun !== false}
                    onChange={(e) =>
                      onUpdate(updateShowVariables(task, { lockRun: e.target.checked }))
                    }
                  />
                  Students fill in every prediction before their first Run
                </label>
              </>
            )}
            {mode === 'target' && (
              <DraftInput
                multiline
                label="Targets, one per line"
                placeholder={'score = 10\nbag = ["key", "map"]'}
                value={formatTargetLines(config.target)}
                onCommit={(text) =>
                  onUpdate(updateShowVariables(task, { target: parseTargetLines(text) }))
                }
                help="The green tags are display only — add variable checks to decide completion."
              />
            )}
          </>
        )}
      </div>
    </Field>
  )
}

function DraftInput({ label, value, onCommit, placeholder, multiline = false, help }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const Tag = multiline ? 'textarea' : 'input'
  return (
    <label style={s.label}>
      {label}
      <Tag
        className="te-input"
        style={multiline ? s.textarea : undefined}
        value={draft}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onCommit(draft)
        }}
      />
      {help && <span style={s.help}>{help}</span>}
    </label>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', flexWrap: 'wrap', gap: 12 },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontFamily: 'var(--font-body)',
    fontSize: 12,
    fontWeight: 700,
    color: '#475569',
    minWidth: 200,
  },
  help: {
    margin: 0,
    fontFamily: 'var(--font-body)',
    fontSize: 12,
    fontWeight: 400,
    color: 'var(--colour-muted, #4b5563)',
  },
  textarea: { minHeight: 72, fontFamily: 'var(--font-code)' },
}
