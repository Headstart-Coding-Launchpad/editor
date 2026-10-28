// The Mind Reader's brain: a tiny hand-written neural network (look-back one-hot inputs -> a
// small tanh hidden layer -> 3 softmax outputs) trained online with plain SGD, one example per
// round. Node-safe: no React, DOM or storage. Same seed and same moves always give the same
// network, so the tutor's view and a reload rebuild it by replaying the moves.

export const MOVES = ['✊', '✋', '✌']
export const MOVE_NAMES = ['rock', 'paper', 'scissors']
export const HIDDEN = 6
export const STEPS_PER_ROUND = 8
export const LEARNING_RATE = 0.5
export const MIN_LOOK_BACK = 1
export const MAX_LOOK_BACK = 5

// The move that beats move m (✋ beats ✊, ✌ beats ✋, ✊ beats ✌).
export const counterOf = (m) => (m + 1) % 3

// 'win' for the child, 'lose' for the child, or 'tie'.
export function resultOf(move, pick) {
  if (move === pick) return 'tie'
  return move === counterOf(pick) ? 'win' : 'lose'
}

// Small seeded random number generator (mulberry32).
export function makeRng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function initNet(lookBack, seed = 7) {
  const rng = makeRng(seed * 31 + lookBack)
  const inputs = lookBack * 3
  const w = () => (rng() - 0.5) * 1
  return {
    lookBack,
    w1: Array.from({ length: HIDDEN }, () => Array.from({ length: inputs }, w)),
    b1: Array.from({ length: HIDDEN }, () => 0),
    w2: Array.from({ length: 3 }, () => Array.from({ length: HIDDEN }, w)),
    b2: [0, 0, 0],
  }
}

// The network's inputs from the moves so far: slot 0 is the latest move, slot 1 the one before,
// and so on. A slot with no move yet stays all zero. Length lookBack * 3.
export function inputsFor(moves, lookBack) {
  const x = new Array(lookBack * 3).fill(0)
  for (let k = 0; k < lookBack; k += 1) {
    const m = moves[moves.length - 1 - k]
    if (m != null) x[k * 3 + m] = 1
  }
  return x
}

// Forward pass: { x, hidden, probs }. probs sums to 1.
export function forward(net, x) {
  const hidden = net.w1.map((row, j) => Math.tanh(row.reduce((s, w, i) => s + w * x[i], net.b1[j])))
  const raw = net.w2.map((row, k) => row.reduce((s, w, j) => s + w * hidden[j], net.b2[k]))
  const top = Math.max(...raw)
  const exps = raw.map((v) => Math.exp(v - top))
  const sum = exps.reduce((s, v) => s + v, 0)
  return { x, hidden, probs: exps.map((v) => v / sum) }
}

export const argmax = (list) => list.reduce((best, v, i) => (v > list[best] ? i : best), 0)

// What the network thinks the child plays next, and the move it plays to beat that.
export function readMind(net, moves) {
  const out = forward(net, inputsFor(moves, net.lookBack))
  const guess = argmax(out.probs)
  return { ...out, guess, pick: counterOf(guess) }
}

// One SGD pass on one example (cross-entropy), STEPS_PER_ROUND times.
export function train(net, x, target) {
  for (let step = 0; step < STEPS_PER_ROUND; step += 1) {
    const { hidden, probs } = forward(net, x)
    const dOut = probs.map((p, k) => p - (k === target ? 1 : 0))
    const dHidden = hidden.map(
      (h, j) => (1 - h * h) * dOut.reduce((s, d, k) => s + d * net.w2[k][j], 0)
    )
    for (let k = 0; k < 3; k += 1) {
      for (let j = 0; j < HIDDEN; j += 1) net.w2[k][j] -= LEARNING_RATE * dOut[k] * hidden[j]
      net.b2[k] -= LEARNING_RATE * dOut[k]
    }
    for (let j = 0; j < HIDDEN; j += 1) {
      for (let i = 0; i < x.length; i += 1) net.w1[j][i] -= LEARNING_RATE * dHidden[j] * x[i]
      net.b1[j] -= LEARNING_RATE * dHidden[j]
    }
  }
}

// Replay a game: a fresh network that has learned from `moves` (an array of 0..2), round by
// round. Returns the network and what it guessed before each move.
export function replay(moves, lookBack, seed) {
  const net = initNet(lookBack, seed)
  const guesses = []
  for (let r = 0; r < moves.length; r += 1) {
    const seen = moves.slice(0, r)
    guesses.push(readMind(net, seen).guess)
    train(net, inputsFor(seen, lookBack), moves[r])
  }
  return { net, guesses }
}
