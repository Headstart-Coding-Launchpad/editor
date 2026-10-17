// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CROP_TEST_IDS,
  findShotTask,
  normaliseShot,
  normaliseShots,
  prepareShotLesson,
  readSpecCode,
  shotFileName,
} from './lesson-screenshot-input.mjs'
import {
  buildThrowawayLesson,
  lessonKeyedNodes,
  throwawayLessonId,
} from './lesson-screenshot-session.mjs'
import { flattenTasks } from '../src/shared/taskUtils.js'

const LESSON = {
  id: 'les-1',
  title: 'Posters',
  type: 'composed',
  levelId: 'python-level-1',
  modules: [
    { id: 'python', type: 'python' },
    { id: 'html', type: 'html' },
    { id: 'scratch', type: 'scratch' },
  ],
  tasks: [
    { id: 1, title: 'Welcome', taskType: 'information' },
    {
      id: 'g1',
      type: 'group',
      title: 'Group',
      subtasks: [
        {
          id: 2,
          title: 'Poster',
          moduleType: 'python',
          carryCodeFrom: 1,
          codeStages: [
            { role: 'starter', label: 'Starter', code: 'print(1)\n' },
            { role: 'support', label: 'Hint', code: 'print(2)\n' },
            { role: 'complete', label: 'Complete', code: 'print(3)\n' },
          ],
        },
      ],
    },
    {
      id: 3,
      title: 'Page',
      moduleType: 'html',
      starterFiles: [
        { name: 'index.html', type: 'html', content: '<p>hi</p>' },
        { name: 'style.css', type: 'css', content: 'p {}' },
      ],
      completeFiles: [{ name: 'index.html', type: 'html', content: '<h1>done</h1>' }],
    },
    {
      id: 4,
      title: 'Sprite',
      moduleType: 'scratch',
      starterBlocks: { a: 1 },
      codeStages: [{ role: 'complete', blocks: { b: 2 } }],
    },
  ],
}

const taskOf = (lesson, id) => flattenTasks(lesson.tasks).find((t) => String(t.id) === String(id))

describe('normaliseShot', () => {
  it('defaults to the whole student page at desktop size', () => {
    expect(normaliseShot({ task: 2 })).toMatchObject({
      task: '2',
      view: 'student',
      crop: 'page',
      width: 1440,
      height: 900,
      hasTouch: false,
      run: false,
      inputs: [],
      students: [],
    })
  })

  it('reads the view names request #75 used as a view and crop', () => {
    expect(normaliseShot({ task: 2, view: 'editor+output' })).toMatchObject({
      view: 'student',
      crop: 'workspace',
    })
    expect(normaliseShot({ task: 2, view: 'tutor-page' })).toMatchObject({ view: 'tutor' })
  })

  it('takes tablet size with touch, and explicit sizes over the device', () => {
    expect(normaliseShot({ task: 2, device: 'tablet' })).toMatchObject({
      width: 1024,
      height: 768,
      hasTouch: true,
    })
    expect(normaliseShot({ task: 2, device: 'tablet', width: 800 })).toMatchObject({ width: 800 })
  })

  it('rejects unknown views, crops, devices and a code plus code stage', () => {
    expect(() => normaliseShot({ task: 2, view: 'nope' })).toThrow(/Unknown view/)
    expect(() => normaliseShot({ task: 2, crop: 'nope' })).toThrow(/Unknown crop/)
    expect(() => normaliseShot({ task: 2, device: 'phone' })).toThrow(/Unknown device/)
    expect(() => normaliseShot({ task: 2, code: 'x', codeStage: 'complete' })).toThrow(/not both/)
    expect(() => normaliseShot({ task: 2, view: 'tutor', crop: 'editor' })).toThrow(/whole/)
  })

  it('gives session views two made-up students and only accepts "Test" names', () => {
    expect(normaliseShot({ task: 2, view: 'tutor-grid' }).students.map((s) => s.name)).toEqual([
      'Test Ava',
      'Test Ben',
    ])
    expect(() => normaliseShot({ task: 2, view: 'tutor', students: ['Jamie'] })).toThrow(/made up/)
    expect(() => normaliseShot({ task: 2, view: 'tutor', students: ['Test A', 'Test A'] })).toThrow(
      /twice/
    )
    expect(() => normaliseShot({ task: 2, view: 'student-modal', student: 'Test Zed' })).toThrow(
      /not in this shot/
    )
  })

  it('makes someone share for a Shared work shot and views it as a classmate', () => {
    const shot = normaliseShot({ task: 2, view: 'shared-work' })
    expect(shot.students[0].share).toBe(true)
    expect(shot.student).toBe('Test Ben')
  })

  it('lets each spec entry override the command-line defaults', () => {
    const shots = normaliseShots([{ task: 2 }, { task: 3, crop: 'editor' }], { crop: 'workspace' })
    expect(shots.map((s) => s.crop)).toEqual(['workspace', 'editor'])
    expect(() => normaliseShots([])).toThrow(/array/)
    expect(() => normaliseShots([{ task: 2, view: 'x' }])).toThrow(/Shot 1 \(task 2\)/)
  })
})

