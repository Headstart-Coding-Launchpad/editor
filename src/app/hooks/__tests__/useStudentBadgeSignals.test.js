import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useStudentBadgeSignals,
  workAreaShortcutFor,
  workAreaSurfaceOf,
} from '../useStudentBadgeSignals'
import { lastRunTimes, pendingSandboxSnapshots } from '../useSandboxArchiveSnapshots'

const ID = 'student-1'
const WRITER_NAMES = [
  'recordTopicOpenSignal',
  'recordShortcutSignal',
  'recordAutocompleteSignal',
  'recordFirstEditSignal',
  'recordCompleteShownSignal',
  'recordSandboxRunSignal',
  'flagSandboxRunError',
  'addSandboxTimeSignal',
]

function makeWriters() {
  return Object.fromEntries(WRITER_NAMES.map((name) => [name, vi.fn()]))
}

function render(props = {}) {
  const writers = makeWriters()
  const initialProps = {
    phase: 'lesson',
    identity: { anonymousId: ID },
    session: { state: 'active' },
    currentTaskId: 1,
    writers,
    ...props,
  }
  const hook = renderHook((p) => useStudentBadgeSignals(p), { initialProps })
  return { ...hook, writers, rerender: (patch) => hook.rerender({ ...initialProps, ...patch }) }
}

let now = 0
beforeEach(() => {
  now = 1000
  vi.spyOn(performance, 'now').mockImplementation(() => now)
})
afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('gating', () => {
  it.each([
    ['the presentation window', { teacherPresentation: true }],
    ['the Builder preview', { previewMode: true }],
    ['solo', { phase: 'solo' }],
    ['the waiting room', { phase: 'waiting' }],
    ['no live session', { session: null }],
    ['no identity', { identity: null }],
  ])('records nothing in %s', (_label, props) => {
    const { result, writers } = render(props)
    expect(result.current.enabled).toBe(false)
    act(() => {
      result.current.reportTopicOpen('loops')
      result.current.reportShortcut('run')
      result.current.reportAutocomplete()
      result.current.reportUserEdit('code-editor')
      result.current.reportCompleteShown(1, 'show')
      result.current.reportSandboxRun({ error: true, submission: 'x' })
    })
    for (const name of WRITER_NAMES) expect(writers[name]).not.toHaveBeenCalled()
  })

  it('records in a live lesson and the teacher sandbox', () => {
    expect(render().result.current).toMatchObject({ enabled: true, context: 'task' })
    expect(render({ phase: 'sandbox' }).result.current).toMatchObject({
      enabled: true,
      context: 'sandbox',
    })
    expect(render({ inPersonalSandbox: true }).result.current.context).toBe('personal')
  })
})

describe('first edits (Ready to Code)', () => {
  it('times the first real edit from when the task rendered, once per task', () => {
    const { result, writers, rerender } = render()
    now = 7200
    act(() => result.current.reportUserEdit('code-editor'))
    now = 9000
    act(() => result.current.reportUserEdit('code-editor'))
    expect(writers.recordFirstEditSignal).toHaveBeenCalledTimes(1)
    expect(writers.recordFirstEditSignal).toHaveBeenCalledWith(ID, 1, 6200)

    now = 20000
    rerender({ currentTaskId: 2 })
    now = 23000
    act(() => result.current.reportUserEdit('blocks'))
    expect(writers.recordFirstEditSignal).toHaveBeenLastCalledWith(ID, 2, 3000)
  })

  it('starts the clock when the student joins, if that is later than the task', () => {
    const { result, writers, rerender } = render({ phase: 'waiting' })
    now = 50000
    rerender({ phase: 'lesson' })
    now = 54000
    act(() => result.current.reportUserEdit('code-editor'))
    expect(writers.recordFirstEditSignal).toHaveBeenCalledWith(ID, 1, 4000)
  })

  it('does not count edits in a sandbox', () => {
    const { result, writers } = render({ inPersonalSandbox: true })
    act(() => result.current.reportUserEdit('code-editor'))
    expect(writers.recordFirstEditSignal).not.toHaveBeenCalled()
  })
})

