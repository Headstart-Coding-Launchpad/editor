// The generic work slot (module contract v2, plan steps 4.3–4.4): filesystem, desktop and the
// code modules keep their work in one `{ moduleType, taskId, value }` slot driven by their
// definitions' `workSlot` and `checking` groups (the code modules are covered in
// useStudentCodeState.codeWorkSlot.test.js). The Phase 0 characterisation suites pin the bytes; these tests cover what
// the slot adds — a composed lesson switching modules never publishes, mirrors or saves the
// previous module's work, and handlers read the work they have just set (workRef), not the
// last render's.
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ANON,
  actSync,
  makeSession,
  renderStudentCodeState,
  studentSourcedTeacherLive,
  taskKey,
} from '../../../test/studentCodeStateHarness'
import {
  desktopLesson,
  desktopWith,
  filesystemLesson,
  fsWith,
  normalisedDesktopWith,
} from '../../../test/fixtures/studentCodeStateLessons'
import { DEFAULT_FS } from '../../../modules/filesystem/filesystem'

vi.mock('../../../modules/python/pyodide', async () =>
  (await import('../../../test/studentCodeStateMocks')).pyodideMock()
)
vi.mock('../../../shared/useTypeAssets', async () =>
  (await import('../../../test/studentCodeStateMocks')).typeAssetsMock()
)
vi.mock('../../../shared/useLessonStorageAssets', async () =>
  (await import('../../../test/studentCodeStateMocks')).lessonStorageAssetsMock()
)

afterEach(() => {
  vi.restoreAllMocks()
})

const composedModulesLesson = () => ({
  id: 'lesson-1',
  type: 'composed',
  title: 'composed lesson',
  tasks: [
    { id: 'c1', title: 'Python', moduleType: 'python', starterCode: 'x = 1' },
    { id: 'c2', title: 'Files', moduleType: 'filesystem', starterFs: fsWith('c2.txt') },
    {
      id: 'c3',
      title: 'Desktop',
      moduleType: 'desktop',
      availableApps: ['fileManager'],
      starterDesktop: desktopWith('c3.txt'),
    },
    { id: 'c4', title: 'More files', moduleType: 'filesystem', starterFs: fsWith('c4.txt') },
  ],
})

// StudentView's task change: save, reset, then the new task id.
function goToTask(h, taskId) {
  actSync(() => h.result.current.saveCurrentWork())
  actSync(() => h.result.current.resetForTaskChange())
  h.update({ currentTaskId: taskId })
}

const payloads = (h) => h.writers.updateTeacherLive.mock.calls.map(([payload]) => payload)

