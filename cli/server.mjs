import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { db } from './firebase.mjs'
import { registerLessonTools } from './lessons.mjs'
import { registerTopicTools } from './topics.mjs'
import { registerAssetTools } from './assets.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Keep db import alive - ensures Firebase is initialised before tools are called
void db

const server = new McpServer({ name: 'hsc-repl', version: '1.0.0' })

registerLessonTools(server)
registerTopicTools(server)
registerAssetTools(server)

server.resource(
  'lesson-authoring-workflow',
  'workflow://lesson-authoring',
  async (uri) => {
    const text = `# Lesson Authoring Workflow

## Storage model

Lessons and topics live in **Firestore**, not in local files.

- \`lessons/\` Firestore collection - live lessons served to students
- \`topicLibrary/\` Firestore collection - live topic library

The local \`YAML Files/\` and \`JSON Files/\` directories are **authoring workspace** artifacts only. Editing a local file has no effect on the live app until you publish the converted lesson with \`upsert_lesson\`.

## Authoring workflow (step by step)

1. **Understand the YAML format** - fetch \`yaml://format\` before writing lesson YAML. It documents the shorthand and links back to the full schema when a field needs deeper reference.

2. **Create the lesson YAML locally** - write the concise lesson YAML following \`YAML_LESSON_FORMAT.md\`. The lesson \`id\` must be a lowercase slug (e.g. \`python-for-loops\`).

3. **Convert and validate before publishing** - call \`yaml_to_lesson(yaml)\`. Review the converted lesson JSON, fix all errors, and review warnings before continuing.

4. **Publish to Firestore** - call \`upsert_lesson(lesson)\` with the converted lesson JSON to write the lesson to the live app. This also validates; if validation fails the lesson is not written and errors are returned. For the fast path after local review, call \`publish_yaml_lesson(yaml)\` to convert, validate, publish, and fetch confirmation in one call.

5. **Confirm the publish** - call \`get_lesson(id)\` to verify the live lesson matches what you intended.

## Updating an existing lesson

**Whole-lesson edit** (restructuring, reordering, or many changes at once):
1. Fetch the current version: \`get_lesson(id)\`
2. Apply your changes in YAML when possible, then run \`yaml_to_lesson(yaml)\`; for direct JSON edits, run \`validate_lesson(lesson)\`
3. Publish: \`upsert_lesson(lesson)\`

**Single-task edit** (lower token cost - preferred for targeted changes):
1. Fetch the skeleton: \`get_lesson_skeleton(id)\` - see which task indices exist
2. Fetch the task: \`get_task(lessonId, taskIndex)\`
3. Edit the returned task object
4. Write it back: \`upsert_task(lessonId, taskIndex, task)\` - validates the full lesson automatically

**Build a lesson task by task** (create shell, then append):
1. Publish a minimal lesson: \`upsert_lesson({ id, type, title, description, tasks: [] })\`
2. For each task: \`append_task(lessonId, task)\` - appends and validates
3. Confirm: \`get_lesson_skeleton(id)\`

## Topic library workflow

Topics follow the same pattern using \`list_topics\`, \`get_topic\`, \`upsert_topic\`, and \`delete_topic\`. Fetch \`topic://schema\` for the full topic object format.

## Assets

Use \`list_lesson_assets\`, \`upload_lesson_asset\`, and \`delete_lesson_asset\` to manage files stored in Firebase Storage. Asset download URLs are stored in the lesson's \`storageAssets\` field and served directly to students.

## Important rules

- Prefer authoring new lessons in YAML, then converting with \`yaml_to_lesson\`
- Never call \`upsert_lesson\` without first validating via \`yaml_to_lesson\` or \`validate_lesson\`
- Never call \`delete_lesson\` without confirming the lesson ID with the user - deletion is permanent
- The \`id\` field in the lesson JSON determines the Firestore document ID; changing it creates a new document (the old one must be deleted manually)
- Scratch toolbox XML validation is skipped server-side (no DOMParser in Node.js) - use the builder preview to catch XML errors
`
    return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text }] }
  }
)

server.resource(
  'lesson-schema',
  'lesson://schema',
  async (uri) => {
    const text = await readFile(join(__dirname, '..', 'LESSON_SCHEMA.md'), 'utf-8')
    return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text }] }
  }
)

server.resource(
  'topic-schema',
  'topic://schema',
  async (uri) => {
    const text = await readFile(join(__dirname, '..', 'TOPIC_LIBRARY_SCHEMA.md'), 'utf-8')
    return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text }] }
  }
)

server.resource(
  'yaml-lesson-format',
  'yaml://format',
  async (uri) => {
    const text = await readFile(join(__dirname, '..', 'YAML_LESSON_FORMAT.md'), 'utf-8')
    return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text }] }
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
