import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SpinTick } from '../ui/ActivityCorrect.jsx'
import ActivityLayout, { ActStepper } from '../ui/ActivityLayout.jsx'
import NetworkPlaygroundBuilderEditor from './NetworkPlaygroundBuilderEditor.jsx'
import {
  accuracy,
  initNet,
  makeDataset,
  makeRng,
  makeTestDots,
  predict,
  trainEpoch,
} from './network.js'
import {
  TRAIN_EVERY,
  MAX_HIDDEN_LAYERS,
  allowAddLayerOf,
  allowInputsOf,
  allowZeroLayersOf,
  datasetOf,
  inputLabel,
  testDotsOf,
  maxNeuronsOf,
  netOfState,
  normalizeNetworkState,
  percent,
  stateFromNet,
  targetOf,
} from './network_playground.js'

// Network Playground UI. Controlled view: ActivityHost passes `state`, `onChange(next)`,
// `readOnly` (the tutor's card, modal and review) and `device`. Never writes to Firebase or
// storage: useActivityState owns persistence and live sync.
//
// The network lives in a ref and trains in requestAnimationFrame: one pass over the ~160 dots
// every TRAIN_EVERY frames (well under a millisecond each), slow enough that children can watch it
// learn (two blobs takes a few seconds, not a blink); the canvas and diagram redraw every few passes. The state is
// handed to `onChange` when training starts or stops, when the layers change, and at most every 2
// seconds while it trains (those are 'continuous' in definition.classifyChange). The tutor's
// read-only view rebuilds the same network from the state's numbers.

const SIZE = 300 // canvas pixels (CSS scales it)
const CELLS = 30 // heatmap cells per side
const REDRAW_EVERY = 2 // passes between redraws
const SYNC_EVERY_MS = 2000
const HOLD_FRAMES = 15 // frames at or above the target before it stops itself
const MAX_EPOCHS = 2000 // step cap
const ORANGE = '#f97316'
const BLUE = '#2563eb'

const toPx = (v, flip) => ((flip ? 1 - v : v + 1) / 2) * SIZE

