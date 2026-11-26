import { describe, expect, it } from 'vitest'
import {
  buildReadyReport,
  checkAssets,
  collectAssetRefs,
  formatReadySummary,
  judgeTask,
  planTask,
  planTasks,
  validateAsPublished,
} from './lesson-ready.mjs'
import { SETUP_ERROR_TEXT } from '../src/shared/puzzle/setupCode.js'

const BASE = 'https://example.test/editor/'

function pythonLesson(tasks, extra = {}) {
  return {
    id: 'ready-demo',
    type: 'python',
    title: 'Ready demo',
    description: 'A lesson used to test lessons ready.',
    tasks,
    ...extra,
  }
}

const printTask = {
  id: 1,
  title: 'Say hello',
  instructions: 'Print hello.',
  starterCode: '# print hello here\n',
  codeStages: [
    { role: 'starter', label: 'Starter', code: '# print hello here\n' },
    { role: 'complete', label: 'Complete', code: 'print("hello")\n' },
  ],
  check: { type: 'output', operator: 'contains', value: 'hello', hint: 'Print the word hello.' },
}

const done = (verdict, extra = {}) => ({ status: 'done', verdict, hintShown: null, ...extra })

describe('lessons ready: the Fun moment (a lesson that would break in class is never "ready")', () => {
  it('fails a lesson whose starter code already passes, naming the task', () => {
    const lesson = pythonLesson([printTask])
    const plan = planTask(lesson, printTask)
    const task = judgeTask(plan, { starter: done('passed'), complete: done('passed') })
    const report = buildReadyReport({
      lesson,
      validation: validateAsPublished(lesson),
      assets: { status: 'pass', checked: 0, broken: [], notChecked: [] },
      tasks: [task],
    })
    expect(report.result).toBe('not_ready')
    expect(report.exitCode).toBe(1)
    expect(task.status).toBe('fail')
    expect(task.checks.find((c) => c.name === 'starter does not pass').status).toBe('fail')
    expect(formatReadySummary(report).join('\n')).toMatch(/Task 1 .*starter already passes/i)
  })

  it('never calls a lesson ready when a task was not run', () => {
    const lesson = pythonLesson([printTask])
    const task = judgeTask(planTask(lesson, printTask), {
      starter: { status: 'not_checked', reason: 'no browser run (--no-run)' },
      complete: { status: 'not_checked', reason: 'no browser run (--no-run)' },
    })
    const report = buildReadyReport({
      lesson,
      validation: validateAsPublished(lesson),
      assets: { status: 'pass', checked: 0, broken: [], notChecked: [] },
      tasks: [task],
    })
    expect(task.status).toBe('not_checked')
    expect(report.result).toBe('not_fully_checked')
    expect(report.result).not.toBe('ready')
    expect(report.exitCode).toBe(2)
    expect(formatReadySummary(report)[0]).toMatch(/not fully checked/i)
  })

  it('calls a lesson ready only when every step ran and passed', () => {
    const lesson = pythonLesson([printTask])
    const task = judgeTask(planTask(lesson, printTask), {
      starter: done('failed', { hintShown: 'Print the word hello.' }),
      complete: done('passed'),
    })
    const report = buildReadyReport({
      lesson,
      validation: validateAsPublished(lesson),
      assets: { status: 'pass', checked: 0, broken: [], notChecked: [] },
      tasks: [task],
    })
    expect(task.status).toBe('pass')
    expect(task.hints).toEqual([
      expect.objectContaining({
        hint: 'Print the word hello.',
        status: 'shown',
        seenIn: ['starter'],
      }),
    ])
    expect(report.result).toBe('ready')
    expect(report.exitCode).toBe(0)
  })

  it('fails a quiz whose own answer is marked wrong', () => {
    // The answer names an option the quiz no longer offers: no child can ever pick it.
    const quiz = {
      id: 20,
      title: 'Which prints?',
      taskType: 'quiz',
      quizType: 'multiple_choice',
      options: [
        { id: 'a', text: 'print' },
        { id: 'b', text: 'input' },
      ],
      check: { type: 'answer_equals', value: 'c' },
    }
    const task = judgeTask(planTask(pythonLesson([quiz]), quiz))
    expect(task.status).toBe('fail')
    expect(task.checks.find((c) => c.name === 'model answer passes').status).toBe('fail')
  })

  it('fails a code_arrange task whose model arrangement fails its check', () => {
    const arrange = {
      id: 21,
      title: 'Arrange hello',
      taskType: 'code_arrange',
      moduleType: 'python',
      lines: [{ id: 'l1', parts: [{ type: 'slot', id: 's1', code: 'print("hi")' }] }],
      distractors: [{ id: 'd1', code: 'input("hi")' }],
      check: { type: 'output', operator: 'contains', value: 'hello' },
    }
    const lesson = { ...pythonLesson([arrange]), type: 'composed' }
    const plan = planTask(lesson, arrange)
    expect(plan.status).toBeUndefined()
    expect(plan.runs).toEqual([
      expect.objectContaining({ role: 'complete', code: 'print("hi")', expect: 'pass' }),
    ])
    const task = judgeTask(plan, { complete: done('failed') })
    expect(task.status).toBe('fail')
    expect(task.checks[0]).toMatchObject({ name: 'model arrangement passes', status: 'fail' })
  })

  it('fails a Support stage that already passes: offering it hands over the answer', () => {
    const withSupport = {
      ...printTask,
      codeStages: [
        ...printTask.codeStages,
        { role: 'support', label: 'Nearly there', code: 'print("hello")\n' },
      ],
    }
    const plan = planTask(pythonLesson([withSupport]), withSupport)
    expect(plan.runs.map((r) => [r.key, r.expect])).toEqual([
      ['starter', 'not_pass'],
      ['complete', 'pass'],
      ['support:2', 'not_pass'],
    ])
    const task = judgeTask(plan, {
      starter: done('failed', { hintShown: 'Print the word hello.' }),
      complete: done('passed'),
      'support:2': done('passed'),
    })
    expect(task.status).toBe('fail')
    const support = task.checks.find((c) => c.name.endsWith('does not pass') && c.role === 'support')
    expect(support).toMatchObject({ status: 'fail', name: 'Support: Nearly there does not pass' })
    expect(support.detail).toMatch(/hands the child the answer/)
  })
})

