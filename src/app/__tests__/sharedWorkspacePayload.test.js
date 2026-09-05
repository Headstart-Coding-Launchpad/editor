import { describe, it, expect } from 'vitest'
import {
  buildSharedWorkspaceSnapshot,
  buildShareIndexEntry,
  isSnapshotWithinLimit,
  measureSnapshotBytes,
  sortedShareEntries,
  SHARE_PAYLOAD_MAX_BYTES,
} from '../sharedWorkspacePayload'

const pythonLesson = { type: 'python', tasks: [{ id: 1, title: 'One' }] }
const htmlLesson = { type: 'html', tasks: [{ id: 1, title: 'One' }] }
const scratchLesson = { type: 'scratch', tasks: [{ id: 1, title: 'One' }] }
const fsLesson = { type: 'filesystem', tasks: [{ id: 1, title: 'One' }] }
const arcadeLesson = { type: 'arcade', tasks: [{ id: 1, title: 'One' }] }

describe('buildSharedWorkspaceSnapshot', () => {
  it('captures code for a code module', () => {
    const snap = buildSharedWorkspaceSnapshot({
      lesson: pythonLesson,
      taskId: 1,
      code: 'print("hi")',
      output: 'hi',
      runStatus: 'success',
    })
    expect(snap).toMatchObject({
      lessonType: 'python',
      taskId: 1,
      code: 'print("hi")',
      output: 'hi',
      runStatus: 'success',
      files: {},
      arcadeDesign: null,
    })
    expect(snap.capturedAt).toEqual(expect.any(Number))
  })

  it('captures a files map with real filenames for a files module', () => {
    const snap = buildSharedWorkspaceSnapshot({
      lesson: htmlLesson,
      taskId: 1,
      files: [
        { name: 'index.html', content: '<p>hi</p>' },
        { name: 'style.css', content: 'p{}' },
      ],
      activeFile: 'index.html',
    })
    // Encoding to Firebase-safe keys happens at the write boundary, not here.
    expect(snap.files).toEqual({ 'index.html': '<p>hi</p>', 'style.css': 'p{}' })
    expect(snap.activeFile).toBe('index.html')
  })

  it('reads Scratch blocks from scratchCode, not the generic code state', () => {
    const snap = buildSharedWorkspaceSnapshot({
      lesson: scratchLesson,
      taskId: 1,
      code: 'leftover from a previous task',
      scratchCode: '{"blocks":1}',
    })
    expect(snap.code).toBe('{"blocks":1}')
  })

  it('serializes filesystem state into code and sends no files', () => {
    const snap = buildSharedWorkspaceSnapshot({
      lesson: fsLesson,
      taskId: 1,
      fsState: { '/': ['a.txt'] },
      files: [{ name: 'ignored.txt', content: 'x' }],
    })
    expect(JSON.parse(snap.code)).toEqual({ '/': ['a.txt'] })
    expect(snap.files).toEqual({})
  })

  it('carries the arcade design only for arcade tasks', () => {
    const design = { sprites: [] }
    expect(
      buildSharedWorkspaceSnapshot({ lesson: arcadeLesson, taskId: 1, arcadeDesign: design })
        .arcadeDesign
    ).toBe(design)
    expect(
      buildSharedWorkspaceSnapshot({ lesson: pythonLesson, taskId: 1, arcadeDesign: design })
        .arcadeDesign
    ).toBe(null)
  })

  it('resolves the module from the task in a composed lesson, not lesson.type', () => {
    const composed = {
      type: 'composed',
      modules: [
        { id: 'py', type: 'python', title: 'Python' },
        { id: 'sc', type: 'scratch', title: 'Scratch' },
      ],
      tasks: [
        { id: 1, title: 'Py', moduleType: 'python', moduleId: 'py' },
        { id: 2, title: 'Scratch', moduleType: 'scratch', moduleId: 'sc' },
      ],
    }
    const pySnap = buildSharedWorkspaceSnapshot({
      lesson: composed,
      taskId: 1,
      code: 'print(1)',
      scratchCode: '{"blocks":1}',
    })
    const scratchSnap = buildSharedWorkspaceSnapshot({
      lesson: composed,
      taskId: 2,
      code: 'print(1)',
      scratchCode: '{"blocks":1}',
    })
    expect(pySnap.lessonType).toBe('python')
    expect(pySnap.code).toBe('print(1)')
    expect(scratchSnap.lessonType).toBe('scratch')
    expect(scratchSnap.code).toBe('{"blocks":1}')
  })

  it('omits live-only interaction state', () => {
    const snap = buildSharedWorkspaceSnapshot({ lesson: pythonLesson, taskId: 1, code: 'x' })
    for (const field of [
      'cursor',
      'blockDrag',
      'spriteState',
      'selection',
      'activity',
      'codeArrangeSlots',
    ]) {
      expect(snap).not.toHaveProperty(field)
    }
  })

  it('tolerates missing inputs', () => {
    const snap = buildSharedWorkspaceSnapshot({ lesson: null, taskId: null })
    expect(snap.code).toBe('')
    expect(snap.files).toEqual({})
    expect(snap.lessonType).toBe(null)
  })
})

