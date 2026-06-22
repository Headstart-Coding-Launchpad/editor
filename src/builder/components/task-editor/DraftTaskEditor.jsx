import React from 'react'
import { Field } from './TaskEditorFields'

const DETAILS_STAGES = new Set(['details', 'review', 'approved', 'published'])

const KIND_OPTIONS = [
  'code task',
  'information slide',
  'quiz',
  'confidence check',
  'project step',
  'group heading',
  'recap',
  'extension',
]

export default function DraftTaskEditor({ task, lesson, onUpdate }) {
  const stage = lesson.stage ?? 'published'
  const showDetailsTier = DETAILS_STAGES.has(stage)

  function set(field, value) {
    onUpdate({ ...task, [field]: value })
  }

  return (
    <>
      <Field label="Kind">
        <select
          className="te-select"
          style={{ width: '100%' }}
          value={task.kind ?? 'code task'}
          onChange={e => set('kind', e.target.value)}
        >
          {KIND_OPTIONS.map(k => (
            <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
          ))}
        </select>
      </Field>

      <Field label="Purpose">
        <textarea
          className="te-input"
          rows={3}
          value={task.purpose ?? ''}
          onChange={e => set('purpose', e.target.value)}
          placeholder="Why this moment exists — what the author intends."
          style={{ resize: 'vertical' }}
        />
      </Field>

      {showDetailsTier ? (
        <>
          <div style={s.tierHeading}>Details template</div>

          <Field label="Student-facing content" hint="Markdown">
            <textarea
              className="te-input"
              rows={6}
              value={task.studentFacingContent ?? ''}
              onChange={e => set('studentFacingContent', e.target.value)}
              placeholder="Complete draft of explainer text, quiz question, task prompt, or slide copy."
              style={{ resize: 'vertical', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.85rem' }}
            />
          </Field>

          <Field label="Student action" hint="omit for quizzes and information slides">
            <textarea
              className="te-input"
              rows={2}
              value={task.studentAction ?? ''}
              onChange={e => set('studentAction', e.target.value)}
              placeholder="What the learner does."
              style={{ resize: 'vertical' }}
            />
          </Field>

          <Field label="Starter state" hint="optional">
            <textarea
              className="te-input"
              rows={4}
              value={task.starterState ?? ''}
              onChange={e => set('starterState', e.target.value)}
              placeholder="Starter code, files, blocks, or carry-through notes."
              style={{ resize: 'vertical', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.85rem' }}
            />
          </Field>

          <Field label="Expected outcome">
            <textarea
              className="te-input"
              rows={3}
              value={task.expectedOutcome ?? ''}
              onChange={e => set('expectedOutcome', e.target.value)}
              placeholder="Output, correct answers, page state, or completed work."
              style={{ resize: 'vertical' }}
            />
          </Field>

          <Field label="Checks and success signals">
            <textarea
              className="te-input"
              rows={3}
              value={task.checksAndSuccessSignals ?? ''}
              onChange={e => set('checksAndSuccessSignals', e.target.value)}
              placeholder={'e.g. output_contains: "Hello", answer_equals: "a", or manual review'}
              style={{ resize: 'vertical', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.85rem' }}
            />
          </Field>

          <Field label="Hints and support" hint="optional">
            <textarea
              className="te-input"
              rows={4}
              value={task.hintsAndSupport ?? ''}
              onChange={e => set('hintsAndSupport', e.target.value)}
              placeholder="Hint text, quiz feedback, code stages with content, recovery path, or key misconception note."
              style={{ resize: 'vertical' }}
            />
          </Field>

          <Field label="Topic links" hint="optional">
            <input
              className="te-input"
              value={task.topicLinks ?? ''}
              onChange={e => set('topicLinks', e.target.value)}
              placeholder="e.g. [[for-loop]], [[variables]]"
            />
          </Field>

          <Field label="YAML handoff notes" hint="optional">
            <textarea
              className="te-input"
              rows={3}
              value={task.yamlHandoffNotes ?? ''}
              onChange={e => set('yamlHandoffNotes', e.target.value)}
              placeholder="Task type, mode, grouping, carry-through, assets, or anything the builder needs."
              style={{ resize: 'vertical' }}
            />
          </Field>
        </>
      ) : (
        <div style={s.tierLocked}>
          <p style={s.tierLockedText}>
            Move the lesson to <strong>Details</strong> stage to unlock the full authoring template.
          </p>
          <p style={s.tierLockedHint}>
            Use the Stage selector in Lesson Details (left panel) to advance the stage.
          </p>
        </div>
      )}
    </>
  )
}

const s = {
  tierHeading: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.78rem',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    paddingBottom: 8,
    borderBottom: '1px solid #e5e7eb',
    marginTop: 4,
  },
  tierLocked: {
    padding: '16px 20px',
    background: '#f9fafb',
    border: '1px dashed #d1d5db',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  tierLockedText: {
    margin: 0,
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: '#374151',
    lineHeight: 1.5,
  },
  tierLockedHint: {
    margin: 0,
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: '#9ca3af',
    lineHeight: 1.5,
  },
}
