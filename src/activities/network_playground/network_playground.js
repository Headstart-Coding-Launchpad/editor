// Pure logic for the Network Playground activity: task fields, validation, the saved state,
// grading and hints. Node-safe (no React, JSX or DOM) so the CLI, the Builder and print share it.
// The maths (dots, network, training) is in ./network.js.
import { DATASETS, flattenNet, netFromFlat, weightCount } from './network.js'

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

// The starting hidden layers from the task, kept inside the limits.
export function startLayersOf(task) {
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
    if (!Array.isArray(task.layers) || task.layers.length < 1 || task.layers.length > 2) {
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
  return errors
}

// ---- The saved state ----
// { v: 1, layers: [3], acc, best, epochs, maxLayers, w }
//   layers     the student's hidden layers now
//   acc / best the share of dots right now / at best (0 to 1, 3 decimals)
//   epochs     passes over the dots since the weights were last reset
//   maxLayers  the most hidden layers they have used
//   w          the network's numbers (2 decimals) so the tutor sees the same network; null at start
// About 100 numbers at most, well under 2 KB.

export function initialNetworkState(task) {
  const layers = startLayersOf(task)
  return { v: 1, layers, acc: 0, best: 0, epochs: 0, maxLayers: layers.length, w: null }
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
  const use = layers.length ? layers : base.layers
  const acc = rate(raw.acc)
  return {
    v: 1,
    layers: use,
    acc,
    best: Math.max(acc, rate(raw.best)),
    epochs: isWhole(raw.epochs) && raw.epochs > 0 ? raw.epochs : 0,
    maxLayers: Math.max(use.length, isWhole(raw.maxLayers) ? Math.min(raw.maxLayers, 2) : 0),
    w: Array.isArray(raw.w) && raw.w.length === weightCount(use) ? raw.w : null,
  }
}

// The state a student's network makes: layers, numbers and what it scored.
export function stateFromNet(prev, layers, net, acc, epochs) {
  const accR = rate(acc)
  return {
    v: 1,
    layers: [...layers],
    acc: accR,
    best: Math.max(rate(prev?.best), accR),
    epochs,
    maxLayers: Math.max(isWhole(prev?.maxLayers) ? prev.maxLayers : 0, layers.length),
    w: net ? flattenNet(net) : null,
  }
}

// The net a state describes (null before it has trained).
export function netOfState(state) {
  return netFromFlat(state?.layers ?? [], state?.w)
}

// A finished example for Complete (show answers): full marks, no network drawn.
export function solutionFor(task) {
  const layers = startLayersOf(task)
  return { v: 1, layers, acc: 1, best: 1, epochs: 0, maxLayers: layers.length, w: null }
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
    maxLayers: s.maxLayers,
    epochs: s.epochs,
    hint,
  }
}
