import React from 'react'
import { MarkdownRenderer } from '../../../shared/markdown'

export function getQuizOptionText(task, answerId) {
  return task?.options?.find(option => option.id === answerId)?.text ?? ''
}

export const CONFIDENCE_COLOURS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e']

export const OPTION_COLOURS = [
  { background: '#dbeafe', border: '#2563eb', active: '#2563eb', text: '#1e3a8a' },
  { background: '#fee2e2', border: '#dc2626', active: '#dc2626', text: '#7f1d1d' },
  { background: '#fef3c7', border: '#f59e0b', active: '#f59e0b', text: '#78350f' },
  { background: '#dcfce7', border: '#16a34a', active: '#16a34a', text: '#14532d' },
]

export function stableHash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  return h
}

export function parseQuizAnswerState(selectedAnswer) {
  if (selectedAnswer && typeof selectedAnswer === 'object' && !Array.isArray(selectedAnswer)) return selectedAnswer
  if (typeof selectedAnswer === 'string' && selectedAnswer) {
    try {
      const parsed = JSON.parse(selectedAnswer)
      if (parsed && typeof parsed === 'object') return parsed
    } catch {}
  }
  return {}
}

export function fillDragTileMatchesBlank(tile, blank) {
  return tile?.text === blank?.answer
}

export function typedValueMatchesBlank(value, blank) {
  return String(value ?? '').trim().toLowerCase() === String(blank?.answer ?? '').trim().toLowerCase()
}

// Parses fill-blank text into tokens:
//   {type:'text'|'code'|'blank', text?, lang?, blankId?}
//   {type:'codeBlock', lang, parts:[{type:'codeText'|'blank', text?, blankId?}]}
// Triple-backtick blocks are detected before single backticks so ``` is never
// misread as a code span. Blanks inside code blocks keep the pre-formatted
// indentation intact because parts render as raw text nodes inside <pre>.
export function parseFillBlankSegments(text, blanks) {
  const tokens = []
  let blankCount = 0
  let i = 0

  while (i < text.length) {
    if (text.startsWith('___', i)) {
      tokens.push({ type: 'blank', blankId: blanks[blankCount]?.id ?? `b${blankCount + 1}` })
      blankCount++
      i += 3
      continue
    }

    if (text.startsWith('```', i)) {
      const closeIdx = text.indexOf('\n```', i + 3)
      if (closeIdx !== -1) {
        const blockContent = text.slice(i + 3, closeIdx)
        const nlIdx = blockContent.indexOf('\n')
        const lang = nlIdx !== -1 ? blockContent.slice(0, nlIdx).trim() : ''
        const body = nlIdx !== -1 ? blockContent.slice(nlIdx + 1) : blockContent
        const bodyNoTrail = body.replace(/\n$/, '')
        const parts = []
        const bodyParts = bodyNoTrail.split('___')
        bodyParts.forEach((part, j) => {
          if (part) parts.push({ type: 'codeText', text: part })
          if (j < bodyParts.length - 1) {
            parts.push({ type: 'blank', blankId: blanks[blankCount]?.id ?? `b${blankCount + 1}` })
            blankCount++
          }
        })
        tokens.push({ type: 'codeBlock', lang, parts })
        i = closeIdx + 4
        continue
      }
    }

    const close = text[i] === '`' ? text.indexOf('`', i + 1) : -1
    if (close !== -1) {
      const raw = text.slice(i + 1, close)
      const langMatch = raw.match(/^(python|html|css|js):/)
      const lang = langMatch ? langMatch[1] : null
      const body = lang ? raw.slice(lang.length + 1) : raw
      if (body.includes('___')) {
        const codeParts = body.split('___')
        codeParts.forEach((part, j) => {
          if (part) tokens.push({ type: 'code', lang, text: part })
          if (j < codeParts.length - 1) {
            tokens.push({ type: 'blank', blankId: blanks[blankCount]?.id ?? `b${blankCount + 1}` })
            blankCount++
          }
        })
      } else {
        tokens.push({ type: 'code', lang, text: body })
      }
      i = close + 1
      continue
    }

    const textStart = i
    i++
    while (i < text.length && !text.startsWith('___', i) && !text.startsWith('```', i) && text[i] !== '`') i++
    tokens.push({ type: 'text', text: text.slice(textStart, i) })
  }

  return tokens
}

