#!/usr/bin/env node
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '.env') })

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { readFile } from 'node:fs/promises'
import { extname, basename } from 'node:path'

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

function parseJson(text) {
  try {
    return JSON.parse(text.trim())
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`)
  }
}

function print(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n')
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

// validate and yaml-to-json don't touch Firebase, so import directly.
const loadValidate = () => import('./validate.mjs')
const loadYaml = () => import('./yaml-converter.mjs')

await yargs(hideBin(process.argv))
  .scriptName('hsc')
  .usage('$0 <command> <subcommand> [args]')

  // ─── LESSONS ────────────────────────────────────────────────────────────────

  .command('lessons', 'Manage lessons in Firestore', yargs => yargs

    .command('list', 'List all published lessons', {}, cmd(async () => {
      const { listLessons } = await loadLessons()
      print(await listLessons())
    }))

    .command('get <id>', 'Fetch the full lesson JSON', {}, cmd(async ({ id }) => {
      const { getLesson } = await loadLessons()
      print(await getLesson(id))
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

    .command('yaml-to-json [file]', 'Convert a YAML lesson to JSON — file path or stdin', {}, cmd(async ({ file }) => {
      const { parseYamlLesson } = await loadYaml()
      const { validateLessonForMcp } = await loadValidate()
      const lesson = parseYamlLesson(await readText(file))
      const { valid, errors, warnings } = validateLessonForMcp(lesson)
      print({ lesson, valid, errors, warnings })
    }))

    .command('publish-yaml [file]', 'Convert YAML and publish to Firestore in one step — file path or stdin', {
      'include-lesson': { type: 'boolean', default: false, describe: 'Include the converted lesson JSON in the output' },
    }, cmd(async ({ file, includLesson, 'include-lesson': includeLesson }) => {
      const { publishYamlLesson } = await loadLessons()
      const result = await publishYamlLesson(await readText(file), includeLesson)
      print(result)
      if (!result.success) process.exit(1)
    }))

    .demandCommand(1, 'Specify a subcommand: list | get | skeleton | validate | upsert | delete | yaml-to-json | publish-yaml')
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
      print(await getTopic(id))
    }))

    .command('upsert [file]', 'Create or update a topic — file path or stdin', {}, cmd(async ({ file }) => {
      const { upsertTopic } = await loadTopics()
      const result = await upsertTopic(parseJson(await readText(file)))
      print(result)
      if (!result.success) process.exit(1)
    }))

    .command('delete <id>', 'Permanently delete a topic from the library', {}, cmd(async ({ id }) => {
      const { deleteTopic } = await loadTopics()
      print(await deleteTopic(id))
    }))

    .demandCommand(1, 'Specify a subcommand: list | get | upsert | delete')
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

  .demandCommand(1, 'Specify a command: lessons | tasks | topics | assets')
  .help()
  .parseAsync()
