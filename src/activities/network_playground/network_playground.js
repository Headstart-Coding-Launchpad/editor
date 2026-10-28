// Pure logic for the Network Playground activity: task fields, validation, the saved state,
// grading and hints. Node-safe (no React, JSX or DOM) so the CLI, the Builder and print share it.
// The maths (dots, network, training) is in ./network.js.
import {
  DATASETS,
  DEFAULT_INPUTS,
  INPUT_IDS,
  INPUT_LABELS,
  flattenNet,
  netFromFlat,
  weightCount,
} from './network.js'

export const DEFAULT_TARGET = 0.9
// Animation frames between training passes (about 10 passes a second), so children can watch it
// learn instead of it finishing in a blink.
export const TRAIN_EVERY = 6
export const DEFAULT_MAX_NEURONS = 6
export const MAX_NEURONS_LIMIT = 8
export const MAX_HIDDEN_LAYERS = 2
export const DEFAULT_LAYERS = [3]
export const DATASET_LABELS = {
  two_blobs: 'Two blobs',
  circle: 'Circle',
  spiral: 'Spiral',
}

const isWhole = (v) => Number.isInteger(v)

export function maxNeuronsOf(task) {
  return isWhole(task?.maxNeurons) && task.maxNeurons >= 1 && task.maxNeurons <= MAX_NEURONS_LIMIT
    ? task.maxNeurons
    : DEFAULT_MAX_NEURONS
}

export function targetOf(task) {
  const t = task?.target
  return typeof t === 'number' && t > 0.5 && t <= 1 ? t : DEFAULT_TARGET
}

export function allowAddLayerOf(task) {
  return task?.allowAddLayer !== false
}

export function datasetOf(task) {
  return DATASETS.includes(task?.dataset) ? task.dataset : 'two_blobs'
}

// allowZeroLayers: the student may remove every hidden layer (inputs wired straight to the output).
export function allowZeroLayersOf(task) {
  return task?.allowZeroLayers === true
}

// testDots: show "Try new dots", which scores fresh dots from the same pattern.
export function testDotsOf(task) {
  return task?.testDots === true
}

const cleanInputs = (list) =>
  Array.isArray(list) ? INPUT_IDS.filter((id) => list.includes(id)) : []

// The inputs the student may switch between: allowInputs when the task gives it, else none to
// switch (just the starting inputs).
export function allowInputsOf(task) {
  const list = cleanInputs(task?.allowInputs)
  return list.length ? list : []
}

// The inputs the network starts with: inputs (kept inside allowInputs), default x and y.
export function startInputsOf(task) {
  const allowed = allowInputsOf(task)
  const list = cleanInputs(task?.inputs).filter((id) => !allowed.length || allowed.includes(id))
  const base = list.length
    ? list
    : DEFAULT_INPUTS.filter((id) => !allowed.length || allowed.includes(id))
  return base.length ? base : allowed
}

// Every input id the saved state may use for this task.
export function availableInputsOf(task) {
  const allowed = allowInputsOf(task)
  return allowed.length ? allowed : startInputsOf(task)
}

export const inputLabel = (id) => INPUT_LABELS[id] ?? id
export const inputsText = (inputs) => inputs.map(inputLabel).join(', ')

// The starting hidden layers from the task, kept inside the limits.
export function startLayersOf(task) {
  if (allowZeroLayersOf(task) && Array.isArray(task?.layers) && task.layers.length === 0) return []
  const max = maxNeuronsOf(task)
  const list = Array.isArray(task?.layers) ? task.layers : DEFAULT_LAYERS
  const clean = list
    .filter(isWhole)
    .slice(0, MAX_HIDDEN_LAYERS)
    .map((n) => Math.max(1, Math.min(max, n)))
  return clean.length ? clean : [Math.min(max, DEFAULT_LAYERS[0])]
}

// Authoring validation shared by the Builder and the CLI. `n` is the 1-based task number.
// Every message pushed here must be listed in docs/authoring/validation-errors.md.
export function validateNetworkPlaygroundTask(task, n) {
  const errors = []
  const where = `Task ${n}`
  if (!DATASETS.includes(task?.dataset)) {
    errors.push(`${where}: dataset must be two_blobs, circle or spiral.`)
  }
  const maxOk =
    task?.maxNeurons == null ||
    (isWhole(task.maxNeurons) && task.maxNeurons >= 1 && task.maxNeurons <= MAX_NEURONS_LIMIT)
  if (!maxOk) errors.push(`${where}: maxNeurons must be a whole number from 1 to 8.`)
  if (task?.layers != null) {
    const fewest = task.allowZeroLayers === true ? 0 : 1
    if (!Array.isArray(task.layers) || task.layers.length < fewest || task.layers.length > 2) {
      errors.push(`${where}: layers must list 1 or 2 hidden layers.`)
    } else {
      const max = maxOk ? maxNeuronsOf(task) : MAX_NEURONS_LIMIT
      if (!task.layers.every((v) => isWhole(v) && v >= 1 && v <= max)) {
        errors.push(`${where}: each layer in layers must be a whole number from 1 to maxNeurons.`)
      }
    }
  }
  if (
    task?.target != null &&
    !(typeof task.target === 'number' && task.target > 0.5 && task.target <= 1)
  ) {
    errors.push(`${where}: target must be a number above 0.5 and up to 1.`)
  }
  if (task?.allowAddLayer != null && typeof task.allowAddLayer !== 'boolean') {
    errors.push(`${where}: allowAddLayer must be true or false.`)
  }
  if (task?.allowZeroLayers != null && typeof task.allowZeroLayers !== 'boolean') {
    errors.push(`${where}: allowZeroLayers must be true or false.`)
  }
  if (task?.testDots != null && typeof task.testDots !== 'boolean') {
    errors.push(`${where}: testDots must be true or false.`)
  }
  const goodList = (list) =>
    Array.isArray(list) &&
    list.length >= 1 &&
    list.length <= INPUT_IDS.length &&
    new Set(list).size === list.length &&
    list.every((id) => INPUT_IDS.includes(id))
  if (task?.allowInputs != null && !goodList(task.allowInputs)) {
    errors.push(`${where}: allowInputs must list 1 to 4 different inputs from x, y, x2 and y2.`)
  }
  if (task?.inputs != null) {
    if (!goodList(task.inputs)) {
      errors.push(`${where}: inputs must list 1 to 4 different inputs from x, y, x2 and y2.`)
    } else if (
      goodList(task.allowInputs) &&
      !task.inputs.every((id) => task.allowInputs.includes(id))
    ) {
      errors.push(`${where}: every input in inputs must also be in allowInputs.`)
    }
  }
  return errors
}

