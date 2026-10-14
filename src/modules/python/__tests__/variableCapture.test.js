import { describe, expect, it } from 'vitest'
import { normalizeCaptureConfig, normalizeRecordConfig } from '../pyodide.worker.js'
import { VARIABLE_CAPTURE_LIMITS, VARIABLE_CAPTURE_PY } from '../variableCapture.py.js'

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
