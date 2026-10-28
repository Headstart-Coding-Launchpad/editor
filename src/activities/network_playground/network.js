// The pure maths for the Network Playground: seeded datasets, a tiny fully connected network
// (2 inputs x, y -> hidden layers of tanh neurons -> 1 sigmoid output), plain SGD, accuracy.
// Node-safe: no React, DOM or storage. Hand written on purpose; no machine-learning library.

export const DATASETS = ['two_blobs', 'circle', 'spiral']
export const LEARNING_RATE = 0.1
export const POINTS_PER_CLASS = 80

// Small seeded random number generator (mulberry32): same seed, same numbers, everywhere.
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

const clamp = (v) => Math.max(-1, Math.min(1, v))
const round3 = (v) => Math.round(v * 1000) / 1000

// A normal-ish random number (sum of 3 uniforms), mean 0, spread about 1.
const bell = (rng) => (rng() + rng() + rng() - 1.5) * 1.15

// The dots: [{ x, y, label }] with x, y in [-1, 1] and label 0 (blue) or 1 (orange).
// Always the same dots for the same name.
export function makeDataset(name) {
  const rng = makeRng(name === 'circle' ? 22 : name === 'spiral' ? 33 : 11)
  const dots = []
  for (let i = 0; i < POINTS_PER_CLASS; i += 1) {
    for (const label of [0, 1]) {
      let x
      let y
      if (name === 'circle') {
        // Orange inside, blue in a ring round it.
        const angle = rng() * Math.PI * 2
        const radius = label === 1 ? 0.5 * Math.sqrt(rng()) : 0.72 + 0.26 * rng()
        x = Math.cos(angle) * radius
        y = Math.sin(angle) * radius
      } else if (name === 'spiral') {
        // Two arms winding out from the middle.
        const t = (i + rng() * 0.8) / POINTS_PER_CLASS
        const angle = t * Math.PI * 2.2 + label * Math.PI
        const radius = 0.08 + 0.85 * t
        x = Math.cos(angle) * radius + bell(rng) * 0.04
        y = Math.sin(angle) * radius + bell(rng) * 0.04
      } else {
        // Two blobs, orange top right, blue bottom left.
        const centre = label === 1 ? 0.5 : -0.5
        x = centre + bell(rng) * 0.22
        y = centre + bell(rng) * 0.22
      }
      dots.push({ x: round3(clamp(x)), y: round3(clamp(y)), label })
    }
  }
  return dots
}

// ---- The network ----
// net = { sizes: [2, ...hidden, 1], W: [layer][neuron][input], b: [layer][neuron] }

export function netSizes(layers) {
  return [2, ...layers, 1]
}

export function initNet(layers, seed = 1) {
  const rng = makeRng(seed)
  const sizes = netSizes(layers)
  const W = []
  const b = []
  for (let l = 1; l < sizes.length; l += 1) {
    const limit = Math.sqrt(6 / (sizes[l - 1] + sizes[l]))
    W.push(
      Array.from({ length: sizes[l] }, () =>
        Array.from({ length: sizes[l - 1] }, () => (rng() * 2 - 1) * limit)
      )
    )
    b.push(Array.from({ length: sizes[l] }, () => 0))
  }
  return { sizes, W, b }
}

// How many numbers a net of these hidden layers holds.
export function weightCount(layers) {
  const sizes = netSizes(layers)
  let total = 0
  for (let l = 1; l < sizes.length; l += 1) total += sizes[l] * sizes[l - 1] + sizes[l]
  return total
}

// A short list of numbers (2 decimals) the tutor's screen can rebuild the net from.
export function flattenNet(net) {
  const flat = []
  net.W.forEach((layer, l) => {
    for (const row of layer) for (const w of row) flat.push(Math.round(w * 100) / 100)
    for (const bias of net.b[l]) flat.push(Math.round(bias * 100) / 100)
  })
  return flat
}

// The reverse of flattenNet; null when the list does not fit these layers.
export function netFromFlat(layers, flat) {
  if (!Array.isArray(flat) || flat.length !== weightCount(layers)) return null
  if (!flat.every((v) => typeof v === 'number' && Number.isFinite(v))) return null
  const sizes = netSizes(layers)
  const W = []
  const b = []
  let at = 0
  for (let l = 1; l < sizes.length; l += 1) {
    W.push(
      Array.from({ length: sizes[l] }, () => {
        const row = flat.slice(at, at + sizes[l - 1])
        at += sizes[l - 1]
        return row
      })
    )
    b.push(flat.slice(at, at + sizes[l]))
    at += sizes[l]
  }
  return { sizes, W, b }
}

const sigmoid = (v) => 1 / (1 + Math.exp(-v))

// All neurons' outputs, layer by layer (the first entry is the input).
function activations(net, x, y) {
  const acts = [[x, y]]
  const last = net.W.length - 1
  for (let l = 0; l <= last; l += 1) {
    const input = acts[l]
    const out = net.W[l].map((row, j) => {
      let sum = net.b[l][j]
      for (let i = 0; i < row.length; i += 1) sum += row[i] * input[i]
      return l === last ? sigmoid(sum) : Math.tanh(sum)
    })
    acts.push(out)
  }
  return acts
}

// The network's guess for a point: 0 (blue) to 1 (orange).
export function predict(net, x, y) {
  const acts = activations(net, x, y)
  return acts[acts.length - 1][0]
}

// One step of plain SGD on one dot (log loss; the output error is just guess minus answer).
export function trainOne(net, dot, rate = LEARNING_RATE) {
  const acts = activations(net, dot.x, dot.y)
  const layers = net.W.length
  let delta = [acts[layers][0] - dot.label]
  for (let l = layers - 1; l >= 0; l -= 1) {
    const input = acts[l]
    let next = null
    if (l > 0) {
      next = input.map((a, i) => {
        let sum = 0
        for (let j = 0; j < delta.length; j += 1) sum += net.W[l][j][i] * delta[j]
        return sum * (1 - a * a)
      })
    }
    for (let j = 0; j < delta.length; j += 1) {
      const row = net.W[l][j]
      for (let i = 0; i < row.length; i += 1) row[i] -= rate * delta[j] * input[i]
      net.b[l][j] -= rate * delta[j]
    }
    delta = next
  }
}

// One pass over every dot in a shuffled order. `rng` keeps the shuffle repeatable.
export function trainEpoch(net, dots, rng, rate = LEARNING_RATE) {
  const order = dots.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  for (const i of order) trainOne(net, dots[i], rate)
}

// The share of dots the net puts on the right side (0 to 1).
export function accuracy(net, dots) {
  if (!dots.length) return 0
  let right = 0
  for (const dot of dots) if (predict(net, dot.x, dot.y) >= 0.5 === (dot.label === 1)) right += 1
  return right / dots.length
}
