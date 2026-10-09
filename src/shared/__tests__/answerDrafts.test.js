// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  ANSWER_DRAFT_MAX_LENGTH,
  buildDraftRecord,
  draftLogUpdates,
  fillBlankDraftText,
  lastDraftFor,
  normalizeDraftText,
  readAnswerDraft,
} from '../answerDrafts'
import { buildSessionReport } from '../lessonReport'
import {
  FILL_BLANK_DRAG_TASK,
  OPEN_SHORT_ANSWER_TASK,
  SHORT_ANSWER_TASK,
} from '../../test/fixtures/legacyActivityTasks'

describe('answer drafts', () => {
  it('normalises draft text: blank is nothing, long text is cut', () => {
    expect(normalizeDraftText('  ')).toBe('')
    expect(normalizeDraftText(null)).toBe('')
    expect(normalizeDraftText(' It prints ')).toBe(' It prints ')
    expect(normalizeDraftText('x'.repeat(ANSWER_DRAFT_MAX_LENGTH + 5))).toHaveLength(
      ANSWER_DRAFT_MAX_LENGTH
    )
  })

  it('builds the currentDraft record, or null to clear it', () => {
    expect(buildDraftRecord(6, 'It prints', 100)).toEqual({ taskId: 6, text: 'It prints', at: 100 })
    expect(buildDraftRecord(6, '   ', 100)).toBeNull()
    expect(buildDraftRecord(null, 'text', 100)).toBeNull()
  })

  it('reads a draft only for the given task', () => {
    const student = { currentDraft: { taskId: 6, text: 'It prints', at: 1 } }
    expect(readAnswerDraft(student, 6)).toBe('It prints')
    expect(readAnswerDraft(student, '6')).toBe('It prints')
    expect(readAnswerDraft(student, 7)).toBeNull()
    expect(readAnswerDraft({ currentDraft: { taskId: 6, text: ' ' } }, 6)).toBeNull()
    expect(readAnswerDraft({}, 6)).toBeNull()
  })

  it('joins typed gaps into one line', () => {
    const task = { ...FILL_BLANK_DRAG_TASK, mode: 'type' }
    expect(fillBlankDraftText(task, { b1: 'print' })).toBe('print · ___')
    expect(fillBlankDraftText(task, { b1: 'print', b2: ' input ' })).toBe('print · input')
    expect(fillBlankDraftText(task, { b1: '  ' })).toBe('')
  })

  it('keeps a draft for the report when the class moves on, unless the student submitted', () => {
    const session = {
      students: {
        a: { currentDraft: { taskId: 6, text: 'Loops repeat', at: 5 } },
        b: { currentDraft: { taskId: 6, text: 'Submitted already', at: 5 } },
        c: { currentDraft: null },
        d: { currentDraft: { taskId: 6, text: 'Left on leave', at: 7 } },
      },
      attemptLog: {
        b: { 6: { k: { passed: true, submission: 'x' } } },
        // An auto-check on leave is not a submission.
        d: { 6: { k: { auto: 'leave', passed: false } } },
      },
    }
    expect(draftLogUpdates(session)).toEqual({
      'draftLog/a/6': { text: 'Loops repeat', at: 5 },
      'draftLog/d/6': { text: 'Left on leave', at: 7 },
    })
  })

  it('finds the last draft: the live one for the current task, otherwise the log', () => {
    const session = {
      students: { a: { currentDraft: { taskId: 6, text: 'Now', at: 9 } } },
      draftLog: { a: { 5: { text: 'Earlier', at: 1 } } },
    }
    expect(lastDraftFor(session, 'a', 6)).toBe('Now')
    expect(lastDraftFor(session, 'a', 5)).toBe('Earlier')
    expect(lastDraftFor(session, 'a', 4)).toBeNull()
    expect(lastDraftFor(session, 'z', 6)).toBeNull()
  })
})

describe('lastDraft in the session report', () => {
  const lesson = {
    id: 'l',
    title: 'L',
    type: 'python',
    tasks: [SHORT_ANSWER_TASK, OPEN_SHORT_ANSWER_TASK],
  }

  it('reports the last draft of a student who never submitted, never as an attempt', () => {
    const session = {
      students: {
        a: { displayName: 'A', currentDraft: { taskId: 6, text: 'I learned loo', at: 9 } },
        b: { displayName: 'B' },
      },
      draftLog: { a: { 5: { text: 'It shows tex', at: 2 } }, b: { 5: { text: 'Old', at: 1 } } },
      attemptLog: {
        b: { 5: { k: { attemptNumber: 1, passed: true, submission: 'It shows text' } } },
      },
    }
    const report = buildSessionReport({ session, lesson })
    const [alice, bob] = report.students
    const aliceShort = alice.tasks.find((t) => t.taskId === 5)
    const aliceOpen = alice.tasks.find((t) => t.taskId === 6)
    expect(aliceShort).toMatchObject({
      lastDraft: 'It shows tex',
      attempts: 0,
      finalResult: 'not_attempted',
    })
    expect(aliceShort.distinctAttempts).toEqual([])
    expect(aliceOpen.lastDraft).toBe('I learned loo')
    // Bob submitted task 5, so his draft is not reported.
    expect(bob.tasks.find((t) => t.taskId === 5).lastDraft).toBeUndefined()
  })
})
