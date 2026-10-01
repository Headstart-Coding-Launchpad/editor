// html (per-file work) and scratch (workspace-owned work) on the generic work slot (plan step
// 4.5): html's value is `{ files, activeFile }`, stored one record per file and published on
// the files channel; Scratch's is the workspace states it last reported, with restored blocks
// pushed to the workspace and its own check reports going through reportRun. The Phase 0
// characterisation suites pin the bytes; these tests cover what the migration adds.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from '@testing-library/react'
import {
  ANON,
  actAsync,
  actSync,
  fileKey,
  makeSession,
  mockHtmlPreview,
  renderStudentCodeState,
  storedKeys,
  studentSourcedTeacherLive,
  taskKey,
  writeStored,
} from '../../../test/studentCodeStateHarness'
import {
  htmlFile,
  htmlLesson,
  pythonLesson,
  scratchBlocks,
  scratchLesson,
} from '../../../test/fixtures/studentCodeStateLessons'

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

// StudentView's task change: save, reset, then the new task id.
function goToTask(h, taskId) {
  actSync(() => h.result.current.saveCurrentWork())
  actSync(() => h.result.current.resetForTaskChange())
  h.update({ currentTaskId: taskId })
}

const payloads = (h) => h.writers.updateTeacherLive.mock.calls.map(([payload]) => payload)
const payloadsFor = (h, taskId) => payloads(h).filter((p) => p.taskId === taskId)

const composedWebLesson = () => ({
  id: 'lesson-1',
  type: 'composed',
  title: 'composed web lesson',
  tasks: [
    { id: 'p1', title: 'Python', moduleType: 'python', starterCode: 'x = 1' },
    {
      id: 'h1',
      title: 'Web 1',
      moduleType: 'html',
      entryFile: 'index.html',
      starterFiles: [htmlFile('<p>h1</p>'), htmlFile('p {}', 'style.css', 'css')],
    },
    {
      id: 's1',
      title: 'Blocks',
      moduleType: 'scratch',
      starterBlocks: scratchBlocks('s1'),
      check: [{ type: 'sprite_moved', hint: 'Move the cat' }],
    },
    {
      id: 'h2',
      title: 'Web 2',
      moduleType: 'html',
      entryFile: 'page.html',
      starterFiles: [htmlFile('<p>h2</p>', 'page.html')],
    },
  ],
})

