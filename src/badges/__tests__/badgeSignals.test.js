import { describe, expect, it } from 'vitest'
import {
  applySandboxRun,
  applySandboxRunError,
  applySandboxTime,
  contextForSandboxKind,
  hashSubmission,
  isBlocklyFieldIntermediateChange,
  isBlocklyUserEdit,
  runErrorFor,
  runErrorName,
  SANDBOX_RUNS_LOG_MAX,
  sandboxKindForContext,
  signalContextFor,
  signalKey,
  storedError,
} from '../signals.js'
import {
  ARCHIVE_ENTRY_MAX_BYTES,
  ARCHIVE_TRUNCATION_MARKER,
  archiveExplainerFields,
  archiveWorkFields,
  capArchiveText,
  normaliseSessionArchive,
  utf8Bytes,
} from '../sessionArchive.js'
import { isDesktopKeyboardShortcut } from '../shortcuts.js'

describe('signal contexts', () => {
  it('maps the phase and personal sandbox to a context and sandbox kind', () => {
    expect(signalContextFor({ phase: 'lesson' })).toBe('task')
    expect(signalContextFor({ phase: 'lesson', inPersonalSandbox: true })).toBe('personal')
    expect(signalContextFor({ phase: 'sandbox', inPersonalSandbox: true })).toBe('sandbox')
    expect(sandboxKindForContext('sandbox')).toBe('session')
    expect(sandboxKindForContext('personal')).toBe('personal')
    expect(sandboxKindForContext('task')).toBe(null)
    expect(contextForSandboxKind('session')).toBe('sandbox')
    expect(contextForSandboxKind('personal')).toBe('personal')
  })

  it('makes RTDB-safe keys from topic and task ids', () => {
    expect(signalKey('python.loops')).toBe('python__dot__loops')
    expect(signalKey('a/b#c$d[e]')).toBe('a_b_c_d_e_')
    expect(signalKey(3)).toBe('3')
    expect(signalKey(null)).toBe('none')
  })
})

describe('run errors', () => {
  it("reads the error's name from Python and browser output", () => {
    expect(runErrorName("Line 3: NameError: name 'x' is not defined\n")).toBe('NameError')
    expect(runErrorName('Uncaught ReferenceError: x is not defined (line 2)')).toBe(
      'ReferenceError'
    )
    expect(runErrorName('hello\nTraceback...\nZeroDivisionError: division by zero')).toBe(
      'ZeroDivisionError'
    )
    expect(runErrorName('KeyboardInterrupt')).toBe('KeyboardInterrupt')
    expect(runErrorName('I printed MyError as text in a sentence')).toBe(null)
    expect(runErrorName('')).toBe(null)
  })

  it('is false for a clean run, the name when readable, else true', () => {
    expect(runErrorFor('success', 'NameError: x')).toBe(false)
    expect(runErrorFor('stopped', '')).toBe(false)
    expect(runErrorFor('error', 'Line 1: TypeError: bad')).toBe('TypeError')
    expect(runErrorFor('error', 'something went wrong')).toBe(true)
    expect(storedError(false)).toBe(null)
    expect(storedError(true)).toBe(true)
    expect(storedError('NameError')).toBe('NameError')
  })
})

describe('hashSubmission', () => {
  it('is stable, tells different code apart, and hashes a string as-is', () => {
    expect(hashSubmission('print(1)')).toBe(hashSubmission('print(1)'))
    expect(hashSubmission('print(1)')).not.toBe(hashSubmission('print(2)'))
    expect(hashSubmission({ a: 1 })).toBe(hashSubmission('{"a":1}'))
    expect(hashSubmission(null)).toBe(null)
  })
})

