// Real charts on the Python Stage: matplotlib through Pyodide (src/shared/stage/). Pure and
// Node-safe.
//
// A program that imports matplotlib gets the real package, loaded by the worker with
// pyodide.loadPackage the first time (it ships with Pyodide; students still can't install
// anything). plt.show() turns each open figure into a PNG and puts it on the Stage as one
// command:
//
//   { type: 'image', png, w, h, alt? }   png = base64 PNG bytes (no data: prefix); w, h = its
//                                        size in pixels; alt = the chart in words
//
// An image covers the whole Stage, like background(): white first, then the picture fitted
// inside (no stretching), so the last show() is the one you see; Stage calls made after it draw
// on top. Programs that never import matplotlib load nothing extra.
import { MAX_STAGE_COMMANDS, STAGE_SIZE } from './commands.js'

// What the worker loads (with its own dependencies: numpy, pillow, …).
export const CHART_PACKAGES = Object.freeze(['matplotlib'])
// The longer side of a chart's PNG, in pixels. Stage export draws at 800, so this stays sharp.
export const CHART_PIXELS = 800
// The most base64 characters one chart may take. It is synced to the tutor with each run
// (students/{id}/currentStageResult), so a bigger picture is redrawn smaller first.
export const MAX_CHART_PNG_CHARS = 400_000
// The most charts one run can show.
export const MAX_CHART_IMAGES = 20
export const MAX_CHART_ALT_CHARS = 300

export const CHARTS_LOADING_MESSAGE = 'Loading charts… (first time only)'
export const CHARTS_LOAD_FAILED_MESSAGE =
  "Charts couldn't load. Check the computer is online, then press Run again."

// `import matplotlib`, `import matplotlib.pyplot as plt`, `import numpy, matplotlib.pyplot`,
// `from matplotlib import pyplot`, `from matplotlib.pyplot import bar`. A match inside a string
// or a comment only costs a load, never a wrong answer.
const IMPORTS_MATPLOTLIB =
  /^[ \t]*(?:import[ \t]+(?:[\w.]+(?:[ \t]+as[ \t]+\w+)?[ \t]*,[ \t]*)*matplotlib\b|from[ \t]+matplotlib\b)/m

/** Whether a program (or any of the given pieces, e.g. a task's setup code) imports matplotlib. */
export function codeImportsMatplotlib(...codes) {
  return codes.some((code) => typeof code === 'string' && IMPORTS_MATPLOTLIB.test(code))
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/

export function isChartImage(command) {
  return command?.type === 'image' && typeof command.png === 'string' && command.png.length > 0
}

/** A chart's PNG as a data: URL, for an <img> or an SVG <image>. */
export function chartImageSrc(command) {
  return isChartImage(command) ? `data:image/png;base64,${command.png}` : ''
}

/** Where a chart sits on the 400 × 400 stage: fitted inside it, centred, never stretched. */
export function chartImageRect(command) {
  const w = Number(command?.w)
  const h = Number(command?.h)
  if (!(w > 0) || !(h > 0)) return { x: 0, y: 0, w: STAGE_SIZE, h: STAGE_SIZE }
  const scale = Math.min(STAGE_SIZE / w, STAGE_SIZE / h)
  const fw = w * scale
  const fh = h * scale
  return { x: (STAGE_SIZE - fw) / 2, y: (STAGE_SIZE - fh) / 2, w: fw, h: fh }
}

/**
 * One chart from Python → `{ command }` or `{ error: { kind, message } }` (the Python exception
 * to raise). `png` is base64 PNG bytes; `w`, `h` its pixel size; `alt` the chart in words.
 */
export function chartImageCommand(png, w, h, alt = '') {
  const data = String(png ?? '')
  if (!data || !BASE64.test(data)) {
    return { error: { kind: 'RuntimeError', message: "plt.show(): the chart couldn't be drawn" } }
  }
  if (data.length > MAX_CHART_PNG_CHARS) {
    return {
      error: {
        kind: 'RuntimeError',
        message: 'plt.show(): this chart is too big to show. Try fewer points or a smaller figure',
      },
    }
  }
  const width = Math.round(Number(w))
  const height = Math.round(Number(h))
  if (!(width > 0) || !(height > 0)) {
    return { error: { kind: 'RuntimeError', message: "plt.show(): the chart couldn't be drawn" } }
  }
  const words = String(alt ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CHART_ALT_CHARS)
  return {
    command: { type: 'image', png: data, w: width, h: height, ...(words ? { alt: words } : {}) },
  }
}

/**
 * Adds a chart to a run's stage recorder (createStageRecorder in ./commands.js), with its caps.
 * Returns '' when it was added, or 'Kind|message' for Python to raise.
 */
export function recordChartImage(recorder, png, w, h, alt) {
  const { command, error } = chartImageCommand(png, w, h, alt)
  if (error) return `${error.kind}|${error.message}`
  const commands = recorder.commands
  if (commands.length >= MAX_STAGE_COMMANDS) {
    return `RuntimeError|The stage stopped after ${MAX_STAGE_COMMANDS.toLocaleString('en-GB')} drawing commands — is a loop drawing forever?`
  }
  const shown = commands.reduce((n, c) => n + (c?.type === 'image' ? 1 : 0), 0)
  if (shown >= MAX_CHART_IMAGES) {
    return `RuntimeError|plt.show() has shown ${MAX_CHART_IMAGES} charts already — is a loop calling it over and over?`
  }
  commands.push(command)
  return ''
}
