// Presentation for the quiz task family.
//
// These style objects and colour constants used to sit at the bottom of quizUtils.js,
// where 472 of that file's 647 lines were styling in a module named Utils. Splitting
// them out leaves quizUtils holding logic and keeps the palette - the subject of the
// answer-colour fix - somewhere a reader would look for it.

export const CONFIDENCE_COLOURS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e']

// Answer options are colour-coded by position, because four bright cards read better to
// a classroom of children than four identical ones. The colour is decoration: it says
// nothing about whether an answer is right.
//
// Which is exactly why none of these four hues comes from the success or error families.
// The old palette drew two of its four entries from them and used the same palette for
// the selected fill, so OPTION_COLOURS[1].active was the isWrong red and [3].active was
// the isCorrect green, byte for byte - a student could pick the right answer and watch it
// turn red under a green "Correct!" banner. Blue, violet, cyan and pink cannot collide
// with a verdict no matter which cell they land in.
//
// Options are no longer shuffled here (the authoring agent shuffles them), so a given
// question shows the same colour in the same place for every student in the room - which
// makes "the blue one" a referent that actually works.
export const OPTION_COLOURS = [
  { background: '#dbeafe', border: '#2563eb', active: '#2563eb', text: '#1e3a8a' },
  { background: '#ede9fe', border: '#7c3aed', active: '#7c3aed', text: '#4c1d95' },
  { background: '#cffafe', border: '#0891b2', active: '#0891b2', text: '#164e63' },
  { background: '#fce7f3', border: '#db2777', active: '#db2777', text: '#831843' },
]

// Reserved for a submitted answer, and never used by OPTION_COLOURS above.
export const OPTION_VERDICT_COLOURS = {
  correct: {
    background: 'var(--colour-success-edge)',
    border: 'var(--colour-success-edge)',
    text: '#fff',
  },
  wrong: {
    background: 'var(--colour-error-edge)',
    border: 'var(--colour-error-edge)',
    text: '#fff',
  },
}

export const baseStyles = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    width: '100%',
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  question: {
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
    flex: '0 0 auto',
  },
  questionLabel: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '11px 14px',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.95rem',
    letterSpacing: '0.04em',
  },
  questionBody: {
    flex: '1 1 auto',
    minHeight: 0,
    padding: '16px 18px',
    fontSize: '1.16rem',
    lineHeight: 1.7,
    overflowWrap: 'anywhere',
  },
  optionsFrame: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    overflowY: 'auto',
    // Reserve the scrollbar's width whether or not it's currently needed, so a
    // scrollbar appearing/disappearing never changes the width available to
    // fit against (that feedback loop caused answers to shake/thrash).
    scrollbarGutter: 'stable',
  },
  options: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    // Rows share the frame equally and grow into it, so the answers fill the space the
    // question leaves rather than sitting in a band at the top.
    gridAutoRows: 'minmax(min-content, 1fr)',
    gap: 'calc(var(--quiz-option-scale, 1) * 10px)',
    minHeight: '100%',
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    minHeight: 0,
    height: '100%',
    padding: 'calc(var(--quiz-option-scale, 1) * 18px) calc(var(--quiz-option-scale, 1) * 20px)',
    border: '2px solid',
    borderRadius: 8,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'var(--font-body)',
    fontSize: 'calc(var(--quiz-option-scale, 1) * 1.42rem)',
    fontWeight: 600,
    transition: 'background 0.12s, border-color 0.12s, box-shadow 0.12s',
  },
  optionActive: {
    boxShadow: 'inset 0 0 0 3px rgba(255, 255, 255, 0.5), 0 6px 18px rgba(17, 24, 39, 0.18)',
    zIndex: 2,
  },
  optionId: {
    width: 'calc(var(--quiz-option-scale, 1) * 42px)',
    height: 'calc(var(--quiz-option-scale, 1) * 42px)',
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
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  },
  scratchOptionText: {
    flex: '1 1 0',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  scratchOptionScale: {
    display: 'inline-block',
    transformOrigin: 'center',
    width: 'max-content',
  },
  markdownOnDark: {
    '--colour-text': '#ffffff',
    '--colour-primary-dark': '#ffffff',
  },
  correctAnswerNote: {
    padding: '8px 12px',
    borderRadius: 6,
    background: 'var(--colour-success-bg)',
    border: '1px solid var(--colour-success-edge)',
    color: 'var(--colour-success-text)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    fontWeight: 600,
  },
  correctAnswerText: {
    fontWeight: 700,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
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
  submittedAnswerText: {
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
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