describe('quizzes: graded with the quiz’s own grader', () => {
  const mc = {
    id: 30,
    title: 'Pick print',
    taskType: 'quiz',
    quizType: 'multiple_choice',
    options: [
      { id: 'a', text: 'print' },
      { id: 'b', text: 'input' },
    ],
    check: { type: 'answer_equals', value: 'a' },
  }

  it('passes when the model answer passes and a blank answer does not', () => {
    const task = judgeTask(planTask(pythonLesson([mc]), mc))
    expect(task.checks.map((c) => [c.name, c.status])).toEqual([
      ['blank answer does not pass', 'pass'],
      ['model answer passes', 'pass'],
    ])
    expect(task.status).toBe('pass')
  })

  it('judges fill-in-the-gaps answers', () => {
    const gaps = {
      id: 31,
      title: 'Fill',
      taskType: 'quiz',
      quizType: 'fill_blank',
      text: 'Use {{b1}} to show text.',
      blanks: [{ id: 'b1', answer: 'print' }],
      distractors: [{ id: 'd1', text: 'input' }],
    }
    expect(judgeTask(planTask(pythonLesson([gaps]), gaps)).status).toBe('pass')
  })

  it('has nothing to judge on an ungraded quiz, and does not guess a typed answer', () => {
    const poll = { ...mc, id: 32, quizType: 'poll', check: undefined }
    expect(planTask(pythonLesson([poll]), poll).status).toBe('nothing_to_run')
    const typed = {
      id: 33,
      title: 'Name it',
      taskType: 'quiz',
      quizType: 'short_answer',
      check: { type: 'answer_equals', value: 'print' },
    }
    const plan = planTask(pythonLesson([typed]), typed)
    expect(plan.status).toBe('not_checked')
    expect(plan.reason).toMatch(/model answer/)
  })
})

