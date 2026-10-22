import { useEffect, useRef, useState } from 'react'
import ItemNav from '../ui/ItemNav.jsx'
import ActivityCorrect from '../ui/ActivityCorrect.jsx'
import { resolveAssetFileUrl } from '../../shared/assetPaths.js'
import {
  firstOpenIndex,
  gradeItem,
  gradeTask,
  kindOf,
  revealLines,
  sideLabel,
  SIDES,
  tellLabel,
  tellsOf,
} from './real_or_ai.js'

// Real or AI UI. Controlled view: ActivityHost passes `state`, `onChange(next | prev => next)`,
// `readOnly` (teacher views and review), `teacher` (the tutor's view: shows the answer key and
// the student's picks before they reveal) and `assetsPath` (the lesson's resolved asset base
// for relative picture paths). The activity finishes itself when the last pair is revealed
// (completion: 'auto'), so there is no Check button. Never write to Firebase or storage here:
// useActivityState owns persistence and live sync.
//
// Every pick, clue and Reveal is a discrete change, so the tutor's card and student modal
// follow the student's choices live, before the pair is revealed.

function itemStateOf(state, item) {
  const saved = state?.items?.[item.id] ?? {}
  return {
    pick: SIDES.includes(saved.pick) ? saved.pick : '',
    tell: typeof saved.tell === 'string' ? saved.tell : '',
    done: saved.done === true,
  }
}

// A picture's URL: full URLs, data/blob URLs and /-rooted paths as they are; other paths
// relative to the lesson's assets path (the same rule as Scratch costumes), and as a last
// resort as written.
function imageSrc(assetsPath, path) {
  return resolveAssetFileUrl(assetsPath, path) || String(path ?? '')
}

