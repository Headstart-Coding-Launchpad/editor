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
