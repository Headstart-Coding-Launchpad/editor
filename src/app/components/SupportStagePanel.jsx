import React from 'react'
import { MarkdownRenderer } from '../../shared/markdown'
import { getModuleDefinition, getModuleLabel } from '../../modules/definitions'

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
}) {
  const text = stageToText(stage, lessonType)
  if (!revealed || !text.trim()) return null
  const hintsByLine = stageHintsByLine(stage, lessonType, lineHintsFor)

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
      </div>
      {stageReferenceFor(lessonType)?.markdown ? (
        <div style={s.markdown}>
          <MarkdownRenderer content={text} topicType={lessonType} disableCopy />
        </div>
      ) : (
        <pre style={s.pre}>
          <code style={s.code}>
            {hintsByLine.size === 0
              ? text
              : text.split('\n').map((line, index, lines) => (
                  <React.Fragment key={index}>
                    {line}
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
  lineHint: {
    marginLeft: '1.5em',
    color: '#9ca3af',
    fontStyle: 'italic',
    fontFamily: 'var(--font-body)',
    fontSize: '0.92em',
  },
}