describe('other signals', () => {
  it('records topic opens with the context and task, and teacher-sent ones as teacher', () => {
    const { result, writers } = render({ phase: 'sandbox', currentTaskId: 4 })
    act(() => {
      result.current.reportTopicOpen('loops', { via: 'list' })
      result.current.reportTopicOpen('lists', { source: 'teacher', via: 'teacher' })
    })
    expect(writers.recordTopicOpenSignal).toHaveBeenCalledWith(ID, {
      context: 'sandbox',
      taskId: 4,
      topicId: 'loops',
      source: 'student',
      via: 'list',
    })
    expect(writers.recordTopicOpenSignal.mock.calls[1][1].source).toBe('teacher')
  })

  it('records complete code shown on a task only', () => {
    const { result, writers } = render()
    act(() => result.current.reportCompleteShown(1, 'teacherReset'))
    expect(writers.recordCompleteShownSignal).toHaveBeenCalledWith(ID, 1, 'teacherReset')
    const personal = render({ inPersonalSandbox: true })
    act(() => personal.result.current.reportCompleteShown(1, 'show'))
    expect(personal.writers.recordCompleteShownSignal).not.toHaveBeenCalled()
  })

  it('records sandbox runs against the right node, with a hash and never the code', () => {
    const { result, writers } = render({ phase: 'sandbox' })
    act(() => result.current.reportSandboxRun({ error: 'NameError', submission: 'print(x)' }))
    const [id, kind, value] = writers.recordSandboxRunSignal.mock.calls[0]
    expect([id, kind]).toEqual([ID, 'session'])
    expect(value.error).toBe('NameError')
    expect(typeof value.submissionHash).toBe('string')
    expect(JSON.stringify(value)).not.toContain('print(x)')
    const task = render()
    act(() => task.result.current.reportSandboxRun({ submission: 'x' }))
    expect(task.writers.recordSandboxRunSignal).not.toHaveBeenCalled()
  })

  it('adds personal-sandbox time when the student leaves it', () => {
    const { rerender, writers } = render({ inPersonalSandbox: true })
    now = 6000
    rerender({ inPersonalSandbox: false })
    expect(writers.addSandboxTimeSignal).toHaveBeenCalledWith(ID, 'personal', 5000)
  })
})

