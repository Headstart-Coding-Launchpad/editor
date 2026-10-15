import { describe, expect, it } from 'vitest'
import { normalizeCaptureConfig, normalizeRecordConfig } from '../pyodide.worker.js'
import { VARIABLE_CAPTURE_LIMITS, VARIABLE_CAPTURE_PY } from '../variableCapture.py.js'
import { STAGE_MODULE_PY } from '../../../shared/stage/stagePy.js'

describe('name-tag panel capture config (worker side)', () => {
  it('is off without capture.panel', () => {
    expect(normalizeCaptureConfig(null)).toEqual({ panel: false })
    expect(normalizeCaptureConfig({ panel: false, peekLine: 3 })).toEqual({ panel: false })
  })

  it('keeps a positive whole peek line and string hide names only', () => {
    expect(normalizeCaptureConfig({ panel: true, peekLine: 4, hide: ['a', 3, '', 'b'] })).toEqual({
      panel: true,
      peekLine: 4,
      hide: ['a', 'b'],
    })
    expect(normalizeCaptureConfig({ panel: true, peekLine: 0 }).peekLine).toBeNull()
    expect(normalizeCaptureConfig({ panel: true, peekLine: 2.5 }).peekLine).toBeNull()
  })
})

describe('variable capture Python source', () => {
  it('defines the reusable helpers, with the limits filled in', () => {
    for (const name of [
      'def _hs_encode_value(',
      'def _hs_snapshot(',
      'def _hs_frame_namespace(',
      'def _hs_imported_names(',
      'class _HsLineWatch',
    ]) {
      expect(VARIABLE_CAPTURE_PY).toContain(name)
    }
    expect(VARIABLE_CAPTURE_PY).toContain(`_HS_MAX_ITEMS = ${VARIABLE_CAPTURE_LIMITS.maxItems}`)
    expect(VARIABLE_CAPTURE_PY).not.toContain('${')
  })

  it('gives each variable its own share of the budget, with room for a 32 × 32 grid', () => {
    expect(VARIABLE_CAPTURE_LIMITS.maxVarNodes).toBeGreaterThanOrEqual(1 + 32 + 32 * 32)
    expect(VARIABLE_CAPTURE_LIMITS.maxNodes).toBeGreaterThan(VARIABLE_CAPTURE_LIMITS.maxVarNodes)
    // Slow-mo keeps every step, so its budget stays small.
    expect(VARIABLE_CAPTURE_LIMITS.stepNodes).toBeLessThanOrEqual(600)
    expect(VARIABLE_CAPTURE_PY).toContain(
      `_HS_MAX_VAR_NODES = ${VARIABLE_CAPTURE_LIMITS.maxVarNodes}`
    )
    expect(VARIABLE_CAPTURE_PY).toContain(
      'def _hs_snapshot(namespace, hidden=(), scope=None, max_nodes=None, max_var_nodes=None):'
    )
  })

  it('marks lists the Stage drew with grid() in this run (g, gp, gw)', () => {
    expect(VARIABLE_CAPTURE_PY).toContain('def _hs_drawn_rows():')
    expect(VARIABLE_CAPTURE_PY).toContain("node['g'] = 1")
    expect(VARIABLE_CAPTURE_PY).toContain("node['gp'] = words")
    // The very same object, not an equal copy.
    expect(VARIABLE_CAPTURE_PY).toContain('mark[0] is value')
    expect(STAGE_MODULE_PY).toContain("_hs_drawn.append((rows, palette, kwargs.get('width')))")
    // A flat list's width= (never on a list of rows), for the panel's wrapped tiles.
    expect(VARIABLE_CAPTURE_PY).toContain('def _hs_drawn_width(value, width):')
    expect(VARIABLE_CAPTURE_PY).toContain("node['gw'] = width")
  })

  it('reads the student file only, so library frames are never traced', () => {
    expect(VARIABLE_CAPTURE_PY).toContain("frame.f_code.co_filename != '<student>'")
  })
})

describe('slow-mo record config (worker side)', () => {
  it('is off without record', () => {
    expect(normalizeRecordConfig(null)).toEqual({ on: false })
    expect(normalizeRecordConfig(undefined)).toEqual({ on: false })
  })

  it('keeps a positive whole line offset and string hide names only', () => {
    expect(normalizeRecordConfig({ lineOffset: 2, hide: ['a', 1, '', 'b'] })).toEqual({
      on: true,
      lineOffset: 2,
      hide: ['a', 'b'],
    })
    expect(normalizeRecordConfig({ lineOffset: -1 }).lineOffset).toBe(0)
    expect(normalizeRecordConfig({ lineOffset: 1.5 }).lineOffset).toBe(0)
  })

  it('lets a recorder end the program at the step cap', () => {
    expect(VARIABLE_CAPTURE_PY).toContain('class _HsStopRun(BaseException)')
    expect(VARIABLE_CAPTURE_PY).toContain('except _HsStopRun:')
  })
})