describe('code_arrange: the model arrangement runs as the host module’s code', () => {
  const indent = {
    id: 40,
    title: 'Square',
    taskType: 'code_arrange',
    moduleType: 'turtle',
    arrangeMode: 'indent',
    lines: [
      { id: 'L1', code: 'import turtle', depth: 0, locked: true },
      { id: 'L2', code: 'for side in range(4):', depth: 0, locked: true },
      { id: 'L3', code: 'turtle.forward(100)', depth: 1 },
      { id: 'L4', code: 'turtle.left(90)', depth: 1 },
    ],
    check: { type: 'turtle_segment_count', operator: 'equals', value: '4' },
  }
  const composed = (task) => ({ ...pythonLesson([task]), type: 'composed' })

  it('runs the start depths (must not pass) and the model depths (must pass) in indent mode', () => {
    const plan = planTask(composed(indent), indent)
    expect(plan.module).toBe('turtle')
    expect(plan.runs.map((r) => [r.role, r.expect, r.code])).toEqual([
      ['starter', 'not_pass', 'import turtle\nfor side in range(4):\nturtle.forward(100)\nturtle.left(90)'],
      [
        'complete',
        'pass',
        'import turtle\nfor side in range(4):\n    turtle.forward(100)\n    turtle.left(90)',
      ],
    ])
    const task = judgeTask(plan, { starter: done('failed'), complete: done('passed') })
    expect(task.status).toBe('pass')
  })

  it('reports an HTML arrangement as not checked (a frozen module)', () => {
    const html = { ...indent, id: 41, moduleType: 'html', arrangeMode: undefined }
    expect(planTask(composed(html), html).status).toBe('not_checked')
  })
})

describe('validateAsPublished', () => {
  it('runs the full rules on a Draft (the draft flag is ignored)', () => {
    // A Draft skips the check rules, so this broken setupCode validates clean as a Draft.
    const broken = pythonLesson([{ ...printTask, intent: 'Print.', setupCode: 'x = (\n' }], {
      draft: true,
    })
    const result = validateAsPublished(broken)
    expect(result.status).toBe('fail')
    expect(result.wasDraft).toBe(true)
    expect(result.errors.join('\n')).toMatch(/setupCode has a syntax problem/)
  })

  it('passes a valid lesson', () => {
    expect(validateAsPublished(pythonLesson([printTask])).status).toBe('pass')
  })
})

describe('collectAssetRefs', () => {
  it('finds Markdown images, img src and URL fields, but not code', () => {
    const lesson = pythonLesson(
      [
        {
          ...printTask,
          instructions:
            'Look: ![a cat](https://storage.test/cat.png) and <img src="https://storage.test/dog.png">',
          explainer:
            '![logo](/assets/logo.png) ![local](cat.png) ![inline](data:image/png;base64,AA)',
          starterCode: 'print("https://example.test/not-an-asset.png")\n',
        },
      ],
      {
        storageAssets: [{ name: 'cat.png', url: 'https://storage.test/cat.png' }],
        assetsPath: '/assets/ready-demo/',
      }
    )
    const refs = collectAssetRefs(lesson, { base: BASE })
    const urls = refs.map((r) => r.url)
    expect(urls).toContain('https://storage.test/cat.png')
    expect(urls).toContain('https://storage.test/dog.png')
    expect(urls).toContain('https://example.test/editor/assets/logo.png')
    expect(urls).not.toContain('https://example.test/not-an-asset.png')
    // A folder is not a file to fetch.
    expect(urls.some((u) => u?.endsWith('/'))).toBe(false)
    // One entry per URL, listing every place it is used.
    const cat = refs.find((r) => r.url === 'https://storage.test/cat.png')
    expect(cat.where).toEqual(expect.arrayContaining(['task 1 instructions', 'storageAssets']))
    // A relative path can't be checked from here: it is reported, not guessed.
    const local = refs.find((r) => r.ref === 'cat.png')
    expect(local.url).toBeNull()
    expect(local.reason).toMatch(/relative/)
    expect(refs.some((r) => r.ref?.startsWith('data:'))).toBe(false)
  })
})

describe('checkAssets', () => {
  it('reports broken URLs and unresolvable refs', async () => {
    const refs = [
      { url: 'https://storage.test/ok.png', where: ['task 1 instructions'] },
      { url: 'https://storage.test/gone.png', where: ['task 2 explainer'] },
      { url: null, ref: 'cat.png', where: ['task 3 explainer'], reason: 'relative path' },
    ]
    const fetchImpl = async (url) => ({
      ok: url.endsWith('ok.png'),
      status: url.endsWith('ok.png') ? 206 : 404,
    })
    const result = await checkAssets(refs, { fetchImpl })
    expect(result.status).toBe('fail')
    expect(result.checked).toBe(2)
    expect(result.broken).toEqual([
      expect.objectContaining({ url: 'https://storage.test/gone.png', status: 404 }),
    ])
    expect(result.notChecked).toEqual([expect.objectContaining({ ref: 'cat.png' })])
  })

  it('is not_checked (never pass) when only unresolvable refs exist', async () => {
    const result = await checkAssets(
      [{ url: null, ref: 'cat.png', where: ['task 1'], reason: 'relative path' }],
      { fetchImpl: async () => ({ ok: true, status: 200 }) }
    )
    expect(result.status).toBe('not_checked')
  })
})