describe('generic work slot — composed lesson module switches', () => {
  it('python → filesystem → desktop → filesystem never publishes a leftover value', () => {
    const h = renderStudentCodeState({
      lesson: composedModulesLesson(),
      currentTaskId: 'c1',
      session: makeSession({ teacherLive: studentSourcedTeacherLive() }),
    })
    // Python joined the slot in plan step 4.4 (it held no work here before).
    expect(h.result.current.work).toEqual({ moduleType: 'python', taskId: 'c1', value: 'x = 1' })

    goToTask(h, 'c2')
    expect(h.result.current.work).toEqual({
      moduleType: 'filesystem',
      taskId: 'c2',
      value: fsWith('c2.txt'),
    })
    // Nothing the python task held ever travels as filesystem work.
    for (const payload of payloads(h).filter((p) => p.lessonType === 'filesystem')) {
      expect(payload.files).toEqual({})
      expect(() => JSON.parse(payload.code)).not.toThrow()
    }
    const edited = fsWith('c2.txt', 'edited.txt')
    actSync(() => h.result.current.handleFsChange(edited))
    expect(payloads(h).at(-1)).toMatchObject({
      lessonType: 'filesystem',
      taskId: 'c2',
      code: JSON.stringify(edited),
    })

    h.writers.updateTeacherLive.mockClear()
    goToTask(h, 'c3')
    const desktopPayloads = payloads(h).filter((p) => p.taskId === 'c3')
    expect(desktopPayloads.length).toBeGreaterThan(0)
    for (const payload of desktopPayloads) {
      expect(payload.lessonType).toBe('desktop')
      expect(payload.code).not.toContain('edited.txt')
      expect(JSON.parse(payload.code)).toHaveProperty('windows')
    }
    expect(payloads(h).at(-1).code).toBe(JSON.stringify(normalisedDesktopWith('c3.txt')))
    // The filesystem alias no longer exposes the other module's work.
    expect(h.result.current.fsState).toBe(DEFAULT_FS)
    expect(h.result.current.desktopState).toEqual(normalisedDesktopWith('c3.txt'))

    const desktopEdit = normalisedDesktopWith('c3.txt', 'desk.txt')
    actSync(() => h.result.current.handleDesktopChange(desktopEdit))

    h.writers.updateTeacherLive.mockClear()
    goToTask(h, 'c4')
    const c4Payloads = payloads(h).filter((p) => p.taskId === 'c4')
    expect(c4Payloads.length).toBeGreaterThan(0)
    for (const payload of c4Payloads) {
      expect(payload.lessonType).toBe('filesystem')
      // Neither the earlier filesystem task's work nor the desktop's.
      expect(payload.code).not.toContain('edited.txt')
      expect(payload.code).not.toContain('desk.txt')
    }
    expect(payloads(h).at(-1).code).toBe(JSON.stringify(fsWith('c4.txt')))

    // Each task kept its own record.
    expect(JSON.parse(localStorage.getItem(taskKey('c2')))).toEqual({ fs: edited })
    expect(JSON.parse(localStorage.getItem(taskKey('c3')))).toEqual({ desktop: desktopEdit })
  })

  it('watch-start mirrors the current module’s work, not the previous module’s', () => {
    const h = renderStudentCodeState({ lesson: composedModulesLesson(), currentTaskId: 'c2' })
    actSync(() => h.result.current.handleFsChange(fsWith('c2.txt', 'edited.txt')))
    goToTask(h, 'c3')
    h.updateSession({ activeStudentView: ANON })
    expect(h.writers.writeStudentCode.mock.calls).toEqual([
      [ANON, JSON.stringify(normalisedDesktopWith('c3.txt'))],
    ])
  })

  it('the share snapshot uses the task module’s work', () => {
    const h = renderStudentCodeState({ lesson: composedModulesLesson(), currentTaskId: 'c2' })
    actSync(() => h.result.current.handleFsChange(fsWith('c2.txt', 'edited.txt')))
    goToTask(h, 'c3')
    expect(h.result.current.buildShareSnapshot()).toMatchObject({
      lessonType: 'desktop',
      taskId: 'c3',
      code: JSON.stringify(normalisedDesktopWith('c3.txt')),
      files: {},
    })
  })
})

describe('generic work slot — workRef freshness', () => {
  it('desktop: an interaction right after a change checks and reports the new work', () => {
    const h = renderStudentCodeState({ lesson: desktopLesson(), currentTaskId: 't1' })
    const next = normalisedDesktopWith('start.txt', 'done.txt')
    // Desktop opening a file: handleDesktopChange then handleDesktopInteraction in one event.
    actSync(() => {
      h.result.current.handleDesktopChange(next)
      h.result.current.handleDesktopInteraction({ currentDir: '/', openFile: '/done.txt' })
    })
    expect(h.writers.writeStudentRun).toHaveBeenCalledTimes(2)
    expect(h.writers.writeStudentRun.mock.calls.at(-1)).toEqual([
      ANON,
      { code: JSON.stringify(next), status: 'success', checkPassed: true },
    ])
    expect(h.writers.logAttempt.mock.calls.at(-1)[2]).toEqual({
      submission: next,
      passed: true,
      suggestion: '',
    })
    expect(h.result.current.desktopInteraction).toEqual({ currentDir: '/', openFile: '/done.txt' })
  })

  it('filesystem: consecutive changes in one event each see the previous one', () => {
    const h = renderStudentCodeState({ lesson: filesystemLesson(), currentTaskId: 't1' })
    const first = fsWith('start.txt', 'a.txt')
    const second = fsWith('start.txt', 'a.txt', 'done.txt')
    actSync(() => {
      h.result.current.handleFsChange(first)
      h.result.current.handleFsChange(second)
      h.result.current.handleFsInteraction({ currentDir: '/docs', openFile: null })
    })
    expect(h.writers.writeStudentRun.mock.calls.map(([, run]) => run.code)).toEqual([
      JSON.stringify(first),
      JSON.stringify(second),
      JSON.stringify(second),
    ])
    expect(h.result.current.fsState).toBe(second)
    expect(h.result.current.fsInteraction).toEqual({ currentDir: '/docs', openFile: null })
  })

  it('handleWorkChange defaults to the current lesson module', () => {
    const h = renderStudentCodeState({ lesson: filesystemLesson(), currentTaskId: 't1' })
    const next = fsWith('start.txt', 'done.txt')
    actSync(() => h.result.current.handleWorkChange(next))
    expect(localStorage.getItem(taskKey('t1'))).toBe(JSON.stringify({ fs: next }))
    expect(h.result.current.work).toEqual({ moduleType: 'filesystem', taskId: 't1', value: next })
    expect(h.result.current.checkPassed).toBe(true)
  })
})
