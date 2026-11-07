import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MarkdownRenderer } from '../../shared/markdown'
import { getModuleDefinition, getModuleLabel } from '../../modules/definitions'
import { chooseLockedLines } from '../../shared/lockedLines'
import {
  cleanCodeLineIndexes,
  computeStageChange,
  stageShowsChange,
} from '../../shared/stageChange'
import { ChangeHunk, FullChangeRows } from './ChangeLines'

// The change view's wording (platform request 134; docs/authoring/python-tasks.md "Change view").
const CHANGE_VIEW_TEXT = {
  showAll: 'Show all the code',
  showChanges: 'Show only the changes',
  fallback:
    'A lot changed in this step, so here is all of the code. Green lines are new, red lines go.',
  same: 'Your code already matches this step',
}

function getLanguageLabel(lessonType) {
  return getModuleLabel(lessonType, 'stageReference') ?? 'Code'
}

// How a revealed stage reads, by the module's state kind (capabilities.sandboxState): its text,
// and whether that text is Markdown (a blocks stage's notes) rather than code.
const STAGE_REFERENCE_BY_KIND = {
  code: { text: (stage) => stage.code ?? '' },
  files: {
    text: (stage) => {
      if (stage.code != null) return stage.code
      return (stage.files ?? [])
        .map((file) => `/* ${file.name} */\n${file.content ?? ''}`)
        .join('\n\n')
    },
  },
  fs: { text: (stage) => JSON.stringify(stage.fs ?? {}, null, 2) },
  desktop: { text: (stage) => JSON.stringify(stage.desktop ?? {}, null, 2) },
  blocks: { text: (stage) => stage.markdown ?? '', markdown: true },
}

function stageReferenceFor(lessonType) {
  const kind = getModuleDefinition(lessonType)?.capabilities?.sandboxState
  return Object.hasOwn(STAGE_REFERENCE_BY_KIND, kind ?? '') ? STAGE_REFERENCE_BY_KIND[kind] : null
}

// Text for a revealed stage, by the module's state kind (capabilities.sandboxState).
export function stageToText(stage, lessonType) {
  if (!stage) return ''
  return stageReferenceFor(lessonType)?.text(stage) ?? ''
}

// The author line hints of a stage's text (stageToText) by 0-based line: `lineHintsFor(file)`
// gives a code stage's hints (file null) or one file's ([{ line, text }], 1-based lines in that
// code); a files stage's hints are shifted past each file's `/* name */` header.
export function stageHintsByLine(stage, lessonType, lineHintsFor) {
  const byLine = new Map()
  if (!stage || !lineHintsFor) return byLine
  const add = (index, text) =>
    byLine.set(index, byLine.has(index) ? `${byLine.get(index)} · ${text}` : text)
  const kind = getModuleDefinition(lessonType)?.capabilities?.sandboxState
  if (kind === 'code' || (kind === 'files' && stage.code != null)) {
    for (const hint of lineHintsFor(null) ?? []) add(hint.line - 1, hint.text)
  } else if (kind === 'files') {
    let offset = 0
    for (const file of stage.files ?? []) {
      for (const hint of lineHintsFor(file.name) ?? []) add(offset + hint.line, hint.text)
      offset += 1 + String(file.content ?? '').split('\n').length + 1
    }
  }
  return byLine
}

// The whole-program rows with the Complete's lock tags and author line hints: each row but a
// removed one is the next cleaned Complete line, placed in the stage code by cleanCodeLineIndexes.
function withLineNotes(rows, code, lockedIndexes, hintsByLine) {
  if (!lockedIndexes.size && !hintsByLine.size) return rows
  const places = cleanCodeLineIndexes(code)
  let next = 0
  return rows.map((row) => {
    if (row.type === 'remove') return row
    const index = places[next]
    next += 1
    const locked = lockedIndexes.has(index)
    const hint = hintsByLine.get(index) ?? null
    return locked || hint ? { ...row, locked, hint } : row
  })
}

