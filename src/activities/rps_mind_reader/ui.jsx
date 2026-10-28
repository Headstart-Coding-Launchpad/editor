import { useEffect, useMemo, useState } from 'react'
import { SpinTick } from '../ui/ActivityCorrect.jsx'
import ActivityLayout, { ActSegmented } from '../ui/ActivityLayout.jsx'
import RpsMindReaderBuilderEditor from './RpsMindReaderBuilderEditor.jsx'
import { RoundFinished } from '../ui/RoundProgress.jsx'
import { HIDDEN, MAX_LOOK_BACK, MIN_LOOK_BACK, MOVES } from './mind.js'
import {
  LOSS_STREAK,
  WINDOW,
  brainOf,
  guessOfPick,
  initialGame,
  normalizeGame,
  panelsOf,
  playRound,
  setLookBack,
  statsOf,
} from './rps_mind_reader.js'

// Mind Reader UI. Controlled view: ActivityHost passes `state`, `onChange(next | prev => next)`,
// `readOnly` (the tutor's card, modal and review) and `device`. Never writes to Firebase or
// storage: useActivityState owns persistence and live sync.
//
// The Mind Reader LOCKS IN its pick before the child taps (a face-down card), and flips it after
// the tap. The network's outputs stay hidden until the tap too, since they would give the pick
// away. The brain is rebuilt from the saved moves (see rps_mind_reader.js), so a reload and the
// tutor's copy show the same network.

const REVEAL_MS = 1100
const PICK_LABELS = ['Rock', 'Paper', 'Scissors']
const BACK_LABELS = ['last', '2 back', '3 back', '4 back', '5 back']

const ROW = 34
const NET_W = 440