describe('shotFileName', () => {
  it('names the file after the task, then any view, crop and non-default size', () => {
    expect(shotFileName(normaliseShot({ task: 20 }))).toBe('task 20.png')
    expect(shotFileName(normaliseShot({ task: 20, openTask: 21, crop: 'output' }))).toBe(
      'task 21 - output.png'
    )
    expect(shotFileName(normaliseShot({ task: 5, view: 'tutor-grid', device: 'tablet' }))).toBe(
      'task 5 - tutor-grid - 1024x768.png'
    )
  })
})

describe('findShotTask', () => {
  it('finds tasks inside groups by id, as text or number', () => {
    expect(findShotTask(LESSON, '2').title).toBe('Poster')
    expect(() => findShotTask(LESSON, 9)).toThrow(/task ids: 1, 2, 3, 4/)
  })
})

describe('prepareShotLesson', () => {
  it('leaves the lesson alone with no code override', () => {
    expect(prepareShotLesson(LESSON, normaliseShot({ task: 2 }))).toBe(LESSON)
  })

  it('puts Python code in as the starter and drops carry, without changing the lesson', () => {
    const lesson = prepareShotLesson(LESSON, normaliseShot({ task: 2, code: 'print("me")' }))
    const task = taskOf(lesson, 2)
    expect(task.codeStages[0]).toEqual({ role: 'starter', label: 'Starter', code: 'print("me")' })
    expect(task.codeStages.map((s) => s.role)).toEqual(['starter', 'support', 'complete'])
    expect(task.carryCodeFrom).toBeUndefined()
    expect(taskOf(LESSON, 2).codeStages[0].code).toBe('print(1)\n')
  })

  it('shows a code stage by role, label or index', () => {
    const byRole = prepareShotLesson(LESSON, normaliseShot({ task: 2, codeStage: 'complete' }))
    expect(taskOf(byRole, 2).starterCode).toBe('print(3)\n')
    const byLabel = prepareShotLesson(LESSON, normaliseShot({ task: 2, codeStage: 'Hint' }))
    expect(taskOf(byLabel, 2).starterCode).toBe('print(2)\n')
    expect(() => prepareShotLesson(LESSON, normaliseShot({ task: 2, codeStage: 'x' }))).toThrow(
      /no code stage "x"/
    )
  })

  it('puts HTML code in its entry file, and complete files in whole', () => {
    const code = prepareShotLesson(LESSON, normaliseShot({ task: 3, code: '<h2>me</h2>' }))
    expect(taskOf(code, 3).starterFiles).toEqual([
      { name: 'index.html', type: 'html', content: '<h2>me</h2>' },
      { name: 'style.css', type: 'css', content: 'p {}' },
    ])
    const complete = prepareShotLesson(LESSON, normaliseShot({ task: 3, codeStage: 'complete' }))
    expect(taskOf(complete, 3).starterFiles).toEqual(LESSON.tasks[2].completeFiles)
  })

  it('refuses code for a task with no code', () => {
    expect(() => prepareShotLesson(LESSON, normaliseShot({ task: 1, code: 'x' }))).toThrow(
      /don't apply/
    )
  })

  it('puts Scratch blocks in as the starter blocks', () => {
    const lesson = prepareShotLesson(LESSON, normaliseShot({ task: 4, codeStage: 'complete' }))
    expect(taskOf(lesson, 4).starterBlocks).toEqual({ b: 2 })
    const json = prepareShotLesson(LESSON, normaliseShot({ task: 4, code: '{"c":3}' }))
    expect(taskOf(json, 4).starterBlocks).toEqual({ c: 3 })
  })
})

