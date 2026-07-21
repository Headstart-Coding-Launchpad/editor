import { describe, expect, it } from 'vitest'
import { copyScratchSpriteStateToStarters, copyStarterToComplete, normalizeTasksForExport, quizHasCheckValue, quizHasStarter, renumberTasks, validateLesson } from '../lessonUtils'

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
      .toEqual(expect.arrayContaining(['Task 1 has invalid toolbox XML', 'Task 1 has a Scratch check but no block opcode']))
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

  it('validates feedback check fields using the same lesson-type rules', () => {
    const fsResult = validateLesson(lesson('filesystem', [{
      id: 1,
      title: 'FS',
      starterFs: { '/': { type: 'dir' } },
      check: { type: 'fs_path', operator: 'exists', itemType: 'file', path: '/done.txt' },
      feedbackChecks: [{ type: 'fs_file_content', operator: 'contains', path: '/tmp.txt', value: '', hint: 'Add content.' }],
    }]))
    expect(fsResult.errors).toContain('Task 1 has a file-content feedback check but no expected value')

    const electronicsResult = validateLesson(lesson('electronics', [{
      id: 1,
      title: 'Circuit',
      starterCircuit: { components: [], wires: [], controls: {} },
      check: { type: 'circuit_no_short' },
      feedbackChecks: [{ type: 'circuit_path_exists', from: { type: 'battery' }, to: { type: 'led', pin: 'anode' }, hint: 'Wire both endpoints.' }],
    }]))
    expect(electronicsResult.errors).toContain('Task 1 has a circuit connection feedback check but no source or destination part/pin')

    const htmlResult = validateLesson(lesson('html', [{
      id: 1,
      title: 'Web',
      starterFiles: [{ name: 'index.html', type: 'html', content: '<h1>Hi</h1>' }],
      check: { type: 'html_element', selector: 'h1' },
      feedbackChecks: [{ type: 'html_element_value', operator: 'equals', selector: '', value: 'Hi', hint: 'Target the heading.' }],
    }]))
    expect(htmlResult.errors).toContain('Task 1 has an element feedback check but no CSS selector')
  })

  it('warns for blocking feedback checks without hints and requires a completion check', () => {
    const result = validateLesson(lesson('python', [{
      id: 1,
      title: 'Python',
      starterCode: 'print("hi")',
      feedbackChecks: [{ type: 'code', operator: 'contains', value: 'input(' }],
    }]))

    expect(result.errors).toContain('Task 1 has feedback checks but no completion check')
    expect(result.warnings).toContain('Task 1 has a blocking feedback check with no hint')
  })

  it('warns when two flat tasks use the same ID', () => {
    const result = validateLesson(lesson('python', [{
      id: 2,
      title: 'Intro',
      taskType: 'information',
      informationType: 'introduction',
      explainer: 'Welcome',
    }, {
      id: 'group-a',
      type: 'group',
      title: 'Group',
      subtasks: [{
        id: 2,
        title: 'Code',
        starterCode: 'print("hi")',
      }],
    }]))

    expect(result.warnings).toContain('Task ID 2 is used by task 1 "Intro" and task 2 "Code" - renumber task IDs before publishing')
  })

  it('validates class fork metadata', () => {
    const result = validateLesson({
      id: 'test-lesson-maple',
      title: 'Test lesson - Maple',
      type: 'python',
      fork: { sourceLessonId: 'test-lesson', classId: 'maple', taskLinks: [] },
      tasks: [{ id: 1, title: 'Code', starterCode: 'print("hi")' }],
    })
    expect(result.errors).toEqual([])

    const invalid = validateLesson({
      id: 'wrong',
      title: 'Test lesson - Maple',
      type: 'python',
      fork: { sourceLessonId: 'test-lesson', classId: 'maple', taskLinks: {} },
      tasks: [{ id: 1, title: 'Code', starterCode: 'print("hi")' }],
    })
    expect(invalid.errors).toEqual(expect.arrayContaining([
      'Forked lesson ID must be test-lesson-maple',
      'Fork task links must be an array',
    ]))
  })
})