// The dots over a coarse heatmap of what the network thinks (orange side, blue side).
function drawField(canvas, net, dots) {
  const ctx = canvas?.getContext?.('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, SIZE, SIZE)
  const cell = SIZE / CELLS
  for (let i = 0; i < CELLS; i += 1) {
    for (let j = 0; j < CELLS; j += 1) {
      const x = ((i + 0.5) / CELLS) * 2 - 1
      const y = 1 - ((j + 0.5) / CELLS) * 2
      if (net) {
        const p = predict(net, x, y)
        ctx.fillStyle = p >= 0.5 ? ORANGE : BLUE
        ctx.globalAlpha = 0.12 + 0.3 * Math.abs(p - 0.5) * 2
      } else {
        ctx.fillStyle = '#94a3b8'
        ctx.globalAlpha = 0.1
      }
      ctx.fillRect(i * cell, j * cell, cell + 0.5, cell + 0.5)
    }
  }
  ctx.globalAlpha = 1
  for (const dot of dots) {
    ctx.beginPath()
    ctx.arc(toPx(dot.x), toPx(dot.y, true), 4, 0, Math.PI * 2)
    ctx.fillStyle = dot.label === 1 ? ORANGE : BLUE
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = '#fff'
    ctx.stroke()
  }
}

// Neurons as circles, weights as lines: orange for a positive weight, blue for a negative one,
// thicker for a bigger one. With `slots` (the lesson's allowed inputs) the input column also
// shows the switched-off inputs as dashed, faded circles; `onToggle` makes every input circle a
// tap target (a switch), so the diagram is also the control surface for the inputs.
function NetworkDiagram({ net, sizes, inputs, slots = [], onToggle = null }) {
  const width = 300
  const slotIds = slots.length ? slots : inputs
  const height = slotIds.length > 3 ? 240 : 170
  const cols = sizes.length
  const pos = sizes.map((count, c) => {
    const n = c === 0 ? slotIds.length : count
    return Array.from({ length: n }, (_, i) => ({
      x: 28 + (c * (width - 56)) / (cols - 1),
      y: ((i + 1) * height) / (n + 1),
    }))
  })
  const inputPos = (i) => pos[0][Math.max(0, slotIds.indexOf(inputs[i]))]
  const lines = []
  if (net) {
    net.W.forEach((layer, l) =>
      layer.forEach((row, j) =>
        row.forEach((w, i) => {
          const from = l === 0 ? inputPos(i) : pos[l][i]
          const to = pos[l + 1][j]
          lines.push(
            <line
              key={`${l}-${j}-${i}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={w >= 0 ? ORANGE : BLUE}
              strokeWidth={Math.min(5, 0.4 + Math.abs(w) * 1.4)}
              strokeOpacity={0.75}
            />
          )
        })
      )
    )
  }
  const toggleable = !!onToggle && slots.length > 0
  return (
    <svg
      className="act-net-diagram"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`The network: inputs ${inputs.map(inputLabel).join(', ')}, ${
        sizes.length > 2
          ? `${sizes.slice(1, -1).join(' then ')} hidden neurons`
          : 'no hidden layers'
      }, 1 output`}
      data-testid="network-diagram"
    >
      {lines}
      {pos
        .slice(1)
        .map((col, c) =>
          col.map((p, i) => (
            <circle
              key={`${c + 1}-${i}`}
              cx={p.x}
              cy={p.y}
              r={9}
              fill={c + 1 === cols - 1 ? '#fde68a' : '#fff'}
              stroke="#475569"
              strokeWidth={1.5}
            />
          ))
        )}
      <g data-act-control={toggleable ? 'group' : undefined}>
        {pos[0].map((p, k) => {
          const id = slotIds[k]
          const active = inputs.includes(id)
          const circle = (
            <>
              {toggleable && <circle cx={p.x} cy={p.y} r={24} fill="transparent" />}
              <circle
                cx={p.x}
                cy={p.y}
                r={toggleable ? 13 : 9}
                fill={active ? '#e2e8f0' : '#fff'}
                stroke={active ? '#6222cc' : '#94a3b8'}
                strokeWidth={active ? 2.5 : 1.5}
                strokeDasharray={active ? undefined : '3 3'}
                opacity={active ? 1 : 0.7}
              />
              <text
                x={p.x}
                y={p.y + 4}
                fontSize={toggleable ? '11' : '9'}
                textAnchor="middle"
                fill="#334155"
              >
                {inputLabel(id)}
              </text>
            </>
          )
          if (!toggleable) return <g key={id}>{circle}</g>
          return (
            <g
              key={id}
              role="switch"
              aria-checked={active}
              aria-label={`Input ${inputLabel(id)}`}
              tabIndex={0}
              className="act-net-diagram__input"
              onClick={() => onToggle(id)}
              onKeyDown={(event) => {
                if (event.key === ' ' || event.key === 'Enter') {
                  event.preventDefault()
                  onToggle(id)
                }
              }}
            >
              {circle}
            </g>
          )
        })}
      </g>
    </svg>
  )
}

const keyOf = (s) =>
  JSON.stringify([s?.layers ?? null, s?.inputs ?? null, s?.test ?? null, s?.w ?? null])
const newSeed = () => Math.floor(Math.random() * 2147483000) + 1

export function NetworkPlaygroundStudentView({ task, state, onChange, readOnly = false }) {
  const dots = useMemo(() => makeDataset(datasetOf(task)), [task])
  const testDots = useMemo(() => (testDotsOf(task) ? makeTestDots(datasetOf(task)) : []), [task])
  const allowedInputs = allowInputsOf(task)
  const zeroOk = allowZeroLayersOf(task)
  const target = targetOf(task)
  const maxNeurons = maxNeuronsOf(task)
  const shown = useMemo(() => normalizeNetworkState(task, state), [task, state])

  const canvasRef = useRef(null)
  const netRef = useRef(null)
  const rngRef = useRef(null)
  const runningRef = useRef(false)
  const rafRef = useRef(null)
  const statsRef = useRef({
    acc: 0,
    epochs: 0,
    best: 0,
    maxLayers: 1,
    hold: 0,
    frames: 0,
    test: null,
  })
  const lastSyncRef = useRef(0)
  const lastKeyRef = useRef(keyOf(shown))
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const [layers, setLayers] = useState(shown.layers)
  const [inputs, setInputs] = useState(shown.inputs)
  const inputsRef = useRef(inputs)
  inputsRef.current = inputs
  const [running, setRunning] = useState(false)
  const [live, setLive] = useState({ acc: shown.acc, epochs: shown.epochs, test: shown.test })
  const [note, setNote] = useState('')
  const [, setPaint] = useState(0)
  const layersRef = useRef(layers)
  layersRef.current = layers

  // The tutor sees the student's network from the state's numbers; the student's own is in a ref.
  const viewNet = readOnly ? netOfState(shown) : netRef.current
  const viewLayers = readOnly ? shown.layers : layers
  const viewInputs = readOnly ? shown.inputs : inputs

  const buildNet = useCallback(
    (nextLayers, fromState, nextInputs = inputsRef.current) => {
      const fromNumbers = fromState ? netOfState(fromState) : null
      netRef.current = fromNumbers ?? initNet(nextLayers, newSeed(), nextInputs)
      rngRef.current = makeRng(newSeed())
      statsRef.current = {
        acc: accuracy(netRef.current, dots),
        epochs: fromNumbers ? (fromState.epochs ?? 0) : 0,
        best: fromState?.best ?? 0,
        maxLayers: Math.max(fromState?.maxLayers ?? 0, nextLayers.length),
        hold: 0,
        frames: 0,
        test: fromNumbers ? (fromState.test ?? null) : null,
      }
    },
    [dots]
  )

  // First render of the student's view: pick up where the saved state left off.
  if (!readOnly && netRef.current == null) buildNet(shown.layers, shown)

  const redraw = useCallback(() => {
    drawField(canvasRef.current, netRef.current, dots)
  }, [dots])

  const commit = useCallback((training) => {
    const s = statsRef.current
    const prev = { best: s.best, maxLayers: s.maxLayers }
    const next = {
      ...stateFromNet(prev, layersRef.current, netRef.current, s.acc, s.epochs, {
        inputs: inputsRef.current,
        test: s.test,
      }),
      training,
    }
    s.best = next.best
    lastKeyRef.current = keyOf(next)
    lastSyncRef.current = performance.now()
    onChangeRef.current?.(next)
  }, [])
  const stop = useCallback(
    (message = '') => {
      runningRef.current = false
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      setRunning(false)
      setNote(message)
      setLive({
        acc: statsRef.current.acc,
        epochs: statsRef.current.epochs,
        test: statsRef.current.test,
      })
      redraw()
      commit(false)
    },
    [commit, redraw]
  )

  const frame = useCallback(() => {
    rafRef.current = null
    if (!runningRef.current) return
    const s = statsRef.current
    s.tick = (s.tick ?? 0) + 1
    if (s.tick % TRAIN_EVERY !== 0) {
      rafRef.current = requestAnimationFrame(frame)
      return
    }
    trainEpoch(netRef.current, dots, rngRef.current)
    s.epochs += 1
    s.acc = accuracy(netRef.current, dots)
    s.best = Math.max(s.best, s.acc)
    s.hold = s.acc >= target ? s.hold + 1 : 0
    s.frames += 1
    // No note: the pass line below already says it reached the target.
    if (s.hold >= HOLD_FRAMES) return stop()
    if (s.epochs >= MAX_EPOCHS) {
      return stop('It got stuck. Try more neurons or another layer, then press Start again.')
    }
    if (s.frames % REDRAW_EVERY === 0) {
      redraw()
      setLive({ acc: s.acc, epochs: s.epochs })
      setPaint((n) => n + 1)
    }
    if (performance.now() - lastSyncRef.current >= SYNC_EVERY_MS) commit(true)
    rafRef.current = requestAnimationFrame(frame)
  }, [commit, dots, redraw, stop, target])

  function train() {
    if (readOnly || runningRef.current) return
    runningRef.current = true
    statsRef.current.hold = 0
    statsRef.current.test = null
    setLive((prev) => ({ ...prev, test: null }))
    setRunning(true)
    setNote('')
    commit(true)
    rafRef.current = requestAnimationFrame(frame)
  }

  // Changing the layers (or Start again) gives the network fresh random numbers.
  function rebuild(nextLayers, nextInputs = inputsRef.current) {
    if (readOnly) return
    runningRef.current = false
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    setRunning(false)
    setNote('')
    layersRef.current = nextLayers
    setLayers(nextLayers)
    inputsRef.current = nextInputs
    setInputs(nextInputs)
    const keep = { best: statsRef.current.best, maxLayers: statsRef.current.maxLayers }
    buildNet(nextLayers, null, nextInputs)
    statsRef.current.best = keep.best
    statsRef.current.maxLayers = Math.max(keep.maxLayers, nextLayers.length)
    setLive({ acc: statsRef.current.acc, epochs: 0, test: null })
    redraw()
    commit(false)
  }

  // Switching an input on or off rebuilds the network (fresh numbers), keeping at least one.
  function toggleInput(id) {
    const has = inputsRef.current.includes(id)
    if (has && inputsRef.current.length <= 1) return
    const next = allowedInputs.filter((x) => (x === id ? !has : inputsRef.current.includes(x)))
    rebuild(layers, next)
  }

  // Scores fresh dots from the same pattern. It does not change whether the task passes.
  function tryNewDots() {
    if (readOnly || runningRef.current || statsRef.current.epochs === 0) return
    statsRef.current.test = accuracy(netRef.current, testDots)
    setLive((prev) => ({ ...prev, test: statsRef.current.test }))
    commit(false)
  }

  const changeNeurons = (index, by) =>
    rebuild(layers.map((n, i) => (i === index ? Math.max(1, Math.min(maxNeurons, n + by)) : n)))

  // Draw once on mount, and again whenever the tutor's state changes.
  useEffect(() => {
    if (readOnly) drawField(canvasRef.current, netOfState(shown), dots)
    else redraw()
  }, [readOnly, shown, dots, redraw])

  // The student's state changed from outside (tutor reset, Start again): pick it up.
  useEffect(() => {
    if (readOnly || runningRef.current || keyOf(shown) === lastKeyRef.current) return
    lastKeyRef.current = keyOf(shown)
    layersRef.current = shown.layers
    setLayers(shown.layers)
    inputsRef.current = shown.inputs
    setInputs(shown.inputs)
    buildNet(shown.layers, shown.w ? shown : null, shown.inputs)
    setLive({
      acc: statsRef.current.acc,
      epochs: statsRef.current.epochs,
      test: statsRef.current.test,
    })
    redraw()
  }, [readOnly, shown, buildNet, redraw])

  // Leaving the task: stop the loop, and save what it learned.
  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      if (runningRef.current) {
        runningRef.current = false
        commit(false)
      }
    },
    [commit]
  )

  const acc = readOnly ? shown.acc : live.acc
  const epochs = readOnly ? shown.epochs : live.epochs
  const fresh = readOnly ? shown.test : live.test
  const passed = acc >= target
  const sizes = [viewInputs.length, ...viewLayers, 1]

  const startingLayers = Array.isArray(task?.layers) ? task.layers.length : 1
  const layerMin = zeroOk ? 0 : 1
  const layerMax = allowAddLayerOf(task)
    ? MAX_HIDDEN_LAYERS
    : Math.max(viewLayers.length, startingLayers)
  const showLayers = allowAddLayerOf(task) || zeroOk
  const hasTest = testDotsOf(task)
  const offerNewDots = hasTest && passed && !running
  const freshScored = fresh != null

  let action = null
  if (!readOnly) {
    const trainButton = {
      label: running ? 'Pause' : epochs > 0 ? 'Train more' : 'Train',
      icon: running ? '⏸' : '▶',
      onClick: () => (running ? stop('Paused.') : train()),
    }
    const newDots = { label: 'Try new dots', icon: '🎯', onClick: tryNewDots }
    action = {
      main: offerNewDots && !freshScored ? newDots : trainButton,
      secondary: offerNewDots ? (freshScored ? newDots : trainButton) : undefined,
      link: { label: 'Start again', icon: '↺', onClick: () => rebuild(layers) },
    }
  }

  const goalPct = Math.round(target * 100)
  const shownPct = epochs > 0 ? percent(acc) : 0
  const result = (
    <div className="act-net__score" data-testid="network-stats">
      <div className="act-net__score-main">
        <strong className={`act-net__big${passed && epochs > 0 ? ' act-net__big--pass' : ''}`}>
          {epochs > 0 ? `${shownPct}% right` : 'Not trained yet'}
          {passed && epochs > 0 ? (
            <>
              {' '}
              <SpinTick />
            </>
          ) : null}
        </strong>
        {hasTest && fresh != null && (
          <span className="act-net__new" data-testid="network-new-dots">
            On new dots: <strong>{percent(fresh)}%</strong>
          </span>
        )}
        {readOnly && state?.training && <span className="act-net__new">training now</span>}
      </div>
      <div
        className="act-net__goalbar"
        role="meter"
        aria-label="Score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={shownPct}
        aria-valuetext={`${shownPct}% right, goal ${goalPct}%`}
      >
        <span className="act-net__goalbar-fill" style={{ width: `${shownPct}%` }} />
        <span className="act-net__goalbar-mark" style={{ left: `${goalPct}%` }} />
      </div>
    </div>
  )

  const tip = readOnly
    ? null
    : note || (epochs === 0 ? 'Press Train and watch the colours change.' : null)

  const controls = (
    <section className="act-net__card">
      <h3 className="act-net__heading">Your network</h3>
      <NetworkDiagram
        net={viewNet}
        sizes={sizes}
        inputs={viewInputs}
        slots={allowedInputs}
        onToggle={readOnly || running ? null : toggleInput}
      />
      {allowedInputs.length > 0 && !readOnly && (
        <p className="act-net__legend">Dashed circles are inputs it could use. Tap to switch on.</p>
      )}
      {!readOnly && (
        <div className="act-net__steppers">
          {showLayers && (
            <div className="act-net__stepper">
              <span>Layers</span>
              <ActStepper
                name="Layers"
                value={layers.length}
                min={layerMin}
                max={layerMax}
                disabled={running}
                lessLabel="Fewer layers"
                moreLabel="More layers"
                onChange={(next) =>
                  next > layers.length
                    ? rebuild([...layers, Math.min(3, maxNeurons)])
                    : rebuild(layers.slice(0, next))
                }
              />
            </div>
          )}
          {layers.map((count, index) => (
            <div className="act-net__stepper" key={index}>
              <span>{layers.length > 1 ? `Neurons (layer ${index + 1})` : 'Neurons'}</span>
              <ActStepper
                name={`Neurons in layer ${index + 1}`}
                value={count}
                min={1}
                max={maxNeurons}
                disabled={running}
                lessLabel={`Fewer neurons in layer ${index + 1}`}
                moreLabel={`More neurons in layer ${index + 1}`}
                onChange={(next) => changeNeurons(index, next - count)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )

  return (
    <div className="act-panel act-net" data-testid="network_playground-activity">
      <ActivityLayout
        result={result}
        resultPlacement="top"
        stage={
          <>
            <canvas
              ref={canvasRef}
              className="act-net__field"
              width={SIZE}
              height={SIZE}
              role="img"
              aria-label={`Orange and blue dots with the network's guess behind them. ${epochs > 0 ? `${percent(acc)} percent right.` : 'Not trained yet.'}`}
              data-testid="network-field"
            />
            <p className="act-net__legend">
              <span style={{ color: ORANGE }}>●</span> orange <span style={{ color: BLUE }}>●</span>{' '}
              blue: the colour behind each dot is the network&apos;s guess
            </p>
          </>
        }
        action={action}
        tip={tip}
        controls={controls}
      />
    </div>
  )
}

export default {
  StudentView: NetworkPlaygroundStudentView,
  BuilderEditor: NetworkPlaygroundBuilderEditor,
}
