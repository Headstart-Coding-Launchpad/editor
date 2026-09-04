import { describe, expect, it } from 'vitest'
import { deriveStudentLiveDisplay, toTeacherLiveFiles } from '../studentLiveDisplay'

const localWorkspace = {
  code: 'local code',
  files: [{ name: 'index.html', content: 'local html', type: 'html' }],
  activeFile: 'index.html',
  output: 'local output',
  runStatus: 'success',
  checkPassed: true,
  checkAttempted: true,
  checkSuggestion: 'local suggestion',
  editorActivity: { type: 'click' },
}

describe('toTeacherLiveFiles', () => {
  it('converts live file maps to editor files using the existing type rules', () => {
    expect(
      toTeacherLiveFiles({
        'index.html': '<main />',
        'styles.css': 'body {}',
        'app.js': 'run()',
        'data.json': '{}',
      })
    ).toEqual([
      { name: 'index.html', content: '<main />', type: 'html' },
      { name: 'styles.css', content: 'body {}', type: 'css' },
      { name: 'app.js', content: 'run()', type: 'javascript' },
      { name: 'data.json', content: '{}', type: 'javascript' },
    ])
    expect(toTeacherLiveFiles(null)).toEqual([])
  })
})

describe('deriveStudentLiveDisplay', () => {
  const teacherBroadcast = {
    active: true,
    source: 'teacher',
    taskId: 2,
    code: 'live code',
    arcadeDesign: { sprites: [{ name: 'hero.png' }], maps: [] },
    files: { 'index.html': 'live html' },
    output: 'live output',
    selection: { from: 1, to: 2 },
    activity: { type: 'paste' },
    codeArrangeSlots: { slot1: 'fragment-a' },
    codeArrangeCursor: { tileId: 'fragment-a', x: 0.4, y: 0.6, at: 123 },
  }

  it('shows a teacher broadcast to students in a live lesson', () => {
    const display = deriveStudentLiveDisplay({
      ...localWorkspace,
      teacherPresentation: false,
      phase: 'lesson',
      teacherLive: teacherBroadcast,
      identityId: 'student-1',
      currentTaskId: 1,
      viewingTaskId: null,
    })

    expect(display.isTeacherLiveViewer).toBe(true)
    expect(display.isForcedTeacherLive).toBe(true)
    expect(display.displayedTaskId).toBe(2)
    expect(display.displayCode).toBe('live code')
    expect(display.displayArcadeDesign).toEqual({ sprites: [{ name: 'hero.png' }], maps: [] })
    expect(display.displayFiles).toEqual([
      { name: 'index.html', content: 'live html', type: 'html' },
    ])
    expect(display.displayOutput).toBe('live output')
    expect(display.displayCheckPassed).toBe(false)
    expect(display.displaySelection).toEqual({ from: 1, to: 2 })
    expect(display.displayActivity).toEqual({ type: 'paste' })
    expect(display.displayCodeArrangeSlots).toEqual({ slot1: 'fragment-a' })
    expect(display.displayCodeArrangeCursor).toEqual({
      tileId: 'fragment-a',
      x: 0.4,
      y: 0.6,
      at: 123,
    })
  })

  it('reports no live code_arrange state when not forced-teacher-live', () => {
    const display = deriveStudentLiveDisplay({
      ...localWorkspace,
      teacherPresentation: false,
      phase: 'solo',
      teacherLive: null,
      identityId: 'student-1',
      currentTaskId: 1,
      viewingTaskId: null,
    })

    expect(display.isForcedTeacherLive).toBe(false)
    expect(display.displayCodeArrangeSlots).toBeNull()
    expect(display.displayCodeArrangeCursor).toBeNull()
  })

  it('keeps the broadcasting student on their own workspace while classmates watch', () => {
    const studentBroadcast = {
      active: true,
      source: 'student',
      sourceStudentId: 'student-1',
      taskId: 3,
      code: 'shared student code',
    }
    const ownerDisplay = deriveStudentLiveDisplay({
      ...localWorkspace,
      teacherPresentation: false,
      phase: 'sandbox',
      teacherLive: studentBroadcast,
      identityId: 'student-1',
      currentTaskId: 1,
      viewingTaskId: 4,
    })
    const classmateDisplay = deriveStudentLiveDisplay({
      ...localWorkspace,
      teacherPresentation: false,
      phase: 'sandbox',
      teacherLive: studentBroadcast,
      identityId: 'student-2',
      currentTaskId: 1,
      viewingTaskId: 4,
    })

    expect(ownerDisplay.isForcedTeacherLive).toBe(false)
    expect(ownerDisplay.displayedTaskId).toBe(4)
    expect(ownerDisplay.displayCode).toBe('local code')
    expect(ownerDisplay.displayArcadeDesign).toBeNull()
    expect(classmateDisplay.isStudentGoLiveViewer).toBe(true)
    expect(classmateDisplay.displayedTaskId).toBe(3)
    expect(classmateDisplay.displayCode).toBe('shared student code')
    expect(classmateDisplay.displayArcadeDesign).toBeNull()
  })

  it("shows a student broadcast in presentation mode but treats teacher broadcast as the presenter's source", () => {
    const studentDisplay = deriveStudentLiveDisplay({
      ...localWorkspace,
      teacherPresentation: true,
      phase: 'lesson',
      teacherLive: { active: true, source: 'student', taskId: 3, code: 'student screen' },
      currentTaskId: 1,
      viewingTaskId: null,
    })
    const teacherDisplay = deriveStudentLiveDisplay({
      ...localWorkspace,
      teacherPresentation: true,
      phase: 'lesson',
      teacherLive: teacherBroadcast,
      currentTaskId: 1,
      viewingTaskId: null,
    })

    expect(studentDisplay.isPresentationStudentViewer).toBe(true)
    expect(studentDisplay.displayCode).toBe('student screen')
    expect(teacherDisplay.isTeacherLiveActive).toBe(true)
    expect(teacherDisplay.isForcedTeacherLive).toBe(false)
    expect(teacherDisplay.displayCode).toBe('local code')
  })
})