export function QuestionPanel({ task }) {
  if (!task?.explainer) return null
  return React.createElement(
    'div',
    { style: baseStyles.question },
    React.createElement('div', { style: baseStyles.questionLabel }, 'Question'),
    React.createElement(
      'div',
      { style: baseStyles.questionBody },
      React.createElement(MarkdownRenderer, { title: task.title, content: task.explainer }),
    ),
  )
}

export const baseStyles = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    width: '100%',
    flexGrow: 1,
    flexShrink: 0,
  },
  question: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
    flexShrink: 0,
  },
  questionLabel: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '10px 14px',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.85rem',
    letterSpacing: '0.04em',
  },
  questionBody: {
    padding: '14px 16px',
  },
  options: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gridAutoRows: 'minmax(min-content, 1fr)',
    gap: 10,
    flexGrow: 1,
    flexShrink: 0,
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    minHeight: 0,
    height: '100%',
    padding: '18px 20px',
    border: '2px solid',
    borderRadius: 8,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'var(--font-body)',
    fontSize: '1.35rem',
    fontWeight: 600,
    transition: 'background 0.12s, border-color 0.12s, box-shadow 0.12s',
  },
  optionActive: {
    boxShadow: 'inset 0 0 0 3px rgba(255, 255, 255, 0.5), 0 6px 18px rgba(17, 24, 39, 0.18)',
    zIndex: 2,
  },
  optionId: {
    width: 42,
    height: 42,
    borderRadius: 6,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  optionText: {
    minWidth: 0,
    lineHeight: 1.35,
  },
  markdownOnDark: {
    '--colour-text': '#ffffff',
    '--colour-primary-dark': '#ffffff',
  },
  correctAnswerNote: {
    padding: '8px 12px',
    borderRadius: 6,
    background: '#dcfce7',
    border: '1px solid #16a34a',
    color: '#15803d',
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    fontWeight: 600,
  },
}

