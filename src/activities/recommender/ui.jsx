import { useMemo, useState } from 'react'
import { SpinTick } from '../ui/ActivityCorrect.jsx'
import ActivityLayout, { ActSegmented } from '../ui/ActivityLayout.jsx'
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

  const emptySlots = Math.max(0, FEED_SIZE - feed.length)
  const tip = rated === 0 ? 'Nothing rated yet, so this is what the class likes most.' : tutorLine

  const stage = (
    <div className="act-rec__stage">
      <h3 className="act-rec__heading">Your feed</h3>
      <ul className="act-rec__feed" data-testid="recommender-feed" data-act-control="group">
        {feed.map((entry) => (
          <li key={entry.item.id} className="act-rec__feed-item">
            <span className="act-rec__emoji" aria-hidden="true">
              {entry.item.emoji}
            </span>
            <span className="act-rec__label">{entry.item.label}</span>
            {showWhy && (
              <button
                type="button"
                className="act-btn--secondary act-rec__why"
                aria-expanded={openId === entry.item.id}
                aria-label={`Why ${entry.item.label}?`}
                onClick={() => openWhy(entry.item.id)}
              >
                Why?
              </button>
            )}
          </li>
        ))}
        {Array.from({ length: emptySlots }, (_, i) => (
          <li key={`empty-${i}`} className="act-rec__feed-empty" aria-hidden="true">
            (empty)
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

  const stageTop =
    goals.length > 1 ? (
      <>
        <span className="act-rec__aims">Feed aims for</span>
        <ActSegmented
          label="What should your feed aim for?"
          value={goal}
          disabled={readOnly}
          onChange={pickGoal}
          options={goals.map((g) => ({ value: g, label: GOAL_LABELS[g] }))}
        />
      </>
    ) : null

  const controls = (
    <section className="act-rec__rate-card">
      <div className="act-rec__rate-head">
        <p className="act-prompt">Do you like these? Tap 👍 or 👎.</p>
        <p className="act-rec__count" role="status" aria-live="polite">
          {rated >= need ? <SpinTick /> : '👍'} Rated {Math.min(rated, need)} of {need}
          {showWhy && rated >= need && !why ? ' · now tap Why? on your feed' : ''}
          {passed ? ' · done!' : ''}
        </p>
      </div>
      <ul className="act-rec__grid" data-act-control="group">
        {items.map((item) => {
          const value = ratings[item.id]
          return (
            <li
              key={item.id}
              className={`act-rec__item${value === 1 ? ' act-rec__item--liked' : ''}${value === -1 ? ' act-rec__item--disliked' : ''}`}
              data-testid={`recommender-item-${item.id}`}
            >
              <span className="act-rec__who">
                <span className="act-rec__emoji" aria-hidden="true">
                  {item.emoji}
                </span>
                <span className="act-rec__label">{item.label}</span>
              </span>
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
    </section>
  )

  return (
    <div className="act-panel act-rec" data-testid="recommender-activity">
      <ActivityLayout stageTop={stageTop} stage={stage} tip={tip} controls={controls} />
    </div>
  )
}

export default {
  StudentView: RecommenderStudentView,
  BuilderEditor: RecommenderBuilderEditor,
}
