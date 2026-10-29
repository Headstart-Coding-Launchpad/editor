import { useEffect, useMemo, useRef, useState } from 'react'
import ActivityLayout, { ActChip, ActSegmented, ActStepper } from '../ui/ActivityLayout.jsx'
import GameAgentBuilderEditor from './GameAgentBuilderEditor.jsx'
import {
  REWARD_MAX,
  REWARD_MIN,
  MAX_SCORES,
  SENSE_KEYS,
  agentAfter,
  beginEpisode,
  bestMoveOf,
  cellsOfMoves,
  describeSituation,
  envOf,
  finishEpisode,
  greedyRun,
  hasCoin,
  hasPit,
  hasUsefulSenses,
  hintFor,
  maxSensesOf,
  normalizeGameAgentState,
  sensesChoosable,
  showLearningOf,
  stateKey,
  stepEpisode,
  testMapFor,
  topSituations,
  withGoResult,
  withRewards,
  withSenses,
  withCourseResult,
  coursesBeaten,
  withTestResult,
  hasCourses,
  isCopyBrain,
  triesPerTrain,
} from './game_agent.js'
import { courseFor, trainingCourseFor } from './courses.js'
import CopyBotView from './CopyBotView.jsx'

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

// Up, right, down, left (the order of ACTIONS).
const ARROWS = ['↑', '→', '↓', '←']
const ARROW_NAMES = ['up', 'right', 'down', 'left']

const REWARD_LABELS = {
  treasure: ['Find the treasure', '💎'],
  step: ['Each step', '👣'],
  wall: ['Bump a wall', '🧱'],
  pit: ['Fall in a pit', '🕳️'],
  coin: ['Pick up a coin', '🪙'],
}

// Sense chips: the child sees one compass per lesson, always called "Treasure compass".
const SENSE_CHIP_LABELS = {
  position: ['Where I am', '📍'],
  walls: ['Walls next to me', '🧱'],
  treasure_direction: ['Treasure compass', '🧭'],
  treasure_direction_4: ['Treasure compass', '🧭'],
  pit_near: ['Pit next to me', '🕳️'],
  coin_direction: ['Coin compass', '🪙'],
}

const COMPASS_8 = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘']
const COMPASS_4 = ['→', '↑', '←', '↓']

// The arrow from one square towards another (null when they are the same square).
function arrowTo(env, from, to, ways) {
  if (to == null || to < 0 || from === to) return null
  const dr = Math.floor(to / env.cols) - Math.floor(from / env.cols)
  const dc = (to % env.cols) - (from % env.cols)
  const angle = Math.atan2(-dr, dc)
  const step = ways === 4 ? Math.PI / 2 : Math.PI / 4
  const n = ways === 4 ? 4 : 8
  const i = (((Math.round(angle / step) % n) + n) % n) | 0
  return (ways === 4 ? COMPASS_4 : COMPASS_8)[i]
}

// Which sides of a square are walls or the edge (up, right, down, left).
function blockedSides(env, pos) {
  const r = Math.floor(pos / env.cols)
  const c = pos % env.cols
  const open = (rr, cc) =>
    rr >= 0 && cc >= 0 && rr < env.rows && cc < env.cols && env.cells[rr * env.cols + cc] !== 'wall'
  return [!open(r - 1, c), !open(r, c + 1), !open(r + 1, c), !open(r, c - 1)]
}

