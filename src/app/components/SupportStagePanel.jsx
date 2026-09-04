import React from 'react'
import { MarkdownRenderer } from '../../shared/markdown'

function getLanguageLabel(language) {
  if (language === 'python') return 'Python'
  if (language === 'html') return 'HTML'
  if (language === 'filesystem') return 'Filesystem'
  if (language === 'scratch') return 'Scratch'
  if (language === 'electronics') return 'Electronics'
  return 'Code'
}

function stageToText(stage, lessonType) {
  if (!stage) return ''
  if (lessonType === 'python') return stage.code ?? ''
  if (lessonType === 'arcade') return stage.code ?? ''
  if (lessonType === 'html') {
    if (stage.code != null) return stage.code
    return (stage.files ?? [])
      .map(file => `/* ${file.name} */\n${file.content ?? ''}`)
      .join('\n\n')
  }
  if (lessonType === 'filesystem') return JSON.stringify(stage.fs ?? {}, null, 2)
  if (lessonType === 'scratch') return stage.markdown ?? ''
  if (lessonType === 'electronics') return stage.code ?? ''
  return ''
}

export function getSupportStageText(stage, lessonType) {
  return stageToText(stage, lessonType)
}

export default function SupportStagePanel({ stage, lessonType, revealed, sourceLabel }) {
  const text = stageToText(stage, lessonType)
  if (!revealed || !text.trim()) return null

  const title = stage?.label || 'Stage reference'
  const languageLabel = getLanguageLabel(lessonType)

  return (
    <section
      style={s.panel}
      aria-label={`${title} stage reference`}
      onCopy={e => e.preventDefault()}
      onCut={e => e.preventDefault()}
      onDragStart={e => e.preventDefault()}
      onContextMenu={e => e.preventDefault()}
    >
      <div style={s.header}>
        <div style={s.titleWrap}>
          <span style={s.kicker}>{languageLabel} reference</span>
          <span style={s.title}>{title}</span>
          {sourceLabel && <span style={s.source}>{sourceLabel}</span>}
        </div>
      </div>
      {lessonType === 'scratch' ? (
        <div style={s.markdown}><MarkdownRenderer content={text} topicType="scratch" disableCopy /></div>
      ) : (
        <pre style={s.pre}>
          <code style={s.code}>{text}</code>
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
}
