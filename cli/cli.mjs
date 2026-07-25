#!/usr/bin/env node
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '.env') })

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import yaml from 'js-yaml'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { extname, basename, relative, sep } from 'node:path'
import {
  parseJson,
  parseJsonOrYaml,
  parseLessonJsonOrYaml,
  parseTopicJsonOrYaml,
  parseTopicLibraryJsonOrYaml,
} from './structured-input.mjs'
import { validateTopicStage } from '../src/shared/topicAudit.js'

const MIME_MAP = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
}

async function readStdin() {
  if (process.stdin.isTTY) process.stderr.write('Reading from stdin… (Ctrl+D when done)\n')
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf-8')
}

async function readText(filePath) {
  return filePath ? readFile(filePath, 'utf-8') : readStdin()
}

async function writeText(filePath, text) {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, text, 'utf-8')
}

function currentOutputFormat() {
  if (process.argv.includes('--yaml')) return 'yaml'
  const formatIndex = process.argv.findIndex(arg => arg === '--format' || arg === '-f')
  if (formatIndex !== -1) return process.argv[formatIndex + 1] === 'yaml' ? 'yaml' : 'json'
  const inlineFormat = process.argv.find(arg => arg.startsWith('--format='))
  return inlineFormat?.split('=')[1] === 'yaml' ? 'yaml' : 'json'
}

function yamlDump(data) {
  return yaml.dump(data, {
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
  })
}

function print(data, options = {}) {
  if (currentOutputFormat() === 'yaml') {
    process.stdout.write(options.yamlText ?? yamlDump(data))
    if (!(options.yamlText ?? '').endsWith('\n')) process.stdout.write('\n')
    return
  }
  process.stdout.write(JSON.stringify(data, null, 2) + '\n')
}

function printRelativePath(path) {
  const rel = relative(process.cwd(), path)
  return rel && !rel.startsWith('..') ? rel : path
}

function replaceArtifactSegment(inputPath, fromSegment, toSegment, extension) {
  if (!inputPath) return null
  const parts = resolve(inputPath).split(/[\\/]/)
  const index = parts.lastIndexOf(fromSegment)
  if (index === -1) return null
  parts[index] = toSegment
  parts[parts.length - 1] = parts.at(-1).replace(/\.[^.]+$/i, extension)
  return parts.join(sep)
}

function inferJsonPath(yamlPath, lessonId) {
  return replaceArtifactSegment(yamlPath, 'YAML Files', 'JSON Files', '.json') ?? resolve(`${lessonId}.json`)
}

function inferYamlPath(jsonPath, lessonId) {
  return replaceArtifactSegment(jsonPath, 'JSON Files', 'YAML Files', '.yaml') ?? resolve(`${lessonId}.yaml`)
}

async function preflightYamlLesson(file) {
  const checks = []
  const add = (ok, name, detail = '') => checks.push({ ok, name, detail })

  if (!file) {
    add(false, 'YAML file provided', 'Pass a lesson YAML path')
    return { valid: false, checks }
  }

  const { parseYamlLesson } = await loadYaml()
  const { validateLessonForMcp } = await loadValidate()

  let lesson = null
  try {
    lesson = parseYamlLesson(await readText(file))
    add(true, 'YAML converts', lesson.id)
  } catch (e) {
    add(false, 'YAML converts', e.message)
    return { valid: false, checks }
  }

  const validation = validateLessonForMcp(lesson)
  add(validation.valid, 'lesson validates', validation.valid ? `${validation.warnings.length} warning(s)` : validation.errors.join('; '))

  const { listTopics } = await loadTopics()
  const topics = await listTopics()
  const topicValidation = validateTopicStage(
    lesson,
    topics,
    lesson.stage ?? 'published',
  )
  const linkedTopicIds = topicValidation.audit.references.map(reference => reference.id)
  const missingTopicIds = topicValidation.audit.missing.map(reference => reference.id)
  add(
    topicValidation.valid,
    'topic stage requirements pass',
    missingTopicIds.length
      ? `${missingTopicIds.join(', ')} (${topicValidation.errors.join('; ') || 'warning only at this stage'})`
      : `${linkedTopicIds.length} link id(s)`,
  )

  return {
    valid: checks.every(check => check.ok),
    lessonId: lesson.id,
    checks,
    warnings: [...validation.warnings, ...topicValidation.warnings],
    errors: [...validation.errors, ...topicValidation.errors],
    topicAudit: topicValidation.audit,
  }
}

