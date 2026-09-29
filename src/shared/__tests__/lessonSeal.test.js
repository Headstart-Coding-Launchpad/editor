import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseYamlLesson } from '../../../cli/yaml-converter.mjs'
import {
  SEALED_FIELD,
  TASK_SEALED_FIELDS,
  decodeSealPayload,
  encodeSealPayload,
  getSealedFieldsForTask,
  lessonNeedsSealing,
  sealLesson,
  sealTask,
  sealTasks,
  unsealLesson,
  unsealTask,
  unsealTasks,
} from '../lessonSeal'
import {
  decodeLessonBlocksFromFirestore,
  decodeLessonFromFirestore,
  encodeLessonBlocksForFirestore,
  encodeLessonForFirestore,
} from '../lessonBlocksCodec'
import { applyLessonOverride } from '../lessonService'
import {
  ALL_LEGACY_ACTIVITY_TASKS,
  legacyActivityLesson,
} from '../../test/fixtures/legacyActivityTasks'
import {
  arcadeLesson,
  composedLesson,
  desktopLesson,
  electronicsLesson,
  filesystemLesson,
  htmlLesson,
  pythonLesson,
  scratchLesson,
  turtleLesson,
} from '../../test/fixtures/studentCodeStateLessons'
import { getActivityDefinitions } from '../../activities/registry.pure.js'

// ── Sample lessons: every complete lesson example in docs/authoring (the same corpus as
// authoringDocExamples.test.js) plus the shared classroom fixtures. ───────────────────────

const DOCS_DIR = resolve(process.cwd(), 'docs/authoring')

function docLessons() {
  const files = [
    ...readdirSync(DOCS_DIR).filter((name) => name.endsWith('.md')),
    ...readdirSync(resolve(DOCS_DIR, 'activities'))
      .filter((name) => name.endsWith('.md'))
      .map((name) => `activities/${name}`),
  ]
  const lessons = []
  for (const file of files) {
    const text = readFileSync(resolve(DOCS_DIR, file), 'utf8').replace(/\r\n/g, '\n')
    const pattern = /(<!--\s*example:template\s*-->\n)?```(yaml|json)\n([\s\S]*?)```/g
    let match
    while ((match = pattern.exec(text))) {
      const [, templateMarker, lang, body] = match
      if (templateMarker) continue
      const isLesson =
        lang === 'yaml'
          ? /^id:/m.test(body) && /^tasks:/m.test(body)
          : body.trim().startsWith('{') && /"id"\s*:/.test(body) && /"tasks"\s*:/.test(body)
      if (!isLesson) continue
      const line = text.slice(0, match.index).split('\n').length + 1
      lessons.push({
        name: `${file}:${line}`,
        lesson: lang === 'yaml' ? parseYamlLesson(body) : JSON.parse(body),
      })
    }
  }
  return lessons
}

const SAMPLE_LESSONS = [
  ...docLessons(),
  { name: 'fixture python', lesson: pythonLesson() },
  { name: 'fixture turtle', lesson: turtleLesson() },
  { name: 'fixture arcade', lesson: arcadeLesson() },
  { name: 'fixture electronics', lesson: electronicsLesson() },
  { name: 'fixture html', lesson: htmlLesson() },
  { name: 'fixture scratch', lesson: scratchLesson() },
  { name: 'fixture filesystem', lesson: filesystemLesson() },
  { name: 'fixture desktop', lesson: desktopLesson() },
  { name: 'fixture composed', lesson: composedLesson() },
  {
    name: 'fixture legacy activities',
    lesson: legacyActivityLesson(Object.values(ALL_LEGACY_ACTIVITY_TASKS)),
  },
]

// Firestore only stores JSON, so compare JSON-normalised shapes.
const json = (value) => JSON.parse(JSON.stringify(value))

function flatTasks(tasks) {
  return (tasks ?? []).flatMap((task) =>
    task?.type === 'group' ? flatTasks(task.subtasks) : [task]
  )
}