describe('planTask', () => {
  it('runs Python and Turtle code tasks in the browser', () => {
    const plan = planTask(pythonLesson([printTask]), printTask)
    expect(plan.runs.map((r) => r.role)).toEqual(['starter', 'complete'])
    expect(plan.status).toBeUndefined()
  })

  it('reports frozen modules as not checked, building nothing for them', () => {
    const html = { id: 2, title: 'Page', starterFiles: [{ name: 'index.html', content: '<p>' }] }
    const lesson = { ...pythonLesson([html]), type: 'html' }
    const plan = planTask(lesson, html)
    expect(plan.status).toBe('not_checked')
    expect(plan.reason).toMatch(/frozen/)
    expect(plan.runs).toEqual([])
  })

  it('has nothing to run on an information task', () => {
    const info = { id: 3, title: 'Read me', taskType: 'information', instructions: 'Hi' }
    expect(planTask(pythonLesson([info]), info).status).toBe('nothing_to_run')
  })

  it('does not guess input() answers', () => {
    const ask = {
      ...printTask,
      id: 4,
      codeStages: [
        { role: 'starter', label: 'Starter', code: 'name = input("Name?")\n' },
        {
          role: 'complete',
          label: 'Complete',
          code: 'name = input("Name?")\nprint("hello", name)\n',
        },
      ],
      starterCode: 'name = input("Name?")\n',
    }
    const plan = planTask(pythonLesson([ask]), ask)
    expect(plan.runs.every((r) => r.skip)).toBe(true)
    const task = judgeTask(plan, {})
    expect(task.status).toBe('not_checked')
    expect(task.checks[0].reason).toMatch(/input\(\)/)
  })

  it('expects the starter of a run-and-read task to pass', () => {
    const demo = {
      ...printTask,
      id: 9,
      starterCode: 'print("hello")\n',
      codeStages: [{ role: 'starter', label: 'Starter', code: 'print("hello")\n' }],
      completeCode: 'print("hello")  \n',
    }
    const plan = planTask(pythonLesson([demo]), demo)
    expect(plan.runs).toEqual([expect.objectContaining({ role: 'starter', expect: 'pass' })])
    const task = judgeTask(plan, { starter: done('passed') })
    expect(task.checks[0]).toMatchObject({ name: 'starter passes (run and read)', status: 'pass' })

    const runAttempted = { ...printTask, id: 10, check: { type: 'run_attempted' } }
    expect(planTask(pythonLesson([runAttempted]), runAttempted).runs[0].expect).toBe('pass')
  })

  it('does not run a task whose Run waits for predictions', () => {
    const predict = {
      ...printTask,
      id: 8,
      starterCode: 'x = 3\nprint(x)\n',
      codeStages: [
        { role: 'starter', label: 'Starter', code: 'x = 3\nprint(x)\n' },
        { role: 'complete', label: 'Complete', code: 'x = 3\nprint(x)\n' },
      ],
      showVariables: { mode: 'predict', predict: ['x'] },
    }
    const plan = planTask(pythonLesson([predict]), predict)
    expect(plan.runs.every((r) => /predict/.test(r.skip))).toBe(true)
  })

  it('runs input() code with the answers given (--inputs), per task or per run', () => {
    const ask = {
      ...printTask,
      id: 4,
      codeStages: [
        { role: 'starter', label: 'Starter', code: 'name = input("Name?")\n' },
        {
          role: 'complete',
          label: 'Complete',
          code: 'name = input("Name?")\nprint("hello", name)\n',
        },
      ],
    }
    const lesson = pythonLesson([ask])
    const [plan] = planTasks(lesson, { inputs: { 4: ['Ava'] } })
    expect(plan.runs.map((r) => [r.skip, r.inputs])).toEqual([
      [undefined, ['Ava']],
      [undefined, ['Ava']],
    ])
    const perRun = planTask(lesson, ask, { inputs: { complete: ['Ben'] } })
    expect(perRun.runs[0].skip).toMatch(/--inputs/)
    expect(perRun.runs[1].inputs).toEqual(['Ben'])
  })

  it('reports Python tests and submit-mode tasks as not checked', () => {
    const tests = { ...printTask, id: 5, tests: [{ id: 't1', inputs: [], check: printTask.check }] }
    const submit = { ...printTask, id: 6, interactionMode: 'submit' }
    const lesson = pythonLesson([tests, submit])
    expect(planTask(lesson, tests).status).toBe('not_checked')
    expect(planTask(lesson, submit).status).toBe('not_checked')
  })

  it('needs complete code to prove the checks can pass', () => {
    const noComplete = { ...printTask, id: 7, codeStages: [printTask.codeStages[0]] }
    const plan = planTask(pythonLesson([noComplete]), noComplete)
    const task = judgeTask(plan, { starter: done('failed') })
    const complete = task.checks.find((c) => c.name === 'complete code passes')
    expect(complete.status).toBe('not_checked')
    expect(complete.reason).toMatch(/no complete code/)
    expect(task.status).toBe('not_checked')
  })

  it('walks into groups', () => {
    const lesson = pythonLesson([{ type: 'group', title: 'G', subtasks: [printTask] }])
    expect(planTasks(lesson).map((p) => p.id)).toEqual([1])
  })
})