export default function SupportStagePanel({
  stage,
  lessonType,
  revealed,
  sourceLabel,
  lineHintsFor,
  // The task's lock sets (getTaskLockSets): a code stage marks the lines a student can't change.
  lockSets = null,
  // The student's code to compare with (chooseChangeBase): with it, a Complete code stage that
  // has `show: 'change'` shows only what changes (modules with capabilities.stageChangeView,
  // Python). Read once, when the stage is first revealed, so the view holds still while the
  // student types; callers key the panel per task and stage, and remount it after "Replace my
  // code with this" so it compares with the replaced code.
  changeBase = null,
  // Told whether the change view (not the whole program) is on screen, for the load button's words.
  onChangeViewShown,
}) {
  const text = stageToText(stage, lessonType)
  // The base is read when the stage is first revealed (a panel can mount hidden), then held.
  const [openedBase, setOpenedBase] = useState(() => (revealed ? changeBase : undefined))
  if (revealed && openedBase === undefined) setOpenedBase(changeBase)
  const base = openedBase === undefined ? (revealed ? changeBase : null) : openedBase
  const showsChange =
    revealed &&
    typeof base === 'string' &&
    stageShowsChange(stage) &&
    !!getModuleDefinition(lessonType)?.capabilities?.stageChangeView
  const change = useMemo(
    () => (showsChange ? computeStageChange(base, stage.code) : null),
    [showsChange, base, stage?.code]
  )
  // Only real changes ('changes') can be shown on their own; a fall-back always shows the whole
  // program, and 'same' just says so. `view` is the student's choice from the toggle.
  const [view, setView] = useState('changes')
  const canShowChanges = change?.kind === 'changes'
  const changeViewShown = change?.kind === 'same' || (canShowChanges && view === 'changes')
  const onChangeViewShownRef = useRef(onChangeViewShown)
  onChangeViewShownRef.current = onChangeViewShown
  useEffect(() => {
    onChangeViewShownRef.current?.(changeViewShown)
  }, [changeViewShown])
  useEffect(() => () => onChangeViewShownRef.current?.(false), [])

  if (!revealed || !text.trim()) return null
  const hintsByLine = stageHintsByLine(stage, lessonType, lineHintsFor)
  const lockedIndexes =
    lockSets &&
    stage?.code != null &&
    stageReferenceFor(lessonType) === STAGE_REFERENCE_BY_KIND.code
      ? new Set(chooseLockedLines(text, lockSets).map((line) => line - 1))
      : new Set()

  const title = stage?.label || 'Stage reference'
  const languageLabel = getLanguageLabel(lessonType)

  return (
    <section
      style={s.panel}
      aria-label={`${title} stage reference`}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div style={s.header}>
        <div style={s.titleWrap}>
          <span style={s.kicker}>{languageLabel} reference</span>
          <span style={s.title}>{title}</span>
          {sourceLabel && <span style={s.source}>{sourceLabel}</span>}
        </div>
        {canShowChanges && (
          <button
            type="button"
            style={s.toggle}
            onClick={() => setView(view === 'all' ? 'changes' : 'all')}
          >
            {view === 'all' ? CHANGE_VIEW_TEXT.showChanges : CHANGE_VIEW_TEXT.showAll}
          </button>
        )}
      </div>
      {change ? (
        <div style={s.changeBody} data-testid="stage-change-view">
          {change.kind === 'same' ? (
            <p style={s.changeNote}>{CHANGE_VIEW_TEXT.same}</p>
          ) : change.kind === 'changes' && view === 'changes' ? (
            // The changes on their own carry no lock tags or line hints (they name lines by
            // text); "Show all the code" has both.
            change.hunks.map((hunk, index) => <ChangeHunk key={index} {...hunk} />)
          ) : (
            <>
              {change.kind === 'fallback' && (
                <p style={s.changeNote}>{CHANGE_VIEW_TEXT.fallback}</p>
              )}
              <FullChangeRows
                rows={withLineNotes(change.fullRows, stage.code, lockedIndexes, hintsByLine)}
              />
            </>
          )}
        </div>
      ) : stageReferenceFor(lessonType)?.markdown ? (
        <div style={s.markdown}>
          <MarkdownRenderer content={text} topicType={lessonType} disableCopy />
        </div>
      ) : (
        <pre style={s.pre}>
          <code style={s.code}>
            {hintsByLine.size === 0 && lockedIndexes.size === 0
              ? text
              : text.split('\n').map((line, index, lines) => (
                  <React.Fragment key={index}>
                    {line}
                    {lockedIndexes.has(index) && (
                      <span style={s.lockedTag} title="Locked line">
                        <span aria-hidden="true">🔒 </span>Locked
                      </span>
                    )}
                    {hintsByLine.has(index) && (
                      <span style={s.lineHint} title={hintsByLine.get(index)}>
                        {hintsByLine.get(index)}
                      </span>
                    )}
                    {index < lines.length - 1 ? '\n' : null}
                  </React.Fragment>
                ))}
          </code>
        </pre>
      )}
    </section>
  )
}

const s = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    minWidth: 0,
    maxHeight: 260,
    border: '1px solid #93c5fd',
    borderRadius: 8,
    background: '#eff6ff',
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
    marginBottom: 8,
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '8px 10px',
    background: '#dbeafe',
    borderBottom: '1px solid #93c5fd',
    minWidth: 0,
  },
  titleWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  kicker: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.68rem',
    color: '#1d4ed8',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  title: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.86rem',
    color: '#1e3a8a',
    lineHeight: 1.2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  source: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    color: '#1d4ed8',
    fontWeight: 600,
  },
  pre: {
    margin: 0,
    padding: '11px 12px',
    overflow: 'auto',
    whiteSpace: 'pre',
    lineHeight: 1.55,
    fontSize: 13,
    color: '#111827',
    background: '#f8fafc',
  },
  code: {
    fontFamily: 'var(--font-code)',
    fontVariantLigatures: 'none',
    fontFeatureSettings: '"liga" 0, "calt" 0',
  },
  markdown: { overflow: 'auto', padding: '10px 12px', background: '#f8fafc' },
  // The panel's own maxHeight caps it; the changes scroll inside, so a tablet keeps the editor.
  changeBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    minHeight: 0,
    overflow: 'auto',
    padding: '8px 0',
    background: '#f8fafc',
    userSelect: 'none',
  },
  changeNote: {
    margin: '0 12px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: '#1e3a8a',
    lineHeight: 1.4,
  },
  toggle: {
    flexShrink: 0,
    minHeight: 44,
    padding: '0 14px',
    border: '1px solid #93c5fd',
    borderRadius: 8,
    background: '#ffffff',
    color: '#1d4ed8',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.86rem',
    cursor: 'pointer',
  },
  lockedTag: {
    marginLeft: '1.2em',
    color: '#475569',
    fontFamily: 'var(--font-body)',
    fontSize: '0.85em',
    fontWeight: 600,
  },
  lineHint: {
    marginLeft: '1.5em',
    color: '#9ca3af',
    fontStyle: 'italic',
    fontFamily: 'var(--font-body)',
    fontSize: '0.92em',
  },
}
