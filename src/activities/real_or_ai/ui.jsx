import { useEffect, useRef, useState } from 'react'
import RoundProgress, { BonusBanner, RoundFinished } from '../ui/RoundProgress.jsx'
import { SpinTick } from '../ui/ActivityCorrect.jsx'
import TutorItemPicker from '../ui/TutorItemPicker.jsx'
import { useRoundFlow } from '../ui/useRoundFlow.js'
import { coreCountOf } from '../round.js'
import RealOrAiBuilderEditor from './RealOrAiBuilderEditor.jsx'
import { resolveAssetFileUrl } from '../../shared/assetPaths.js'
import {
  gradeItem,
  gradeTask,
  kindOf,
  revealInfo,
  rightCount,
  sideLabel,
  SIDES,
  tellNote,
} from './real_or_ai.js'

// Real or AI UI. Controlled view: ActivityHost passes `state`, `onChange(next | prev => next)`,
// `readOnly` (teacher views and review), `teacher` (the tutor's view: shows the answer key and
// the student's picks) and `assetsPath` (the lesson's resolved asset base for relative picture
// paths). The activity marks itself (completion: 'auto'), so there is no Check button. Never
// write to Firebase or storage here: useActivityState owns persistence and live sync.
//
// One tap on a side picks "the AI one" and reveals at once (tick or cross plus a word, and a
// one-line note on the tell). The round then moves to the next pair by itself after
// READ_MOMENT_MS, or sooner when the student taps Next: the note needs reading time, so the
// moment is much longer than the other activities' tick. Every pick is a discrete change, so the
// tutor's card and student modal follow the picks live.

// How long a revealed pair stays up before the round moves on without a tap.
export const READ_MOMENT_MS = 5000

function itemStateOf(state, item) {
  const saved = state?.items?.[item.id] ?? {}
  const pick = SIDES.includes(saved.pick) ? saved.pick : ''
  return { pick, done: saved.done === true && !!pick }
}

// A picture's URL: full URLs, data/blob URLs and /-rooted paths as they are; other paths
// relative to the lesson's assets path (the same rule as Scratch costumes), and as a last
// resort as written.
function imageSrc(assetsPath, path) {
  return resolveAssetFileUrl(assetsPath, path) || String(path ?? '')
}

function PairSide({ item, side, assetsPath, itemState, locked, tutor, onPick, revealed }) {
  const text = item[side]
  const picked = itemState.pick === side
  const isAi = item.answer === side
  const alt = (side === 'a' ? item.altA : item.altB) || `Picture ${sideLabel(side)}`
  const cls = [
    'act-rai__card',
    picked ? 'act-rai__card--picked' : '',
    revealed && isAi ? 'act-rai__card--ai' : '',
    revealed && !isAi ? 'act-rai__card--real' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      type="button"
      className={cls}
      data-testid={`real_or_ai-side-${side}`}
      aria-pressed={picked}
      disabled={locked}
      onClick={() => onPick(side)}
    >
      <span className="act-rai__caption">
        <span className="act-badge">{sideLabel(side)}</span>
        {revealed && <span className="act-rai__verdict">{isAi ? '🤖 Made by AI' : '📷 Real'}</span>}
        {tutor && !revealed && isAi && <span className="act-rai__verdict">🔑 AI (key)</span>}
        {picked && (
          <span className="act-rai__chosen">👆 {tutor ? "Student's pick" : 'Your pick'}</span>
        )}
      </span>
      {kindOf(item) === 'image' ? (
        <img className="act-rai__image" src={imageSrc(assetsPath, text)} alt={alt} />
      ) : (
        <span className="act-rai__text">{text}</span>
      )}
      {!locked && <span className="act-rai__tap">Tap if this is the AI one</span>}
    </button>
  )
}