describe('lesson seal round trip over sample lessons', () => {
  it('finds the sample lessons', () => {
    expect(SAMPLE_LESSONS.length).toBeGreaterThanOrEqual(20)
  })

  it.each(SAMPLE_LESSONS)('$name: unsealLesson(sealLesson(x)) is lossless', ({ lesson }) => {
    const original = json(lesson)
    const sealed = json(sealLesson(original))
    expect(json(unsealLesson(sealed))).toEqual(original)
    // Sealing never mutates its input.
    expect(original).toEqual(json(lesson))
  })

  it.each(SAMPLE_LESSONS)('$name: the Firestore boundary round-trips', ({ lesson }) => {
    const original = json(lesson)
    const stored = json(encodeLessonForFirestore(original))
    const expected = json(decodeLessonBlocksFromFirestore(encodeLessonBlocksForFirestore(original)))
    expect(json(decodeLessonFromFirestore(stored))).toEqual(expected)
  })

  it.each(SAMPLE_LESSONS)('$name: no answer field is left in plain text', ({ lesson }) => {
    const sealed = json(sealLesson(json(lesson)))
    for (const task of flatTasks(sealed.tasks)) {
      for (const field of getSealedFieldsForTask(task)) expect(task[field]).toBeUndefined()
    }
    expect(lessonNeedsSealing(sealed)).toBe(false)
  })
})

describe('what gets sealed', () => {
  it('seals complete code, code stages, checks and tests but keeps student-facing fields', () => {
    const task = {
      id: 1,
      title: 'Say hi',
      explainer: 'Print **hi**',
      starterCode: 'print("start")',
      copyCode: 'print("copy me")',
      completeCode: 'print("hi")',
      codeStages: [
        { label: 'Starter', role: 'starter', code: 'print("start")' },
        { label: 'Complete', role: 'complete', code: 'print("hi")' },
      ],
      check: { type: 'output', operator: 'contains', value: 'SECRET-EXPECTED' },
      feedbackChecks: [{ type: 'code', operator: 'contains', value: 'while', mode: 'nudge' }],
      tests: [{ inputs: ['1'], check: { type: 'output', value: 'SECRET-TEST' } }],
    }
    const sealed = sealTask(task)
    expect(Object.keys(sealed).sort()).toEqual(
      ['id', 'title', 'explainer', 'starterCode', 'copyCode', SEALED_FIELD].sort()
    )
    expect(sealed[SEALED_FIELD]).toMatch(/^v1:[A-Za-z0-9+/=]+$/)
    const raw = JSON.stringify(sealed)
    expect(raw).not.toContain('SECRET-EXPECTED')
    expect(raw).not.toContain('SECRET-TEST')
    expect(raw).not.toContain('print("hi")')
    expect(unsealTask(sealed)).toEqual(task)
  })

  it('seals the answer fields of quiz and code_arrange activities', () => {
    const lesson = legacyActivityLesson(Object.values(ALL_LEGACY_ACTIVITY_TASKS))
    const raw = JSON.stringify(sealLesson(lesson))
    for (const answer of ['Shows text', 'Yes - print shows text.', '"answer":"print"']) {
      expect(raw).not.toContain(answer)
    }
    const byType = Object.fromEntries(
      sealLesson(lesson).tasks.map((task) => [task.quizType ?? task.taskType, task])
    )
    expect(byType.match.pairs).toBeUndefined()
    expect(byType.fill_blank.blanks).toBeUndefined()
    const dragFillBlank = sealLesson(lesson).tasks.find((task) => task.mode === 'drag')
    expect(dragFillBlank.distractors).toBeDefined()
    expect(byType.multiple_choice.options).toBeUndefined()
    expect(byType.code_arrange.lines).toBeUndefined()
  })

  it('declares sealedFields on every activity (an array)', () => {
    for (const activity of getActivityDefinitions()) {
      expect(Array.isArray(activity.sealedFields)).toBe(true)
    }
    expect(TASK_SEALED_FIELDS).toContain('check')
  })

  it('leaves tasks with nothing to seal unchanged (no _sealed)', () => {
    const info = { id: 1, taskType: 'information', title: 'Welcome', explainer: 'Hello' }
    expect(sealTask(info)).toEqual(info)
    expect(sealTask(info)[SEALED_FIELD]).toBeUndefined()
  })

  it('seals group subtasks and leaves the group itself alone', () => {
    const lesson = {
      id: 'g',
      tasks: [
        {
          id: 'g-1',
          type: 'group',
          title: 'Group',
          subtasks: [{ id: 1, title: 'A', check: { type: 'output', value: 'x' } }],
        },
      ],
    }
    const sealed = sealLesson(lesson)
    expect(sealed.tasks[0].title).toBe('Group')
    expect(sealed.tasks[0][SEALED_FIELD]).toBeUndefined()
    expect(sealed.tasks[0].subtasks[0].check).toBeUndefined()
    expect(sealed.tasks[0].subtasks[0][SEALED_FIELD]).toBeDefined()
    expect(unsealLesson(sealed)).toEqual(lesson)
  })
})