describe('sandbox counters', () => {
  it('counts runs, error runs and fixes (error then different, clean code)', () => {
    let state = applySandboxRun(null, { at: 1, error: 'NameError', submissionHash: 'a' })
    state = applySandboxRun(state, { at: 2, error: false, submissionHash: 'a' })
    expect(state).toMatchObject({ runs: 2, errorRuns: 1, fixes: 0 })
    state = applySandboxRun(state, { at: 3, error: true, submissionHash: 'b' })
    state = applySandboxRun(state, { at: 4, error: false, submissionHash: 'c' })
    expect(state).toMatchObject({ runs: 4, errorRuns: 2, fixes: 1, timeMs: 0 })
    expect(state.runsLog.at(-1)).toEqual({ at: 4, error: false, submissionHash: 'c', fix: true })
    expect(state.runsLog[0]).toEqual({ at: 1, error: 'NameError', submissionHash: 'a' })
  })

  it('keeps only the last 20 runs, and reads a stored object-shaped log', () => {
    let state = null
    for (let i = 0; i < 25; i += 1)
      state = applySandboxRun(state, { at: i, submissionHash: `${i}` })
    expect(state.runs).toBe(25)
    expect(state.runsLog).toHaveLength(SANDBOX_RUNS_LOG_MAX)
    expect(state.runsLog[0].at).toBe(5)
    const fromRtdb = { runs: 1, runsLog: { 0: { at: 1, error: true, submissionHash: 'x' } } }
    expect(applySandboxRun(fromRtdb, { at: 2, submissionHash: 'y' })).toMatchObject({
      runs: 2,
      fixes: 1,
    })
  })

  it('marks the latest run as errored when its error arrives late, taking back a fix', () => {
    let state = applySandboxRun(null, { at: 1, error: true, submissionHash: 'a' })
    state = applySandboxRun(state, { at: 2, submissionHash: 'b' })
    expect(state.fixes).toBe(1)
    state = applySandboxRunError(state, 'NameError')
    expect(state).toMatchObject({ errorRuns: 2, fixes: 0 })
    expect(state.runsLog.at(-1)).toEqual({ at: 2, error: 'NameError', submissionHash: 'b' })
    expect(applySandboxRunError(state, true)).toEqual(state)
  })

  it('accumulates time', () => {
    expect(applySandboxTime(applySandboxTime(null, 1500.4), 1000).timeMs).toBe(2500)
    expect(applySandboxTime({ timeMs: 10 }, -5).timeMs).toBe(10)
  })
})

describe('isBlocklyFieldIntermediateChange', () => {
  it('is true only for a keystroke inside an open field editor', () => {
    expect(
      isBlocklyFieldIntermediateChange({
        type: 'block_field_intermediate_change',
        oldValue: 'h',
        newValue: 'ha',
      })
    ).toBe(true)
    expect(
      isBlocklyFieldIntermediateChange({
        type: 'change',
        element: 'field',
        oldValue: 'Hello!',
        newValue: 'ha',
      })
    ).toBe(false)
    expect(isBlocklyFieldIntermediateChange({ type: 'create' })).toBe(false)
    expect(isBlocklyFieldIntermediateChange(null)).toBe(false)
  })

  it('is not counted as a user edit (the committed change is)', () => {
    expect(
      isBlocklyUserEdit({ type: 'block_field_intermediate_change', oldValue: 'h', newValue: 'ha' })
    ).toBe(false)
  })
})

describe('isBlocklyUserEdit', () => {
  it('counts creating, deleting, moving to a new place and changing a field', () => {
    expect(isBlocklyUserEdit({ type: 'create' })).toBe(true)
    expect(isBlocklyUserEdit({ type: 'delete' })).toBe(true)
    expect(isBlocklyUserEdit({ type: 'move', oldParentId: null, newParentId: 'p1' })).toBe(true)
    expect(
      isBlocklyUserEdit({
        type: 'move',
        oldCoordinate: { x: 0, y: 0 },
        newCoordinate: { x: 40, y: 10 },
      })
    ).toBe(true)
    expect(
      isBlocklyUserEdit({ type: 'change', element: 'field', oldValue: 10, newValue: 20 })
    ).toBe(true)
  })

  it('ignores UI events and a block dropped back where it was', () => {
    expect(isBlocklyUserEdit({ type: 'create', isUiEvent: true })).toBe(false)
    expect(isBlocklyUserEdit({ type: 'viewport_change' })).toBe(false)
    expect(isBlocklyUserEdit({ type: 'selected', isUiEvent: true })).toBe(false)
    expect(
      isBlocklyUserEdit({
        type: 'move',
        oldParentId: 'p1',
        newParentId: 'p1',
        oldInputName: 'DO',
        newInputName: 'DO',
      })
    ).toBe(false)
    expect(
      isBlocklyUserEdit({
        type: 'move',
        oldCoordinate: { x: 10, y: 10 },
        newCoordinate: { x: 10.2, y: 10 },
      })
    ).toBe(false)
    expect(
      isBlocklyUserEdit({ type: 'change', element: 'comment', oldValue: 1, newValue: 2 })
    ).toBe(false)
  })
})