describe('judgeTask', () => {
  it('fails when the complete code does not pass, with the hint the child would see', () => {
    const task = judgeTask(planTask(pythonLesson([printTask]), printTask), {
      starter: done('failed'),
      complete: done('failed', { hintShown: 'Print the word hello.' }),
    })
    const complete = task.checks.find((c) => c.name === 'complete code passes')
    expect(complete.status).toBe('fail')
    expect(complete.detail).toMatch(/Print the word hello/)
  })

  it('fails when setupCode breaks', () => {
    const withSetup = { ...printTask, setupCode: 'x = (\n' }
    const task = judgeTask(planTask(pythonLesson([withSetup]), withSetup), {
      starter: done('failed', { output: SETUP_ERROR_TEXT, setupError: true }),
      complete: done('failed', { output: SETUP_ERROR_TEXT, setupError: true }),
    })
    expect(task.checks.find((c) => c.name === 'setup runs clean').status).toBe('fail')
    expect(task.status).toBe('fail')
  })

  it('reports a run with no verdict as not checked, never a pass', () => {
    const task = judgeTask(planTask(pythonLesson([printTask]), printTask), {
      starter: done(null),
      complete: done(null),
    })
    expect(task.status).toBe('not_checked')
  })

  it('lists hints no run showed as not checked', () => {
    const withNudge = {
      ...printTask,
      feedbackChecks: [
        { type: 'code', operator: 'contains', value: 'while', hint: 'Use print, not a loop.' },
      ],
    }
    const task = judgeTask(planTask(pythonLesson([withNudge]), withNudge), {
      starter: done('failed', { hintShown: 'Print the word hello.' }),
      complete: done('passed'),
    })
    const nudge = task.hints.find((h) => h.hint === 'Use print, not a loop.')
    expect(nudge.status).toBe('not_checked')
    expect(task.status).toBe('not_checked')
  })
})

describe('Scratch tasks: block checks judged on each stage', () => {
  const stack = (...opcodes) =>
    opcodes.reduceRight(
      (next, type) => ({ type, ...(next ? { next: { block: next } } : {}) }),
      null
    )
  const blocksFor = (...stacks) => ({ sprite1: { blocks: { blocks: stacks } } })
  const scratchTask = (overrides = {}) => ({
    id: 7,
    title: 'Move the rocket',
    sprites: [{ id: 'sprite1', name: 'Rocket' }],
    starterBlocks: blocksFor(stack('event_whenflagclicked', 'motion_turnright')),
    completeBlocks: blocksFor(stack('event_whenflagclicked', 'motion_movesteps')),
    check: [{ type: 'block_used', opcode: 'motion_movesteps', hint: 'Use a move block.' }],
    feedbackChecks: [
      { type: 'block_used', opcode: 'motion_turnright', hint: 'Remove the turn block.' },
    ],
    ...overrides,
  })
  const lesson = (task) => ({
    id: 's',
    type: 'scratch',
    title: 'S',
    description: 'd',
    tasks: [task],
  })

  it('passes when the starter fails and the complete blocks pass, with hints found', () => {
    const task = scratchTask()
    const report = judgeTask(planTask(lesson(task), task))
    expect(report.method).toBe('blocks')
    expect(report.checks.map((c) => [c.name, c.status])).toEqual([
      ['starter does not pass', 'pass'],
      ['complete blocks pass', 'pass'],
    ])
    expect(report.hints.map((h) => [h.hint, h.status])).toEqual([
      ['Use a move block.', 'shown'],
      ['Remove the turn block.', 'shown'],
    ])
    expect(report.status).toBe('pass')
  })

  it('fails a starter that already passes', () => {
    const task = scratchTask({
      starterBlocks: blocksFor(stack('event_whenflagclicked', 'motion_movesteps', 'looks_say')),
    })
    const report = judgeTask(planTask(lesson(task), task))
    expect(report.status).toBe('fail')
    expect(report.checks[0].detail).toMatch(/already pass/)
  })

  it('fails a Support stage whose blocks already pass', () => {
    const task = scratchTask({
      codeStages: [
        {
          role: 'support',
          label: 'Hint',
          blocks: blocksFor(stack('event_whenflagclicked', 'motion_movesteps')),
        },
      ],
    })
    const report = judgeTask(planTask(lesson(task), task))
    const support = report.checks.find((c) => c.name === 'support:Hint does not pass')
    expect(support).toMatchObject({ status: 'fail', detail: expect.stringMatching(/answer/) })
    expect(report.status).toBe('fail')
  })

  it('reports run-time checks as not checked', () => {
    const task = scratchTask({
      check: [{ type: 'sprite_property', property: 'x', operator: 'greater_than', value: 5 }],
      feedbackChecks: [],
    })
    const report = judgeTask(planTask(lesson(task), task))
    expect(report.status).toBe('not_checked')
    expect(report.checks.find((c) => c.name === 'complete blocks pass').reason).toMatch(/run/)
  })
})

