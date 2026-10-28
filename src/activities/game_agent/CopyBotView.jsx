import { useEffect, useMemo, useRef, useState } from 'react'
import ActivityLayout from '../ui/ActivityLayout.jsx'
import {
  ACTIONS,
  MAX_DRIVES,
  MAX_DRIVE_MOVES,
  coursesBeaten,
  hasNetworkPanel,
  normalizeGameAgentState,
  withCourseResult,
} from './game_agent.js'
import { courseFor, trainingCourseFor } from './courses.js'
import {
  FIT_STEPS,
  STEPS_PER_FRAME,
  coursesDriven,
  examplesOf,
  featuresAt,
  fitNet,
  fitSteps,
  forward,
  inputNames,
  movesDriven,
  netRun,
  newNet,
  replayDrive,
} from './copybot.js'

// The copy-bot screen (task field brain: copy). Controlled view like the rest of Game agent:
// ActivityHost passes `state`, `onChange(next | prev => next)` and `readOnly` (the tutor's view).
//
// The student drives the robot on a practice course with the arrow keys or the on-screen arrows;
// each move is saved in state.drives. Train fits the network on those moves, a few steps per
// animation frame (copybot.js). Watch it drive runs the network on the next unseen class course.
// The network lives in a ref and is rebuilt from the drives when this device has not built it.

const ARROWS = ['↑', '→', '↓', '←']
const ARROW_NAMES = ['up', 'right', 'down', 'left']
const KEY_MOVES = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }
const WATCH_STEP_MS = 260

function reducedMotion() {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

const typing = (el) =>
  !!el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)

// The network drawn as dots: inputs (the senses), hidden neurons, four outputs. A dot is lit as
// bright as the number it holds; the output it picks has a ring.
function NetworkPanel({ names, net, acts }) {
  const hidden = net.w1.length
  const colX = [40, 150, 260]
  const height = Math.max(names.length, hidden, 4) * 22 + 10
  const place = (n, i) => 14 + ((i + 0.5) * (height - 28)) / n
  const x = acts?.x ?? names.map(() => 0)
  const h = acts?.h ?? Array.from({ length: hidden }, () => 0)
  const out = acts?.out ?? [0, 0, 0, 0]
  const picked = acts ? acts.move : -1
  const lit = (v) => Math.min(1, Math.max(0.08, Math.abs(v)))
  return (
    <svg
      className="act-ga-net"
      viewBox={`0 0 340 ${height}`}
      role="img"
      aria-label={`The robot's network: ${names.length} inputs, ${hidden} hidden neurons and 4 outputs${
        picked >= 0 ? `. It picks ${ARROW_NAMES[picked]}.` : '.'
      }`}
      data-testid="ga-network"
    >
      {net.w1.map((row, j) =>
        row.map((w, i) => (
          <line
            key={`a${j}-${i}`}
            x1={colX[0]}
            y1={place(names.length, i)}
            x2={colX[1]}
            y2={place(hidden, j)}
            stroke="currentColor"
            strokeOpacity={net.steps ? Math.min(0.5, Math.abs(w) / 6) : 0.05}
            strokeWidth="1"
          />
        ))
      )}
      {net.w2.map((row, k) =>
        row.map((w, j) => (
          <line
            key={`b${k}-${j}`}
            x1={colX[1]}
            y1={place(hidden, j)}
            x2={colX[2]}
            y2={place(4, k)}
            stroke="currentColor"
            strokeOpacity={net.steps ? Math.min(0.5, Math.abs(w) / 6) : 0.05}
            strokeWidth="1"
          />
        ))
      )}
      {names.map((name, i) => (
        <g key={name}>
          <circle
            cx={colX[0]}
            cy={place(names.length, i)}
            r="7"
            fill="var(--colour-ink-strong, #333)"
            fillOpacity={lit(x[i])}
            stroke="currentColor"
          />
          <text x={colX[0] - 11} y={place(names.length, i) + 3} textAnchor="end" fontSize="9">
            {name}
          </text>
        </g>
      ))}
      {h.map((v, j) => (
        <circle
          key={j}
          cx={colX[1]}
          cy={place(hidden, j)}
          r="7"
          fill="var(--colour-ink-strong, #333)"
          fillOpacity={lit(v)}
          stroke="currentColor"
        />
      ))}
      {out.map((v, k) => (
        <g key={k}>
          <circle
            cx={colX[2]}
            cy={place(4, k)}
            r="8"
            fill="var(--colour-ink-strong, #333)"
            fillOpacity={lit(v)}
            stroke="currentColor"
            strokeWidth={picked === k ? 3 : 1}
          />
          <text x={colX[2] + 14} y={place(4, k) + 5} fontSize="14">
            {ARROWS[k]}
          </text>
        </g>
      ))}
    </svg>
  )
}

