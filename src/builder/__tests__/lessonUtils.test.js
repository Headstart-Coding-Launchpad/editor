import { describe, expect, it } from 'vitest'
import { copyScratchSpriteStateToStarters, copyStarterToComplete, normalizeTasksForExport, quizHasCheckValue, quizHasStarter, validateLesson } from '../lessonUtils'

function lesson(type, tasks) {
  return { id: 'test-lesson', title: 'Test lesson', type, tasks }
}

describe('validateLesson', () => {
  it('captures Python starter, check, carry-through and timing issues', () => {
    const result = validateLesson(lesson('python', [{
      id: 3,
      title: 'Python',
      estimatedMinutes: 0,
      starterCode: '',
      carryCodeFrom: 99,
      interactionMode: 'submit',
      check: { type: 'output_contains', value: '' },
    }]))

    expect(result.errors).toEqual(expect.arrayContaining([
      'Task 1 estimated time must be a positive whole number of minutes',
      'Task 1 uses submit mode but has a check that requires running the code',
      'Task 1 has a check enabled but no check value',
      'Task 1 references task 99 for carry-through but that task does not exist',
    ]))
    expect(result.warnings).toContain('Task 1 has no starter code — students will start with an empty editor')
  })

  it('validates HTML, Scratch and information task-specific fields', () => {
    expect(validateLesson(lesson('html', [{ id: 1, title: 'Web', starterFiles: [{ name: 'style.css', type: 'css', content: '' }] }])).errors)
      .toContain('Task 1 has no HTML file to use as entry point')
    expect(validateLesson(lesson('scratch', [{ id: 1, title: 'Blocks', toolbox: '<category>', check: { type: 'block_used' } }])).errors)
      .toEqual(expect.arrayContaining(['Task 1 has invalid toolbox XML', 'Task 1 block-used check is missing a block opcode']))
    expect(validateLesson(lesson('python', [{ id: 1, title: 'Read', taskType: 'information', informationType: 'standard', explainer: '' }])).errors)
      .toContain('Task 1 is an information task but has no explainer')
  })

  it('validates grouped and quiz tasks without editor warnings for complete content', () => {
    const result = validateLesson(lesson('python', [{
      id: 'group-a',
      type: 'group',
      title: 'Quiz',
      subtasks: [{
        id: 8,
        title: 'Match',
        taskType: 'quiz',
        quizType: 'match',
        pairs: [{ prompt: 'a', answer: 'b' }, { prompt: 'c', answer: 'd' }],
        _checkTested: true,
      }],
    }]))
    expect(result).toEqual({ errors: [], warnings: [] })
  })
})

describe('quiz helpers', () => {
  it('detect starter and check values for quiz variants', () => {
    expect(quizHasStarter({ quizType: 'fill_blank', text: 'Hi ___', blanks: [] })).toBe(true)
    expect(quizHasCheckValue({ quizType: 'match', pairs: [{ prompt: 'a', answer: 'b' }] })).toBe(true)
    expect(quizHasCheckValue({ quizType: 'short_answer', check: { value: '' } })).toBe(false)
  })
})

describe('copyScratchSpriteStateToStarters', () => {
  it('copies stage presentation state while preserving sprite identity and artwork', () => {
    const sprites = [
      { id: 'rocket', name: 'Rocket', type: 'cat', costumes: [{ name: 'idle', image: 'idle.png' }], x: 0 },
      { id: 'star', name: 'Star', type: 'star', x: 5 },
    ]

    expect(copyScratchSpriteStateToStarters(sprites, {
      rocket: { x: 80, y: -20, size: 130, direction: -90, visible: false, rotationStyle: 'left-right', costume: 'boost', bubble: 'skip me' },
    })).toEqual([
      {
        id: 'rocket',
        name: 'Rocket',
        type: 'cat',
        costumes: [{ name: 'idle', image: 'idle.png' }],
        x: 80,
        y: -20,
        size: 130,
        direction: -90,
        visible: false,
        rotationStyle: 'left-right',
        costume: 'boost',
      },
      { id: 'star', name: 'Star', type: 'star', x: 5 },
    ])
  })
})

describe('copyStarterToComplete', () => {
  it('copies Python starter code into complete code', () => {
    expect(copyStarterToComplete({ starterCode: 'print("hello")' }, 'python')).toEqual({
      completeCode: 'print("hello")',
    })
  })

  it('clones HTML starter files and entry file into complete content', () => {
    const task = {
      entryFile: 'home.html',
      starterFiles: [{ name: 'home.html', type: 'html', content: '<h1>Hello</h1>' }],
    }
    const result = copyStarterToComplete(task, 'html')

    expect(result).toEqual({
      completeEntryFile: 'home.html',
      completeFiles: [{ name: 'home.html', type: 'html', content: '<h1>Hello</h1>' }],
    })
    expect(result.completeFiles[0]).not.toBe(task.starterFiles[0])
  })
})

describe('normalizeTasksForExport', () => {
  it('remaps grouped task IDs and trims transient option/check data', () => {
    const exported = normalizeTasksForExport([{
      id: 70,
      type: 'group',
      title: 'Group',
      subtasks: [{
        id: 40,
        title: 'First',
        starterCode: 'print(1)',
        _checkTested: true,
        check: { type: 'output_equals', value: '1', hint: '  keep  ' },
        options: [{ text: 'A', feedback: '   ' }],
      }, {
        id: 90,
        title: 'Second',
        starterCode: '',
        carryCodeFrom: 40,
        check: [{ type: 'code_no_error', hint: ' ' }],
      }],
    }])

    expect(exported[0].subtasks[0]).toMatchObject({
      id: 1,
      check: { hint: 'keep' },
      options: [{ text: 'A' }],
    })
    expect(exported[0].subtasks[1]).toMatchObject({ id: 2, carryCodeFrom: 1, check: [{ type: 'code_no_error' }] })
  })

  it('exports information tasks with only public fields', () => {
    expect(normalizeTasksForExport([{
      id: 4,
      taskType: 'information',
      informationType: 'introduction',
      title: 'Welcome',
      explainer: 'Hello',
      estimatedMinutes: 2,
      starterCode: 'ignored',
    }])).toEqual([{
      id: 1,
      taskType: 'information',
      informationType: 'introduction',
      title: 'Welcome',
      explainer: 'Hello',
      estimatedMinutes: 2,
    }])
  })

  it('exports recap (two-pane) information tasks including leftContent', () => {
    expect(normalizeTasksForExport([{
      id: 4,
      taskType: 'information',
      informationType: 'recap',
      title: 'Recap',
      leftContent: 'Can you explain X?',
      explainer: 'Here is the answer.',
    }])).toEqual([{
      id: 1,
      taskType: 'information',
      informationType: 'recap',
      title: 'Recap',
      leftContent: 'Can you explain X?',
      explainer: 'Here is the answer.',
    }])
  })
})