describe('review fixes', () => {
  it('still runs different complete code on a run_attempted task, for errors', () => {
    const task = {
      ...printTask,
      id: 11,
      check: { type: 'run_attempted' },
      codeStages: [
        { role: 'starter', label: 'Starter', code: '' },
        { role: 'complete', label: 'Complete', code: 'print(oops)\n' },
      ],
      starterCode: '',
    }
    const plan = planTask(pythonLesson([task]), task)
    expect(plan.runs.map((r) => [r.role, r.expect])).toEqual([
      ['starter', 'pass'],
      ['complete', 'runs_clean'],
    ])
    const report = judgeTask(plan, {
      starter: done('passed'),
      complete: done('passed', { runError: true, output: 'NameError' }),
    })
    expect(report.status).toBe('fail')
  })

  it('judges a Scratch task with no starter blocks on an empty workspace', () => {
    const task = {
      id: 12,
      title: 'Blank start',
      sprites: [{ id: 'sprite1', name: 'Cat' }],
      completeBlocks: { sprite1: { blocks: { blocks: [{ type: 'motion_movesteps' }] } } },
      check: [{ type: 'block_used', opcode: 'motion_movesteps' }],
    }
    const lesson = { id: 's', type: 'scratch', title: 'S', description: 'd', tasks: [task] }
    const report = judgeTask(planTask(lesson, task))
    expect(report.checks[0]).toMatchObject({ name: 'starter does not pass', status: 'pass' })
    expect(report.status).toBe('pass')
  })

  it('never fetches assetsPath, with or without a trailing slash', () => {
    const lesson = pythonLesson([printTask], { assetsPath: '/lesson-assets/pets' })
    expect(collectAssetRefs(lesson, { base: BASE })).toEqual([])
  })

  it('matches a hint with a Markdown link by its text', () => {
    const task = {
      ...printTask,
      check: { ...printTask.check, hint: 'Look at [print](https://docs.python.org).' },
    }
    const report = judgeTask(planTask(pythonLesson([task]), task), {
      starter: done('failed', { hintShown: 'Look at print.' }),
      complete: done('passed'),
    })
    expect(report.hints[0].status).toBe('shown')
  })

  it('finds a carryCodeFrom task whose id is written as text', () => {
    // Task 2's complete code is task 1's, so a child carrying task 1's work starts with the
    // answer: that is "starter already passes", never a run-and-read task.
    const second = { ...printTask, id: 2, carryCodeFrom: '1' }
    const plan = planTask(pythonLesson([printTask, second]), second)
    expect(plan.runs[0].expect).toBe('not_pass')
    expect(plan.runs[0]).toMatchObject({
      code: 'print("hello")\n',
      note: expect.stringMatching(/carried/),
    })
  })

  it('counts an empty file (416) as there', async () => {
    const result = await checkAssets([{ url: 'https://storage.test/empty.txt', where: ['x'] }], {
      fetchImpl: async () => ({ ok: false, status: 416 }),
    })
    expect(result.status).toBe('pass')
  })
})
