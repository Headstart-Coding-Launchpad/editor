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
        currentFiles: { 'index__dot__html': '<h1>Hello</h1>' },
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
