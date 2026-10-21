import { describe, expect, it, vi } from 'vitest'
import { studentShareKey } from '../shareLink.js'
import { makeSessionShareLinks, sessionStudents, withTimeout } from '../sessionShareLinks.js'

const lesson = {
  id: 'L1',
  type: 'python',
  tasks: [
    { id: 1, title: 'First', taskType: 'code' },
    { id: 2, title: 'Second', taskType: 'code' },
  ],
}

// A stand-in exporter: live work is the student's currentCode; a submission is its code.
const exporter = {
  readLive: (student) => (student?.currentCode ? { code: student.currentCode } : null),
  readSubmission: (submission) => (submission ? { code: submission } : null),
  sharePayload: (item) => ({ code: item.work.code }),
}

function setup(session, create = vi.fn(async () => ({ ok: true, id: 'abc', expiresAtMs: 99 }))) {
  return {
    create,
    run: () =>
      makeSessionShareLinks({
        lesson,
        session,
        uid: 'tutor',
        hasExporter: () => true,
        getExporter: () => exporter,
        create,
        urlFor: (id) => `https://x/#/share/${id}`,
      }),
  }
}

describe('studentShareKey', () => {
  it('is stable for the same id, differs between ids and never contains the id', () => {
    expect(studentShareKey('anon-123')).toBe(studentShareKey('anon-123'))
    expect(studentShareKey('anon-123')).not.toBe(studentShareKey('anon-124'))
    expect(studentShareKey('anon-123')).toMatch(/^s_[0-9a-z]+$/)
    expect(studentShareKey('anon-123')).not.toContain('anon')
  })
})

describe('sessionStudents', () => {
  it('includes the roster and students who only have logged attempts', () => {
    const ids = sessionStudents({
      students: { a: { displayName: 'Ann' } },
      attemptLog: { b: {} },
    }).map((s) => s.anonymousId)
    expect(ids).toEqual(['a', 'b'])
  })
})

describe('makeSessionShareLinks', () => {
  it('makes one nameless link per student with work, for their last task with work', async () => {
    const session = {
      currentTaskId: 2,
      students: {
        a: { displayName: 'Ann', currentCode: 'print(2)' },
        b: { displayName: 'Ben' },
      },
      attemptLog: {
        b: { 1: { x: { submission: 'print(1)', loggedAt: 5, attemptNumber: 1 } } },
      },
    }
    const { run, create } = setup(session)
    const links = await run()
    expect(links).toEqual([
      {
        studentKey: studentShareKey('a'),
        kind: 'python',
        taskId: 2,
        taskTitle: 'Second',
        shareId: 'abc',
        url: 'https://x/#/share/abc',
        expiresAt: 99,
      },
      expect.objectContaining({ studentKey: studentShareKey('b'), taskId: 1 }),
    ])
    expect(create).toHaveBeenCalledWith({
      kind: 'python',
      title: 'Second',
      payload: { code: 'print(2)' },
      uid: 'tutor',
    })
    expect(JSON.stringify(create.mock.calls)).not.toMatch(/Ann|Ben/)
  })

  it('skips students with no work and reports a link that could not be made', async () => {
    const session = {
      currentTaskId: 1,
      students: { a: { currentCode: 'x = 1' }, b: {} },
    }
    const create = vi.fn(async () => ({ ok: false, message: 'too big' }))
    const links = await setup(session, create).run()
    expect(links).toEqual([{ studentKey: studentShareKey('a'), error: 'too big' }])
  })

  it('makes nothing without a signed-in tutor', async () => {
    const links = await makeSessionShareLinks({
      lesson,
      session: { students: { a: { currentCode: 'x' } }, currentTaskId: 1 },
      uid: null,
      hasExporter: () => true,
      getExporter: () => exporter,
      create: vi.fn(),
      urlFor: (id) => id,
    })
    expect(links).toEqual([])
  })
})

describe('withTimeout', () => {
  it('falls back when the promise is too slow', async () => {
    vi.useFakeTimers()
    const pending = withTimeout(new Promise(() => {}), 100, 'late')
    vi.advanceTimersByTime(100)
    await expect(pending).resolves.toBe('late')
    vi.useRealTimers()
  })
})
