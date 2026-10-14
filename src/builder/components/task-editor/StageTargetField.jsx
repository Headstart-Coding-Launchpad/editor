import { useEffect, useState } from 'react'
import { Field } from './TaskEditorFields'

/**
 * Builder control for a Python task's Stage target (`stageTarget`, docs/authoring/python.md
 * "Stage"): the Python that draws the target picture, and whether its faint ghost starts shown.
 * The code keeps its own draft and saves on blur.
 */
export default function StageTargetField({ task, onUpdate }) {
  const config = task?.stageTarget ?? null
  const enabled = !!config
  const [draft, setDraft] = useState(config?.code ?? '')
  useEffect(() => setDraft(task?.stageTarget?.code ?? ''), [task?.id, task?.stageTarget?.code])

  function update(next) {
    if (!next) {
      const { stageTarget: _removed, ...rest } = task
      onUpdate(rest)
      return
    }
    onUpdate({ ...task, stageTarget: next })
  }

  return (
    <Field label="Stage target" hint="optional">
      <div style={s.wrap}>
        <label className="te-check-toggle" style={{ alignSelf: 'flex-start' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) =>
              update(e.target.checked ? { code: 'from stage import *\n', ghost: true } : null)
            }
          />
          Give students a target picture to draw (ghost and differences on the Stage)
        </label>
        {enabled && (
          <>
            <textarea
              className="te-input"
              style={s.code}
              spellCheck={false}
              aria-label="Python that draws the target"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => update({ ...config, code: draft })}
            />
            <label className="te-check-toggle" style={{ alignSelf: 'flex-start' }}>
              <input
                type="checkbox"
                checked={config.ghost !== false}
                onChange={(e) => update({ ...config, ghost: e.target.checked })}
              />
              Show the faint target when the task opens
            </label>
          </>
        )}
      </div>
    </Field>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  code: {
    minHeight: 120,
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: 13,
    whiteSpace: 'pre',
  },
}