// ---- The saved state ----
// { v: 1, layers: [3], inputs, acc, best, epochs, maxLayers, test, w }
//   layers     the student's hidden layers now (can be [] when the task has allowZeroLayers)
//   inputs     the inputs the network is given now (ids from x, y, x2, y2; default x and y)
//   test       the share of the fresh "new dots" it got right, or null (Try new dots, testDots)
//   acc / best the share of dots right now / at best (0 to 1, 3 decimals)
//   epochs     passes over the dots since the weights were last reset
//   maxLayers  the most hidden layers they have used
//   w          the network's numbers (2 decimals) so the tutor sees the same network; null at start
// About 100 numbers at most, well under 2 KB.

export function initialNetworkState(task) {
  const layers = startLayersOf(task)
  return {
    v: 1,
    layers,
    inputs: startInputsOf(task),
    acc: 0,
    best: 0,
    epochs: 0,
    maxLayers: layers.length,
    test: null,
    w: null,
  }
}

const rate = (v) => (typeof v === 'number' && v >= 0 && v <= 1 ? Math.round(v * 1000) / 1000 : 0)

// Reads a saved or shared state (or anything else) into a safe state.
export function normalizeNetworkState(task, raw) {
  const base = initialNetworkState(task)
  if (!raw || typeof raw !== 'object') return base
  const max = MAX_NEURONS_LIMIT
  const layers = (Array.isArray(raw.layers) ? raw.layers : [])
    .filter(isWhole)
    .slice(0, MAX_HIDDEN_LAYERS)
    .map((v) => Math.max(1, Math.min(max, v)))
  const zero = allowZeroLayersOf(task) && Array.isArray(raw.layers) && raw.layers.length === 0
  const use = layers.length || zero ? layers : base.layers
  const available = availableInputsOf(task)
  const picked = cleanInputs(raw.inputs).filter((id) => available.includes(id))
  const inputs = picked.length ? picked : base.inputs
  const acc = rate(raw.acc)
  return {
    v: 1,
    layers: use,
    inputs,
    test: typeof raw.test === 'number' && raw.test >= 0 && raw.test <= 1 ? rate(raw.test) : null,
    acc,
    best: Math.max(acc, rate(raw.best)),
    epochs: isWhole(raw.epochs) && raw.epochs > 0 ? raw.epochs : 0,
    maxLayers: Math.max(use.length, isWhole(raw.maxLayers) ? Math.min(raw.maxLayers, 2) : 0),
    w: Array.isArray(raw.w) && raw.w.length === weightCount(use, inputs.length) ? raw.w : null,
  }
}

// The state a student's network makes: layers, numbers and what it scored.
// `extra` carries { inputs, test } (the inputs the net uses and its new-dots score).
export function stateFromNet(prev, layers, net, acc, epochs, extra = {}) {
  const accR = rate(acc)
  return {
    v: 1,
    layers: [...layers],
    inputs: extra.inputs ?? net?.inputs ?? prev?.inputs ?? [...DEFAULT_INPUTS],
    test: typeof extra.test === 'number' ? rate(extra.test) : null,
    acc: accR,
    best: Math.max(rate(prev?.best), accR),
    epochs,
    maxLayers: Math.max(isWhole(prev?.maxLayers) ? prev.maxLayers : 0, layers.length),
    w: net ? flattenNet(net) : null,
  }
}

// The net a state describes (null before it has trained).
export function netOfState(state) {
  return netFromFlat(
    state?.layers ?? [],
    state?.w,
    state?.inputs?.length ? state.inputs : DEFAULT_INPUTS
  )
}

// A finished example for Complete (show answers): full marks, no network drawn.
export function solutionFor(task) {
  const layers = startLayersOf(task)
  return {
    v: 1,
    layers,
    inputs: startInputsOf(task),
    acc: 1,
    best: 1,
    epochs: 0,
    maxLayers: layers.length,
    test: null,
    w: null,
  }
}

export function accuracyOf(state) {
  return typeof state?.acc === 'number' ? state.acc : 0
}

export function percent(value) {
  return Math.round((value ?? 0) * 100)
}

// Whole-task progress: { target, acc, best, passed, layers, ... }.
export function gradeTask(task, state) {
  const target = targetOf(task)
  const s = normalizeNetworkState(task, state)
  const passed = s.acc >= target
  let hint = null
  if (!passed) {
    if (s.epochs === 0) hint = 'Press Train and watch the network learn.'
    else if (s.acc < 0.6) hint = 'Not much yet. Let it train for longer, or change the layers.'
    else hint = 'Getting there. Try more neurons or another layer, then train again.'
  }
  return {
    target,
    acc: s.acc,
    best: s.best,
    passed,
    layers: s.layers.length,
    inputs: s.inputs,
    test: s.test,
    maxLayers: s.maxLayers,
    epochs: s.epochs,
    hint,
  }
}