// The network as a diagram: one row of three circles per remembered move (lit for the move
// played), the hidden neurons (glow by how active), the three outputs. `outputs` is null while
// the Mind Reader's answer is still secret.
function BrainDiagram({ brain, lookBack, outputs }) {
  const top = 26
  const height = top + Math.max(lookBack * ROW, 6 * 30) + 10
  const inX = (m) => 70 + m * 30
  const inY = (k) => top + k * ROW + ROW / 2
  const hidX = 250
  const hidY = (j) => top + 6 + j * ((height - top - 18) / (HIDDEN - 1))
  const outX = 390
  const outY = (m) => top + 18 + m * ((height - top - 50) / 2)
  return (
    <svg
      className="act-mr__net"
      viewBox={`0 0 ${NET_W} ${height}`}
      role="img"
      aria-label="The Mind Reader's brain: your last moves go in on the left, six neurons in the middle, and its guess of your next move comes out on the right."
      data-testid="mr-brain"
    >
      {MOVES.map((emoji, m) => (
        <text key={m} x={inX(m)} y={16} textAnchor="middle" fontSize="15" aria-hidden="true">
          {emoji}
        </text>
      ))}
      <text x={hidX} y={16} textAnchor="middle" fontSize="12" fill="#475569">
        neurons
      </text>
      <text x={outX} y={16} textAnchor="middle" fontSize="12" fill="#475569">
        its guess
      </text>
      {/* wires from lit inputs to the neurons */}
      {brain.x.map((on, i) => {
        if (!on) return null
        const k = Math.floor(i / 3)
        const m = i % 3
        return Array.from({ length: HIDDEN }, (_, j) => (
          <line
            key={`${i}-${j}`}
            x1={inX(m)}
            y1={inY(k)}
            x2={hidX}
            y2={hidY(j)}
            stroke="#2563eb"
            strokeOpacity={Math.min(0.5, 0.08 + Math.abs(brain.net.w1[j][i]) * 0.35)}
            strokeWidth="1.5"
          />
        ))
      })}
      {outputs &&
        brain.hidden.map((h, j) =>
          [0, 1, 2].map((m) => (
            <line
              key={`o${j}-${m}`}
              x1={hidX}
              y1={hidY(j)}
              x2={outX}
              y2={outY(m)}
              stroke="#16a34a"
              strokeOpacity={Math.min(0.4, 0.04 + Math.abs(h * brain.net.w2[m][j]) * 0.3)}
              strokeWidth="1.5"
            />
          ))
        )}
      {Array.from({ length: lookBack }, (_, k) => (
        <g key={k}>
          <text x={4} y={inY(k) + 4} fontSize="11" fill="#475569">
            {BACK_LABELS[k]}
          </text>
          {[0, 1, 2].map((m) => (
            <circle
              key={m}
              cx={inX(m)}
              cy={inY(k)}
              r={11}
              data-testid={`mr-in-${k}-${m}`}
              data-lit={brain.x[k * 3 + m] ? 'true' : 'false'}
              fill={brain.x[k * 3 + m] ? '#2563eb' : '#fff'}
              stroke="#94a3b8"
              strokeWidth="1.5"
            />
          ))}
        </g>
      ))}
      {brain.hidden.map((h, j) => (
        <circle
          key={j}
          cx={hidX}
          cy={hidY(j)}
          r={12}
          data-testid={`mr-hidden-${j}`}
          fill="#f59e0b"
          fillOpacity={0.08 + Math.min(1, Math.abs(h)) * 0.92}
          stroke="#94a3b8"
          strokeWidth="1.5"
        />
      ))}
      {[0, 1, 2].map((m) => {
        const chosen = outputs && outputs.guess === m
        return (
          <g key={m}>
            <circle
              cx={outX}
              cy={outY(m)}
              r={18}
              data-testid={`mr-out-${m}`}
              data-lit={chosen ? 'true' : 'false'}
              fill={outputs ? '#16a34a' : '#fff'}
              fillOpacity={outputs ? (chosen ? 1 : 0.1 + outputs.probs[m] * 0.6) : 1}
              stroke={chosen ? '#166534' : '#94a3b8'}
              strokeWidth={chosen ? 3 : 1.5}
            />
            <text
              x={outX}
              y={outY(m) + 6}
              textAnchor="middle"
              fontSize="17"
              aria-hidden="true"
              opacity={outputs ? 1 : 0.45}
            >
              {MOVES[m]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// Its read-rate over the rounds so far: the share of the last 10 it read, after each round.
function ReadChart({ series, rounds }) {
  const W = 220
  const H = 70
  const x = (r) => 6 + (r / Math.max(1, rounds - 1)) * (W - 12)
  const y = (v) => H - 6 - v * (H - 12)
  const points = series.map((v, r) => `${x(r).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const last = series.length ? Math.round(series[series.length - 1] * 100) : 0
  return (
    <figure className="act-mr__chart" data-testid="mr-history">
      <figcaption>
        Its read-rate <strong>{series.length ? `${last}%` : '-'}</strong>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`How often it read you, over the last ${WINDOW} rounds, round by round. Now ${last} percent. Just guessing is 33 percent.`}
      >
        <line
          x1="6"
          x2={W - 6}
          y1={y(1 / 3)}
          y2={y(1 / 3)}
          stroke="#94a3b8"
          strokeDasharray="4 4"
        />
        <text x={W - 6} y={y(1 / 3) - 3} textAnchor="end" fontSize="9" fill="#64748b">
          guessing
        </text>
        {series.length > 1 && (
          <polyline points={points} fill="none" stroke="#7c3aed" strokeWidth="2.5" />
        )}
        {series.length === 1 && <circle cx={x(0)} cy={y(series[0])} r="3" fill="#7c3aed" />}
      </svg>
    </figure>
  )
}

function Card({ pick, faceUp, label }) {
  return (
    <div
      className={`act-mr__card${faceUp ? ' act-mr__card--up' : ''}`}
      data-testid="mr-card"
      data-face={faceUp ? 'up' : 'down'}
    >
      <div className="act-mr__card-face" aria-hidden={!faceUp}>
        {faceUp ? MOVES[pick] : '?'}
      </div>
      <span className="act-mr__card-label">{label}</span>
    </div>
  )
}

const verdict = { win: 'You win!', lose: 'It wins', tie: 'Draw' }

export function RpsMindReaderStudentView({ task, state, onChange, readOnly = false, teacher }) {
  const tutor = readOnly || !!teacher
  const game = useMemo(() => normalizeGame(task, state), [task, state])
  const stats = useMemo(() => statsOf(task, game), [task, game])
  const brain = useMemo(() => brainOf(game), [game])
  const panels = panelsOf(task)
  const [reveal, setReveal] = useState(null)

  useEffect(() => {
    if (!reveal) return undefined
    const timer = setTimeout(() => setReveal(null), REVEAL_MS)
    return () => clearTimeout(timer)
  }, [reveal])

  const revealing = !!reveal && !tutor
  const last = stats.played ? stats.played - 1 : null
  const lastPick = last == null ? null : stats.picks[last]
  const lastMove = last == null ? null : stats.moves[last]
  const lastOutcome = last == null ? null : stats.outcomes[last]

  function tap(move) {
    if (readOnly || revealing || stats.finished) return
    setReveal({ brain, move })
    onChange?.((prev) => playRound(task, normalizeGame(task, prev), move))
  }

  // The brain on show: what it saw just before the tap while the card flips, then the next
  // round's. A tutor always sees the locked-in answer; the child only after the tap.
  const shown = revealing ? reveal.brain : brain
  const outputs = revealing || tutor ? { guess: shown.guess, probs: shown.probs } : null
  const cardUp = revealing || tutor
  const cardPick = revealing ? lastPick : brain.pick

  let tip = null
  if (!tutor && !stats.finished) {
    tip =
      stats.lossStreak >= LOSS_STREAK
        ? 'Try playing randomly. A coin flip in your head beats it, because there is no pattern to find.'
        : stats.played === 0
          ? `It looks at your last ${game.lb} move${game.lb === 1 ? '' : 's'}. Can you be unpredictable?`
          : 'It learns from every round. Can you fool it?'
  }

  const buttons = stats.finished ? (
    <RoundFinished
      total={stats.rounds}
      readOnly={tutor}
      message={`All ${stats.rounds} rounds played! You ${stats.you} – ${stats.it} It. It read you ${Math.round(stats.accuracy * 100)}% of the time.`}
      onPlayAgain={() => onChange?.(initialGame({ ...task, lookBack: game.lb }))}
    />
  ) : (
    <div className="act-mr__moves" role="group" aria-label="Your move">
      {MOVES.map((emoji, m) => (
        <button
          key={m}
          type="button"
          className="act-mr__move"
          aria-label={PICK_LABELS[m]}
          data-testid={`mr-move-${m}`}
          disabled={readOnly || revealing}
          onClick={() => tap(m)}
        >
          <span className="act-mr__move-emoji" aria-hidden="true">
            {emoji}
          </span>
        </button>
      ))}
    </div>
  )

  const lastLine =
    last == null ? (
      <p className="act-mr__last">Pick a move. It has already chosen.</p>
    ) : (
      <p className="act-mr__last" data-testid="mr-last">
        It guessed {MOVES[guessOfPick(lastPick)]} → played {MOVES[lastPick]} · you played{' '}
        {MOVES[lastMove]} · <strong>{verdict[lastOutcome]}</strong>
      </p>
    )

  const stage = (
    <div className="act-mr__stage">
      {panels.includes('network') && (
        <BrainDiagram brain={shown} lookBack={game.lb} outputs={outputs} />
      )}
      <div className="act-mr__row">
        <Card
          pick={cardPick}
          faceUp={cardUp}
          label={
            revealing
              ? 'It had chosen'
              : tutor
                ? 'It has chosen (hidden from the student)'
                : 'It has chosen'
          }
        />
        {lastLine}
      </div>
    </div>
  )

  const result = (
    <div className="act-mr__score" data-testid="mr-score">
      <div className="act-mr__score-main">
        You {stats.you} – {stats.it} It
        {stats.played >= stats.passAt ? <SpinTick /> : null}
      </div>
      <div className="act-mr__score-sub">
        {stats.played
          ? `It read you ${stats.readRecent} of last ${stats.recentCount}`
          : 'Round 1 is about to start'}
        {' · '}Round {Math.min(stats.played + (stats.finished ? 0 : 1), stats.rounds)} of{' '}
        {stats.rounds}
      </div>
    </div>
  )

  const controls = (
    <>
      {panels.includes('lookback') && (
        <div className="act-mr__dial">
          <span className="act-mr__dial-label">Remembers</span>
          <ActSegmented
            label="Remembers how many of your moves"
            value={game.lb}
            disabled={readOnly}
            testId="mr-lookback"
            options={Array.from({ length: MAX_LOOK_BACK - MIN_LOOK_BACK + 1 }, (_, i) => ({
              value: MIN_LOOK_BACK + i,
              label: String(MIN_LOOK_BACK + i),
              ariaLabel: `Remembers ${MIN_LOOK_BACK + i} move${i ? 's' : ''}`,
            }))}
            onChange={(lb) =>
              onChange?.((prev) => setLookBack(task, normalizeGame(task, prev), lb))
            }
          />
        </div>
      )}
      {panels.includes('history') && <ReadChart series={stats.series} rounds={stats.rounds} />}
    </>
  )

  return (
    <div className="act-panel act-mr" data-testid="rps_mind_reader-activity">
      <ActivityLayout
        testId="mr-layout"
        stage={stage}
        result={result}
        resultPlacement="side"
        action={buttons}
        tip={tip}
        controls={controls}
      />
    </div>
  )
}

export default {
  StudentView: RpsMindReaderStudentView,
  BuilderEditor: RpsMindReaderBuilderEditor,
}
