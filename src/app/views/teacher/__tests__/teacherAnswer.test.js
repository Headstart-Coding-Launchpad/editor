import { describe, expect, it } from 'vitest'
import {
  answerTabFor,
  expectedOutputOf,
  extraStageTabs,
  shortAnswerModel,
  shortAnswerResponses,
  stagePictureCode,
  studentViewStageFor,
  tallyChoiceAnswers,
  teacherAnswerKind,
} from '../teacherAnswer'

const MC = {
  id: 6,
  title: 'What does a loop do?',
  taskType: 'quiz',
  quizType: 'multiple_choice',
  options: [
    { id: 'a', text: 'Repeats code' },
    { id: 'b', text: 'Stops the program' },
    { id: 'c', text: 'Prints text' },
    { id: 'd', text: 'Makes a variable' },
  ],
  check: { type: 'answer_equals', value: 'a' },
}

describe('teacherAnswerKind', () => {
  it('sorts tasks into their answer views', () => {
    expect(teacherAnswerKind({ id: 1, taskType: 'information' })).toBe('info')
    expect(teacherAnswerKind(MC)).toBe('choice')
    expect(teacherAnswerKind({ id: 2, taskType: 'quiz', quizType: 'short_answer' })).toBe('short')
    expect(teacherAnswerKind({ id: 3, title: 'Code', starterCode: '' })).toBe('code')
  })
})

describe('answerTabFor', () => {
  it('uses the complete-role stage of a unified-stage task', () => {
    const task = {
      codeStages: [
        { role: 'starter', code: '' },
        { role: 'support', code: '#' },
        { role: 'complete', code: 'print(1)' },
      ],
    }
    expect(answerTabFor({ lifecycle: { teacherCompleteTab: () => false } }, task)).toBe('stage_2')
    expect(extraStageTabs(task, 'stage_2')).toEqual(['stage_1'])
  })

  it('uses the separate Complete tab when the module has one', () => {
    expect(answerTabFor({ lifecycle: { teacherCompleteTab: () => true } }, { id: 1 })).toBe(
      'complete'
    )
  })

  it('uses the Complete tab for a legacy task with complete work and no complete stage', () => {
    const definition = {
      capabilities: { unifiedStages: true },
      lifecycle: { teacherCompleteTab: () => false },
      getDisplayState: (task, stage, live, tab) =>
        tab === 'complete' ? { files: task.completeFiles ?? [], entryFile: 'index.html' } : live,
    }
    expect(
      answerTabFor(definition, {
        codeStages: [{ role: 'starter', files: [] }],
        completeFiles: [{ name: 'index.html', content: '<h1>Hi</h1>' }],
      })
    ).toBe('complete')
    expect(answerTabFor(definition, { codeStages: [{ role: 'starter', files: [] }] })).toBeNull()
    // A module without unified stages answers through teacherCompleteTab only.
    expect(
      answerTabFor(
        { ...definition, capabilities: {} },
        { completeFiles: [{ name: 'index.html', content: 'x' }] }
      )
    ).toBeNull()
  })

  it('has no answer tab without a complete stage', () => {
    expect(answerTabFor(null, { codeStages: [{ role: 'starter', code: '' }] })).toBeNull()
  })
})

describe('expectedOutputOf', () => {
  it('prefers an exact output and falls back to the contains values', () => {
    expect(expectedOutputOf({ check: { type: 'output_equals', value: 'Hello' } })).toBe('Hello')
    expect(
      expectedOutputOf({
        check: [
          { type: 'output_contains', value: 'Hello' },
          { type: 'code_contains', value: 'print' },
          { type: 'output_contains', value: 'Ava' },
        ],
      })
    ).toBe('Hello\nAva')
    expect(expectedOutputOf({ check: { type: 'code_contains', value: 'x' } })).toBeNull()
  })

  it('reads the type + operator form of output checks too', () => {
    expect(
      expectedOutputOf({ check: { type: 'output', operator: 'contains', value: 'Hello' } })
    ).toBe('Hello')
    expect(
      expectedOutputOf({ check: { type: 'output', operator: 'equals', value: 'Hi Ava' } })
    ).toBe('Hi Ava')
  })
})