export const interactionStyles = {
  matchLayout: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    flexGrow: 1,
    flexShrink: 0,
  },
  promptList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  matchRow: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    gap: 10,
    alignItems: 'center',
  },
  promptCell: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '12px 16px',
    borderRadius: 8,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '1rem',
    textAlign: 'center',
  },
  matchArrow: {
    color: '#9ca3af',
    fontSize: '1.25rem',
    flexShrink: 0,
  },
  slot: {
    padding: '12px 16px',
    borderRadius: 8,
    border: '2px dashed',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '1rem',
    textAlign: 'center',
    minHeight: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.12s, border-color 0.12s',
  },
  slotEmpty: {
    borderColor: '#d1d5db',
    background: '#f9fafb',
    color: '#9ca3af',
  },
  slotFilled: {
    borderColor: 'var(--colour-secondary)',
    borderStyle: 'solid',
    background: '#fffbeb',
    color: 'var(--colour-text)',
  },
  slotHighlight: {
    borderColor: 'var(--colour-primary)',
    background: '#f5f3ff',
    color: 'var(--colour-primary)',
    boxShadow: '0 0 0 4px rgba(98, 34, 204, 0.14), inset 0 0 0 2px rgba(251, 165, 4, 0.55)',
    transform: 'scale(1.03)',
  },
  slotCorrect: {
    borderColor: '#16a34a',
    borderStyle: 'solid',
    background: '#dcfce7',
    color: '#15803d',
  },
  slotWrong: {
    borderColor: '#dc2626',
    borderStyle: 'solid',
    background: '#fee2e2',
    color: '#b91c1c',
  },
  correctAnswerHint: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    color: '#15803d',
    background: '#dcfce7',
    border: '1px solid #bbf7d0',
    borderRadius: 5,
    padding: '3px 8px',
  },
  answerPool: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 12,
  },
  poolLabel: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.78rem',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  poolTiles: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    minHeight: 42,
  },
  tile: {
    padding: '8px 16px',
    border: '2px solid #e5e7eb',
    borderRadius: 8,
    background: '#fff',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.95rem',
    color: 'var(--colour-text)',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'border-color 0.12s, background 0.12s, box-shadow 0.12s, transform 0.12s',
  },
  tileSelected: {
    borderColor: 'var(--colour-primary)',
    background: 'var(--colour-primary)',
    color: '#fff',
    boxShadow: '0 16px 34px rgba(35, 18, 76, 0.3), 0 0 0 5px rgba(251, 165, 4, 0.24)',
    transform: 'translateY(-8px) rotate(-2deg) scale(1.06)',
  },
  selectedTileMarkdown: {
    '--colour-text': '#ffffff',
    '--colour-primary-dark': '#ffffff',
  },
  poolEmpty: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  fillCodeBlock: {
    display: 'block',
    margin: '10px 0',
  },
  fillCodeBlockPre: {
    background: '#fafafa',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '12px 14px',
    overflowX: 'auto',
    fontFamily: "'JetBrains Mono', monospace",
    fontVariantLigatures: 'none',
    fontFeatureSettings: '"liga" 0, "calt" 0',
    fontSize: '0.88em',
    margin: 0,
    lineHeight: 1.8,
    whiteSpace: 'pre',
  },
  fillWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    flexGrow: 1,
    flexShrink: 0,
  },
  fillText: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '16px 20px',
    fontFamily: 'var(--font-body)',
    fontSize: '1.1rem',
    lineHeight: 2.2,
    color: 'var(--colour-text)',
  },
  fillBlank: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    padding: '2px 12px',
    borderRadius: 6,
    border: '2px dashed',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '1rem',
    textAlign: 'center',
    margin: '0 2px',
    verticalAlign: 'middle',
    transition: 'background 0.1s, border-color 0.1s',
  },
  fillBlankMarkdown: {
    '--colour-text': 'var(--colour-text)',
    '--colour-primary-dark': 'var(--colour-primary-dark)',
    color: 'var(--colour-text)',
  },
  fillBlankEmpty: {
    borderColor: '#d1d5db',
    background: '#f9fafb',
    color: '#9ca3af',
  },
  fillBlankFilled: {
    borderColor: 'var(--colour-secondary)',
    borderStyle: 'solid',
    background: '#fffbeb',
    color: 'var(--colour-text)',
  },
  fillBlankHighlight: {
    borderColor: 'var(--colour-primary)',
    background: '#f5f3ff',
    color: 'var(--colour-primary)',
    boxShadow: '0 0 0 4px rgba(98, 34, 204, 0.14), inset 0 0 0 2px rgba(251, 165, 4, 0.55)',
    transform: 'scale(1.05)',
  },
  fillBlankCorrect: {
    borderColor: '#16a34a',
    borderStyle: 'solid',
    background: '#dcfce7',
    color: '#15803d',
  },
  fillBlankWrong: {
    borderColor: '#dc2626',
    borderStyle: 'solid',
    background: '#fee2e2',
    color: '#b91c1c',
  },
  fillInput: {
    display: 'inline-block',
    minWidth: 90,
    width: 'auto',
    padding: '2px 10px',
    borderRadius: 6,
    border: '2px solid #d1d5db',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '1rem',
    color: 'var(--colour-text)',
    background: '#fff',
    margin: '0 2px',
    verticalAlign: 'middle',
    outline: 'none',
  },
  fillInputCorrect: {
    borderColor: '#16a34a',
    background: '#dcfce7',
    color: '#15803d',
  },
  fillInputWrong: {
    borderColor: '#dc2626',
    background: '#fee2e2',
    color: '#b91c1c',
  },
  shortAnswerWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    flexGrow: 1,
    flexShrink: 0,
  },
  shortAnswerInput: {
    padding: '12px 14px',
    border: '2px solid #d1d5db',
    borderRadius: 8,
    fontFamily: 'var(--font-body)',
    fontSize: '1rem',
    color: 'var(--colour-text)',
    resize: 'vertical',
    lineHeight: 1.6,
    outline: 'none',
    width: '100%',
  },
  submittedAnswer: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    color: '#4b5563',
    padding: '8px 12px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
  },
}

export const confidenceStyles = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    flexGrow: 1,
    flexShrink: 0,
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingBottom: 2,
  },
  labelEdge: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.82rem',
    color: '#6b7280',
  },
  buttons: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 12,
    padding: '8px 6px',
    overflow: 'visible',
  },
  btn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: '16px 0',
    borderRadius: 12,
    border: '3px solid',
    cursor: 'pointer',
    transition: 'background 0.12s, color 0.12s, transform 0.12s, box-shadow 0.12s',
    fontFamily: 'var(--font-body)',
  },
  btnNum: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '2rem',
    lineHeight: 1,
  },
  btnIcon: {
    fontSize: '1.3rem',
    lineHeight: 1,
  },
  result: {
    padding: '10px 14px',
    borderRadius: 8,
    border: '2px solid',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    fontWeight: 600,
    textAlign: 'center',
  },
}