describe('files + scratch work slot — composed python → html → scratch → html', () => {
  it('never publishes a leftover code, file map or active file', () => {
    const h = renderStudentCodeState({
      lesson: composedWebLesson(),
      currentTaskId: 'p1',
      session: makeSession({ teacherLive: studentSourcedTeacherLive() }),
    })
    actSync(() => h.result.current.handleCodeChange('x = 99'))

    h.writers.updateTeacherLive.mockClear()
    goToTask(h, 'h1')
    const webPayloads = payloadsFor(h, 'h1')
    expect(webPayloads.length).toBeGreaterThan(0)
    for (const payload of webPayloads) {
      expect(payload.lessonType).toBe('html')
      // Before plan step 4.5 an html task's payload carried the previous python task's code.
      expect(payload.code).toBe('')
    }
    expect(webPayloads.at(-1)).toMatchObject({
      files: { 'index.html': '<p>h1</p>', 'style.css': 'p {}' },
      activeFile: 'index.html',
    })
    expect(h.result.current.work).toMatchObject({ moduleType: 'html', taskId: 'h1' })
    // The code alias only speaks for code-string modules.
    expect(h.result.current.code).toBe('')
    actSync(() => h.result.current.handleFileChange('index.html', '<h1>edited</h1>'))
    actSync(() => h.result.current.handleFileTabChange('style.css'))

    h.writers.updateTeacherLive.mockClear()
    goToTask(h, 's1')
    const blockPayloads = payloadsFor(h, 's1')
    expect(blockPayloads.length).toBeGreaterThan(0)
    for (const payload of blockPayloads) {
      expect(payload.lessonType).toBe('scratch')
      expect(payload.code).toBe('')
      expect(payload.files).toEqual({})
      expect(payload.activeFile).toBe('')
    }
    expect(h.result.current.files).toEqual([])
    expect(h.result.current.activeFile).toBe('')
    actSync(() => h.result.current.handleScratchChange(scratchBlocks('mine')))
    expect(payloads(h).at(-1)).toMatchObject({
      lessonType: 'scratch',
      code: JSON.stringify(scratchBlocks('mine')),
      files: {},
    })

    h.writers.updateTeacherLive.mockClear()
    goToTask(h, 'h2')
    const secondWebPayloads = payloadsFor(h, 'h2')
    expect(secondWebPayloads.length).toBeGreaterThan(0)
    for (const payload of secondWebPayloads) {
      expect(payload.lessonType).toBe('html')
      expect(payload.code).toBe('')
      // Never the first html task's files (the first publish can precede the load: empty).
      expect([{}, { 'page.html': '<p>h2</p>' }]).toContainEqual(payload.files)
    }
    expect(secondWebPayloads.at(-1)).toMatchObject({
      files: { 'page.html': '<p>h2</p>' },
      activeFile: 'page.html',
    })

    // Each task kept its own records, in its own shape.
    expect(JSON.parse(localStorage.getItem(taskKey('p1')))).toMatchObject({ code: 'x = 99' })
    expect(JSON.parse(localStorage.getItem(fileKey('h1', 'index.html')))).toEqual({
      content: '<h1>edited</h1>',
    })
    expect(JSON.parse(localStorage.getItem(taskKey('s1')))).toEqual({
      state: scratchBlocks('mine'),
    })
  })

  it('the share snapshot follows the task module, never a leftover', () => {
    const h = renderStudentCodeState({ lesson: composedWebLesson(), currentTaskId: 'h1' })
    goToTask(h, 's1')
    expect(h.result.current.buildShareSnapshot()).toMatchObject({
      lessonType: 'scratch',
      code: '',
      files: {},
      activeFile: '',
    })
    actSync(() => h.result.current.handleScratchChange(scratchBlocks('shared')))
    expect(h.result.current.buildShareSnapshot().code).toBe(JSON.stringify(scratchBlocks('shared')))
    goToTask(h, 'h2')
    expect(h.result.current.buildShareSnapshot()).toMatchObject({
      lessonType: 'html',
      code: '',
      files: { 'page.html': '<p>h2</p>' },
      activeFile: 'page.html',
    })
  })

  it("a Scratch workspace's unmount flush after the lesson moved on never replaces the new module's work", () => {
    const lesson = composedWebLesson()
    lesson.tasks.splice(3, 0, {
      id: 'p2',
      title: 'Python again',
      moduleType: 'python',
      starterCode: 'y = 2',
    })
    const h = renderStudentCodeState({ lesson, currentTaskId: 's1' })
    // The workspace holds the handler it was last rendered with.
    const staleScratchChange = h.result.current.handleScratchChange
    goToTask(h, 'p2')
    actSync(() => staleScratchChange(scratchBlocks('flushed')))
    expect(h.result.current.code).toBe('y = 2')
    expect(h.result.current.work).toMatchObject({ moduleType: 'python', value: 'y = 2' })
    // The flushed report is still saved to the Scratch task.
    expect(JSON.parse(localStorage.getItem(taskKey('s1')))).toEqual({
      state: scratchBlocks('flushed'),
    })
  })
})