describe('stagePictureCode', () => {
  it('draws the stageTarget, else a model answer that uses the Stage without input()', () => {
    expect(stagePictureCode({ stageTarget: { code: 'from stage import *\nrect()' } }, '')).toBe(
      'from stage import *\nrect()'
    )
    expect(stagePictureCode({}, 'from stage import *\ncircle()')).toBe(
      'from stage import *\ncircle()'
    )
    expect(stagePictureCode({}, 'print("hi")')).toBeNull()
    expect(stagePictureCode({}, 'from stage import *\nname = input()')).toBeNull()
  })
})

describe('tallyChoiceAnswers', () => {
  it('counts each option, the right ones and who has not answered', () => {
    const students = [
      { displayName: 'Ava', currentAnswer: 'a' },
      { displayName: 'Ben', currentAnswer: 'b' },
      { displayName: 'Cai', currentAnswer: 'a' },
      { displayName: 'Omar', currentAnswer: null },
    ]
    expect(tallyChoiceAnswers(MC, students)).toEqual({
      counts: { a: 2, b: 1, c: 0, d: 0 },
      answered: 3,
      right: 2,
      correct: 'a',
      notAnswered: ['Omar'],
      total: 4,
    })
  })

  it('finds the right option when the check is a list', () => {
    const task = {
      ...MC,
      check: [{ type: 'run_attempted' }, { type: 'answer_equals', value: 'b' }],
    }
    const tally = tallyChoiceAnswers(task, [
      { displayName: 'Ava', currentAnswer: 'b' },
      { displayName: 'Ben', currentAnswer: 'a' },
    ])
    expect(tally.correct).toBe('b')
    expect(tally.right).toBe(1)
  })
})

describe('short answers', () => {
  it('describes the check and lists submitted answers', () => {
    expect(shortAnswerModel({ check: { type: 'answer_contains', value: 'repeat' } })).toEqual({
      label: 'Must contain',
      value: 'repeat',
    })
    expect(shortAnswerModel({ check: null })).toBeNull()
    const { responses, notAnswered } = shortAnswerResponses([
      {
        anonymousId: 'a',
        displayName: 'Ava',
        currentAnswer: 'It repeats',
        lastRunStatus: 'submitted',
        checkPassed: true,
      },
      { anonymousId: 'b', displayName: 'Ben', currentAnswer: 'typing…', lastRunStatus: null },
    ])
    expect(responses).toEqual([{ id: 'a', name: 'Ava', text: 'It repeats', passed: true }])
    expect(notAnswered).toEqual(['Ben'])
  })
})

describe('studentViewStageFor', () => {
  const unified = { type: 'python', capabilities: { unifiedStages: true, stageChangeView: true } }
  const task = {
    codeStages: [
      { role: 'starter', code: 'a = 1' },
      { role: 'support', label: 'Hint', code: 'b = 2' },
      { role: 'complete', code: 'a = 1\nb = 2' },
      { role: 'support', label: 'Empty', code: '  ' },
    ],
  }

  it('finds the Support or Complete stage a tab shows', () => {
    expect(studentViewStageFor(unified, task, 'stage_1')).toMatchObject({
      index: 1,
      role: 'support',
    })
    expect(studentViewStageFor(unified, task, 'stage_2')).toMatchObject({ role: 'complete' })
  })

  it('is null for the starter, an empty stage, other tabs and modules without the change view', () => {
    expect(studentViewStageFor(unified, task, 'stage_0')).toBeNull()
    expect(studentViewStageFor(unified, task, 'stage_3')).toBeNull()
    expect(studentViewStageFor(unified, task, 'live')).toBeNull()
    // The legacy Complete tab, and modules without the change view (Turtle, HTML, Arcade).
    expect(studentViewStageFor(unified, task, 'complete')).toBeNull()
    expect(
      studentViewStageFor({ capabilities: { unifiedStages: true } }, task, 'stage_1')
    ).toBeNull()
  })
})
