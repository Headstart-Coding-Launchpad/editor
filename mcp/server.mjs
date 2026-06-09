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

// Keep db import alive — ensures Firebase is initialised before tools are called
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

- \`lessons/\` Firestore collection — live lessons served to students
- \`topicLibrary/\` Firestore collection — live topic library

The local \`lessons/JSON Files/\` directory is the **authoring workspace** only. Editing a local JSON file has no effect on the live app until you publish it with \`upsert_lesson\`.

## Authoring workflow (step by step)

1. **Understand the schema** — fetch \`lesson://schema\` before writing any lesson JSON. All field names, types, and valid values are defined there.

2. **Create the lesson JSON locally** — write or generate the full lesson JSON object following the schema. The lesson \`id\` must be a lowercase slug (e.g. \`python-for-loops\`).

3. **Validate before publishing** — call \`validate_lesson(lesson)\` with the full JSON. Fix all errors before continuing. Warnings are non-blocking but should be reviewed.

4. **Publish to Firestore** — call \`upsert_lesson(lesson)\` to write the lesson to the live app. This also validates; if validation fails the lesson is not written and errors are returned.

5. **Confirm the publish** — call \`get_lesson(id)\` to verify the live lesson matches what you intended.

## Updating an existing lesson

1. Fetch the current version: \`get_lesson(id)\`
2. Apply your changes to the returned JSON
3. Validate: \`validate_lesson(lesson)\`
4. Publish: \`upsert_lesson(lesson)\`

## Topic library workflow

Topics follow the same pattern using \`list_topics\`, \`get_topic\`, \`upsert_topic\`, and \`delete_topic\`. Fetch \`topic://schema\` for the full topic object format.

## Assets

Use \`list_lesson_assets\`, \`upload_lesson_asset\`, and \`delete_lesson_asset\` to manage files stored in Firebase Storage. Asset download URLs are stored in the lesson's \`storageAssets\` field and served directly to students.

## Important rules

- Never call \`upsert_lesson\` without calling \`validate_lesson\` first (or accepting that upsert will validate and reject)
- Never call \`delete_lesson\` without confirming the lesson ID with the user — deletion is permanent
- The \`id\` field in the lesson JSON determines the Firestore document ID; changing it creates a new document (the old one must be deleted manually)
- Scratch toolbox XML validation is skipped server-side (no DOMParser in Node.js) — use the builder preview to catch XML errors
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

const transport = new StdioServerTransport()
await server.connect(transport)
