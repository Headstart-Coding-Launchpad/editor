// Pure logic for the Mind Reader activity: task fields, validation, the saved game, scoring and
// grading. Node-safe (no React, JSX or DOM) so the CLI, the Builder and print share it. The
// network itself is in ./mind.js.
import { MAX_LOOK_BACK, MIN_LOOK_BACK, readMind, replay, resultOf } from './mind.js'

export const DEFAULT_ROUNDS = 30
export const MIN_ROUNDS = 5
export const MAX_ROUNDS = 100
export const DEFAULT_LOOK_BACK = 3
export const PANELS = ['network', 'history', 'lookback']
export const DEFAULT_PANELS = ['network', 'history']
// "It read you N of the last 10".
export const WINDOW = 10
// Lost this many rounds in a row: show the "play randomly" tip.
export const LOSS_STREAK = 2

const isWhole = (v) => Number.isInteger(v)

export function roundsOf(task) {
  return isWhole(task?.rounds) && task.rounds >= MIN_ROUNDS && task.rounds <= MAX_ROUNDS
    ? task.rounds
    : DEFAULT_ROUNDS
}

export function lookBackOf(task) {
  return isWhole(task?.lookBack) && task.lookBack >= MIN_LOOK_BACK && task.lookBack <= MAX_LOOK_BACK
    ? task.lookBack
    : DEFAULT_LOOK_BACK
}

export function passAtOf(task) {
  const rounds = roundsOf(task)
  return isWhole(task?.passAt) && task.passAt >= 1 && task.passAt <= rounds ? task.passAt : rounds
}

export function panelsOf(task) {
  return Array.isArray(task?.panels)
    ? PANELS.filter((p) => task.panels.includes(p))
    : [...DEFAULT_PANELS]
}

export function validateRpsMindReaderTask(task, n) {
  const errors = []
  const where = `Task ${n}`
  if (
    task?.rounds != null &&
    !(isWhole(task.rounds) && task.rounds >= MIN_ROUNDS && task.rounds <= MAX_ROUNDS)
  ) {
    errors.push(`${where}: rounds must be a whole number from 5 to 100.`)
  }
  if (
    task?.lookBack != null &&
    !(isWhole(task.lookBack) && task.lookBack >= MIN_LOOK_BACK && task.lookBack <= MAX_LOOK_BACK)
  ) {
    errors.push(`${where}: lookBack must be a whole number from 1 to 5.`)
  }
  if (
    task?.panels != null &&
    !(Array.isArray(task.panels) && task.panels.every((p) => PANELS.includes(p)))
  ) {
    errors.push(`${where}: panels must only list network, history or lookback.`)
  }
  if (task?.passAt != null && !(isWhole(task.passAt) && task.passAt >= 1)) {
    errors.push(`${where}: passAt must be a whole number of 1 or more.`)
  } else if (task?.passAt != null && task.passAt > roundsOf(task)) {
    errors.push(`${where}: passAt cannot be more than rounds.`)
  }
  return errors
}

// ---- the saved game -------------------------------------------------------------------------
// State: { v: 1, lb, moves: '0120', picks: '1201' }. moves are the child's moves (0 rock,
// 1 paper, 2 scissors), picks what the Mind Reader played in each of those rounds. Both are digit
// strings, one char a round, so a 100-round game is about 250 bytes. The network is not saved:
// it is rebuilt by replaying the moves (deterministic), so the tutor's copy shows the same brain.

const digits = (s, max) => (typeof s === 'string' ? s.replace(/[^0-2]/g, '') : '').slice(0, max)

export function initialGame(task) {
  return { v: 1, lb: lookBackOf(task), moves: '', picks: '' }
}

export function normalizeGame(task, raw) {
  const base = initialGame(task)
  if (!raw || typeof raw !== 'object') return base
  const rounds = roundsOf(task)
  const moves = digits(raw.moves, rounds)
  const picks = digits(raw.picks, moves.length)
  // A round with a move but no pick (hand-edited state) is dropped.
  const played = Math.min(moves.length, picks.length)
  const lb =
    isWhole(raw.lb) && raw.lb >= MIN_LOOK_BACK && raw.lb <= MAX_LOOK_BACK ? raw.lb : base.lb
  return { v: 1, lb, moves: moves.slice(0, played), picks: picks.slice(0, played) }
}

const toList = (s) => Array.from(s, Number)

// The brain and its locked-in pick for the next round.
export function brainOf(game) {
  const moves = toList(game.moves)
  const { net } = replay(moves, game.lb)
  return { net, moves, ...readMind(net, moves) }
}

// The child taps a move: the Mind Reader's locked-in pick for this round is saved with it.
export function playRound(task, game, move) {
  const g = normalizeGame(task, game)
  if (g.moves.length >= roundsOf(task)) return g
  const { pick } = brainOf(g)
  return { ...g, moves: g.moves + move, picks: g.picks + pick }
}

// Change how far back it looks. The brain relearns from the moves so far; the score stays.
export function setLookBack(task, game, lb) {
  const g = normalizeGame(task, game)
  if (!(isWhole(lb) && lb >= MIN_LOOK_BACK && lb <= MAX_LOOK_BACK)) return g
  return { ...g, lb }
}

// What the Mind Reader guessed the child would play in a round (the move its pick beats).
export const guessOfPick = (pick) => (pick + 2) % 3

export function statsOf(task, state) {
  const g = normalizeGame(task, state)
  const moves = toList(g.moves)
  const picks = toList(g.picks)
  let you = 0
  let it = 0
  let ties = 0
  const reads = moves.map((m, r) => guessOfPick(picks[r]) === m)
  const outcomes = moves.map((m, r) => resultOf(m, picks[r]))
  for (const o of outcomes) {
    if (o === 'win') you += 1
    else if (o === 'lose') it += 1
    else ties += 1
  }
  const played = moves.length
  const recent = reads.slice(-WINDOW)
  const readRecent = recent.filter(Boolean).length
  // Its read-rate after each round, over the last WINDOW rounds so far (0 to 1).
  const series = reads.map((_, r) => {
    const win = reads.slice(Math.max(0, r + 1 - WINDOW), r + 1)
    return win.filter(Boolean).length / win.length
  })
  let streak = 0
  for (let r = outcomes.length - 1; r >= 0 && outcomes[r] === 'lose'; r -= 1) streak += 1
  return {
    played,
    rounds: roundsOf(task),
    passAt: passAtOf(task),
    you,
    it,
    ties,
    reads,
    outcomes,
    moves,
    picks,
    readRecent,
    recentCount: recent.length,
    readRate: recent.length ? readRecent / recent.length : 0,
    accuracy: played ? reads.filter(Boolean).length / played : 0,
    series,
    lossStreak: streak,
    finished: played >= roundsOf(task),
    lb: g.lb,
  }
}

// The teacher's "complete" game: a child who repeats rock, rock, paper for passAt rounds.
export function solutionFor(task) {
  let game = initialGame(task)
  const pattern = [0, 0, 1]
  for (let r = 0; r < passAtOf(task); r += 1) game = playRound(task, game, pattern[r % 3])
  return game
}

export function gradeTask(task, state) {
  const s = statsOf(task, state)
  return {
    passed: s.played >= s.passAt,
    played: s.played,
    passAt: s.passAt,
    hint: s.played >= s.passAt ? null : `Play ${s.passAt - s.played} more rounds.`,
  }
}
