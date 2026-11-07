import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MarkdownRenderer } from '../../shared/markdown'
import { getModuleDefinition, getModuleLabel } from '../../modules/definitions'
import { chooseLockedLines } from '../../shared/lockedLines'
import { computeStageChange, stageShowsChange } from '../../shared/stageChange'
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

export default function SupportStagePanel({
  stage,
  lessonType,
  revealed,
  sourceLabel,
  lineHintsFor,
  // The task's lock sets (getTaskLockSets): a code stage marks the lines a student can't change.
  lockSets = null,
  // The student's code to compare with (chooseChangeBase): with it, a Complete code stage that
  // has `show: 'change'` shows only what changes. Read once, when the panel opens (callers key
  // the panel per task and stage), so the view holds still while the student types.
  changeBase = null,
  // Told whether the change view (not the whole program) is on screen, for the load button's words.
  onChangeViewShown,
}) {
  const text = stageToText(stage, lessonType)
  const [openedBase] = useState(changeBase)
  const showsChange =
    revealed &&
    typeof openedBase === 'string' &&
    stageShowsChange(stage) &&
    getModuleDefinition(lessonType)?.capabilities?.sandboxState === 'code'
  const change = useMemo(
    () => (showsChange ? computeStageChange(openedBase, stage.code) : null),
    [showsChange, openedBase, stage?.code]
  )
  // 'auto' follows the change (the changes, or the whole program when too much changed);
  // 'all' / 'changes' are the student's own choice from the toggle.
  const [view, setView] = useState('auto')
  const canShowChanges = !!change && !(change.kind === 'fallback' && change.reason === 'no-anchor')
  const shownView = !change
    ? null
    : view === 'all' || (view === 'auto' && change.kind === 'fallback') || !canShowChanges
      ? 'all'
      : 'changes'
  const changeViewShown = shownView === 'changes'
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
        {change && canShowChanges && (
          <button
            type="button"
            style={s.toggle}
            onClick={() => setView(shownView === 'all' ? 'changes' : 'all')}
          >
            {shownView === 'all' ? CHANGE_VIEW_TEXT.showChanges : CHANGE_VIEW_TEXT.showAll}
          </button>
        )}
      </div>
      {change ? (
        <div style={s.changeBody} data-testid="stage-change-view">
          {shownView === 'all' ? (
            <>
              {view === 'auto' && change.kind === 'fallback' && (
                <p style={s.changeNote}>{CHANGE_VIEW_TEXT.fallback}</p>
              )}
              <FullChangeRows rows={change.fullRows} />
            </>
          ) : change.kind === 'same' ? (
            <p style={s.changeNote}>{CHANGE_VIEW_TEXT.same}</p>
          ) : (
            change.hunks.map((hunk, index) => <ChangeHunk key={index} {...hunk} />)
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
