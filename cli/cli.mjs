#!/usr/bin/env node
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '.env') })

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import yaml from 'js-yaml'
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { extname, basename, join, relative, sep } from 'node:path'

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

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text.trim())
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`)
  }
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

function extractTopicLinksFromText(text) {
  const ids = new Set()
  if (!text) return ids

  const wikiLinkPattern = /\[\[([a-z0-9._-]+)(?:\|[^\]]+)?\]\]/gi
  for (const match of text.matchAll(wikiLinkPattern)) ids.add(match[1])

  const topicHrefPattern = /#topic\/([a-z0-9._-]+)/gi
  for (const match of text.matchAll(topicHrefPattern)) ids.add(match[1])

  return ids
}

function collectTopicLinksFromTasks(tasks, ids = new Set()) {
  for (const task of tasks ?? []) {
    if (task.type === 'group') {
      collectTopicLinksFromTasks(task.subtasks, ids)
      continue
    }
    for (const id of extractTopicLinksFromText(task.explainer)) ids.add(id)
    for (const id of extractTopicLinksFromText(task.leftContent)) ids.add(id)
  }
  return ids
}

async function collectTopicIdsFromMarkdown(root, ids = new Set()) {
  if (!await exists(root)) return ids
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name)
    if (entry.isDirectory()) {
      await collectTopicIdsFromMarkdown(fullPath, ids)
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      ids.add(basename(entry.name, extname(entry.name)))
    }
  }
  return ids
}

async function loadLocalTopicIds() {
  const ids = await collectTopicIdsFromMarkdown(resolve('topic library'))
  const topicJsonPaths = [
    resolve('Old Lessons', 'JSON Files', 'topic-library.json'),
    resolve('New Lessons', 'JSON Files', 'topic-library.json'),
    resolve('JSON Files', 'topic-library.json'),
  ]
  for (const topicJsonPath of topicJsonPaths) {
    if (!await exists(topicJsonPath)) continue
    const topicLibrary = parseJson(await readText(topicJsonPath))
    for (const topic of topicLibrary.topics ?? []) {
      if (topic.id) ids.add(topic.id)
    }
  }
  return ids
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

  const localTopicIds = await loadLocalTopicIds()
  const linkedTopicIds = [...collectTopicLinksFromTasks(lesson.tasks)]
  const missingTopicIds = linkedTopicIds.filter(id => !localTopicIds.has(id))
  add(
    missingTopicIds.length === 0,
    'topic links resolve locally',
    missingTopicIds.length ? missingTopicIds.join(', ') : `${linkedTopicIds.length} link id(s)`,
  )

  return {
    valid: checks.every(check => check.ok),
    lessonId: lesson.id,
    checks,
    warnings: validation.warnings,
    errors: validation.errors,
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

// validate and yaml-to-json don't touch Firebase, so import directly.
const loadValidate = () => import('./validate.mjs')
const loadYaml = () => import('./yaml-converter.mjs')

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

    .command('validate [file]', 'Validate a lesson JSON — file path or stdin', {}, cmd(async ({ file }) => {
      const { validateLessonForMcp } = await loadValidate()
      const result = validateLessonForMcp(parseJson(await readText(file)))
      print(result)
      if (!result.valid) process.exit(1)
    }))

    .command('upsert [file]', 'Publish a lesson JSON to Firestore — file path or stdin', {}, cmd(async ({ file }) => {
      const { upsertLesson } = await loadLessons()
      const result = await upsertLesson(parseJson(await readText(file)))
      print(result)
      if (!result.success) process.exit(1)
    }))

    .command('delete <id>', 'Permanently delete a lesson from Firestore', {}, cmd(async ({ id }) => {
      const { deleteLesson } = await loadLessons()
      print(await deleteLesson(id))
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

    .command('preflight <file>', 'Run local YAML validation and topic-link checks', {}, cmd(async ({ file }) => {
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

    .demandCommand(1, 'Specify a subcommand: list | get | skeleton | validate | upsert | delete | yaml-to-json | json-to-yaml | preflight | publish-yaml')
    .help()
  )

  // ─── TASKS ──────────────────────────────────────────────────────────────────

  .command('tasks', 'Manage individual tasks within a lesson', yargs => yargs

    .command('get <lessonId> <taskIndex>', 'Fetch a single task by 1-based flat index', {}, cmd(async ({ lessonId, taskIndex }) => {
      const { getTask } = await loadLessons()
      print(await getTask(lessonId, Number(taskIndex)))
    }))

    .command('upsert <lessonId> <taskIndex> [file]', 'Replace a task by flat index — file path or stdin', {}, cmd(async ({ lessonId, taskIndex, file }) => {
      const { upsertTask } = await loadLessons()
      const result = await upsertTask(lessonId, Number(taskIndex), parseJson(await readText(file)))
      print(result)
      if (!result.success) process.exit(1)
    }))

    .command('append <lessonId> [file]', 'Append a task to a lesson — file path or stdin', {
      group: { type: 'string', describe: 'Group title to append into (created if it does not exist)' },
    }, cmd(async ({ lessonId, group, file }) => {
      const { appendTask } = await loadLessons()
      const result = await appendTask(lessonId, parseJson(await readText(file)), group)
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

    .command('upsert [file]', 'Create or update a topic — file path or stdin', {}, cmd(async ({ file }) => {
      const { upsertTopic } = await loadTopics()
      const result = await upsertTopic(parseJson(await readText(file)))
      print(result)
      if (!result.success) process.exit(1)
    }))

    .command('upsert-library [file]', 'Create or update many topics from JSON — array, { topics }, or stdin', {}, cmd(async ({ file }) => {
      const { upsertTopicLibrary } = await loadTopics()
      const result = await upsertTopicLibrary(parseJson(await readText(file)))
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

  .command('feedback', 'Read platform and lesson feedback from Firestore', yargs => yargs

    .command('platform', 'List platform feedback', {
      'lesson-id': { type: 'string', describe: 'Only include platform feedback linked to this lesson ID' },
      'task-id': { type: 'string', describe: 'Only include feedback linked to this task ID' },
    }, cmd(async ({ 'lesson-id': lessonId, 'task-id': taskId }) => {
      const { listPlatformFeedback } = await loadFeedback()
      print(await listPlatformFeedback({ lessonId, taskId }))
    }))

    .command('lesson <lessonId>', 'List all feedback saved under one lesson', {
      'task-id': { type: 'string', describe: 'Only include feedback linked to this task ID' },
    }, cmd(async ({ lessonId, 'task-id': taskId }) => {
      const { listLessonFeedback } = await loadFeedback()
      print(await listLessonFeedback(lessonId, { taskId }))
    }))

    .command('all [lessonId]', 'List platform and lesson feedback together', {
      'task-id': { type: 'string', describe: 'Only include feedback linked to this task ID' },
    }, cmd(async ({ lessonId, 'task-id': taskId }) => {
      const { listAllFeedback } = await loadFeedback()
      print(await listAllFeedback({ lessonId, taskId }))
    }))

    .demandCommand(1, 'Specify a subcommand: platform | lesson | all')
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

  .demandCommand(1, 'Specify a command: lessons | tasks | topics | feedback | assets')
  .help()
  .parseAsync()
