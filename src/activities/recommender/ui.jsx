import { useMemo, useState } from 'react'
import { SpinTick } from '../ui/ActivityCorrect.jsx'
import RecommenderBuilderEditor from './RecommenderBuilderEditor.jsx'
import {
  BUBBLE_NUDGE,
  FEED_SIZE,
  GOAL_LABELS,
  bubbleInfo,
  generateRaters,
  goalOf,
  goalsOf,
  gradeTask,
  needsWhy,
  ratedCount,
  recommend,
  triedGoalsOf,
  whyText,
} from './recommender.js'

// Recommender UI. Controlled view: ActivityHost passes `state`, `onChange(next | prev => next)`,
// `readOnly` (teacher views and review) and `teacher` (editing a student's answers). The
// activity marks itself (completion: 'auto'), so there is no Check button. Never write to
// Firebase or storage here: useActivityState owns persistence and live sync.
//
// The student rates items 👍 / 👎 (tap again to take it back). "Your feed" shows the top 4
// recommendations, recomputed only when a rating changes (no timers, no animation loop). A tutor
// sees the same screen with the student's ratings, feed and bubble meter; in the read-only view
// the Why? buttons still open for the tutor but are not saved.

export function RecommenderStudentView({ task, state, onChange, readOnly = false }) {
  const items = useMemo(() => task?.items ?? [], [task?.items])
  const ratings = useMemo(() => state?.ratings ?? {}, [state?.ratings])
  const [openId, setOpenId] = useState(null)

  // Same lesson, same made-up class: built once per item list.
  const raters = useMemo(() => generateRaters(items), [items])
  // The goal is undefined unless the task has `goals`, which keeps the usual feed.
  const goals = goalsOf(task)
  const goal = goalOf(task, state)
  const feed = useMemo(
    () => recommend(items, raters, ratings, FEED_SIZE, goal),
    [items, raters, ratings, goal]
  )
  const bubble = useMemo(() => bubbleInfo(feed, items), [feed, items])
  const { need, passed, why } = gradeTask(task, state)
  const rated = ratedCount(state)
  const showWhy = needsWhy(task)

  function rate(item, value) {
    if (readOnly) return
    onChange?.((prev) => {
      const current = { ...(prev?.ratings ?? {}) }
      if (current[item.id] === value) delete current[item.id]
      else current[item.id] = value
      return { ...(prev ?? { v: 1 }), v: 1, ratings: current }
    })
  }

  function pickGoal(next) {
    if (readOnly || next === goal) return
    onChange?.((prev) => {
      const base = prev ?? { v: 1, ratings: {}, why: false }
      return { ...base, v: 1, goal: next, tried: [...new Set([...triedGoalsOf(task, base), next])] }
    })
  }

  function openWhy(id) {
    setOpenId((prev) => (prev === id ? null : id))
    if (!readOnly && state?.why !== true) {
      onChange?.((prev) => ({ ...(prev ?? { v: 1, ratings: {} }), why: true }))
    }
  }

  if (items.length === 0) return <p>This task has no items yet.</p>

  const open = feed.find((entry) => entry.item.id === openId)
  const tutorLine = readOnly && rated === 0 ? 'The student has not rated anything yet.' : null

  return (
    <div className="act-panel act-rec" data-testid="recommender-activity">
      <p className="act-rec__count" role="status" aria-live="polite">
        {rated >= need ? <SpinTick /> : '👍'} Rated {Math.min(rated, need)} of {need}
        {showWhy && rated >= need && !why ? ' · now tap Why? on your feed' : ''}
        {passed ? ' · done!' : ''}
      </p>
      {tutorLine && <p className="act-hint">{tutorLine}</p>}

      <p className="act-prompt">Do you like these? Tap 👍 or 👎.</p>
      <ul className="act-rec__grid">
        {items.map((item) => {
          const value = ratings[item.id]
          return (
            <li key={item.id} className="act-rec__item" data-testid={`recommender-item-${item.id}`}>
              <span className="act-rec__emoji" aria-hidden="true">
                {item.emoji}
              </span>
              <span className="act-rec__label">{item.label}</span>
              <span className="act-rec__buttons">
                <button
                  type="button"
                  className={`act-rec__rate${value === 1 ? ' act-rec__rate--on' : ''}`}
                  aria-pressed={value === 1}
                  aria-label={`Like ${item.label}`}
                  disabled={readOnly}
                  onClick={() => rate(item, 1)}
                >
                  👍
                </button>
                <button
                  type="button"
                  className={`act-rec__rate${value === -1 ? ' act-rec__rate--off' : ''}`}
                  aria-pressed={value === -1}
                  aria-label={`Dislike ${item.label}`}
                  disabled={readOnly}
                  onClick={() => rate(item, -1)}
                >
                  👎
                </button>
              </span>
            </li>
          )
        })}
      </ul>

      <h3 className="act-rec__heading">Your feed</h3>
      {goals.length > 1 && (
        <div className="act-row" role="group" aria-label="What should your feed aim for?">
          {goals.map((g) => (
            <button
              key={g}
              type="button"
              className="btn-secondary act-btn"
              aria-pressed={goal === g}
              disabled={readOnly}
              onClick={() => pickGoal(g)}
            >
              {goal === g ? '✓ ' : ''}
              {GOAL_LABELS[g]}
            </button>
          ))}
        </div>
      )}
      {rated === 0 && (
        <p className="act-hint">Nothing rated yet, so this is what the class likes most.</p>
      )}
      <ul className="act-rec__feed" data-testid="recommender-feed">
        {feed.map((entry) => (
          <li key={entry.item.id} className="act-rec__feed-item">
            <span aria-hidden="true">{entry.item.emoji}</span>
            <span className="act-rec__label">{entry.item.label}</span>
            {showWhy && (
              <button
                type="button"
                className="btn-ghost-outline act-rec__why"
                aria-expanded={openId === entry.item.id}
                aria-label={`Why ${entry.item.label}?`}
                onClick={() => openWhy(entry.item.id)}
              >
                Why?
              </button>
            )}
          </li>
        ))}
      </ul>
      {feed.length === 0 && <p className="act-hint">You rated everything. The feed is empty!</p>}
      {open && (
        <p className="act-rec__because" role="status" data-testid="recommender-because">
          💡 {whyText(open)}
        </p>
      )}

      {task?.bubble === true && rated > 0 && (
        <div className="act-rec__bubble" data-level={bubble.level} data-testid="recommender-bubble">
          <span className="act-rec__bubble-bar" aria-hidden="true">
            {Array.from({ length: bubble.total }, (_, i) => (
              <span
                key={i}
                className={`act-rec__bubble-dot${i < bubble.kinds ? ' act-rec__bubble-dot--on' : ''}`}
              />
            ))}
          </span>
          <span>{bubble.text}</span>
          {bubble.level !== 'open' && !readOnly && (
            <span className="act-hint"> {BUBBLE_NUDGE}</span>
          )}
        </div>
      )}
    </div>
  )
}

export default {
  StudentView: RecommenderStudentView,
  BuilderEditor: RecommenderBuilderEditor,
}
