import { describe, expect, it } from 'vitest'
import { buildStudentLivePayload } from '../teacherLivePayload'

describe('buildStudentLivePayload', () => {
  it('decodes HTML files and preserves the broadcast payload fields', () => {
    const payload = buildStudentLivePayload({
      lesson: {
        type: 'html',
        tasks: [{ id: 8, entryFile: 'index.html' }],
      },
      taskId: 8,
      entryFileTaskId: 8,
      student: {
        anonymousId: 'student-1',
        displayName: 'Jamie',
        currentArcadeDesign: { sprites: [{ name: 'hero.png' }] },
        currentFiles: { index__dot__html: '<h1>Hello</h1>' },
        currentOutput: 'done',
        lastRunStatus: 'success',
        checkPassed: true,
      },
    })

    expect(payload).toMatchObject({
      source: 'student',
      sourceStudentId: 'student-1',
      taskId: 8,
      lessonType: 'html',
      files: { 'index.html': '<h1>Hello</h1>' },
      activeFile: 'index.html',
      arcadeDesign: { sprites: [{ name: 'hero.png' }] },
      checkPassed: true,
      checkAttempted: true,
    })
  })

  it('carries the student\'s in-progress code_arrange tile board so "Go Live for All" starts pre-seeded', () => {
    const payload = buildStudentLivePayload({
      lesson: { type: 'python', tasks: [{ id: 1 }] },
      taskId: 1,
      entryFileTaskId: 1,
      student: { currentCodeArrangeSlots: { L1: 'L1' } },
    })
    expect(payload.codeArrangeSlots).toEqual({ L1: 'L1' })
  })

  it('defaults codeArrangeSlots to null when the student has none', () => {
    const payload = buildStudentLivePayload({
      lesson: { type: 'python', tasks: [{ id: 1 }] },
      taskId: 1,
      entryFileTaskId: 1,
      student: {},
    })
    expect(payload.codeArrangeSlots).toBeNull()
  })

  it('uses a decoded file as the fallback active file for a task without an entry file', () => {
    const payload = buildStudentLivePayload({
      lesson: { type: 'html', tasks: [{ id: 1 }] },
      taskId: 1,
      entryFileTaskId: undefined,
      student: { currentFiles: { 'page.html': '' } },
    })
    expect(payload.activeFile).toBe('page.html')
    expect(payload.checkAttempted).toBe(false)
  })
})