describe('encoding details', () => {
  it('round-trips Unicode and emoji', () => {
    const payload = { completeCode: 'print("héllo 🐢 — 日本")', check: { value: 'ümlaut' } }
    expect(decodeSealPayload(encodeSealPayload(payload))).toEqual(payload)
  })

  it('is idempotent: sealing a sealed task keeps one payload', () => {
    const task = { id: 1, title: 'T', completeCode: 'x = 1', check: { type: 'code', value: 'x' } }
    const twice = sealTask(sealTask(task))
    expect(unsealTask(twice)).toEqual(task)
    expect(decodeSealPayload(twice[SEALED_FIELD])).toEqual({
      completeCode: 'x = 1',
      check: { type: 'code', value: 'x' },
    })
  })

  it('passes unsealed (legacy) lessons through unchanged', () => {
    const lesson = pythonLesson()
    expect(unsealLesson(lesson)).toEqual(lesson)
    expect(lessonNeedsSealing(lesson)).toBe(true)
    expect(lessonNeedsSealing({ id: 'x', tasks: [{ id: 1, title: 'T' }] })).toBe(false)
  })

  it('keeps an unreadable or unknown-version payload as stored', () => {
    for (const sealed of ['v9:AAAA', 'v1:@@not base64@@', 'v1:' + btoa('not json'), 42]) {
      const task = { id: 1, title: 'T', [SEALED_FIELD]: sealed }
      expect(unsealTask(task)).toEqual(task)
      expect(sealTask(task)).toEqual(task)
    }
  })

  it('lets a plain field set beside the payload win', () => {
    const sealed = sealTask({ id: 1, check: { type: 'code', value: 'old' } })
    const edited = { ...sealed, check: { type: 'code', value: 'new' } }
    expect(unsealTask(edited).check.value).toBe('new')
  })

  it('round-trips randomly generated task payloads', () => {
    let seed = 1234567
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    const CHARS = 'ab"\\\n\t{}é🐢日\u0000 '
    const randString = () =>
      Array.from(
        { length: Math.floor(rand() * 12) },
        () => CHARS[Math.floor(rand() * CHARS.length)]
      ).join('')
    const randValue = (depth) => {
      const r = rand()
      if (depth > 3 || r < 0.3) return randString()
      if (r < 0.4) return Math.floor(rand() * 1e6) - 5e5
      if (r < 0.45) return rand() < 0.5
      if (r < 0.5) return null
      if (r < 0.75)
        return Array.from({ length: Math.floor(rand() * 4) }, () => randValue(depth + 1))
      return Object.fromEntries(
        Array.from({ length: Math.floor(rand() * 4) }, () => [randString(), randValue(depth + 1)])
      )
    }
    for (let i = 0; i < 200; i++) {
      const task = { id: i, title: randString() }
      for (const field of TASK_SEALED_FIELDS) if (rand() < 0.4) task[field] = randValue(0)
      expect(json(unsealTask(json(sealTask(task))))).toEqual(json(task))
    }
  })
})

describe('session lesson overrides', () => {
  it('applyLessonOverride unseals sealed override tasks and accepts plain ones', () => {
    const lesson = pythonLesson()
    const tasks = json(lesson.tasks)
    expect(applyLessonOverride(lesson, sealTasks(tasks)).tasks).toEqual(tasks)
    expect(applyLessonOverride(lesson, tasks).tasks).toEqual(tasks)
    expect(unsealTasks(null)).toBe(null)
  })
})
