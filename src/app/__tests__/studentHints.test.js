import { describe, expect, it } from 'vitest'
import {
  HINT_TEXT_MAX,
  buildStudentHintState,
  describeHintOffer,
  hintPlainText,
  lastErrorLine,
  readHintOffer,
  readStudentHint,
  summariseCommonHints,
} from '../studentHints.js'

const task = {
  id: 't1',
  codeStages: [{ label: 'Starter' }, { label: 'Hint: the loop' }, { label: 'Complete' }],
}

function build(overrides = {}) {
  return buildStudentHintState({
    task,
    taskId: 't1',
    checkAttempted: true,
    checkPassed: false,
    checkSuggestion: 'Remember the **quotes**',
    checkFailCount: 2,
    studentData: {},
    targetedStageOffer: null,
    offeredSupportStageIndex: null,
    ...overrides,
  })
}

describe('lastErrorLine', () => {
  it('returns the last non-empty line of the output', () => {
    expect(lastErrorLine('hello\nLine 3: NameError: x\n\n')).toBe('Line 3: NameError: x')
  })

  it('returns null for empty output', () => {
    expect(lastErrorLine('')).toBeNull()
    expect(lastErrorLine(null)).toBeNull()
  })

  it('clips very long lines', () => {
    expect(lastErrorLine('x'.repeat(1000)).length).toBeLessThanOrEqual(300)
  })
})

describe('buildStudentHintState', () => {
  it('publishes the failed-check hint with its fail streak', () => {
    expect(build()).toEqual({
      studentHint: {
        text: 'Remember the **quotes**',
        source: 'check',
        failStreak: 2,
        taskId: 't1',
      },
      hintOffer: null,
    })
  })

  it('clears both on a pass', () => {
    expect(build({ checkPassed: true, offeredSupportStageIndex: 1 })).toEqual({
      studentHint: null,
      hintOffer: null,
    })
  })

  it('leaves the hint alone until a run has a result', () => {
    expect(build({ checkAttempted: false, checkSuggestion: '' }).studentHint).toBeUndefined()
  })

  it('clears the hint when a failed run shows no hint text', () => {
    expect(build({ checkSuggestion: '  ' }).studentHint).toBeNull()
  })

  it('marks the teacher override hint as the source', () => {
    const state = build({
      checkSuggestion: 'Look at line 2',
      studentData: {
        checkOverridePushedAt: 10,
        checkOverridePassed: false,
        checkOverrideHint: 'Look at line 2',
      },
    })
    expect(state.studentHint.source).toBe('override')
  })

  it('clips very long hints', () => {
    const state = build({ checkSuggestion: 'a'.repeat(HINT_TEXT_MAX + 50) })
    expect(state.studentHint.text.length).toBe(HINT_TEXT_MAX)
  })

  it('describes an unopened support-stage offer with its stage label', () => {
    expect(build({ offeredSupportStageIndex: 1 }).hintOffer).toEqual({
      kind: 'support',
      stageIndex: 1,
      label: 'Hint: the loop',
      taskId: 't1',
    })
  })

  it('prefers a targeted offer and its own label', () => {
    expect(
      build({ targetedStageOffer: { stageIndex: 2, label: 'Fix it' }, offeredSupportStageIndex: 1 })
        .hintOffer
    ).toEqual({ kind: 'targeted', stageIndex: 2, label: 'Fix it', taskId: 't1' })
  })

  it('does nothing without a task', () => {
    expect(build({ taskId: null })).toEqual({ studentHint: undefined, hintOffer: undefined })
  })
})

describe('readStudentHint / readHintOffer', () => {
  const hint = { text: 'Use quotes', source: 'check', failStreak: 1, taskId: '1' }
  const offer = { kind: 'support', stageIndex: 1, label: 'Hint', taskId: '1' }

  it('reads the hint and offer for the current task', () => {
    const student = { studentHint: hint, hintOffer: offer }
    expect(readStudentHint(student, 1)).toBe(hint)
    expect(readHintOffer(student, 1)).toBe(offer)
  })

  it('ignores ones left over from another task', () => {
    const student = { studentHint: hint, hintOffer: offer }
    expect(readStudentHint(student, 2)).toBeNull()
    expect(readHintOffer(student, 2)).toBeNull()
  })

  it('hides them once the student has passed, or the teacher overrode to a pass', () => {
    expect(readStudentHint({ studentHint: hint, checkPassed: true }, 1)).toBeNull()
    expect(
      readHintOffer({ hintOffer: offer, checkOverridePushedAt: 5, checkOverridePassed: true }, 1)
    ).toBeNull()
  })

  it('describes an offer', () => {
    expect(describeHintOffer(offer)).toBe('Offered “Hint” as a hint — not opened yet')
    expect(describeHintOffer({ ...offer, label: null })).toContain('a reference')
  })
})

describe('hintPlainText', () => {
  it('flattens Markdown to one line', () => {
    expect(hintPlainText('Use **quotes** round `text`\n\n- see [the guide](http://x)')).toBe(
      'Use quotes round text see the guide'
    )
  })
})

describe('summariseCommonHints', () => {
  const on = (id, text, extra = {}) => ({
    anonymousId: id,
    studentHint: { text, source: 'check', failStreak: 1, taskId: '1' },
    ...extra,
  })

  it('groups hints shared by two or more students, most common first', () => {
    const students = [
      on('a', 'Use **quotes**'),
      on('b', 'Use quotes'),
      on('c', 'use quotes'),
      on('d', 'Indent the loop'),
      on('e', 'Indent the loop'),
      on('f', 'Only me'),
    ]
    expect(summariseCommonHints(students, 1)).toEqual([
      { group: 'hint:use quotes', text: 'Use quotes', studentIds: ['a', 'b', 'c'] },
      { group: 'hint:indent the loop', text: 'Indent the loop', studentIds: ['d', 'e'] },
    ])
  })

  it('leaves out overrides, passes and other tasks', () => {
    const students = [
      on('a', 'Use quotes'),
      on('b', 'Use quotes', { checkPassed: true }),
      {
        ...on('c', 'Use quotes'),
        studentHint: { text: 'Use quotes', source: 'override', taskId: '1' },
      },
      { ...on('d', 'Use quotes'), studentHint: { text: 'Use quotes', taskId: '9' } },
    ]
    expect(summariseCommonHints(students, 1)).toEqual([])
  })
})
