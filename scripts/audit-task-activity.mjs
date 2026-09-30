// Coverage audit for the badge rules (docs/architecture/live-badges-plan.md, "Task kind"): scans
// lesson YAML / JSON files, read-only, and counts tasks per recognised `taskActivity` pattern,
// the unrecognised values, and how many tasks of each pattern have a `check` (attempts, which
// the pass-based badges read, are only logged for checked tasks).
//
//   node scripts/audit-task-activity.mjs <file-or-folder> [...more] [--json]
//
// Folders are scanned recursively (skipping node_modules, .git and report folders). Files that
// aren't a lesson (no top-level id, type and tasks) are skipped. When several files hold the same
// lesson id (drafts, backups), the most recently modified one is counted.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { parseYamlLesson } from '../cli/yaml-converter.mjs'
import { flattenTasks } from '../src/shared/taskUtils.js'
import { TASK_ACTIVITY_PATTERNS, parseTaskActivity } from '../src/shared/taskActivity.js'
import { getBadgesByPattern } from '../src/badges/registry.pure.js'
import { isGradedQuizTask } from '../src/badges/lessonIndex.js'
import { DEFAULT_BADGE_OPTIONS } from '../src/badges/badgeOptions.js'

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist'])
const LESSON_FILE = /\.(ya?ml|json)$/i

function walk(target) {
  const stat = statSync(target)
  if (stat.isFile()) return LESSON_FILE.test(target) ? [target] : []
  return readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP_DIRS.has(entry.name) || /^reports?$/i.test(entry.name)) return []
    return walk(path.join(target, entry.name))
  })
}

function readLesson(file) {
  try {
    const text = readFileSync(file, 'utf8')
    const lesson = /\.json$/i.test(file) ? JSON.parse(text) : parseYamlLesson(text)
    const isLesson =
      lesson &&
      typeof lesson.id === 'string' &&
      typeof lesson.type === 'string' &&
      Array.isArray(lesson.tasks)
    return isLesson ? lesson : null
  } catch {
    return null
  }
}

/** Latest file per lesson id → [{ file, lesson }]. */
export function collectLessons(targets) {
  const byId = new Map()
  for (const file of targets.flatMap(walk)) {
    const lesson = readLesson(file)
    if (!lesson) continue
    const mtime = statSync(file).mtimeMs
    const prev = byId.get(lesson.id)
    if (!prev || prev.mtime < mtime) byId.set(lesson.id, { file, lesson, mtime })
  }
  return [...byId.values()].sort((a, b) => a.lesson.id.localeCompare(b.lesson.id))
}

/** Counts per pattern / plain form, unrecognised values, and missing taskActivity. */
export function auditLessons(lessons) {
  const rows = new Map()
  const unknown = new Map()
  let tasks = 0
  let missing = 0
  // Groups with enough graded quizzes for 🎯 Quiz Master (at the default minimum).
  let quizGroups = 0
  let lessonsWithQuizGroup = 0
  const bump = (key, hasCheck) => {
    const row = rows.get(key) ?? { tasks: 0, withCheck: 0 }
    row.tasks += 1
    if (hasCheck) row.withCheck += 1
    rows.set(key, row)
  }
  for (const { lesson } of lessons) {
    const groups = lesson.tasks.filter(
      (item) =>
        item?.type === 'group' &&
        (item.subtasks ?? []).filter(isGradedQuizTask).length >=
          DEFAULT_BADGE_OPTIONS.quizMasterMinQuizzes
    ).length
    quizGroups += groups
    if (groups > 0) lessonsWithQuizGroup += 1
    for (const task of flattenTasks(lesson.tasks)) {
      tasks += 1
      const hasCheck = task.check != null
      const value = typeof task.taskActivity === 'string' ? task.taskActivity.trim() : ''
      if (!value) {
        missing += 1
        continue
      }
      const parsed = parseTaskActivity(value)
      if (!parsed.known) {
        unknown.set(value, (unknown.get(value) ?? 0) + 1)
        if (!parsed.pattern) continue
      }
      bump(parsed.pattern ?? `(plain ${parsed.format})`, hasCheck)
    }
  }
  return {
    lessons: lessons.length,
    tasks,
    missing,
    quizGroups,
    lessonsWithQuizGroup,
    rows,
    unknown,
  }
}

function printReport({ lessons, tasks, missing, quizGroups, lessonsWithQuizGroup, rows, unknown }) {
  const badges = getBadgesByPattern()
  const names = new Map(TASK_ACTIVITY_PATTERNS.map((p) => [p.id, p.name]))
  console.log(`Lessons: ${lessons}   Tasks: ${tasks}   No taskActivity: ${missing}`)
  console.log(
    `Quiz groups with ${DEFAULT_BADGE_OPTIONS.quizMasterMinQuizzes}+ graded quizzes: ${quizGroups} (in ${lessonsWithQuizGroup} lessons)\n`
  )
  console.log('Pattern'.padEnd(44) + 'Tasks'.padStart(6) + 'Check'.padStart(7) + '  Badges')
  const sorted = [...rows.entries()].sort((a, b) => b[1].tasks - a[1].tasks)
  for (const [key, row] of sorted) {
    const label = names.has(key) ? `${names.get(key)} (${key})` : key
    console.log(
      label.padEnd(44) +
        String(row.tasks).padStart(6) +
        String(row.withCheck).padStart(7) +
        '  ' +
        (badges[key] ?? []).join(', ')
    )
  }
  console.log(`\nUnrecognised taskActivity values: ${unknown.size}`)
  for (const [value, count] of [...unknown.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(4)}  ${value}`)
  }
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
if (isMain) {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const targets = args.filter((arg) => arg !== '--json')
  if (targets.length === 0) {
    console.error('Usage: node scripts/audit-task-activity.mjs <file-or-folder> [...more] [--json]')
    process.exit(1)
  }
  const report = auditLessons(collectLessons(targets))
  if (json) {
    console.log(
      JSON.stringify(
        {
          ...report,
          rows: Object.fromEntries(report.rows),
          unknown: Object.fromEntries(report.unknown),
        },
        null,
        2
      )
    )
  } else {
    printReport(report)
  }
}