describe('Desktop keyboard shortcuts', () => {
  it('counts copy, cut and paste by keyboard only', () => {
    expect(isDesktopKeyboardShortcut('mod+c')).toBe(true)
    expect(isDesktopKeyboardShortcut('mod+v')).toBe(true)
    expect(isDesktopKeyboardShortcut('c')).toBe(false)
    expect(isDesktopKeyboardShortcut(null)).toBe(false)
  })
})

describe('session archive values', () => {
  it('keeps small text and caps large text at 20 KB with a marker', () => {
    expect(capArchiveText('print(1)')).toEqual({ text: 'print(1)', truncated: false })
    const big = 'x'.repeat(ARCHIVE_ENTRY_MAX_BYTES + 500)
    const capped = capArchiveText(big)
    expect(capped.truncated).toBe(true)
    expect(capped.text.endsWith(ARCHIVE_TRUNCATION_MARKER)).toBe(true)
    expect(utf8Bytes(capped.text)).toBeLessThanOrEqual(ARCHIVE_ENTRY_MAX_BYTES)
  })

  it('never splits a multi-byte character when capping', () => {
    const capped = capArchiveText('🐍'.repeat(6000))
    expect(capped.truncated).toBe(true)
    expect(capped.text).not.toMatch(/�/)
    expect(utf8Bytes(capped.text)).toBeLessThanOrEqual(ARCHIVE_ENTRY_MAX_BYTES)
  })

  it('stores code, or files with encoded keys, capped across all files', () => {
    expect(archiveWorkFields({ code: 'print(1)' })).toEqual({ code: 'print(1)' })
    expect(archiveWorkFields({ files: [{ name: 'index.html', content: '<p>' }] })).toEqual({
      files: { index__dot__html: '<p>' },
    })
    const fields = archiveWorkFields({
      files: { 'a.js': 'a'.repeat(15000), 'b.css': 'b'.repeat(15000) },
    })
    expect(fields.truncated).toBe(true)
    expect(fields.files['a__dot__js']).toHaveLength(15000)
    expect(fields.files['b__dot__css'].endsWith(ARCHIVE_TRUNCATION_MARKER)).toBe(true)
    expect(archiveWorkFields({})).toEqual({})
    expect(archiveExplainerFields('Try a loop')).toEqual({ explainer: 'Try a loop' })
  })

  it('reads visits oldest first, decoding file keys and filling a missing exit from endedAt', () => {
    const raw = {
      visits: {
        200: {
          enteredAt: 200,
          previousTaskId: 4,
          pushes: { p2: { at: 260, code: 'b' }, p1: { at: 210, code: 'a' } },
          studentSnapshots: { s1: { at: 250, files: { index__dot__html: '<p>' } } },
        },
        100: { enteredAt: 100, exitedAt: 150, previousTaskId: 2, explainer: 'Go' },
      },
    }
    const { visits } = normaliseSessionArchive(raw, { endedAt: 900 })
    expect(visits.map((v) => v.visitId)).toEqual(['100', '200'])
    expect(visits[0]).toMatchObject({ exitedAt: 150, durationMs: 50, explainer: 'Go' })
    expect(visits[1]).toMatchObject({ exitedAt: 900, durationMs: 700, previousTaskId: 4 })
    expect(visits[1].pushes.map((p) => p.code)).toEqual(['a', 'b'])
    expect(visits[1].studentSnapshots.s1.files).toEqual({ 'index.html': '<p>' })
    expect(normaliseSessionArchive(null)).toEqual({ visits: [] })
  })
})