export function RealOrAiStudentView({
  task,
  state,
  onChange,
  readOnly = false,
  teacher = false,
  assetsPath = '',
}) {
  // A tutor (read-only view, or editing a student's answers) never lingers or advances: they
  // follow the student's pair or pick one in the tutor-only picker.
  const tutor = readOnly || teacher
  const items = task?.items ?? []
  const core = coreCountOf(task, items.length)
  const isDone = (item) => gradeItem(task, item, itemStateOf(state, item)).done
  const flow = useRoundFlow(items, isDone, { readOnly: tutor, momentMs: READ_MOMENT_MS })
  const [tutorPickId, setTutorPickId] = useState(null)
  const lastItem = items[items.length - 1]
  const current = tutor
    ? (items.find((item) => item.id === tutorPickId) ??
      items.find((item) => !isDone(item)) ??
      lastItem)
    : (flow.current ?? lastItem)

  const nextRef = useRef(null)
  const promptRef = useRef(null)
  const shownId = useRef(current?.id)
  const wasLingering = useRef(false)
  useEffect(() => {
    // Keyboard and screen-reader users land on Next after a tap, and on the question after it.
    if (flow.lingering && !wasLingering.current) nextRef.current?.focus()
    wasLingering.current = flow.lingering
    if (current && shownId.current !== current.id) {
      shownId.current = current.id
      if (!tutor && !flow.finished) promptRef.current?.focus()
    }
  })

  if (!current) return <p>This task has no pairs yet.</p>

  const right = rightCount(task, state)

  // Every pair done (core and bonus): the finish card. Play again clears the pairs on this device
  // (the right count stays); the task stays passed (a clear is never a submit).
  if (!tutor && flow.finished) {
    const { correct, total } = gradeTask(task, state)
    return (
      <div className="act-panel act-rai" data-testid="real_or_ai-activity">
        <p className="act-rai__score" role="status">
          ⭐ {right} right
        </p>
        <p className="act-prompt">
          You spotted {correct} of {total} this time.
        </p>
        <RoundFinished
          total={items.length}
          onPlayAgain={() => onChange?.({ v: 1, right, items: {} })}
        />
      </div>
    )
  }

  const itemState = itemStateOf(state, current)
  const revealed = gradeItem(task, current, itemState).done
  // A tutor editing a student's answers can still change a tapped pair; a student cannot.
  const locked = readOnly || (revealed && !teacher)
  const info = revealed ? revealInfo(task, current, itemState) : null
  const isBonus = items.indexOf(current) >= core
  const inBonus = flow.doneCount >= core && core < items.length
  const lastToDo = items.every((item) => item.id === current.id || isDone(item))
  const statusFor = (item) => (itemStateOf(state, item).done ? 'done' : null)

  function pick(side) {
    if (locked || (!tutor && flow.lingering)) return
    onChange?.((prev) => {
      const before = itemStateOf(prev, current)
      const wasRight = before.done && before.pick === current.answer
      const base = rightCount(task, prev)
      return {
        ...(prev ?? { v: 1 }),
        // Only ever goes up: no streak to lose.
        right: base + (side === current.answer && !wasRight ? 1 : 0),
        items: { ...(prev?.items ?? {}), [current.id]: { pick: side, done: true } },
      }
    })
  }

  return (
    <div className="act-panel act-rai" data-testid="real_or_ai-activity">
      <p className="act-rai__score" role="status" aria-live="polite">
        ⭐ {right} right
      </p>
      <RoundProgress done={flow.doneCount} total={items.length} core={core} />
      {tutor && (
        <TutorItemPicker
          items={items}
          currentId={current.id}
          onSelect={setTutorPickId}
          statusFor={statusFor}
          noun="Pair"
        />
      )}
      {!tutor && inBonus && <BonusBanner />}
      {isBonus && <span className="act-badge">Bonus</span>}

      <p className="act-prompt" ref={promptRef} tabIndex={-1}>
        {kindOf(current) === 'image'
          ? 'Which picture was made by AI?'
          : 'Which text was written by AI?'}
      </p>
      <div className="act-rai__pair">
        {SIDES.map((side) => (
          <PairSide
            key={side}
            item={current}
            side={side}
            assetsPath={assetsPath}
            itemState={itemState}
            locked={locked}
            tutor={tutor}
            revealed={revealed}
            onPick={pick}
          />
        ))}
      </div>

      {teacher && !revealed && (
        <p className="act-hint" data-testid="real_or_ai-teacher-note">
          Student has not picked yet. Key: {sideLabel(current.answer)} is AI
          {tellNote(current) ? `. ${tellNote(current)}` : '.'}
        </p>
      )}

      {info && (
        <div className="act-rai__reveal" role="status" data-testid="real_or_ai-reveal">
          <p className="act-rai__verdict-line">
            {info.correct ? <SpinTick /> : <strong>✗</strong>} <strong>{info.verdict}</strong>{' '}
            {info.aiLine}
          </p>
          {info.note && <p>{info.note}</p>}
          {info.reveal && <p>{info.reveal}</p>}
        </div>
      )}

      {!tutor && flow.lingering && (
        <div className="act-row">
          <button
            type="button"
            className="btn-primary act-btn act-rai__next"
            ref={nextRef}
            onClick={flow.skip}
          >
            {lastToDo ? 'Finish →' : 'Next →'}
          </button>
        </div>
      )}
    </div>
  )
}

export default {
  StudentView: RealOrAiStudentView,
  BuilderEditor: RealOrAiBuilderEditor,
}
