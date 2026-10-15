import { getTaskPuzzle, lineCounter, parResult } from './puzzle.js'
import { getTaskSetupNote } from './setupCode.js'

/**
 * The short line above a Python / Turtle editor for a task's hidden setup and puzzle rules
 * (./puzzle.js, ./setupCode.js): the setupNote ("playlist already exists"), the live line counter
 * ("3 / 4 lines", a live region) and, once the task has passed, how it compares with par
 * ("Solved at par ⭐" — the star always comes with words). Nothing without any of them.
 */
export default function PuzzleBar({ task, code, passed = false }) {
  const note = getTaskSetupNote(task)
  const puzzle = getTaskPuzzle(task)
  const counter = lineCounter(code, puzzle)
  const par = passed ? parResult(code, task) : null
  if (!note && !counter && !par) return null
  const parWords = par ? par.text.replace(/\s*⭐$/, '') : ''

  return (
    <div style={s.bar} className="puzzle-bar">
      {note && (
        <span style={s.note}>
          <span aria-hidden="true">🧰 </span>
          {note}
        </span>
      )}
      <span style={s.right}>
        {par && (
          <span style={{ ...s.par, ...(par.atPar ? s.parGood : null) }}>
            {parWords}
            {par.atPar && <span aria-hidden="true"> ⭐</span>}
          </span>
        )}
        {counter && (
          <span
            role="status"
            aria-live="polite"
            style={{ ...s.counter, ...(counter.over ? s.counterOver : null) }}
            title="Lines of code (blank and comment lines don't count)"
          >
            {counter.text}
            {counter.over && ' — over the limit'}
          </span>
        )}
      </span>
    </div>
  )
}

const s = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    padding: '4px 4px 6px',
    flexShrink: 0,
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
  },
  note: { color: '#475569', fontWeight: 600 },
  right: { marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 },
  counter: {
    minHeight: 28,
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 10px',
    borderRadius: 999,
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#374151',
    fontWeight: 700,
  },
  counterOver: { borderColor: '#fca5a5', background: '#fef2f2', color: '#b91c1c' },
  par: {
    minHeight: 28,
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 10px',
    borderRadius: 999,
    background: '#f3f4f6',
    color: '#374151',
    fontWeight: 600,
  },
  parGood: { background: '#fef9c3', color: '#854d0e' },
}