export default function CopyBotView({
  task,
  state: stateProp,
  onChange,
  readOnly = false,
  lessonId = null,
}) {
  const state = normalizeGameAgentState(task, stateProp)
  const names = useMemo(() => inputNames(state.senses), [state.senses])
  // What is happening now: null, { kind: 'fit', done } or { kind: 'watch', env, cells, acts, upTo }.
  const [run, setRun] = useState(null)
  // The last Watch it drive on the screen: { env, cells, acts } until the next driving or training.
  const [watched, setWatched] = useState(null)
  const netRef = useRef(null)
  const frameRef = useRef(null)
  const timerRef = useRef(null)
  const stopRef = useRef(false)
  const coursesRef = useRef(new Map())
  const running = run != null
  const sensesKey = state.senses.join(',')

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

  function trainingEnv(c) {
    const held = coursesRef.current
    if (!held.has(c)) held.set(c, trainingCourseFor(task, lessonId, c)?.env ?? null)
    return held.get(c)
  }

  const driveEnv = trainingEnv(state.driveCourse)
  const moved = movesDriven(state.drives)
  const shownOn = coursesDriven(state.drives)
  const drive = state.drives.find((d) => d.c === state.driveCourse)?.moves ?? ''
  const now = driveEnv ? replayDrive(driveEnv, state.rewards, drive) : null
  const roomLeft = moved < MAX_DRIVE_MOVES

  // The network as the saved state describes it (refitted when this device has not built it).
  function getNet() {
    const held = netRef.current
    if (held && held.key === `${sensesKey}|${state.trained}`) return held.net
    const examples = examplesOf(state.drives, trainingEnv, state.senses, state.trained)
    const net = examples.length
      ? fitNet(examples, examples[0].x.length)
      : newNet(inputNames(state.senses).length)
    netRef.current = { key: `${sensesKey}|${state.trained}`, net }
    return net
  }

  function drive1(a) {
    if (readOnly || running || !onChange || !driveEnv || !now || now.done) return
    if (!roomLeft) return
    setWatched(null)
    onChange((prev) => {
      const p = normalizeGameAgentState(task, prev)
      const at = p.drives.find((d) => d.c === p.driveCourse)
      const total = p.drives.reduce((n, d) => n + d.moves.length, 0)
      if (total >= MAX_DRIVE_MOVES) return p
      if (!at && p.drives.length >= MAX_DRIVES) return p
      const letter = ACTIONS[a].letter
      const drives = at
        ? p.drives.map((d) => (d === at ? { ...d, moves: d.moves + letter } : d))
        : [...p.drives, { c: p.driveCourse, moves: letter }]
      return { ...p, drives }
    })
  }

  // The arrow keys drive the robot (not while typing in a box).
  const driveRef = useRef(drive1)
  driveRef.current = drive1
  useEffect(() => {
    if (readOnly) return undefined
    const onKey = (e) => {
      const a = KEY_MOVES[e.key]
      if (a === undefined || e.altKey || e.ctrlKey || e.metaKey || typing(e.target)) return
      e.preventDefault()
      driveRef.current(a)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [readOnly])

  function nextCourse() {
    if (readOnly || running || !onChange) return
    setWatched(null)
    onChange((prev) => {
      const p = normalizeGameAgentState(task, prev)
      // Courses go in order; at the limit it stays on the last one.
      return p.drives.length >= MAX_DRIVES ? p : { ...p, driveCourse: p.driveCourse + 1 }
    })
  }

  function train() {
    if (readOnly || running || !onChange || moved === 0) return
    const examples = examplesOf(state.drives, trainingEnv, state.senses)
    if (!examples.length) return
    const net = newNet(examples[0].x.length)
    stopRef.current = false
    setWatched(null)
    setRun({ kind: 'fit', done: 0 })
    onChange((prev) => ({ ...normalizeGameAgentState(task, prev), training: true }))
    const tick = () => {
      frameRef.current = null
      if (stopRef.current) return
      fitSteps(net, examples, Math.min(STEPS_PER_FRAME, FIT_STEPS - net.steps))
      if (net.steps >= FIT_STEPS) {
        netRef.current = { key: `${sensesKey}|${examples.length}`, net }
        onChange((prev) => ({
          ...normalizeGameAgentState(task, prev),
          trained: examples.length,
          training: false,
        }))
        setRun(null)
        return
      }
      setRun({ kind: 'fit', done: net.steps })
      frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
  }

  function watch() {
    if (readOnly || running || !onChange || state.trained === 0) return
    const testEnv = courseFor(task, lessonId, state.tests)?.env
    if (!testEnv) return
    const result = netRun(testEnv, state.rewards, getNet(), state.senses)
    const finish = () => {
      onChange((prev) => withCourseResult(normalizeGameAgentState(task, prev), result))
      setWatched({ env: testEnv, cells: result.cells, acts: result.acts })
      setRun(null)
    }
    if (reducedMotion()) {
      finish()
      return
    }
    let upTo = 0
    const frame = () => ({
      kind: 'watch',
      env: testEnv,
      cells: result.cells,
      acts: result.acts,
      upTo,
    })
    setRun(frame())
    timerRef.current = setInterval(() => {
      upTo += 1
      if (upTo >= result.cells.length - 1) {
        clearInterval(timerRef.current)
        upTo = result.cells.length - 1
        setRun(frame())
        finish()
      } else {
        setRun(frame())
      }
    }, WATCH_STEP_MS)
  }

  // What to draw: the course being driven, or the new course the network is driving.
  const watching = run?.kind === 'watch' ? run : null
  const viewEnv = watching?.env ?? watched?.env ?? driveEnv
  if (!viewEnv) return <p>This task has no usable courses yet.</p>
  const trail = watching
    ? watching.cells.slice(0, watching.upTo + 1)
    : watched
      ? watched.cells
      : (now?.cells ?? [])
  const robotAt = trail[trail.length - 1] ?? viewEnv.start
  const trailSet = new Set(trail)
  const step = watching ? Math.min(watching.upTo, watching.acts.length - 1) : -1
  // What the network shows: the step it is on, or what it would say here once it has learned.
  let acts = null
  if (watching) acts = watching.acts[step] ?? null
  else if (watched) acts = watched.acts[watched.acts.length - 1] ?? null
  else if (state.trained > 0 && now && !now.done) {
    const x = featuresAt(driveEnv, robotAt, state.senses, now.taken)
    const f = forward(getNet(), x)
    acts = { x, h: f.h, out: f.out, move: f.out.indexOf(Math.max(...f.out)) }
  }

  const fresh = moved > state.trained
  const lastCourse = state.courses[state.courses.length - 1]
  const showResult = !run && (watched || (lastCourse && !fresh))

  let result = null
  if (showResult && lastCourse) {
    result = lastCourse.reached ? (
      <div className="act-result--good" data-testid="ga-test-result">
        <span aria-hidden="true">💎</span> It found the treasure on a new course (course{' '}
        {lastCourse.n})! Score {lastCourse.score}
        <br />
        <span data-testid="ga-like-you">It drove like you!</span> {coursesBeaten(state).text}.
      </div>
    ) : (
      <div className="act-result--bad" data-testid="ga-test-result">
        <span aria-hidden="true">😵</span> It got lost on a new course (course {lastCourse.n}).
        Score {lastCourse.score}
        <br />
        {coursesBeaten(state).text}.
      </div>
    )
  }

  let tip = null
  if (!readOnly) {
    if (run?.kind === 'fit') tip = 'The robot is learning from your moves.'
    else if (moved === 0) tip = 'Drive the robot to the treasure with the arrow keys or the arrows.'
    else if (now?.done && !watched) {
      tip = now.reached
        ? 'Press Next course to drive another, or Train.'
        : 'The robot will copy that pit too. Press Next course to try again.'
    } else if (state.trained === 0 || fresh) tip = 'Drive two or three courses, then press Train.'
    else if (lastCourse && !lastCourse.reached && watched) {
      tip = 'Drive more courses, then train it again.'
    } else if (!watched) tip = 'Press Watch it drive to see it on a course it has never seen.'
  }

  let action = null
  if (!readOnly) {
    const trainBtn = {
      label: state.trained > 0 ? 'Train again' : 'Train',
      icon: '🧠',
      onClick: train,
      disabled: running || moved === 0,
      testId: 'ga-train',
    }
    const watchBtn = {
      label: 'Watch it drive',
      icon: '👀',
      onClick: watch,
      disabled: running || state.trained === 0,
      testId: 'ga-watch',
    }
    const nextBtn = {
      label: 'Next course',
      icon: '➡️',
      onClick: nextCourse,
      disabled: running || drive.length === 0 || state.drives.length >= MAX_DRIVES,
      testId: 'ga-next-course',
    }
    action = { main: state.trained > 0 && !fresh ? watchBtn : trainBtn, secondary: nextBtn }
  }

  const status = (
    <p className="act-ga-stats" role="status" data-testid="ga-examples">
      {moved === 0
        ? 'You have not shown it any moves yet.'
        : `You've shown it ${moved} ${moved === 1 ? 'move' : 'moves'} on ${shownOn} ${
            shownOn === 1 ? 'course' : 'courses'
          }`}
      {state.training ? ' (learning now)' : ''}
      {!roomLeft ? ' That is enough: press Train.' : ''}
    </p>
  )

  const pad = readOnly ? null : (
    <div
      className="act-ga-pad"
      role="group"
      aria-label="Drive the robot"
      data-act-control="group"
      data-testid="ga-pad"
    >
      {ARROWS.map((arrow, a) => (
        <button
          key={a}
          type="button"
          className={`act-ga-pad__btn act-ga-pad__btn--${ARROW_NAMES[a]}`}
          aria-label={`Drive ${ARROW_NAMES[a]}`}
          disabled={running || !now || now.done || !roomLeft}
          onClick={() => drive1(a)}
          data-testid={`ga-drive-${ARROW_NAMES[a]}`}
        >
          {arrow}
        </button>
      ))}
    </div>
  )

  const stage = (
    <>
      <p className="act-ga-ribbon" data-testid="ga-course-label">
        {watching || watched ? (
          <>
            <span aria-hidden="true">🗺️</span> New course
          </>
        ) : (
          <>
            <span aria-hidden="true">🕹️</span> Practice course {state.driveCourse + 1}
          </>
        )}
      </p>
      <div
        className="act-ga-grid"
        style={{
          gridTemplateColumns: `repeat(${viewEnv.cols}, 1fr)`,
          maxWidth: `${viewEnv.cols * 80}px`,
        }}
        role="img"
        aria-label={`Grid ${viewEnv.cols} by ${viewEnv.rows}. The robot is at row ${Math.floor(robotAt / viewEnv.cols) + 1}, column ${(robotAt % viewEnv.cols) + 1}.`}
        data-testid="ga-grid"
      >
        {viewEnv.cells.map((kind, i) => {
          const isRobot = i === robotAt
          const cls = [
            'act-ga-cell',
            kind === 'wall' ? 'act-ga-cell--wall' : '',
            trailSet.has(i) && !isRobot && i !== viewEnv.treasure ? 'act-ga-cell--trail' : '',
          ]
          const face = isRobot
            ? '🤖'
            : i === viewEnv.treasure
              ? '💎'
              : kind === 'wall'
                ? '🧱'
                : kind === 'pit'
                  ? '🕳️'
                  : kind === 'coin' && !trailSet.has(i)
                    ? '🪙'
                    : ''
          return (
            <span key={i} className={cls.join(' ').trim()} data-cell={i}>
              {face}
            </span>
          )
        })}
      </div>
      {pad}
      {status}
    </>
  )

  const controls = hasNetworkPanel(task) ? (
    <section className="act-ga-card" aria-label="The robot's brain">
      <h3 className="act-ga-card__title">The robot's brain</h3>
      <NetworkPanel names={names} net={getNet()} acts={acts} />
    </section>
  ) : null

  return (
    <div className="act-panel act-ga" data-testid="game_agent-activity">
      <ActivityLayout stage={stage} result={result} action={action} tip={tip} controls={controls} />
    </div>
  )
}
