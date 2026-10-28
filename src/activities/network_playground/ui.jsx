import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ActivityCorrect from '../ui/ActivityCorrect.jsx'
import NetworkPlaygroundBuilderEditor from './NetworkPlaygroundBuilderEditor.jsx'
import { accuracy, initNet, makeDataset, makeRng, predict, trainEpoch } from './network.js'
import {
  TRAIN_EVERY,
  MAX_HIDDEN_LAYERS,
  allowAddLayerOf,
  datasetOf,
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
// thicker for a bigger one.
function NetworkDiagram({ net, sizes }) {
  const width = 300
  const height = 170
  const cols = sizes.length
  const pos = sizes.map((count, c) =>
    Array.from({ length: count }, (_, i) => ({
      x: 28 + (c * (width - 56)) / (cols - 1),
      y: ((i + 1) * height) / (count + 1),
    }))
  )
  const lines = []
  if (net) {
    net.W.forEach((layer, l) =>
      layer.forEach((row, j) =>
        row.forEach((w, i) => {
          const from = pos[l][i]
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
  return (
    <svg
      className="act-net-diagram"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`The network: 2 inputs, ${sizes.slice(1, -1).join(' then ')} hidden neurons, 1 output`}
      data-testid="network-diagram"
    >
      {lines}
      {pos.map((col, c) =>
        col.map((p, i) => (
          <circle
            key={`${c}-${i}`}
            cx={p.x}
            cy={p.y}
            r={9}
            fill={c === 0 ? '#e2e8f0' : c === cols - 1 ? '#fde68a' : '#fff'}
            stroke="#475569"
            strokeWidth={1.5}
          />
        ))
      )}
      <text x={pos[0][0].x - 4} y={pos[0][0].y + 4} fontSize="10" fill="#334155">
        x
      </text>
      <text x={pos[0][1].x - 4} y={pos[0][1].y + 4} fontSize="10" fill="#334155">
        y
      </text>
    </svg>
  )
}

const keyOf = (s) => JSON.stringify([s?.layers ?? null, s?.w ?? null])
const newSeed = () => Math.floor(Math.random() * 2147483000) + 1

export function NetworkPlaygroundStudentView({ task, state, onChange, readOnly = false }) {
  const dots = useMemo(() => makeDataset(datasetOf(task)), [task])
  const target = targetOf(task)
  const maxNeurons = maxNeuronsOf(task)
  const shown = useMemo(() => normalizeNetworkState(task, state), [task, state])

  const canvasRef = useRef(null)
  const netRef = useRef(null)
  const rngRef = useRef(null)
  const runningRef = useRef(false)
  const rafRef = useRef(null)
  const statsRef = useRef({ acc: 0, epochs: 0, best: 0, maxLayers: 1, hold: 0, frames: 0 })
  const lastSyncRef = useRef(0)
  const lastKeyRef = useRef(keyOf(shown))
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const [layers, setLayers] = useState(shown.layers)
  const [running, setRunning] = useState(false)
  const [live, setLive] = useState({ acc: shown.acc, epochs: shown.epochs })
  const [note, setNote] = useState('')
  const [, setPaint] = useState(0)
  const layersRef = useRef(layers)
  layersRef.current = layers

  // The tutor sees the student's network from the state's numbers; the student's own is in a ref.
  const viewNet = readOnly ? netOfState(shown) : netRef.current
  const viewLayers = readOnly ? shown.layers : layers

  const buildNet = useCallback(
    (nextLayers, fromState) => {
      const fromNumbers = fromState ? netOfState(fromState) : null
      netRef.current = fromNumbers ?? initNet(nextLayers, newSeed())
      rngRef.current = makeRng(newSeed())
      statsRef.current = {
        acc: accuracy(netRef.current, dots),
        epochs: fromNumbers ? (fromState.epochs ?? 0) : 0,
        best: fromState?.best ?? 0,
        maxLayers: Math.max(fromState?.maxLayers ?? 0, nextLayers.length),
        hold: 0,
        frames: 0,
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
      ...stateFromNet(prev, layersRef.current, netRef.current, s.acc, s.epochs),
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
      setLive({ acc: statsRef.current.acc, epochs: statsRef.current.epochs })
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
    if (s.hold >= HOLD_FRAMES) return stop('It learned it!')
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
    setRunning(true)
    setNote('')
    commit(true)
    rafRef.current = requestAnimationFrame(frame)
  }

  // Changing the layers (or Start again) gives the network fresh random numbers.
  function rebuild(nextLayers) {
    if (readOnly) return
    runningRef.current = false
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    setRunning(false)
    setNote('')
    layersRef.current = nextLayers
    setLayers(nextLayers)
    const keep = { best: statsRef.current.best, maxLayers: statsRef.current.maxLayers }
    buildNet(nextLayers, null)
    statsRef.current.best = keep.best
    statsRef.current.maxLayers = Math.max(keep.maxLayers, nextLayers.length)
    setLive({ acc: statsRef.current.acc, epochs: 0 })
    redraw()
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
    buildNet(shown.layers, shown.w ? shown : null)
    setLive({ acc: statsRef.current.acc, epochs: statsRef.current.epochs })
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
  const passed = acc >= target
  const sizes = [2, ...viewLayers, 1]
  const canAdd = allowAddLayerOf(task) && viewLayers.length < MAX_HIDDEN_LAYERS

  return (
    <div className="act-panel act-net" data-testid="network_playground-activity">
      <div className="act-net__main">
        <canvas
          ref={canvasRef}
          className="act-net__field"
          width={SIZE}
          height={SIZE}
          role="img"
          aria-label={`Orange and blue dots with the network's guess behind them. ${percent(acc)} percent right.`}
          data-testid="network-field"
        />
        <p className="act-net__legend">
          <span style={{ color: ORANGE }}>●</span> orange <span style={{ color: BLUE }}>●</span>{' '}
          blue: the colour behind each dot is the network&apos;s guess
        </p>
      </div>

      <div className="act-net__side">
        <p className="act-net__stats" data-testid="network-stats">
          <strong>{percent(acc)}% right</strong> (aim for {percent(target)}%) · {viewLayers.length}{' '}
          hidden layer{viewLayers.length === 1 ? '' : 's'}
          {epochs > 0 && ` · ${epochs} rounds`}
          {readOnly && state?.training && ' · training now'}
        </p>

        <NetworkDiagram net={viewNet} sizes={sizes} />

        {!readOnly && (
          <>
            <div className="act-row">
              <button
                type="button"
                className="btn-primary act-btn"
                onClick={() => (running ? stop('Paused.') : train())}
              >
                {running ? '⏸ Pause' : epochs > 0 ? '▶ Train more' : '▶ Train'}
              </button>
              <button
                type="button"
                className="btn-secondary act-btn"
                onClick={() => rebuild(layers)}
              >
                🔄 Start again
              </button>
            </div>

            <div className="act-net__layers" role="group" aria-label="Layers">
              {layers.map((count, index) => (
                <div className="act-row" key={index}>
                  <span className="act-net__layer-name">Layer {index + 1}</span>
                  <button
                    type="button"
                    className="btn-secondary act-btn"
                    aria-label={`Fewer neurons in layer ${index + 1}`}
                    disabled={count <= 1}
                    onClick={() => changeNeurons(index, -1)}
                  >
                    −
                  </button>
                  <span className="act-net__count" aria-live="polite">
                    {count} neuron{count === 1 ? '' : 's'}
                  </span>
                  <button
                    type="button"
                    className="btn-secondary act-btn"
                    aria-label={`More neurons in layer ${index + 1}`}
                    disabled={count >= maxNeurons}
                    onClick={() => changeNeurons(index, 1)}
                  >
                    +
                  </button>
                </div>
              ))}
              <div className="act-row">
                {canAdd && (
                  <button
                    type="button"
                    className="btn-secondary act-btn"
                    onClick={() => rebuild([...layers, Math.min(3, maxNeurons)])}
                  >
                    ➕ Add a layer
                  </button>
                )}
                {allowAddLayerOf(task) && layers.length > 1 && (
                  <button
                    type="button"
                    className="btn-secondary act-btn"
                    onClick={() => rebuild(layers.slice(0, -1))}
                  >
                    ➖ Remove a layer
                  </button>
                )}
              </div>
            </div>
            <p className="act-hint" role="status" hidden={!note}>
              {note}
            </p>
          </>
        )}

        {passed && <ActivityCorrect>Your network reached {percent(target)}%</ActivityCorrect>}
      </div>
    </div>
  )
}

export default {
  StudentView: NetworkPlaygroundStudentView,
  BuilderEditor: NetworkPlaygroundBuilderEditor,
}
