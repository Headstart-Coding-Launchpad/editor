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
      { storageAssets: [{ name: 'cat.png', url: 'https://storage.test/cat.png' }] }
    )
    const refs = collectAssetRefs(lesson, { base: BASE })
    const urls = refs.map((r) => r.url)
    expect(urls).toContain('https://storage.test/cat.png')
    expect(urls).toContain('https://storage.test/dog.png')
    expect(urls).toContain('https://example.test/editor/assets/logo.png')
    expect(urls).not.toContain('https://example.test/not-an-asset.png')
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