describe('complete solution validation', () => {
  function pythonTask(overrides) {
    return { id: 1, title: 'Task', starterCode: 'print("hi")', _checkTested: true, ...overrides }
  }

  it('warns when Python complete code fails a code_contains check', () => {
    const { warnings } = validateLesson(lesson('python', [pythonTask({
      check: { type: 'code_contains', value: 'for' },
      completeCode: 'print("done")',
    })]))
    expect(warnings).toContain('Task 1 complete solution fails a code check — review the complete code')
  })

  it('does not warn when Python complete code passes a code_contains check', () => {
    const { warnings } = validateLesson(lesson('python', [pythonTask({
      check: { type: 'code_contains', value: 'for' },
      completeCode: 'for i in range(3): print(i)',
    })]))
    expect(warnings.some(w => w.includes('complete solution fails'))).toBe(false)
  })

  it('warns when Python has output checks, complete code set, and _checkTested is false', () => {
    const { warnings } = validateLesson(lesson('python', [pythonTask({
      check: { type: 'output_contains', value: 'Hello' },
      completeCode: 'print("Hello")',
      _checkTested: false,
    })]))
    expect(warnings).toContain('Task 1 has output checks — open the Complete tab and run to verify the complete solution')
  })

  it('does not warn about output checks when _checkTested is true', () => {
    const { warnings } = validateLesson(lesson('python', [pythonTask({
      check: { type: 'output_contains', value: 'Hello' },
      completeCode: 'print("Hello")',
      _checkTested: true,
    })]))
    expect(warnings.some(w => w.includes('output checks'))).toBe(false)
  })

  it('does not warn when Python task has no completeCode', () => {
    const { warnings } = validateLesson(lesson('python', [pythonTask({
      check: { type: 'code_contains', value: 'for' },
    })]))
    expect(warnings.some(w => w.includes('complete solution'))).toBe(false)
  })

  it('warns when HTML complete files fail a code_contains check', () => {
    const { warnings } = validateLesson(lesson('html', [pythonTask({
      starterCode: undefined,
      starterFiles: [{ name: 'index.html', type: 'html', content: '<p>Hi</p>' }],
      check: { type: 'code_contains', value: '<table>' },
      completeFiles: [{ name: 'index.html', type: 'html', content: '<p>Done</p>' }],
    })]))
    expect(warnings).toContain('Task 1 complete solution fails a code check — review the complete files')
  })

  it('warns when filesystem complete solution fails an fs_file_exists check', () => {
    const { warnings } = validateLesson(lesson('filesystem', [{
      id: 1, title: 'FS', _checkTested: true,
      starterFs: { '/': { type: 'dir' } },
      check: { type: 'fs_file_exists', path: '/readme.txt' },
      completeFs: { '/': { type: 'dir' } },
    }]))
    expect(warnings).toContain('Task 1 complete filesystem does not satisfy a check — review the complete filesystem')
  })

  it('does not warn when filesystem complete solution passes the fs_file_exists check', () => {
    const { warnings } = validateLesson(lesson('filesystem', [{
      id: 1, title: 'FS', _checkTested: true,
      starterFs: { '/': { type: 'dir' } },
      check: { type: 'fs_file_exists', path: '/readme.txt' },
      completeFs: { '/': { type: 'dir' }, '/readme.txt': { type: 'file', content: 'hi' } },
    }]))
    expect(warnings.some(w => w.includes('complete filesystem'))).toBe(false)
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

describe('renumberTasks', () => {
  it('renumbers flat task order and updates carry-through references', () => {
    const result = renumberTasks([{
      id: 70,
      type: 'group',
      title: 'Group',
      subtasks: [{
        id: 40,
        title: 'First',
      }, {
        id: 90,
        title: 'Second',
        carryCodeFrom: 40,
        carryBlocksFrom: 40,
        carryFsFrom: 40,
        carryCircuitFrom: 40,
      }],
    }, {
      id: 100,
      title: 'Third',
      carryCodeFrom: 90,
    }])

    expect(result).toEqual([{
      id: 70,
      type: 'group',
      title: 'Group',
      subtasks: [{
        id: 1,
        title: 'First',
      }, {
        id: 2,
        title: 'Second',
        carryCodeFrom: 1,
        carryBlocksFrom: 1,
        carryFsFrom: 1,
        carryCircuitFrom: 1,
      }],
    }, {
      id: 3,
      title: 'Third',
      carryCodeFrom: 2,
    }])
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
        copyCode: 'print("copy me")',
        _checkTested: true,
        check: { type: 'output_equals', value: '1', hint: '  keep  ' },
        feedbackChecks: [{ type: 'code', operator: 'contains', value: 'input(', hint: '  avoid input  ' }],
        incorrectChecks: [{ type: 'code_contains', value: 'legacy', hint: 'drop me' }],
        options: [{ text: 'A', feedback: '   ' }],
      }, {
        id: 90,
        title: 'Second',
        starterCode: '',
        copyCode: '   ',
        carryCodeFrom: 40,
        check: [{ type: 'code_no_error', hint: ' ' }],
      }],
    }])

    expect(exported[0].subtasks[0]).toMatchObject({
      id: 1,
      copyCode: 'print("copy me")',
      check: { hint: 'keep' },
      feedbackChecks: [{ type: 'code', operator: 'contains', value: 'input(', hint: 'avoid input' }],
      options: [{ text: 'A' }],
    })
    expect(exported[0].subtasks[0].incorrectChecks).toBeUndefined()
    expect(exported[0].subtasks[1]).toMatchObject({ id: 2, carryCodeFrom: 1, check: [{ type: 'code_no_error' }] })
    expect(exported[0].subtasks[1].copyCode).toBeUndefined()
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

  it('preserves original task IDs when preserveIds is true', () => {
    const exported = normalizeTasksForExport([{
      id: 70,
      type: 'group',
      title: 'Group',
      subtasks: [{ id: 40, title: 'First', starterCode: '' }, { id: 90, title: 'Second', starterCode: '', carryCodeFrom: 40 }],
    }], { preserveIds: true })

    expect(exported[0].subtasks[0].id).toBe(40)
    expect(exported[0].subtasks[1]).toMatchObject({ id: 90, carryCodeFrom: 40 })
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
