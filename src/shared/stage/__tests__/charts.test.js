// Real charts on the Stage (matplotlib, ../charts.js): import detection, the show() → image
// command plumbing, and drawing, syncing, describing and exporting an image command.
import { afterEach, describe, expect, it } from 'vitest'
import {
  CHARTS_LOADING_MESSAGE,
  MAX_CHART_IMAGES,
  MAX_CHART_PNG_CHARS,
  chartImageCommand,
  chartImageRect,
  chartImageSrc,
  codeImportsMatplotlib,
  recordChartImage,
} from '../charts.js'
import { CHARTS_FLUSH_PY, CHARTS_INSTALL_PY, CHARTS_RESET_PY } from '../chartsPy.js'
import { isChartsLoading, setChartsLoading, subscribeChartsLoading } from '../chartsStatus.js'
import { createStageRecorder } from '../commands.js'
import { drawStage } from '../canvas.js'
import { describeStage } from '../describe.js'
import { forgetStageImages, loadStageImages, rememberStageImage } from '../stageImages.js'
import { stageToSvg } from '../svg.js'
import { compactStageForSync, readStageResult } from '../sync.js'
import { outputPlaceholder, outputStatus } from '../../../app/components/OutputPanel.jsx'

// A tiny valid-looking base64 PNG body (the plumbing never decodes it).
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function chart(extra = {}) {
  return { type: 'image', png: PNG, w: 800, h: 600, ...extra }
}

function recordingContext() {
  const calls = []
  const state = { canvas: { width: 400, height: 400 } }
  const ctx = new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key]
      return (...args) => calls.push([key, ...args])
    },
    set(target, key, value) {
      if (key === 'fillStyle') calls.push(['fillStyle', value])
      target[key] = value
      return true
    },
  })
  return { ctx, calls }
}

afterEach(() => {
  forgetStageImages()
  setChartsLoading(false)
})

describe('codeImportsMatplotlib', () => {
  it.each([
    'import matplotlib.pyplot as plt',
    'import matplotlib',
    'from matplotlib import pyplot as plt',
    'from matplotlib.pyplot import bar, show',
    'import numpy as np, matplotlib.pyplot as plt',
    'x = 1\n    import matplotlib.pyplot as plt',
  ])('spots %j', (code) => {
    expect(codeImportsMatplotlib(code)).toBe(true)
  })

  it.each([
    'import stage',
    'from stage import *',
    'import matplotlibish',
    'print("matplotlib")',
    'import numpy',
    '',
  ])('ignores %j', (code) => {
    expect(codeImportsMatplotlib(code)).toBe(false)
  })

  it("checks every piece given (the task's setup code too)", () => {
    expect(codeImportsMatplotlib('print(1)', undefined, 'import matplotlib.pyplot as plt')).toBe(
      true
    )
    expect(codeImportsMatplotlib(null, undefined)).toBe(false)
  })
})

describe('chartImageCommand / recordChartImage', () => {
  it('makes an image command with the chart in words', () => {
    const { command } = chartImageCommand(PNG, 800.2, 600, "  a chart titled 'Planets'\n ")
    expect(command).toEqual({
      type: 'image',
      png: PNG,
      w: 800,
      h: 600,
      alt: "a chart titled 'Planets'",
    })
  })

  it('refuses something that is not base64, a bad size, or a picture too big to sync', () => {
    expect(chartImageCommand('not <base64>', 10, 10).error.kind).toBe('RuntimeError')
    expect(chartImageCommand(PNG, 0, 10).error.kind).toBe('RuntimeError')
    const huge = 'A'.repeat(MAX_CHART_PNG_CHARS + 4)
    expect(chartImageCommand(huge, 10, 10).error.message).toMatch(/too big/)
  })

  it('adds to the run, in order with the Stage calls', () => {
    const recorder = createStageRecorder()
    expect(recorder.call('circle', [50], {})).toBe('')
    expect(recordChartImage(recorder, PNG, 640, 480, 'a chart')).toBe('')
    expect(recorder.call('text', ['hi'], {})).toBe('')
    expect(recorder.commands.map((c) => c.type)).toEqual(['circle', 'image', 'text'])
  })

  it('stops a loop that shows chart after chart', () => {
    const recorder = createStageRecorder()
    for (let i = 0; i < MAX_CHART_IMAGES; i++) {
      expect(recordChartImage(recorder, PNG, 10, 10, '')).toBe('')
    }
    expect(recordChartImage(recorder, PNG, 10, 10, '')).toMatch(/^RuntimeError\|/)
  })
})