describe('readSpecCode', () => {
  it('reads "@path" relative to the folder and passes other values through', async () => {
    const read = async (p) => `read ${p.replace(/\\/g, '/')}`
    expect(await readSpecCode('print(1)', '/spec', read)).toBe('print(1)')
    expect(await readSpecCode(undefined, '/spec', read)).toBeUndefined()
    expect(await readSpecCode('@code/a.py', '/spec', read)).toMatch(/read .*\/spec\/code\/a\.py$/)
  })
})

describe('session copies', () => {
  it('makes a draft copy outside every level, sharing on only where asked', () => {
    const copy = buildThrowawayLesson(LESSON, 'shot-abc', [2])
    expect(copy).toMatchObject({ id: 'shot-abc', title: '[Screenshot] Posters', draft: true })
    expect(copy.levelId).toBeUndefined()
    expect(taskOf(copy, 2).allowSharing).toBe(true)
    expect(taskOf(copy, 3).allowSharing).toBeUndefined()
    expect(taskOf(LESSON, 2).allowSharing).toBeUndefined()
  })

  it('gives copies ids the cleanup accepts', () => {
    expect(throwawayLessonId(1_700_000_000_000, 0.5)).toMatch(/^shot-[a-z0-9]+$/)
  })

  it('lists every lesson-keyed Realtime Database node from the rules', () => {
    const rules =
      '{ "rules": { // comment\n "sessions": { "$lessonId": {} }, "admins": { ".read": true } } }'
    expect(lessonKeyedNodes(rules.replace('// comment', '\n// comment\n'))).toEqual(['sessions'])
  })
})

// The CLI finds panels by these hooks. Renaming or removing one breaks screenshots, so this
// fails first: update CROP_TEST_IDS (and the docs) with the app.
describe('app hooks the screenshot command relies on', () => {
  const srcRoot = resolve(import.meta.dirname, '../src')
  const files = []
  ;(function walk(dir) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (name === '__tests__' || name === 'test') continue
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.jsx?$/.test(name)) files.push(readFileSync(p, 'utf8'))
    }
  })(srcRoot)
  const source = files.join('\n')
  const hooks = [
    ...new Set([
      ...Object.values(CROP_TEST_IDS).flat(),
      'shot-page',
      'shot-empty',
      'student-grid',
      'share-request-banner',
    ]),
  ]

  it.each(hooks)('data-testid="%s" is still in the app', (id) => {
    expect(source).toContain(`data-testid="${id}"`)
  })

  it('Run buttons still carry their highlight targets', () => {
    expect(source).toMatch(/data-highlight-target="run stop"/)
    expect(source).toMatch(/data-highlight-target="green_flag"/)
    expect(source).toMatch(/data-highlight-target=\{isSubmit \? undefined : 'run'\}/)
  })

  it('a playing Turtle picture says so', () => {
    expect(source).toContain("data-playing={playing ? 'true' : undefined}")
  })
})