function fatal(msg) {
  process.stderr.write(`Error: ${msg}\n`)
  process.exit(1)
}

// Wraps a yargs handler: catches thrown errors and exits cleanly.
function cmd(fn) {
  return async (argv) => {
    try {
      await fn(argv)
    } catch (e) {
      fatal(e.message)
    }
  }
}

// Lazy module imports — Firebase initialises on first load.
const loadLessons = () => import('./lessons.mjs')
const loadTopics = () => import('./topics.mjs')
const loadAssets = () => import('./assets.mjs')
const loadFeedback = () => import('./feedback.mjs')
const loadTopicUtils = () => import('./topic-utils.mjs')
const loadLevels = () => import('./levels.mjs')
const loadClasses = () => import('./classes.mjs')

// validate and yaml-to-json don't touch Firebase, so import directly.
const loadValidate = () => import('./validate.mjs')
const loadYaml = () => import('./yaml-converter.mjs')
const loadCheckTests = () => import('./check-tests.mjs')

await yargs(hideBin(process.argv))
  .scriptName('hsc')
  .usage('$0 <command> <subcommand> [args]')
  .option('format', {
    alias: 'f',
    choices: ['json', 'yaml'],
    default: 'json',
    describe: 'Output data as JSON or YAML',
  })
  .option('yaml', {
    type: 'boolean',
    default: false,
    describe: 'Shortcut for --format yaml',
  })

  // ─── LESSONS ────────────────────────────────────────────────────────────────

  .command('lessons', 'Manage lessons in Firestore', yargs => yargs

    .command('list', 'List all published lessons', {}, cmd(async () => {
      const { listLessons } = await loadLessons()
      print(await listLessons())
    }))

    .command('get <id>', 'Fetch the full lesson JSON', {}, cmd(async ({ id }) => {
      const { getLesson } = await loadLessons()
      const lesson = await getLesson(id)
      const { lessonToYamlText } = await loadYaml()
      print(lesson, { yamlText: lessonToYamlText(lesson) })
    }))

    .command('skeleton <id>', 'Fetch lesson metadata and compact task list (no task bodies)', {}, cmd(async ({ id }) => {
      const { getLessonSkeleton } = await loadLessons()
      print(await getLessonSkeleton(id))
    }))

    .command('validate [file]', 'Validate a lesson from JSON or YAML — file path or stdin', {}, cmd(async ({ file }) => {
      const { validateLessonForMcp } = await loadValidate()
      const result = validateLessonForMcp(parseLessonJsonOrYaml(file, await readText(file)))
      print(result)
      if (!result.valid) process.exit(1)
    }))

    .command('test-checks <lessonPath>', 'Test source-code check cases from a JSON or YAML file', {
      cases: { type: 'string', demandOption: true, describe: 'JSON or YAML file containing named task cases' },
    }, cmd(async ({ lessonPath, cases }) => {
      const { testLessonChecks } = await loadCheckTests()
      const lesson = parseLessonJsonOrYaml(lessonPath, await readText(lessonPath))
      const casesFile = parseJsonOrYaml(cases, await readText(cases))
      const result = testLessonChecks(lesson, casesFile)
      print(result)
      if (!result.success) process.exit(1)
    }))

    .command('upsert [file]', 'Create or update a lesson from JSON or YAML — file path or stdin', {}, cmd(async ({ file }) => {
      const { upsertLesson } = await loadLessons()
      const result = await upsertLesson(parseLessonJsonOrYaml(file, await readText(file)))
      print(result)
      if (!result.success) process.exit(1)
    }))

    .command('delete <id>', 'Permanently delete a lesson from Firestore', {}, cmd(async ({ id }) => {
      const { deleteLesson } = await loadLessons()
      print(await deleteLesson(id))
    }))

    .command('fork <sourceLessonId>', 'Create or overwrite a published class fork of a stock lesson', {
      'class-id': { type: 'string', demandOption: true, describe: 'Class id; fork lesson id becomes sourceLessonId-classId' },
      output: { alias: 'o', type: 'string', describe: 'Write the generated fork lesson to this JSON/YAML file' },
      publish: { type: 'boolean', default: true, describe: 'Publish the generated fork immediately; use --no-publish to only write/print it' },
      'include-lesson': { type: 'boolean', default: false, describe: 'Include the generated lesson in command output' },
    }, cmd(async ({ sourceLessonId, 'class-id': classId, output, publish, 'include-lesson': includeLesson }) => {
      const { forkLesson } = await loadLessons()
      const result = await forkLesson(sourceLessonId, classId, { publish, includeLesson: includeLesson || !publish || Boolean(output) })
      if (output) {
        const outputPath = resolve(output)
        const lesson = result.lesson
        if (!lesson) throw new Error('Could not write output without generated lesson data')
        if (['.yaml', '.yml'].includes(extname(outputPath).toLowerCase())) {
          const { lessonToYamlText } = await loadYaml()
          await writeText(outputPath, lessonToYamlText(lesson))
        } else {
          await writeText(outputPath, JSON.stringify(lesson, null, 2))
        }
        result.outputPath = printRelativePath(outputPath)
      }
      print(result, {
        yamlText: result.lesson
          ? yamlDump({ ...result, lesson: result.lesson })
          : yamlDump(result),
      })
      if (!result.success) process.exit(1)
    }))

    .command('forks <sourceLessonId>', 'List forks created from a stock lesson', {}, cmd(async ({ sourceLessonId }) => {
      const { listLessonForks } = await loadLessons()
      print(await listLessonForks(sourceLessonId))
    }))

    .command('lineage <id>', 'Show whether a lesson is stock or a fork and its lineage metadata', {}, cmd(async ({ id }) => {
      const { getLessonLineage } = await loadLessons()
      print(await getLessonLineage(id))
    }))

    .command('yaml-to-json [file]', 'Convert a YAML lesson to JSON - file path or stdin', {
      output: { alias: 'o', type: 'string', describe: 'Write the converted lesson JSON to this path' },
      'lesson-only': { type: 'boolean', default: false, describe: 'Print only the converted lesson JSON' },
    }, cmd(async ({ file, output, 'lesson-only': lessonOnly }) => {
      const { parseYamlLesson, lessonToYamlObject, lessonToYamlText } = await loadYaml()
      const { validateLessonForMcp } = await loadValidate()
      const lesson = parseYamlLesson(await readText(file))
      const { valid, errors, warnings } = validateLessonForMcp(lesson)
      const result = { lesson, valid, errors, warnings }
      if (output) {
        if (!valid) {
          print(result)
          process.exit(1)
        }
        const outputPath = resolve(output)
        await writeText(outputPath, JSON.stringify(lesson, null, 2))
        result.outputPath = printRelativePath(outputPath)
      }
      const yamlText = lessonOnly
        ? lessonToYamlText(lesson)
        : yamlDump({ ...result, lesson: lessonToYamlObject(lesson) })
      print(lessonOnly ? lesson : result, { yamlText })
      if (!valid) process.exit(1)
    }))

    .command('json-to-yaml <file> [output]', 'Convert a lesson JSON file to concise YAML', {}, cmd(async ({ file, output }) => {
      const { lessonToYamlText } = await loadYaml()
      const lesson = parseJson(await readText(file))
      const yamlText = lessonToYamlText(lesson)
      const outputPath = resolve(output ?? inferYamlPath(file, lesson.id ?? 'lesson'))
      await writeText(outputPath, yamlText)
      print({ success: true, outputPath: printRelativePath(outputPath) })
    }))

    .command('preflight <file>', 'Run YAML validation and check topic links against LaunchPad', {}, cmd(async ({ file }) => {
      const result = await preflightYamlLesson(file)
      print(result)
      if (!result.valid) process.exit(1)
    }))

    .command('publish-yaml [file]', 'Convert YAML and publish to Firestore in one step - file path or stdin', {
      'include-lesson': { type: 'boolean', default: false, describe: 'Include the converted lesson JSON in the output' },
      json: { type: 'string', describe: 'Write the converted lesson JSON to this path before publishing' },
      'write-json': { type: 'boolean', default: false, describe: 'Write converted JSON to the inferred matching JSON Files path before publishing' },
    }, cmd(async ({ file, 'include-lesson': includeLesson, json, 'write-json': writeJson }) => {
      const yamlText = await readText(file)
      const { parseYamlLesson, lessonToYamlObject } = await loadYaml()
      const { validateLessonForMcp } = await loadValidate()
      const lesson = parseYamlLesson(yamlText)
      const validation = validateLessonForMcp(lesson)
      if (!validation.valid) {
        print({ success: false, ...validation })
        process.exit(1)
      }
      const draftTasks = (lesson.tasks ?? []).flatMap(t => t.type === 'group' ? (t.subtasks ?? []) : [t]).filter(t => t.taskType === 'draft')
      if (draftTasks.length > 0) {
        print({ success: false, errors: [`${draftTasks.length} draft task(s) must be converted or removed before publishing: ${draftTasks.map(t => t.title || `task ${t.id}`).join(', ')}`], warnings: validation.warnings })
        process.exit(1)
      }

      let outputPath = null
      if (json || writeJson) {
        outputPath = resolve(json ?? inferJsonPath(file, lesson.id))
        await writeText(outputPath, JSON.stringify(lesson, null, 2))
      }

      const { upsertLesson } = await loadLessons()
      const result = await upsertLesson(lesson)
      if (includeLesson && result.success) result.lesson = lesson
      if (outputPath) result.outputPath = printRelativePath(outputPath)
      print(result, {
        yamlText: includeLesson && result.success
          ? yamlDump({ ...result, lesson: lessonToYamlObject(lesson) })
          : yamlDump(result),
      })
      if (!result.success) process.exit(1)
    }))

    .command('set-stage <id> <stage>', 'Set the stage of a lesson (ideas|details|review|approved|published)', {}, cmd(async ({ id, stage }) => {
      const { setLessonStage } = await loadLessons()
      const result = await setLessonStage(id, stage)
      print(result)
    }))

    .command('topics <id>', 'Audit lesson topic references against the Firestore Topic Library', {}, cmd(async ({ id }) => {
      const { getLessonTopicAudit } = await loadLessons()
      print(await getLessonTopicAudit(id))
    }))

    .command('review <id>', 'Show all tasks with their review notes', {
      task: { type: 'number', describe: 'Task ID to update review note on' },
      decision: { type: 'string', choices: ['pending', 'accepted', 'rejected'], describe: 'Set decision on a specific task' },
      note: { type: 'string', describe: 'Set suggestedChange on a specific task' },
      extra: { type: 'string', describe: 'Set extraNote on a specific task' },
    }, cmd(async ({ id, task: taskId, decision, note, extra }) => {
      const { getLessonReviewNotes, setTaskReviewNote } = await loadLessons()
      if (taskId != null) {
        const reviewNote = {}
        if (decision != null) reviewNote.decision = decision
        if (note != null) reviewNote.suggestedChange = note
        if (extra != null) reviewNote.extraNote = extra
        if (Object.keys(reviewNote).length === 0) {
          throw new Error('Provide at least one of --decision, --note, or --extra to update a task review note')
        }
        print(await setTaskReviewNote(id, taskId, reviewNote))
      } else {
        print(await getLessonReviewNotes(id))
      }
    }))

    .demandCommand(1, 'Specify a subcommand: list | get | skeleton | validate | upsert | delete | fork | forks | lineage | yaml-to-json | json-to-yaml | preflight | publish-yaml | set-stage | topics | review')
    .help()
  )

  // ─── TASKS ──────────────────────────────────────────────────────────────────

  .command('tasks', 'Manage individual tasks within a lesson', yargs => yargs

    .command('get <lessonId> <taskIndex>', 'Fetch a single task by 1-based flat index', {}, cmd(async ({ lessonId, taskIndex }) => {
      const { getTask } = await loadLessons()
      print(await getTask(lessonId, Number(taskIndex)))
    }))

    .command('upsert <lessonId> <taskIndex> [file]', 'Replace a task by flat index — file path or stdin (JSON or YAML)', {}, cmd(async ({ lessonId, taskIndex, file }) => {
      const { upsertTask } = await loadLessons()
      const result = await upsertTask(lessonId, Number(taskIndex), parseJsonOrYaml(file, await readText(file)))
      print(result)
      if (!result.success) process.exit(1)
    }))

    .command('append <lessonId> [file]', 'Append a task to a lesson — file path or stdin (JSON or YAML)', {
      group: { type: 'string', describe: 'Group title to append into (created if it does not exist)' },
    }, cmd(async ({ lessonId, group, file }) => {
      const { appendTask } = await loadLessons()
      const result = await appendTask(lessonId, parseJsonOrYaml(file, await readText(file)), group)
      print(result)
      if (!result.success) process.exit(1)
    }))

    .demandCommand(1, 'Specify a subcommand: get | upsert | append')
    .help()
  )

  // ─── TOPICS ─────────────────────────────────────────────────────────────────

  .command('topics', 'Manage topics in the topic library', yargs => yargs

    .command('list', 'List all topics', {}, cmd(async () => {
      const { listTopics } = await loadTopics()
      print(await listTopics())
    }))

    .command('get <id>', 'Fetch a topic by ID', {}, cmd(async ({ id }) => {
      const { getTopic } = await loadTopics()
      const topic = await getTopic(id)
      const { topicToYamlText } = await loadYaml()
      print(topic, { yamlText: topicToYamlText(topic) })
    }))

    .command('upsert [file]', 'Create or update one topic from JSON or YAML — file path or stdin', {}, cmd(async ({ file }) => {
      const { upsertTopic } = await loadTopics()
      const result = await upsertTopic(parseTopicJsonOrYaml(file, await readText(file)))
      print(result)
      if (!result.success) process.exit(1)
    }))

    .command('upsert-library [file]', 'Create or update many topics from JSON or YAML — file path or stdin', {}, cmd(async ({ file }) => {
      const { upsertTopicLibrary } = await loadTopics()
      const result = await upsertTopicLibrary(parseTopicLibraryJsonOrYaml(file, await readText(file)))
      print(result)
      if (!result.success) process.exit(1)
    }))

    .command('yaml-to-json [file]', 'Convert a YAML topic library to JSON - file path or stdin', {
      output: { alias: 'o', type: 'string', describe: 'Write the converted topic library JSON to this path' },
      'topics-only': { type: 'boolean', default: false, describe: 'Print only the converted topics array' },
    }, cmd(async ({ file, output, 'topics-only': topicsOnly }) => {
      const { parseYamlTopicLibrary } = await loadYaml()
      const { validateTopicLibrary } = await loadTopicUtils()
      const topics = parseYamlTopicLibrary(await readText(file))
      const validation = validateTopicLibrary(topics)
      const result = { topics: validation.topics, valid: validation.valid, errors: validation.errors }
      if (output) {
        if (!validation.valid) {
          print(result)
          process.exit(1)
        }
        const outputPath = resolve(output)
        await writeText(outputPath, JSON.stringify({ topics: validation.topics }, null, 2))
        result.outputPath = printRelativePath(outputPath)
      }
      print(topicsOnly ? validation.topics : result)
      if (!validation.valid) process.exit(1)
    }))

    .command('json-to-yaml <file> [output]', 'Convert topic JSON to topic-library YAML', {}, cmd(async ({ file, output }) => {
      const { topicLibraryToYamlText } = await loadYaml()
      const input = parseJson(await readText(file))
      const yamlText = topicLibraryToYamlText(input)
      const outputPath = resolve(output ?? inferYamlPath(file, 'topic-library'))
      await writeText(outputPath, yamlText)
      print({ success: true, outputPath: printRelativePath(outputPath) })
    }))

    .command('publish-yaml [file]', 'Convert YAML topic library and publish to Firestore - file path or stdin', {
      'include-topics': { type: 'boolean', default: false, describe: 'Include the converted topics in the output' },
      json: { type: 'string', describe: 'Write the converted topic library JSON to this path before publishing' },
      'write-json': { type: 'boolean', default: false, describe: 'Write converted JSON to the inferred matching JSON Files path before publishing' },
    }, cmd(async ({ file, 'include-topics': includeTopics, json, 'write-json': writeJson }) => {
      const { parseYamlTopicLibrary } = await loadYaml()
      const { validateTopicLibrary } = await loadTopicUtils()
      const topics = parseYamlTopicLibrary(await readText(file))
      const validation = validateTopicLibrary(topics)
      if (!validation.valid) {
        print({ success: false, errors: validation.errors })
        process.exit(1)
      }

      let outputPath = null
      if (json || writeJson) {
        outputPath = resolve(json ?? inferJsonPath(file, 'topic-library'))
        await writeText(outputPath, JSON.stringify({ topics: validation.topics }, null, 2))
      }

      const { upsertTopicLibrary } = await loadTopics()
      const result = await upsertTopicLibrary(validation.topics)
      if (includeTopics && result.success) result.topics = validation.topics
      if (outputPath) result.outputPath = printRelativePath(outputPath)
      print(result)
      if (!result.success) process.exit(1)
    }))

    .command('delete <id>', 'Permanently delete a topic from the library', {}, cmd(async ({ id }) => {
      const { deleteTopic } = await loadTopics()
      print(await deleteTopic(id))
    }))

    .demandCommand(1, 'Specify a subcommand: list | get | upsert | upsert-library | yaml-to-json | json-to-yaml | publish-yaml | delete')
    .help()
  )

  // ─── FEEDBACK ──────────────────────────────────────────────────────────────

  .command('feedback', 'Read, write, and clear platform and lesson feedback from Firestore', yargs => yargs

    .command('platform', 'List platform feedback', {
      'lesson-id': { type: 'string', describe: 'Only include platform feedback linked to this lesson ID' },
      'task-id': { type: 'string', describe: 'Only include feedback linked to this task ID' },
      'scope': { type: 'string', choices: ['lesson', 'task'], describe: 'Filter by scope: "lesson" (no task) or "task" (task-specific)' },
      'include-archived': { type: 'boolean', default: false, describe: 'Include archived feedback items' },
    }, cmd(async ({ 'lesson-id': lessonId, 'task-id': taskId, scope, 'include-archived': includeArchived }) => {
      const { listPlatformFeedback } = await loadFeedback()
      print(await listPlatformFeedback({ lessonId, taskId, scope, includeArchived }))
    }))

    .command('lesson <lessonId>', 'List all feedback saved under one lesson', {
      'task-id': { type: 'string', describe: 'Only include feedback linked to this task ID' },
      'scope': { type: 'string', choices: ['lesson', 'task'], describe: 'Filter by scope: "lesson" (no task) or "task" (task-specific)' },
      'include-archived': { type: 'boolean', default: false, describe: 'Include archived feedback items' },
    }, cmd(async ({ lessonId, 'task-id': taskId, scope, 'include-archived': includeArchived }) => {
      const { listLessonFeedback } = await loadFeedback()
      print(await listLessonFeedback(lessonId, { taskId, scope, includeArchived }))
    }))

    .command('all [lessonId]', 'List platform and lesson feedback together', {
      'task-id': { type: 'string', describe: 'Only include feedback linked to this task ID' },
      'scope': { type: 'string', choices: ['lesson', 'task'], describe: 'Filter by scope: "lesson" (no task) or "task" (task-specific)' },
      'include-archived': { type: 'boolean', default: false, describe: 'Include archived feedback items' },
    }, cmd(async ({ lessonId, 'task-id': taskId, scope, 'include-archived': includeArchived }) => {
      const { listAllFeedback } = await loadFeedback()
      print(await listAllFeedback({ lessonId, taskId, scope, includeArchived }))
    }))

    .command('add-lesson <lessonId>', 'Add a feedback item to a lesson', {
      text: { type: 'string', demandOption: true, describe: 'Feedback text' },
      email: { type: 'string', default: '', describe: 'Teacher email address' },
      'lesson-title': { type: 'string', describe: 'Lesson title (informational)' },
      'task-id': { type: 'string', describe: 'Task ID (makes this task-scoped feedback)' },
      'task-title': { type: 'string', describe: 'Task title (informational)' },
    }, cmd(async ({ lessonId, text, email, 'lesson-title': lessonTitle, 'task-id': taskId, 'task-title': taskTitle }) => {
      const { addLessonFeedback } = await loadFeedback()
      print(await addLessonFeedback(lessonId, { text, teacherEmail: email, lessonTitle, taskId, taskTitle }))
    }))

    .command('add-platform', 'Add a platform feedback item', {
      text: { type: 'string', demandOption: true, describe: 'Feedback text' },
      email: { type: 'string', default: '', describe: 'Teacher email address' },
      'lesson-id': { type: 'string', describe: 'Lesson context (optional)' },
      'lesson-title': { type: 'string', describe: 'Lesson title (informational)' },
      'task-id': { type: 'string', describe: 'Task context (optional)' },
      'task-title': { type: 'string', describe: 'Task title (informational)' },
    }, cmd(async ({ text, email, 'lesson-id': lessonId, 'lesson-title': lessonTitle, 'task-id': taskId, 'task-title': taskTitle }) => {
      const { addPlatformFeedback } = await loadFeedback()
      print(await addPlatformFeedback({ text, teacherEmail: email, lessonId, lessonTitle, taskId, taskTitle }))
    }))

    .command('archive-lesson <lessonId> <id>', 'Archive a single feedback item from a lesson', {}, cmd(async ({ lessonId, id }) => {
      const { archiveLessonFeedbackItem } = await loadFeedback()
      print(await archiveLessonFeedbackItem(lessonId, id))
    }))

    .command('archive-platform <id>', 'Archive a single platform feedback item', {}, cmd(async ({ id }) => {
      const { archivePlatformFeedbackItem } = await loadFeedback()
      print(await archivePlatformFeedbackItem(id))
    }))

    .command('clear-lesson <lessonId>', 'Archive all feedback items from a lesson (supports filters)', {
      'task-id': { type: 'string', describe: 'Only archive feedback linked to this task ID' },
      'scope': { type: 'string', choices: ['lesson', 'task'], describe: 'Filter by scope before archiving' },
    }, cmd(async ({ lessonId, 'task-id': taskId, scope }) => {
      const { clearLessonFeedback } = await loadFeedback()
      print(await clearLessonFeedback(lessonId, { taskId, scope }))
    }))

    .command('clear-platform', 'Archive all platform feedback items (supports filters)', {
      'lesson-id': { type: 'string', describe: 'Only archive platform feedback linked to this lesson ID' },
      'task-id': { type: 'string', describe: 'Only archive feedback linked to this task ID' },
      'scope': { type: 'string', choices: ['lesson', 'task'], describe: 'Filter by scope before archiving' },
    }, cmd(async ({ 'lesson-id': lessonId, 'task-id': taskId, scope }) => {
      const { clearPlatformFeedback } = await loadFeedback()
      print(await clearPlatformFeedback({ lessonId, taskId, scope }))
    }))

    .demandCommand(1, 'Specify a subcommand: platform | lesson | all | add-lesson | add-platform | archive-lesson | archive-platform | clear-lesson | clear-platform')
    .help()
  )

  // ─── ASSETS ─────────────────────────────────────────────────────────────────

  .command('assets', 'Manage lesson asset files in Firebase Storage', yargs => yargs

    .command('list <lessonId>', 'List assets for a lesson', {}, cmd(async ({ lessonId }) => {
      const { listLessonAssets } = await loadAssets()
      print(await listLessonAssets(lessonId))
    }))

    .command('upload <lessonId> <filepath>', 'Upload a local file as a lesson asset', {
      filename: { type: 'string', describe: 'Storage filename (defaults to the file\'s basename)' },
      'mime-type': { type: 'string', describe: 'MIME type (auto-detected from file extension if omitted)' },
    }, cmd(async ({ lessonId, filepath, filename, 'mime-type': mimeType }) => {
      const resolvedFilename = filename ?? basename(filepath)
      const resolvedMimeType = mimeType ?? MIME_MAP[extname(filepath).toLowerCase()] ?? 'application/octet-stream'
      const buffer = await readFile(filepath)
      const { uploadLessonAsset } = await loadAssets()
      print(await uploadLessonAsset(lessonId, resolvedFilename, buffer.toString('base64'), resolvedMimeType))
    }))

    .command('delete <lessonId> <filename>', 'Delete a lesson asset from Firebase Storage', {}, cmd(async ({ lessonId, filename }) => {
      const { deleteLessonAsset } = await loadAssets()
      print(await deleteLessonAsset(lessonId, filename))
    }))

    .demandCommand(1, 'Specify a subcommand: list | upload | delete')
    .help()
  )

  // --- LEVELS ---------------------------------------------------------------

  .command('levels', 'Manage reusable lesson level records', yargs => yargs

    .command('list', 'List reusable levels', {
      'scope-type': { type: 'string', choices: ['course', 'module', 'collection', 'type'], describe: 'Filter by scope type' },
      'scope-id': { type: 'string', describe: 'Filter by scope id' },
    }, cmd(async ({ 'scope-type': scopeType, 'scope-id': scopeId }) => {
      const { listLevels } = await loadLevels()
      print(await listLevels({ scopeType, scopeId }))
    }))

    .command('upsert', 'Create or update a reusable level', {
      id: { type: 'string', describe: 'Level id; defaults to a slug from title and scope' },
      title: { type: 'string', demandOption: true, describe: 'Display title' },
      description: { type: 'string', default: '', describe: 'Description' },
      order: { type: 'number', default: 0, describe: 'Sort order' },
      color: { type: 'string', default: '#7c3aed', describe: 'Badge colour' },
      icon: { type: 'string', default: 'star', describe: 'Icon key' },
      'scope-type': { type: 'string', choices: ['course', 'module', 'collection', 'type'], default: 'type', describe: 'Scope type' },
      'scope-id': { type: 'string', demandOption: true, describe: 'Scope id' },
    }, cmd(async ({ id, title, description, order, color, icon, 'scope-type': scopeType, 'scope-id': scopeId }) => {
      const { upsertLevel } = await loadLevels()
      print(await upsertLevel({ id, title, description, order, color, icon, scopeType, scopeId }))
    }))

    .command('delete <id>', 'Delete a reusable level record', {}, cmd(async ({ id }) => {
      const { deleteLevel } = await loadLevels()
      print(await deleteLevel(id))
    }))

    .demandCommand(1, 'Specify a subcommand: list | upsert | delete')
    .help()
  )
  // --- CLASSES --------------------------------------------------------------

  .command('classes', 'Manage admin-only durable class records used for lesson forks', yargs => yargs

    .command('list', 'List classes', {
      'include-archived': { type: 'boolean', default: false, describe: 'Include archived class records' },
    }, cmd(async ({ 'include-archived': includeArchived }) => {
      const { listClasses } = await loadClasses()
      print(await listClasses({ includeArchived }))
    }))

    .command('upsert', 'Create or update a class record', {
      id: { type: 'string', demandOption: true, describe: 'Class id used in fork lesson ids' },
      name: { type: 'string', demandOption: true, describe: 'Class display name' },
    }, cmd(async ({ id, name }) => {
      const { upsertClass } = await loadClasses()
      print(await upsertClass({ id, name, archived: false }))
    }))

    .command('archive <id>', 'Archive a class record', {}, cmd(async ({ id }) => {
      const { archiveClass } = await loadClasses()
      print(await archiveClass(id))
    }))

    .demandCommand(1, 'Specify a subcommand: list | upsert | archive')
    .help()
  )
  .demandCommand(1, 'Specify a command: lessons | tasks | topics | feedback | assets | levels | classes')
  .help()
  .parseAsync()