describe('chartImageRect', () => {
  it('fits a wide chart across the stage, centred top to bottom', () => {
    expect(chartImageRect(chart({ w: 800, h: 600 }))).toEqual({ x: 0, y: 50, w: 400, h: 300 })
  })
  it('fits a tall chart top to bottom, centred across', () => {
    expect(chartImageRect(chart({ w: 300, h: 600 }))).toEqual({ x: 100, y: 0, w: 200, h: 400 })
  })
})

describe('drawing an image command', () => {
  it('covers the stage in white, then draws the decoded picture fitted', () => {
    const picture = { decoded: true }
    rememberStageImage(PNG, picture)
    const { ctx, calls } = recordingContext()
    drawStage(ctx, [{ type: 'background', colour: '#000080' }, chart()])
    const draw = calls.find(([name]) => name === 'drawImage')
    expect(draw).toEqual(['drawImage', picture, 0, 50, 400, 300])
    const fills = calls.filter(([name]) => name === 'fillStyle').map(([, v]) => v)
    // The navy background, then white under the chart.
    expect(fills.slice(-2)).toEqual(['#000080', '#ffffff'])
  })

  it('leaves the stage white while the picture is still loading', () => {
    const { ctx, calls } = recordingContext()
    drawStage(ctx, [chart()])
    expect(calls.some(([name]) => name === 'drawImage')).toBe(false)
  })

  it('has nothing to load when the drawing has no chart', async () => {
    expect(await loadStageImages([{ type: 'circle', x: 1, y: 1, r: 5 }])).toBe(false)
  })

  it('never ghosts a target chart over the drawing', () => {
    rememberStageImage(PNG, {})
    const { ctx, calls } = recordingContext()
    drawStage(ctx, [], { ghost: [chart()] })
    expect(calls.some(([name]) => name === 'drawImage')).toBe(false)
  })
})

describe('syncing, describing and exporting a chart', () => {
  it('syncs from the last chart on (it covers what came before)', () => {
    const synced = compactStageForSync([
      { type: 'circle', x: 1, y: 1, r: 5, colour: '#ff0000' },
      chart({ alt: 'a chart' }),
      { type: 'text', x: 200, y: 20, text: 'Done', colour: '#000000', size: 16 },
    ])
    expect(synced.commands.map((c) => c.type)).toEqual(['image', 'text'])
    expect(synced.count).toBe(3)
    expect(readStageResult(synced).commands[0]).toMatchObject({ type: 'image', png: PNG })
  })

  it('describes the chart in words', () => {
    const words = describeStage([
      { type: 'circle', x: 200, y: 200, r: 5, colour: '#ff0000' },
      chart({ alt: "a chart titled 'Planets' with 8 bars" }),
    ])
    expect(words).toContain("1 thing drawn: a chart titled 'Planets' with 8 bars")
    expect(words).not.toContain('circle')
  })

  it('puts the chart in the exported SVG', () => {
    const svg = stageToSvg([chart()])
    expect(svg).toContain(`<image href="${chartImageSrc(chart())}"`)
    expect(svg).toContain('y="50"')
  })
})

describe('the Python glue', () => {
  it('forces the Agg backend and replaces plt.show()', () => {
    expect(CHARTS_INSTALL_PY).toContain("matplotlib.use('Agg', force=True)")
    expect(CHARTS_INSTALL_PY).toContain('plt.show = show')
    expect(CHARTS_INSTALL_PY).toContain('js.__hsStageChart(')
    expect(CHARTS_RESET_PY).toBe('_hs_charts_reset()')
    expect(CHARTS_FLUSH_PY).toBe('_hs_charts_flush()')
  })
})

describe('the worker bridge', () => {
  it('puts a chart on the Stage from Python, or answers with a problem to raise', async () => {
    await import('../../../modules/python/pyodide.worker.js')
    expect(globalThis.__hsStageChart(PNG, 640, 480, 'a chart')).toBe('')
    expect(globalThis.__hsStageChart('', 640, 480, '')).toMatch(/^RuntimeError\|/)
  })
})

describe('"Loading charts…" while matplotlib loads', () => {
  it('tells listeners when loading starts and stops', () => {
    const seen = []
    const stop = subscribeChartsLoading(() => seen.push(isChartsLoading()))
    setChartsLoading(true)
    setChartsLoading(true)
    setChartsLoading(false)
    stop()
    expect(seen).toEqual([true, false])
  })

  it('shows in the output panel while the run waits for it', () => {
    expect(outputStatus({ running: true, loadingCharts: true }).label).toBe(CHARTS_LOADING_MESSAGE)
    expect(outputPlaceholder({ running: true, loadingCharts: true })).toBe(CHARTS_LOADING_MESSAGE)
    expect(outputStatus({ running: true }).label).toBe('Running…')
    expect(outputPlaceholder({ running: true })).toBe(null)
  })
})
