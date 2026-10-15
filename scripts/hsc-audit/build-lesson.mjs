#!/usr/bin/env node
// HSC Audit visual review: builds the draft test lesson `hsc-audit-visual-review`.
//
// It copies one real example of each task kind from published lessons (so the
// screenshots show what classes actually see), adds small hand-written tasks
// for modules no in-scope lesson uses yet, and writes the lesson JSON.
//
//   node scripts/hsc-audit/build-lesson.mjs            # write JSON only
//   node scripts/hsc-audit/build-lesson.mjs --upsert   # also validate + upsert (draft)
//
// The lesson is a draft with no level, so it never appears in a level list.
// Delete it after a review with: node cli/cli.mjs lessons delete hsc-audit-visual-review

import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repo = resolve(__dirname, '../..')
// HSC_CLI lets a worktree use a checkout whose cli/ has its packages and .env.
const cli = process.env.HSC_CLI || join(repo, 'cli', 'cli.mjs')
export const LESSON_ID = 'hsc-audit-visual-review'

const SOURCE_LESSONS = [
  'python-1-1',
  'python-1-2',
  'python-1-3',
  'python-1-10',
  'python-2b-2',
  'python-3b-2',
  'python-4b-4',
  'scratch-1-1',
  'scratch-1-2',
  'game-dev-1-1',
  'qa-modular-activities',
]

function getLesson(id) {
  try {
    return JSON.parse(
      execFileSync('node', [cli, 'lessons', 'get', id], { encoding: 'utf8', maxBuffer: 64e6 })
    )
  } catch {
    console.warn(`  (skipped ${id}: not found)`)
    return null
  }
}

function flatten(tasks, out = []) {
  for (const t of tasks || []) {
    if (Array.isArray(t.subtasks)) flatten(t.subtasks, out)
    else out.push(t)
  }
  return out
}

const CARRY_KEYS = [
  'carryCodeFrom',
  'carryBlocksFrom',
  'carryCircuitFrom',
  'carryFsFrom',
  'carryDesktopFrom',
  'carryCodeFromLesson',
  'carryBlocksFromLesson',
]

// Make a copied task self-contained: no carry, fresh id, provenance in the intent.
function clean(task, lessonId, id) {
  const t = structuredClone(task)
  for (const k of CARRY_KEYS) delete t[k]
  delete t.intentLastChangedAt
  delete t.taskLastChangedAt
  t.id = id
  t.intent = `HSC Audit copy of "${task.title}" from ${lessonId}.`
  return t
}

const has = (v) => (Array.isArray(v) ? v.length > 0 : v != null && v !== '')
const noCarry = (t) => !CARRY_KEYS.some((k) => has(t[k]))
const quizType = (t) => t.quizType || (t.taskType === 'quiz' ? 'multiple_choice' : null)