describe('html preview — the iframe is only built on Run', () => {
  it('file edits, tab changes and generic work changes never rebuild the preview', async () => {
    const { build } = mockHtmlPreview({ src: 'blob:run-1', text: '' })
    const h = renderStudentCodeState({
      lesson: htmlLesson(),
      currentTaskId: 't1',
      session: makeSession({ activeStudentView: ANON }),
    })
    await actAsync(() => h.result.current.handleRun())
    await act(async () => {})
    expect(build).toHaveBeenCalledTimes(1)
    expect(h.result.current.iframeSrc).toBe('blob:run-1')

    h.writers.writeStudentFiles.mockClear()
    for (const content of ['<h1>', '<h1>a', '<h1>ab</h1>']) {
      actSync(() => h.result.current.handleFileChange('index.html', content))
    }
    actSync(() => h.result.current.handleFileTabChange('style.css'))
    actSync(() =>
      h.result.current.handleWorkChange({
        files: [htmlFile('<p>whole</p>'), htmlFile('p {}', 'style.css', 'css')],
        activeFile: 'style.css',
      })
    )
    expect(build).toHaveBeenCalledTimes(1)
    expect(h.result.current.iframeSrc).toBe('blob:run-1')
    // The watched per-keystroke mirror is the file map, not a preview.
    expect(h.writers.writeStudentFiles).toHaveBeenCalledTimes(4)
  })

  it('the next Run builds from the edited files', async () => {
    const { build } = mockHtmlPreview({ src: 'blob:run-2', text: '' })
    const h = renderStudentCodeState({ lesson: htmlLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleFileChange('index.html', '<h1>new</h1>'))
    expect(build).not.toHaveBeenCalled()
    await actAsync(() => h.result.current.handleRun())
    await act(async () => {})
    expect(build.mock.calls[0][0].files.map((f) => f.content)).toEqual(['<h1>new</h1>', 'p {}'])
  })
})

describe('handleWorkChange — files module', () => {
  it('saves only the files whose content changed and publishes the file map', () => {
    const h = renderStudentCodeState({
      lesson: htmlLesson(),
      currentTaskId: 't1',
      session: makeSession({ teacherLive: studentSourcedTeacherLive() }),
    })
    actSync(() =>
      h.result.current.handleWorkChange({
        files: [htmlFile('<p>start</p>'), htmlFile('h1 {}', 'style.css', 'css')],
        activeFile: 'style.css',
      })
    )
    expect(storedKeys()).toEqual([fileKey('t1', 'style.css')])
    expect(h.result.current.activeFile).toBe('style.css')
    expect(payloads(h).at(-1)).toMatchObject({
      files: { 'index.html': '<p>start</p>', 'style.css': 'h1 {}' },
      activeFile: 'style.css',
      code: '',
    })
  })

  it('handleCodeChange is not a files module entry point', () => {
    const h = renderStudentCodeState({ lesson: htmlLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.handleCodeChange('print("no")'))
    expect(h.result.current.files.map((f) => f.content)).toEqual(['<p>start</p>', 'p {}'])
    expect(storedKeys()).toEqual([])
  })
})

describe('scratch — reportRun (workspace-owned checks)', () => {
  it('handleScratchCheck delegates to reportRun: the reported work is written and logged', () => {
    const h = renderStudentCodeState({ lesson: scratchLesson(), currentTaskId: 't1' })
    const states = scratchBlocks('reported')
    actSync(() => h.result.current.reportRun({ passed: true, work: states }))
    expect(h.writers.writeStudentRun).toHaveBeenCalledWith(ANON, {
      code: JSON.stringify(states),
      status: 'success',
      checkPassed: true,
    })
    expect(h.writers.logAttempt).toHaveBeenCalledWith(ANON, 't1', {
      submission: states,
      passed: true,
      suggestion: '',
    })
    expect(h.result.current.checkPassed).toBe(true)
  })

  it("a failing report uses the workspace's suggestion (never a check's own hint) and the saved work", () => {
    writeStored(taskKey('t1'), { state: scratchBlocks('saved') })
    const h = renderStudentCodeState({ lesson: scratchLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.reportRun({ passed: false, suggestion: '  Use a loop ' }))
    expect(h.writers.logAttempt.mock.calls[0][2]).toEqual({
      submission: scratchBlocks('saved'),
      passed: false,
      suggestion: 'Use a loop',
    })
    actSync(() => h.result.current.reportRun({ passed: false }))
    // No suggestion from the workspace means no failed check had a hint: the generic banner
    // shows. It must not fall back to the first check's hint, which may belong to a check
    // that passed (matches Python/HTML).
    expect(h.writers.logAttempt.mock.calls[1][2].suggestion).toBe('')
    expect(h.result.current.checkSuggestion).toBe('')
  })

  it('a module not checked by its workspace gets local feedback only', () => {
    const h = renderStudentCodeState({ lesson: pythonLesson(), currentTaskId: 't1' })
    actSync(() => h.result.current.reportRun({ passed: true, work: 'print(1)' }))
    expect(h.writers.writeStudentRun).not.toHaveBeenCalled()
    expect(h.writers.logAttempt).not.toHaveBeenCalled()
  })

  it('restored blocks are pushed to the workspace, never set as its reported work', () => {
    const h = renderStudentCodeState({
      lesson: scratchLesson(),
      currentTaskId: 't1',
      session: makeSession({ teacherLive: studentSourcedTeacherLive() }),
    })
    actSync(() => h.result.current.handleShowCodeStage(0))
    expect(h.result.current.scratchExternalState).toEqual(scratchBlocks('stage0'))
    expect(h.result.current.scratchActiveStageIndex).toBe(0)
    expect(h.result.current.work).toMatchObject({ moduleType: 'scratch', value: null })
    expect(payloads(h).at(-1).code).toBe('')
    // The workspace loads the pushed blocks and reports them back as an edit.
    actSync(() => h.result.current.handleScratchChange(scratchBlocks('stage0')))
    expect(h.result.current.work.value).toEqual(scratchBlocks('stage0'))
    expect(payloads(h).at(-1).code).toBe(JSON.stringify(scratchBlocks('stage0')))
    // Moving task clears the pushed blocks so they can't overwrite the next task's.
    actSync(() => h.result.current.resetForTaskChange())
    expect(h.result.current.scratchExternalState).toBe(null)
  })
})
