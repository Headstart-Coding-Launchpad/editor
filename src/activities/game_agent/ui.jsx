import { useEffect, useMemo, useRef, useState } from 'react'
import ActivityCorrect from '../ui/ActivityCorrect.jsx'
import GameAgentBuilderEditor from './GameAgentBuilderEditor.jsx'
import {
  REWARD_MAX,
  REWARD_MIN,
  MAX_SCORES,
  agentAfter,
  beginEpisode,
  cellsOfMoves,
  envOf,
  episodesOf,
  finishEpisode,
  gradeTask,
  greedyRun,
  hasPit,
  hintFor,
  normalizeGameAgentState,
  showLearningOf,
  stepEpisode,
  withGoResult,
  withRewards,
} from './game_agent.js'

// Game agent UI. Controlled view: ActivityHost passes `state`, `onChange(next | prev => next)`,
// `readOnly` (teacher views and review). Never write to Firebase or storage here.
//
// The student sets the rewards, presses Train (the robot practises on the grid, a few moves per
// animation frame so it can be watched, or a big batch per frame with Fast on) and then Go!.
// The learned table lives in a ref (rebuilt from rewards + episode count when it is missing);
// the shared state is small, and progress is committed on start, stop and at most every 2 s.

const SLOW_STEPS = 3 // moves per frame when watching
const FAST_STEPS = 1500 // moves per frame in Fast mode (the work per frame is capped)
const COMMIT_MS = 2000
const GO_STEP_MS = 220

const REWARD_LABELS = {
  treasure: ['Treasure', '💎'],
  step: ['Each step', '👣'],
  wall: ['Hit a wall', '🧱'],
  pit: ['Fall in a pit', '🕳️'],
}