// [slot, predicate] — first match across SOURCE_LESSONS wins.
const PICKS = [
  ['intro', (t) => t.informationType === 'introduction'],
  ['info', (t) => t.taskType === 'information' && !t.informationType && has(t.explainer)],
  [
    'python',
    (t) =>
      t.moduleType === 'python' &&
      !t.taskMode &&
      !has(t.copyCode) &&
      has(t.codeStages) &&
      has(t.feedbackChecks) &&
      noCarry(t),
  ],
  ['python-copy', (t) => t.moduleType === 'python' && has(t.copyCode) && noCarry(t)],
  [
    'python-input',
    (t) =>
      t.moduleType === 'python' &&
      /input\(/.test(JSON.stringify(t.codeStages || t.starterCode || '')) &&
      noCarry(t),
  ],
  ['code-arrange', (t) => t.taskType === 'code_arrange'],
  ['mc', (t) => quizType(t) === 'multiple_choice' && has(t.options)],
  ['match', (t) => quizType(t) === 'match'],
  ['fill', (t) => quizType(t) === 'fill_blank'],
  ['confidence', (t) => quizType(t) === 'confidence'],
  ['scratch', (t) => t.moduleType === 'scratch' && !t.taskMode && has(t.sprites) && noCarry(t)],
  ['scratch-quiz', (t) => t.taskType === 'quiz' && t.moduleType === 'scratch'],
  ['electronics', (t) => t.moduleType === 'electronics' && noCarry(t)],
  ['arcade', (t) => t.moduleType === 'arcade' && noCarry(t)],
  [
    'keyboard',
    (t) => t.activityType === 'keyboard' || (t.type === 'keyboard' && t.mode === 'type_text'),
  ],
  ['mouse', (t) => t.activityType === 'mouse' || t.type === 'mouse'],
  ['binary', (t) => t.activityType === 'binary' || t.type === 'binary'],
  ['recap', (t) => t.informationType === 'recap'],
]

// Hand-written tasks for kinds no in-scope lesson uses (yet).
const AUTHORED = {
  'short-answer': {
    taskType: 'quiz',
    quizType: 'short_answer',
    taskMode: 'live',
    title: 'Show and tell',
    explainer: 'What have you made, tried or played with since last lesson?',
    showResponses: 'teacher_picks',
  },
  poll: {
    taskType: 'quiz',
    quizType: 'poll',
    title: 'What next?',
    explainer: 'Which would you like to try **next week**?',
    options: [
      { id: 'a', text: 'Make a game' },
      { id: 'b', text: 'Draw with code' },
      { id: 'c', text: 'Build a website' },
    ],
  },
  turtle: {
    moduleType: 'turtle',
    title: 'Draw a square',
    explainer: 'Use a loop to draw a square with the turtle. Press **Run**.',
    starterCode:
      'import turtle\n\nfor _ in range(4):\n    turtle.forward(100)\n    turtle.left(90)\n',
    check: [{ type: 'turtle_path_closed', tolerance: 2 }],
  },
  html: {
    moduleType: 'html',
    title: 'Add a heading',
    explainer: 'Add an `<h1>` heading that says **Hello**, then press **Run**.',
    starterFiles: [
      {
        name: 'index.html',
        type: 'html',
        content: '<!DOCTYPE html>\n<html>\n<body>\n\n</body>\n</html>\n',
      },
      { name: 'style.css', type: 'css', content: 'body { font-family: sans-serif; }\n' },
    ],
    check: { type: 'html_element', operator: 'exists', selector: 'h1' },
  },
  filesystem: {
    moduleType: 'filesystem',
    title: 'Make a Documents folder',
    explainer: 'Create a folder called **Documents**.',
    starterFs: { '/': { type: 'dir' }, '/notes.txt': { type: 'file', content: 'Hello!' } },
    check: { type: 'fs_path', operator: 'exists', itemType: 'dir', path: '/Documents/' },
  },
  desktop: {
    moduleType: 'desktop',
    title: 'Open the File Manager',
    explainer: 'Open **File Manager** from the desktop and create a folder called **Documents**.',
    availableApps: ['fileManager', 'textEditor', 'paint'],
    starterDesktop: {
      fs: { '/': { type: 'dir' }, '/Downloads/': { type: 'dir' } },
      recycleBin: [],
      windows: [],
    },
    check: { type: 'fs_path', operator: 'exists', itemType: 'dir', path: '/Documents/' },
  },
  badges: { taskType: 'information', informationType: 'badges', title: 'Badge Summary' },
}

// Order in the lesson. The screenshot script finds each task by its title.
export const ORDER = [
  'intro',
  'info',
  'python',
  'python-copy',
  'python-input',
  'code-arrange',
  'mc',
  'match',
  'fill',
  'confidence',
  'short-answer',
  'poll',
  'turtle',
  'html',
  'scratch',
  'scratch-quiz',
  'electronics',
  'arcade',
  'filesystem',
  'desktop',
  'keyboard',
  'mouse',
  'binary',
  'recap',
  'badges',
]

export function buildLesson() {
  const sources = SOURCE_LESSONS.map((id) => [id, getLesson(id)]).filter(([, l]) => l)
  const picked = {}
  for (const [slot, pred] of PICKS) {
    for (const [lessonId, lesson] of sources) {
      const hit = flatten(lesson.tasks).find(pred)
      if (hit) {
        picked[slot] = clean(hit, lessonId, `audit-${slot}`)
        console.log(`  ${slot.padEnd(14)} ← ${lessonId}: ${hit.title}`)
        break
      }
    }
    if (!picked[slot]) console.warn(`  ${slot.padEnd(14)} ← (no example found, left out)`)
  }
  // Switch on features the copied task may not use, so they can be screenshotted.
  if (picked.python) {
    const p = picked.python
    p.allowSharing = true
    const starter = (p.codeStages || []).find((s) => s.role === 'starter')
    if (starter) starter.code = `#> Write your print() line here\n${starter.code || ''}`
    p.sideQuests = [
      {
        title: 'Break it, then fix it',
        kind: 'debug',
        explainer: 'This line has a bug. Run it, read the error, then fix it.',
        starter: 'print("Hello)\n',
      },
      {
        title: 'Predict, then run',
        kind: 'predict',
        explainer: 'What will this print? Decide first, then press Run.',
        starter: 'print("Hi " * 3)\n',
      },
    ]
  }
  for (const [slot, task] of Object.entries(AUTHORED)) {
    picked[slot] = { id: `audit-${slot}`, intent: 'HSC Audit hand-written task.', ...task }
  }
  // Keyboard/mouse/binary from the QA lesson use the older `type:` shape; the
  // CLI's converter accepts both, so they are passed through unchanged.
  // Numeric ids like real lessons; slot order is fixed, so task N is ORDER[N-1].
  const tasks = ORDER.filter((s) => picked[s]).map((s, i) => ({ ...picked[s], id: i + 1 }))
  return {
    id: LESSON_ID,
    type: 'composed',
    title: 'HSC Audit - Visual Review (test lesson)',
    description:
      'Draft test lesson for the termly HSC Audit visual review. One example of each task kind. Not a real lesson; safe to delete.',
    draft: true,
    tasks,
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log('Building the HSC Audit test lesson from published lessons:')
  const lesson = buildLesson()
  const out = join(repo, 'scripts', 'hsc-audit', '.out', `${LESSON_ID}.json`)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify(lesson, null, 2))
  console.log(`Wrote ${out} (${lesson.tasks.length} tasks)`)
  if (process.argv.includes('--upsert')) {
    execFileSync('node', [cli, 'lessons', 'validate', out], { stdio: 'inherit' })
    execFileSync('node', [cli, 'lessons', 'upsert', out], { stdio: 'inherit' })
  }
}