describe('snapshot size limits', () => {
  it('accepts a normal snapshot', () => {
    const snap = buildSharedWorkspaceSnapshot({
      lesson: pythonLesson,
      taskId: 1,
      code: 'print("hi")',
    })
    expect(isSnapshotWithinLimit(snap)).toBe(true)
    expect(measureSnapshotBytes(snap)).toBeLessThan(SHARE_PAYLOAD_MAX_BYTES)
  })

  it('rejects an oversized snapshot', () => {
    const snap = buildSharedWorkspaceSnapshot({
      lesson: pythonLesson,
      taskId: 1,
      code: 'x'.repeat(SHARE_PAYLOAD_MAX_BYTES + 1),
    })
    expect(isSnapshotWithinLimit(snap)).toBe(false)
  })
})

describe('share index entries', () => {
  it('builds an index entry from the sharer and task', () => {
    const entry = buildShareIndexEntry({
      sharerId: 'stu-1',
      sharerName: 'Jamie',
      task: { title: 'Loops' },
      taskId: 4,
      lessonType: 'python',
      sharedBy: 'student',
    })
    expect(entry).toMatchObject({
      sharerId: 'stu-1',
      sharerName: 'Jamie',
      taskTitle: 'Loops',
      taskId: 4,
      lessonType: 'python',
      sharedBy: 'student',
    })
    expect(entry.sharedAt).toEqual(expect.any(Number))
  })

  it('falls back to a neutral name and rejects unknown sharedBy values', () => {
    const entry = buildShareIndexEntry({ sharerId: 'stu-1', sharedBy: 'someone-else' })
    expect(entry.sharerName).toBe('A student')
    expect(entry.sharedBy).toBe('student')
  })

  it('sorts entries newest first', () => {
    const sorted = sortedShareEntries({
      a: { sharedAt: 100, sharerName: 'A' },
      b: { sharedAt: 300, sharerName: 'B' },
      c: { sharedAt: 200, sharerName: 'C' },
    })
    expect(sorted.map((e) => e.shareId)).toEqual(['b', 'c', 'a'])
    expect(sorted[0]).toMatchObject({ shareId: 'b', sharerName: 'B' })
  })

  it('handles an empty index', () => {
    expect(sortedShareEntries(null)).toEqual([])
  })
})

describe('teacher-initiated share origin', () => {
  it('marks a teacher-started share distinctly from a student one', () => {
    expect(buildShareIndexEntry({ sharerId: 'a', sharedBy: 'teacher' }).sharedBy).toBe('teacher')
    expect(buildShareIndexEntry({ sharerId: 'a', sharedBy: 'student' }).sharedBy).toBe('student')
  })
})