function reducedMotion() {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

function Stepper({ name, value, onChange, disabled, readOnly }) {
  const [label, icon] = REWARD_LABELS[name]
  const set = (n) => onChange(Math.max(REWARD_MIN, Math.min(REWARD_MAX, n)))
  return (
    <div className="act-ga-stepper" data-testid={`ga-reward-${name}`}>
      <span className="act-ga-stepper__label">
        <span aria-hidden="true">{icon}</span> {label}
      </span>
      {!readOnly && (
        <button
          type="button"
          className="btn-ghost-outline act-btn"
          aria-label={`Less ${label}`}
          disabled={disabled || value <= REWARD_MIN}
          onClick={() => set(value - 1)}
        >
          -
        </button>
      )}
      <output className="act-ga-stepper__value" aria-label={`${label} reward`}>
        {value > 0 ? `+${value}` : value}
      </output>
      {!readOnly && (
        <button
          type="button"
          className="btn-ghost-outline act-btn"
          aria-label={`More ${label}`}
          disabled={disabled || value >= REWARD_MAX}
          onClick={() => set(value + 1)}
        >
          +
        </button>
      )}
    </div>
  )
}

function Curve({ scores }) {
  if (!scores.length) return null
  const lo = Math.min(...scores)
  const hi = Math.max(...scores)
  const span = hi - lo || 1
  return (
    <div
      className="act-ga-curve"
      role="img"
      aria-label={`Learning curve: the score of the last ${scores.length} tries, from ${lo} to ${hi}`}
      data-testid="ga-curve"
    >
      {scores.map((score, i) => (
        <span
          key={i}
          className="act-ga-curve__bar"
          style={{ height: `${10 + (90 * (score - lo)) / span}%` }}
          title={`Try ${i + 1}: ${score}`}
        />
      ))}
    </div>
  )
}

export function GameAgentStudentView({ task, state: stateProp, onChange, readOnly = false }) {
  const env = useMemo(() => envOf(task), [task])
  const state = normalizeGameAgentState(task, stateProp)
  // What is on the screen right now: { kind: 'train', trained, scores, pos } or
  // { kind: 'go', cells, upTo } or null.
  const [run, setRun] = useState(null)
  const [fast, setFast] = useState(false)
  const agentRef = useRef(null)
  const stopRef = useRef(false)
  const frameRef = useRef(null)
  const timerRef = useRef(null)
  const running = run != null
  const rewardsKey = JSON.stringify(state.rewards)

  // A slide change or closed tab mid-run stops the loop.
  useEffect(
    () => () => {
      stopRef.current = true
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      clearInterval(timerRef.current)
    },
    []
  )

  // A saved "training" flag with no loop behind it (a reload) is cleared.
  useEffect(() => {
    if (readOnly || run || !state.training || !onChange) return
    onChange((prev) => ({ ...normalizeGameAgentState(task, prev), training: false }))
  }, [readOnly, run, state.training, onChange, task])

  if (!env) return <p>This task has no usable map yet.</p>

  // The robot as the saved state describes it (replayed when this device has not built it yet).
  function getAgent() {
    const held = agentRef.current
    if (held && held.key === rewardsKey && held.agent.episodes === state.trained) return held.agent
    const agent = agentAfter(env, state.rewards, state.trained)
    agentRef.current = { key: rewardsKey, agent }
    return agent
  }

  function setReward(name, value) {
    if (readOnly || running) return
    onChange?.((prev) => {
      const p = normalizeGameAgentState(task, prev)
      return withRewards(task, p, { ...p.rewards, [name]: value })
    })
  }

  function forget() {
    if (readOnly || running) return
    agentRef.current = null
    onChange?.((prev) => withRewards(task, normalizeGameAgentState(task, prev), state.rewards))
  }

  function train() {
    if (readOnly || running || !onChange) return
    const agent = getAgent()
    const rewards = state.rewards
    const total = episodesOf(task)
    const scores = [...state.scores]
    const startTrained = state.trained
    let done = 0
    let ep = null
    let committed = startTrained
    let lastCommit = Date.now()
    stopRef.current = false
    setRun({ kind: 'train', trained: startTrained, scores, pos: env.start })

    const commit = (training) => {
      const trained = startTrained + done
      const snapshot = scores.slice(-MAX_SCORES)
      const before = committed
      committed = trained
      lastCommit = Date.now()
      onChange((prev) => {
        const p = normalizeGameAgentState(task, prev)
        // Rewards changed or the robot was reset from outside: this run is over.
        if (JSON.stringify(p.rewards) !== JSON.stringify(rewards) || p.trained !== before) {
          stopRef.current = true
          return p
        }
        return { ...p, trained, scores: snapshot, training }
      })
    }
    commit(true)

    const tick = () => {
      frameRef.current = null
      let budget = fast ? FAST_STEPS : SLOW_STEPS
      while (budget > 0 && done < total && !stopRef.current) {
        if (!ep) ep = beginEpisode(env)
        stepEpisode(env, rewards, agent, ep)
        budget -= 1
        if (ep.done) {
          scores.push(Math.round(finishEpisode(agent, ep)))
          done += 1
          ep = null
        }
      }
      agentRef.current = { key: JSON.stringify(rewards), agent }
      if (done >= total || stopRef.current) {
        commit(false)
        setRun(null)
        return
      }
      setRun({
        kind: 'train',
        trained: startTrained + done,
        scores: scores.slice(-MAX_SCORES),
        pos: ep ? ep.s : env.start,
      })
      if (Date.now() - lastCommit >= COMMIT_MS) commit(true)
      frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
  }

  function stop() {
    stopRef.current = true
  }

  function go() {
    if (readOnly || running || !onChange || state.trained === 0) return
    const result = greedyRun(env, state.rewards, getAgent())
    const finish = () => {
      onChange((prev) => withGoResult(normalizeGameAgentState(task, prev), result))
      setRun(null)
    }
    if (reducedMotion()) {
      finish()
      return
    }
    let upTo = 0
    setRun({ kind: 'go', cells: result.cells, upTo })
    timerRef.current = setInterval(() => {
      upTo += 1
      if (upTo >= result.cells.length - 1) {
        clearInterval(timerRef.current)
        setRun({ kind: 'go', cells: result.cells, upTo: result.cells.length - 1 })
        finish()
      } else {
        setRun({ kind: 'go', cells: result.cells, upTo })
      }
    }, GO_STEP_MS)
  }

  // What to draw: the robot, and the trail of the last Go!.
  const shown =
    run?.kind === 'train' ? { ...state, trained: run.trained, scores: run.scores } : state
  const savedCells = state.moves ? cellsOfMoves(env, state.moves) : []
  const trail = run?.kind === 'go' ? run.cells.slice(0, run.upTo + 1) : run ? [] : savedCells
  const robotAt =
    run?.kind === 'train'
      ? run.pos
      : run?.kind === 'go'
        ? run.cells[run.upTo]
        : savedCells.length
          ? savedCells[savedCells.length - 1]
          : env.start
  const trailSet = new Set(trail)
  const graded = gradeTask(task, state)
  const names = hasPit(env) ? ['treasure', 'step', 'wall', 'pit'] : ['treasure', 'step', 'wall']
  const lastGo = state.goes > 0 && !run

  return (
    <div className="act-panel" data-testid="game_agent-activity">
      <div
        className="act-ga-grid"
        style={{ gridTemplateColumns: `repeat(${env.cols}, 1fr)`, maxWidth: `${env.cols * 52}px` }}
        role="img"
        aria-label={`Grid ${env.cols} by ${env.rows}. The robot is at row ${Math.floor(robotAt / env.cols) + 1}, column ${(robotAt % env.cols) + 1}.`}
        data-testid="ga-grid"
      >
        {env.cells.map((kind, i) => {
          const isRobot = i === robotAt
          const cls = [
            'act-ga-cell',
            kind === 'wall' ? 'act-ga-cell--wall' : '',
            trailSet.has(i) && !isRobot && i !== env.treasure ? 'act-ga-cell--trail' : '',
          ]
          const face = isRobot
            ? '🤖'
            : i === env.treasure
              ? '💎'
              : kind === 'wall'
                ? '🧱'
                : kind === 'pit'
                  ? '🕳️'
                  : ''
          return (
            <span key={i} className={cls.join(' ').trim()} data-cell={i}>
              {face}
            </span>
          )
        })}
      </div>

      <div className="act-ga-rewards" aria-label="Rewards">
        {names.map((name) => (
          <Stepper
            key={name}
            name={name}
            value={state.rewards[name]}
            readOnly={readOnly}
            disabled={running}
            onChange={(v) => setReward(name, v)}
          />
        ))}
      </div>
      {!readOnly && (
        <p className="act-hint">
          Change a reward and the robot forgets everything and starts again.
        </p>
      )}

      {!readOnly && (
        <div className="act-row">
          {run?.kind === 'train' ? (
            <button type="button" className="btn-primary act-btn" onClick={stop}>
              Stop
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary act-btn"
              disabled={running}
              onClick={train}
            >
              Train ({episodesOf(task)} tries)
            </button>
          )}
          <button
            type="button"
            className="btn-primary act-btn"
            disabled={running || state.trained === 0}
            onClick={go}
          >
            Go!
          </button>
          <button
            type="button"
            className="btn-ghost-outline act-btn"
            aria-pressed={fast}
            onClick={() => setFast((f) => !f)}
          >
            Fast: {fast ? 'on' : 'off'}
          </button>
          <button
            type="button"
            className="btn-ghost-outline act-btn"
            disabled={running || state.trained === 0}
            onClick={forget}
          >
            Start again
          </button>
        </div>
      )}

      <p className="act-ga-stats" role="status" data-testid="ga-stats">
        Tries: <strong>{shown.trained}</strong>
        {state.training && readOnly ? ' (training now)' : ''}
        {' · '}Best score:{' '}
        <strong>
          {state.bestScore == null ? '-' : `${state.bestScore} (${state.bestSteps} steps)`}
        </strong>
      </p>
      {showLearningOf(task) && <Curve scores={shown.scores} />}

      {lastGo && (
        <p className="act-hint" data-testid="ga-result">
          {state.reached
            ? `Go! found the treasure in ${state.moves.length} steps. Score ${state.goScore}.`
            : `Go! missed the treasure. Score ${state.goScore}. ${hintFor(state)}`}
        </p>
      )}
      {!lastGo && !run && state.trained === 0 && !readOnly && (
        <p className="act-hint">Press Train and watch the robot practise.</p>
      )}
      {graded.passed && <ActivityCorrect>Your robot found the treasure</ActivityCorrect>}
    </div>
  )
}

export default {
  StudentView: GameAgentStudentView,
  BuilderEditor: GameAgentBuilderEditor,
}