describe('Keyboard Wizard on the work area', () => {
  function keyOn(target, init) {
    const event = new KeyboardEvent('keydown', { bubbles: true, ...init })
    Object.defineProperty(event, 'target', { value: target })
    return event
  }

  function editor() {
    document.body.innerHTML =
      '<div class="cm-editor"><div class="cm-content" id="ed"></div></div>' +
      '<div class="injectionDiv"><svg class="blocklySvg"><g id="bl"></g></svg></div>' +
      '<div data-badge-surface="app-shortcuts"><textarea id="desk"></textarea></div>' +
      '<textarea id="quiz"></textarea>'
    return {
      ed: document.getElementById('ed'),
      bl: document.getElementById('bl'),
      desk: document.getElementById('desk'),
      quiz: document.getElementById('quiz'),
    }
  }

  it('finds the surface a key landed on', () => {
    const { ed, bl, desk, quiz } = editor()
    expect(workAreaSurfaceOf(ed)).toBe('code-editor')
    expect(workAreaSurfaceOf(bl)).toBe('blocks')
    expect(workAreaSurfaceOf(desk)).toBe('app-shortcuts')
    expect(workAreaSurfaceOf(quiz)).toBe(null)
  })

  it('matches listed shortcuts on the work area only', () => {
    const { ed, bl, quiz } = editor()
    expect(workAreaShortcutFor(keyOn(ed, { key: 'Enter', ctrlKey: true }))).toBe('run')
    expect(workAreaShortcutFor(keyOn(ed, { key: 'Enter', metaKey: true }))).toBe('run')
    expect(workAreaShortcutFor(keyOn(ed, { key: 'Tab' }))).toBe('indent')
    expect(workAreaShortcutFor(keyOn(bl, { key: 'Tab' }))).toBe(null)
    expect(workAreaShortcutFor(keyOn(bl, { key: 'Delete' }))).toBe('delete')
    expect(workAreaShortcutFor(keyOn(quiz, { key: 'Enter', ctrlKey: true }))).toBe(null)
    expect(workAreaShortcutFor(keyOn(ed, { key: 'c', ctrlKey: true }))).toBe(null)
  })

  it('ignores AltGr characters (Ctrl+Alt) and key repeats', () => {
    const { ed } = editor()
    expect(workAreaShortcutFor(keyOn(ed, { key: 'z', ctrlKey: true, altKey: true }))).toBe(null)
    const altGr = keyOn(ed, { key: '/', ctrlKey: true })
    altGr.getModifierState = (name) => name === 'AltGraph'
    expect(workAreaShortcutFor(altGr)).toBe(null)
    expect(workAreaShortcutFor(keyOn(ed, { key: 'z', ctrlKey: true, repeat: true }))).toBe(null)
  })

  it('counts copy/cut/paste by keyboard on the Desktop as a Desktop shortcut', () => {
    const { desk } = editor()
    expect(workAreaShortcutFor(keyOn(desk, { key: 'c', code: 'KeyC', ctrlKey: true }))).toBe(
      'desktop_shortcut'
    )
    expect(workAreaShortcutFor(keyOn(desk, { key: 'z', ctrlKey: true }))).toBe('undo')
  })

  it('records the first use through the hook, gated like every signal', () => {
    const { ed } = editor()
    const { result, writers } = render({ currentTaskId: 3 })
    act(() => result.current.handleWorkAreaKeyDown(keyOn(ed, { key: 's', ctrlKey: true })))
    expect(writers.recordShortcutSignal).toHaveBeenCalledWith(ID, 'save', {
      context: 'task',
      taskId: 3,
    })
    const presenter = render({ teacherPresentation: true })
    act(() =>
      presenter.result.current.handleWorkAreaKeyDown(keyOn(ed, { key: 's', ctrlKey: true }))
    )
    expect(presenter.writers.recordShortcutSignal).not.toHaveBeenCalled()
  })

  it('reports an accepted autocomplete with its context and task', () => {
    const { result, writers } = render({ currentTaskId: 3 })
    act(() => result.current.reportAutocomplete())
    expect(writers.recordAutocompleteSignal).toHaveBeenCalledWith(ID, {
      context: 'task',
      taskId: 3,
    })
    const preview = render({ previewMode: true })
    act(() => preview.result.current.reportAutocomplete())
    expect(preview.writers.recordAutocompleteSignal).not.toHaveBeenCalled()
  })
})

describe('sandbox archive snapshots (teacher side)', () => {
  it('picks the students whose run time moved, decoding file keys', () => {
    const students = {
      a: { lastRunAt: 10, currentCode: 'print(1)' },
      b: { lastRunAt: 20, currentFiles: { index__dot__html: '<p>' } },
      c: { lastRunAt: 30, currentCode: '' },
      d: { lastRunAt: null, currentCode: 'x' },
    }
    expect(pendingSandboxSnapshots(students, { seen: { a: 10 } })).toEqual([
      { anonymousId: 'b', at: 20, files: { 'index.html': '<p>' } },
    ])
    expect(lastRunTimes(students)).toEqual({ a: 10, b: 20, c: 30, d: null })
  })
})

describe('useSandboxArchiveSnapshots', () => {
  it('archives runs made during the visit, not work from before it', async () => {
    const { useSandboxArchiveSnapshots } = await import('../useSandboxArchiveSnapshots')
    const archive = vi.fn()
    const session = (students, state = 'sandbox') => ({ state, sandboxEnteredAt: 100, students })
    const { rerender } = renderHook(
      ({ s }) => useSandboxArchiveSnapshots({ session: s, archiveSandboxStudentSnapshot: archive }),
      { initialProps: { s: session({ a: { lastRunAt: 50, currentCode: 'old' } }) } }
    )
    expect(archive).not.toHaveBeenCalled()
    rerender({ s: session({ a: { lastRunAt: 120, currentCode: 'new' } }) })
    expect(archive).toHaveBeenCalledWith('a', { at: 120, code: 'new' })
    rerender({ s: session({ a: { lastRunAt: 120, currentCode: 'new' } }) })
    expect(archive).toHaveBeenCalledTimes(1)
    rerender({ s: session({ a: { lastRunAt: 130, currentCode: 'lesson' } }, 'active') })
    expect(archive).toHaveBeenCalledTimes(1)
  })
})