function PairSide({ item, side, assetsPath, itemState, locked, teacher, onPick, revealed }) {
  const text = item[side]
  const picked = itemState.pick === side
  const isAi = item.answer === side
  const alt = (side === 'a' ? item.altA : item.altB) || `Picture ${sideLabel(side)}`
  const cls = [
    'act-rai__card',
    picked ? 'act-rai__card--picked' : '',
    revealed && isAi ? 'act-rai__card--ai' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <figure className={cls} data-testid={`real_or_ai-side-${side}`}>
      <figcaption className="act-rai__caption">
        <span className="act-badge">{sideLabel(side)}</span>
        {revealed && <span className="act-rai__verdict">{isAi ? '🤖 Made by AI' : '📷 Real'}</span>}
        {teacher && !revealed && isAi && <span className="act-rai__verdict">🔑 AI (key)</span>}
      </figcaption>
      {kindOf(item) === 'image' ? (
        <img className="act-rai__image" src={imageSrc(assetsPath, text)} alt={alt} />
      ) : (
        <blockquote className="act-rai__text">{text}</blockquote>
      )}
      <button
        type="button"
        className="btn-ghost-outline act-btn act-rai__pick"
        aria-pressed={picked}
        disabled={locked}
        onClick={() => onPick(side)}
      >
        Pick {sideLabel(side)} as the AI one
      </button>
      {picked && (
        <span className="act-rai__chosen">✓ {teacher ? "Student's pick" : 'Your pick'}</span>
      )}
    </figure>
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
  const items = task?.items ?? []
  const tells = tellsOf(task)
  const [index, setIndex] = useState(() => firstOpenIndex(task, state))
  const revealRef = useRef(null)
  const promptRef = useRef(null)
  const focusReveal = useRef(false)
  const focusPrompt = useRef(false)
  const { done: doneCount, correct, total, finished } = gradeTask(task, state)

  // Start again (Stage reset) clears every pair: go back to the first one.
  const prevDone = useRef(doneCount)
  useEffect(() => {
    if (doneCount === 0 && prevDone.current > 0) setIndex(0)
    prevDone.current = doneCount
  }, [doneCount])

  // The tutor's view follows the pair the student is on until the tutor picks another.
  const [followed, setFollowed] = useState(true)
  const shownIndex = teacher && followed ? firstOpenIndex(task, state) : index
  const current = items[Math.min(shownIndex, items.length - 1)]

  const itemState = current ? itemStateOf(state, current) : null
  const revealed = !!current && gradeItem(task, current, itemState).done

  useEffect(() => {
    if (focusReveal.current && revealed) {
      focusReveal.current = false
      revealRef.current?.focus()
    }
    if (focusPrompt.current) {
      focusPrompt.current = false
      promptRef.current?.focus()
    }
  })

  if (!current) return <p>This task has no pairs yet.</p>

  const locked = readOnly || revealed

  function update(patch) {
    if (locked) return
    onChange?.((prev) => ({
      ...(prev ?? { v: 1 }),
      items: { ...(prev?.items ?? {}), [current.id]: { ...itemStateOf(prev, current), ...patch } },
    }))
  }

  function select(i) {
    setFollowed(false)
    setIndex(i)
  }

  const lines = revealed ? revealLines(task, current, itemState) : null
  const nextIndex = Math.min(items.length - 1, shownIndex + 1)
  const statusFor = (item) => (itemStateOf(state, item).done ? 'done' : null)

  return (
    <div className="act-panel act-rai" data-testid="real_or_ai-activity">
      <p className="act-rai__score" role="status" aria-live="polite">
        Score: {correct} right out of {doneCount} done ({total} {total === 1 ? 'pair' : 'pairs'})
      </p>
      <ItemNav
        items={items}
        currentIndex={shownIndex}
        onSelect={select}
        statusFor={statusFor}
        noun="Pair"
      />

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
            teacher={teacher}
            revealed={revealed}
            onPick={(picked) => update({ pick: picked })}
          />
        ))}
      </div>

      {(itemState.pick || teacher) && (
        <div role="group" aria-labelledby="real_or_ai-tell-heading" className="act-rai__tells">
          <p className="act-prompt" id="real_or_ai-tell-heading">
            What gave it away?
          </p>
          <div className="act-row">
            {tells.map((tell) => {
              const on = itemState.tell === tell
              const isKey = (teacher || revealed) && current.tell === tell
              return (
                <button
                  key={tell}
                  type="button"
                  className="btn-ghost-outline act-btn act-rai__tell"
                  aria-pressed={on}
                  disabled={locked}
                  onClick={() => update({ tell })}
                >
                  {on ? '✓ ' : ''}
                  {tellLabel(tell)}
                  {isKey ? (
                    <span className="act-rai__key"> 🔑 {revealed ? 'clue' : 'key'}</span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {!locked && itemState.pick && itemState.tell && (
        <div className="act-row act-row--submit">
          <button
            type="button"
            className="btn-primary act-btn"
            onClick={() => {
              focusReveal.current = true
              update({ done: true })
            }}
          >
            Reveal
          </button>
        </div>
      )}

      {teacher && !revealed && (
        <p className="act-hint" data-testid="real_or_ai-teacher-note">
          {itemState.pick
            ? `Student has picked ${sideLabel(itemState.pick)}${itemState.tell ? ` and the clue "${tellLabel(itemState.tell)}"` : ' and is choosing a clue'}. Not revealed yet.`
            : 'Student has not picked yet.'}{' '}
          Key: {sideLabel(current.answer)} is AI, clue "{tellLabel(current.tell)}",{' '}
          {current.reliable ? 'reliable' : 'not reliable'}.
        </p>
      )}

      {lines && (
        <div
          className="act-rai__reveal"
          role="status"
          tabIndex={-1}
          ref={revealRef}
          data-testid="real_or_ai-reveal"
        >
          <p>
            <strong>{lines.correct ? '✓' : '✗'}</strong> {lines.pickLine}
          </p>
          <p>
            <strong>{lines.tellMatches ? '✓' : '✗'}</strong> {lines.tellLine}
          </p>
          <p>
            <strong>{current.reliable ? '✓' : '⚠'}</strong> {lines.reliableLine}
          </p>
          <p>{lines.reveal}</p>
        </div>
      )}

      {revealed && shownIndex < items.length - 1 && !teacher && (
        <div className="act-row">
          <button
            type="button"
            className="btn-primary act-btn"
            onClick={() => {
              focusPrompt.current = true
              select(nextIndex)
            }}
          >
            Next pair →
          </button>
        </div>
      )}

      {finished && (
        <ActivityCorrect>
          All done! You spotted {correct} of {total}.
        </ActivityCorrect>
      )}
    </div>
  )
}

export default {
  StudentView: RealOrAiStudentView,
}