function reducedMotion() {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

function RewardRow({ name, value, onChange, disabled, readOnly }) {
  const [label, icon] = REWARD_LABELS[name]
  const text = value > 0 ? `+${value}` : `${value}`
  return (
    <div className="act-ga-row" data-testid={`ga-reward-${name}`}>
      <span className="act-ga-row__label">
        <span aria-hidden="true">{icon}</span> {label}
      </span>
      {readOnly ? (
        <output className="act-ga-row__value" aria-label={`${label} reward`}>
          {text}
        </output>
      ) : (
        <ActStepper
          name={label}
          value={value}
          min={REWARD_MIN}
          max={REWARD_MAX}
          disabled={disabled}
          lessLabel={`Less: ${label}`}
          moreLabel={`More: ${label}`}
          valueText={text}
          onChange={(n) => onChange(Math.max(REWARD_MIN, Math.min(REWARD_MAX, n)))}
        />
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

export function GameAgentStudentView(props) {
  return isCopyBrain(props.task) ? <CopyBotView {...props} /> : <RewardBotView {...props} />
}

function RewardBotView({ task, state: stateProp, onChange, readOnly = false, lessonId = null }) {
  const env = useMemo(() => envOf(task), [task])
  const courseMode = hasCourses(task)
  const newThing = courseMode ? 'course' : 'map'
  const state = normalizeGameAgentState(task, stateProp)
  // What is on the screen right now: { kind: 'train', trained, scores, pos } or
  // { kind: 'go', cells, upTo } or null.
  const [run, setRun] = useState(null)
  const [fast, setFast] = useState(false)
  // The view switch on the map: 'map' | 'learned' | 'senses'.
  const [view, setView] = useState('map')
  // The mystery map on show: { env, cells } after "Try a new map" (until "Back to my map").
  const [mystery, setMystery] = useState(null)
  // What the last press of Watch it try / Try a new map did; null after training; undefined means
  // "work it out from the saved state" (a reload, or the tutor's view).
  const [lastLocal, setLastLocal] = useState(undefined)
  const agentRef = useRef(null)
  const coursesRef = useRef(new Map())
  const stopRef = useRef(false)
  const frameRef = useRef(null)
  const timerRef = useRef(null)
  const running = run != null
  const rewardsKey = JSON.stringify([state.rewards, state.senses])

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
  // With random courses every try runs on the next course of the training stream (never the
  // courses "Try a new course" uses).
  function trainingEnv(i) {
    const held = coursesRef.current
    if (!held.has(i)) held.set(i, trainingCourseFor(task, lessonId, i).env)
    return held.get(i)
  }

  function getAgent() {
    const held = agentRef.current
    if (held && held.key === rewardsKey && held.agent.episodes === state.trained) return held.agent
    const agent = agentAfter(
      env,
      state.rewards,
      state.trained,
      state.senses,
      courseMode ? trainingEnv : null
    )
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

  function toggleSense(sense) {
    if (readOnly || running) return
    agentRef.current = null
    onChange?.((prev) => {
      const p = normalizeGameAgentState(task, prev)
      const on = p.senses.includes(sense)
      if (on && p.senses.length === 1) return p // keep at least one
      if (!on && p.senses.length >= maxSensesOf(task)) return p
      const next = SENSE_KEYS.filter((k) => (k === sense ? !on : p.senses.includes(k)))
      return withSenses(task, p, next)
    })
  }

  function train() {
    if (readOnly || running || !onChange) return
    const agent = getAgent()
    const rewards = state.rewards
    const total = triesPerTrain(task)
    let epEnv = env
    const scores = [...state.scores]
    const startTrained = state.trained
    let done = 0
    let ep = null
    let committed = startTrained
    let lastCommit = Date.now()
    stopRef.current = false
    setMystery(null)
    setLastLocal(null)
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
        if (JSON.stringify([p.rewards, p.senses]) !== rewardsKey || p.trained !== before) {
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
        if (!ep) {
          epEnv = courseMode ? trainingEnv(agent.episodes) : env
          ep = beginEpisode(epEnv)
        }
        stepEpisode(epEnv, rewards, agent, ep)
        budget -= 1
        if (ep.done) {
          scores.push(Math.round(finishEpisode(agent, ep)))
          done += 1
          ep = null
        }
      }
      agentRef.current = { key: rewardsKey, agent }
      if (done >= total || stopRef.current) {
        commit(false)
        setRun(null)
        return
      }
      setRun({
        kind: 'train',
        trained: startTrained + done,
        scores: scores.slice(-MAX_SCORES),
        pos: ep ? ep.s : epEnv.start,
        env: courseMode ? epEnv : null,
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
      setLastLocal({ kind: 'go', reached: result.reached })
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

  // "Go on a new map": the trained robot, no training, on a sealed map it has never seen.
  function goNew() {
    // Random courses (same for the whole class with seed: class) or the sealed test maps.
    const testEnv = courseMode
      ? courseFor(task, lessonId, state.tests)?.env
      : testMapFor(task, state.tests)
    if (readOnly || running || !onChange || state.trained === 0 || !testEnv) return
    const result = greedyRun(testEnv, state.rewards, getAgent(), { unseen: true })
    onChange((prev) => {
      const p = normalizeGameAgentState(task, prev)
      return courseMode ? withCourseResult(p, result) : withTestResult(p, result)
    })
    setMystery({ env: testEnv, cells: result.cells })
    setLastLocal({ kind: 'test', reached: result.reached })
    setView('map')
  }

  // What to draw: the robot, and the trail of the last Watch it try.
  const shown =
    run?.kind === 'train' ? { ...state, trained: run.trained, scores: run.scores } : state
  const trained = state.trained > 0
  const showMystery = !!mystery && !run && trained
  const viewEnv = showMystery ? mystery.env : (run?.kind === 'train' && run.env) || env
  const savedCells = state.moves ? cellsOfMoves(env, state.moves) : []
  const trail = showMystery
    ? mystery.cells
    : run?.kind === 'go'
      ? run.cells.slice(0, run.upTo + 1)
      : run
        ? []
        : savedCells
  const robotAt = showMystery
    ? mystery.cells[mystery.cells.length - 1]
    : run?.kind === 'train'
      ? run.pos
      : run?.kind === 'go'
        ? run.cells[run.upTo]
        : savedCells.length
          ? savedCells[savedCells.length - 1]
          : env.start
  const trailSet = new Set(trail)
  const names = [
    'treasure',
    'step',
    'wall',
    ...(hasPit(env) ? ['pit'] : []),
    ...(hasCoin(env) ? ['coin'] : []),
  ]
  const hasTests = courseMode || !!testMapFor(task, 0)
  const choosable = sensesChoosable(task)
  const maxSenses = maxSensesOf(task)
  const activeView = trained && !showMystery && (view !== 'senses' || choosable) ? view : 'map'
  const showBest = activeView === 'learned'
  const eyeView = activeView === 'senses'
  const showList = showBest && !state.senses.includes('position')
  const seeing = describeSituation(stateKey(viewEnv, robotAt, state.senses, new Set()))
  // What it learned so far: while training, the live robot; otherwise the saved one (replayed).
  const learner = showBest ? (run?.kind === 'train' ? agentRef.current?.agent : getAgent()) : null
  const heard = showList && learner ? topSituations(learner, 5) : []

  // What the last Watch it try / Try a new map did (null while there is nothing to show).
  const derived =
    state.goes > 0
      ? { kind: 'go', reached: state.reached }
      : state.tests > 0
        ? { kind: 'test', reached: state.testReached }
        : null
  const last =
    run || (state.goes === 0 && state.tests === 0)
      ? null
      : lastLocal === undefined
        ? derived
        : lastLocal
  const lost = !!last && !last.reached
  // Only suggest senses it does not have yet.
  const suggestSenses = choosable && !hasUsefulSenses(state)
  const beatenLine = courseMode ? (
    <span data-testid="ga-beaten"> {coursesBeaten(state).text}.</span>
  ) : null

  let result = null
  if (last?.kind === 'go') {
    result = last.reached ? (
      <div className="act-result--good" data-testid="ga-result">
        <span aria-hidden="true">💎</span> Found it in {state.moves.length} steps! Score{' '}
        {state.goScore}
      </div>
    ) : (
      <div className="act-result--bad" data-testid="ga-result">
        <span aria-hidden="true">😵</span> Lost! It did not find the treasure. Score {state.goScore}
      </div>
    )
  } else if (last?.kind === 'test') {
    result = last.reached ? (
      <div className="act-result--good" data-testid="ga-test-result">
        <span aria-hidden="true">💎</span> Found it on the new {newThing}
        {courseMode ? ` (course ${state.tests})` : ''} in {state.testSteps} steps! Score{' '}
        {state.testScore}
        {beatenLine}
      </div>
    ) : (
      <div className="act-result--bad" data-testid="ga-test-result">
        <span aria-hidden="true">😵</span> Lost on the new {newThing}
        {courseMode ? ` (course ${state.tests})` : ''}!
        {suggestSenses ? ' Try giving it senses.' : ''} Score {state.testScore}
        {beatenLine}
      </div>
    )
  }

  // One tip line (the child's screen only).
  let tip = null
  if (!readOnly) {
    if (run?.kind === 'train') tip = 'The robot is practising. Press Pause to stop.'
    else if (!trained) tip = 'Press Train and watch the robot practise.'
    else if (!last) tip = 'Press Watch it try to see where the robot goes.'
    else if (lost && !(last.kind === 'test' && suggestSenses))
      tip = hintFor(state, task).replace(/Go!/g, 'Watch it try')
  }

  // The one main button moves along: Train, Pause, Watch it try, Try a new map. When the robot
  // got lost, Train more takes over as the main button.
  let action = null
  if (!readOnly) {
    const busy = running
    const trainBtn = {
      label: 'Train',
      icon: '▶',
      onClick: train,
      disabled: busy,
      testId: 'ga-train',
    }
    const moreBtn = {
      label: 'Train more',
      icon: '▶',
      onClick: train,
      disabled: busy,
      testId: 'ga-train-more',
    }
    const watchBtn = {
      label: 'Watch it try',
      icon: '👀',
      onClick: go,
      disabled: busy || !trained,
      testId: 'ga-watch',
    }
    const newMapBtn = {
      label: courseMode ? 'Try a new course' : 'Try a new map',
      icon: '🗺️',
      onClick: goNew,
      disabled: busy || !trained,
      testId: 'ga-go-new',
    }
    if (run?.kind === 'train') {
      action = { main: { label: 'Pause', icon: '⏸', onClick: stop, testId: 'ga-pause' } }
    } else if (!trained) {
      action = { main: trainBtn }
    } else if (!last) {
      action = { main: watchBtn, secondary: moreBtn }
    } else if (lost) {
      action = { main: moreBtn, secondary: last.kind === 'test' ? newMapBtn : watchBtn }
    } else {
      action = { main: hasTests ? newMapBtn : watchBtn, secondary: moreBtn }
    }
    if (showMystery) {
      action = {
        ...action,
        link: { label: 'Back to my map', onClick: () => setMystery(null), testId: 'ga-back' },
      }
    }
  }

  // Sense drawings on the robot's square ("What it senses" view).
  const compassWays = state.senses.includes('treasure_direction_4')
    ? 4
    : state.senses.includes('treasure_direction')
      ? 8
      : 0
  function senseMarks() {
    const marks = []
    if (compassWays) {
      const a = arrowTo(viewEnv, robotAt, viewEnv.treasure, compassWays)
      if (a) marks.push(`💎${a}`)
    }
    if (state.senses.includes('coin_direction')) {
      let best = null
      let bestDist = Infinity
      for (const coin of viewEnv.coins ?? []) {
        if (trailSet.has(coin)) continue
        const d =
          Math.abs(Math.floor(coin / viewEnv.cols) - Math.floor(robotAt / viewEnv.cols)) +
          Math.abs((coin % viewEnv.cols) - (robotAt % viewEnv.cols))
        if (d < bestDist) {
          bestDist = d
          best = coin
        }
      }
      const a = best == null ? null : arrowTo(viewEnv, robotAt, best, 8)
      if (a) marks.push(`🪙${a}`)
    }
    if (state.senses.includes('pit_near')) {
      const r = Math.floor(robotAt / viewEnv.cols)
      const c = robotAt % viewEnv.cols
      const near = [
        [r - 1, c],
        [r, c + 1],
        [r + 1, c],
        [r, c - 1],
      ].some(
        ([rr, cc]) =>
          rr >= 0 &&
          cc >= 0 &&
          rr < viewEnv.rows &&
          cc < viewEnv.cols &&
          viewEnv.cells[rr * viewEnv.cols + cc] === 'pit'
      )
      if (near) marks.push('🕳️!')
    }
    return marks
  }
  const edges =
    eyeView && state.senses.includes('walls')
      ? blockedSides(viewEnv, robotAt)
      : [false, false, false, false]
  const marks = eyeView ? senseMarks() : []

  const stageTop = readOnly ? null : (
    <>
      {trained && !showMystery && (
        <ActSegmented
          label="View"
          testId="ga-view"
          value={activeView}
          onChange={setView}
          options={[
            { value: 'map', label: 'Map' },
            { value: 'learned', label: 'What it learned' },
            ...(choosable ? [{ value: 'senses', label: 'What it senses' }] : []),
          ]}
        />
      )}
      <div className="act-ga-speed">
        <ActSegmented
          label="Speed"
          testId="ga-speed"
          value={fast ? 'fast' : 'slow'}
          onChange={(v) => setFast(v === 'fast')}
          options={[
            {
              value: 'slow',
              label: (
                <>
                  <span aria-hidden="true">🐢</span> Slow
                </>
              ),
              ariaLabel: 'Slow',
            },
            {
              value: 'fast',
              label: (
                <>
                  <span aria-hidden="true">⚡</span> Fast
                </>
              ),
              ariaLabel: 'Fast',
            },
          ]}
        />
      </div>
    </>
  )

  const stage = (
    <>
      {showMystery && (
        <p className="act-ga-ribbon" data-testid="ga-mystery">
          <span aria-hidden="true">🗺️</span> Mystery map
        </p>
      )}
      <div
        className="act-ga-grid"
        style={{
          gridTemplateColumns: `repeat(${viewEnv.cols}, 1fr)`,
          maxWidth: `${viewEnv.cols * 80}px`,
        }}
        role={showBest ? 'group' : 'img'}
        aria-label={`Grid ${viewEnv.cols} by ${viewEnv.rows}. The robot is at row ${Math.floor(robotAt / viewEnv.cols) + 1}, column ${(robotAt % viewEnv.cols) + 1}.`}
        data-testid="ga-grid"
      >
        {viewEnv.cells.map((kind, i) => {
          const isRobot = i === robotAt
          const cls = [
            'act-ga-cell',
            kind === 'wall' ? 'act-ga-cell--wall' : '',
            eyeView && !isRobot ? 'act-ga-cell--dark' : '',
            trailSet.has(i) && !isRobot && i !== viewEnv.treasure ? 'act-ga-cell--trail' : '',
          ]
          const onTreasure = isRobot && i === viewEnv.treasure
          const face = isRobot
            ? '🤖'
            : eyeView
              ? ''
              : i === viewEnv.treasure
                ? '💎'
                : kind === 'wall'
                  ? '🧱'
                  : kind === 'pit'
                    ? '🕳️'
                    : kind === 'coin' && !trailSet.has(i)
                      ? '🪙'
                      : ''
          const best =
            learner &&
            !showMystery &&
            state.senses.includes('position') &&
            kind !== 'wall' &&
            i !== viewEnv.treasure
              ? bestMoveOf(learner, i)
              : -1
          return (
            <span key={i} className={cls.join(' ').trim()} data-cell={i}>
              {face}
              {onTreasure && (
                <span
                  className="act-ga-cell__gem"
                  role="img"
                  aria-label="treasure"
                  data-testid="ga-gem"
                >
                  💎
                </span>
              )}
              {best >= 0 && (
                <span
                  className="act-ga-cell__best"
                  role="img"
                  aria-label={`best move: ${ARROW_NAMES[best]}`}
                >
                  {ARROWS[best]}
                </span>
              )}
              {isRobot &&
                eyeView &&
                edges.map((on, side) =>
                  on ? (
                    <span
                      key={side}
                      className={`act-ga-edge act-ga-edge--${ARROW_NAMES[side]}`}
                      aria-hidden="true"
                    />
                  ) : null
                )}
              {isRobot && eyeView && marks.length > 0 && (
                <span className="act-ga-cell__marks">{marks.join(' ')}</span>
              )}
            </span>
          )
        })}
      </div>

      {eyeView && (
        <p className="act-hint" role="status" data-testid="ga-eye">
          The robot sees: {seeing || 'nothing'}.
        </p>
      )}
      {heard.length > 0 && (
        <ul className="act-ga-learned" data-testid="ga-learned">
          {heard.map((row) => (
            <li key={row.key}>
              When it sees {describeSituation(row.key)}, it goes{' '}
              <strong>{ARROW_NAMES[row.move]}</strong> {ARROWS[row.move]}
            </li>
          ))}
        </ul>
      )}
      {showList && heard.length === 0 && trained && (
        <p className="act-hint">It has no favourite moves yet.</p>
      )}
    </>
  )

  const controls = (
    <>
      <section className="act-ga-card" aria-label="Rewards">
        <h3 className="act-ga-card__title">What does it get points for?</h3>
        <div className="act-ga-rewards">
          {names.map((name) => (
            <RewardRow
              key={name}
              name={name}
              value={state.rewards[name]}
              readOnly={readOnly}
              disabled={running}
              onChange={(v) => setReward(name, v)}
            />
          ))}
        </div>
        {!readOnly && <p className="act-ga-note">Changing anything makes it forget.</p>}
      </section>
      {readOnly && (
        <p className="act-ga-stats" role="status" data-testid="ga-stats">
          Tries: <strong>{shown.trained}</strong>
          {state.training ? ' (training now)' : ''}
          {' · '}Best score:{' '}
          <strong>
            {state.bestScore == null ? '-' : `${state.bestScore} (${state.bestSteps} steps)`}
          </strong>
        </p>
      )}
      {showLearningOf(task) && shown.scores.length > 0 && (
        <section className="act-ga-card" aria-label="Score each try">
          <div className="act-ga-card__head">
            <h3 className="act-ga-card__title">Score each try</h3>
            {state.bestScore != null && (
              <span className="act-ga-note" data-testid="ga-best">
                best {state.bestScore}
              </span>
            )}
          </div>
          <Curve scores={shown.scores} />
          <p className="act-ga-note">Taller bar = better try</p>
        </section>
      )}
    </>
  )

  const compassKey =
    state.senses.includes('treasure_direction_4') ||
    (task?.senses?.includes?.('treasure_direction_4') &&
      !task.senses.includes('treasure_direction'))
      ? 'treasure_direction_4'
      : 'treasure_direction'
  const chipKeys = [
    'position',
    'walls',
    compassKey,
    ...(hasPit(env) || state.senses.includes('pit_near') ? ['pit_near'] : []),
    ...(hasCoin(env) || state.senses.includes('coin_direction') ? ['coin_direction'] : []),
  ]
  const senseFold = {
    id: 'senses',
    title: 'What can it sense?',
    summary: state.senses
      .map((k) => `${SENSE_CHIP_LABELS[k][1]} ${SENSE_CHIP_LABELS[k][0]}`)
      .join(', '),
    revealed: choosable && !readOnly,
    children: (
      <>
        <p className="act-ga-note">Pick up to {maxSenses}. Changing one makes it forget.</p>
        <div className="act-ga-chips" role="group" aria-label="Senses" data-act-control="group">
          {chipKeys.map((sense) => {
            const on = state.senses.includes(sense)
            const [label, icon] = SENSE_CHIP_LABELS[sense]
            return (
              <ActChip
                key={sense}
                pressed={on}
                disabled={readOnly || running || (!on && state.senses.length >= maxSenses)}
                onClick={() => toggleSense(sense)}
                data-testid={`ga-sense-${sense}`}
              >
                <span aria-hidden="true">{icon}</span> {label}
              </ActChip>
            )
          })}
        </div>
      </>
    ),
  }

  return (
    <div className="act-panel act-ga" data-testid="game_agent-activity">
      <ActivityLayout
        stageTop={stageTop}
        stage={stage}
        result={result}
        action={action}
        tip={tip}
        controls={controls}
        folds={[senseFold]}
      />
    </div>
  )
}

export default {
  StudentView: GameAgentStudentView,
  BuilderEditor: GameAgentBuilderEditor,
}
