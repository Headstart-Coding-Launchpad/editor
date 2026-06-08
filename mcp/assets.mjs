import { z } from 'zod'
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC_ASSETS = join(__dirname, '..', 'public', 'assets')
const MANIFEST_PATH = join(PUBLIC_ASSETS, 'manifest.json')

async function readManifest() {
  const raw = await readFile(MANIFEST_PATH, 'utf-8')
  return JSON.parse(raw)
}

async function writeManifest(manifest) {
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8')
}

function validateFilename(filename) {
  if (!filename || typeof filename !== 'string') return 'filename is required'
  if (basename(filename) !== filename) return 'filename must not contain path components'
  if (filename.startsWith('.')) return 'filename must not start with a dot'
  return null
}

export function registerAssetTools(server) {
  server.tool(
    'list_lesson_assets',
    'List asset files for a lesson from public/assets/manifest.json',
    { lessonId: z.string().describe('Lesson ID slug') },
    async ({ lessonId }) => {
      try {
        const manifest = await readManifest()
        const files = manifest.lessons?.[lessonId] ?? []
        return { content: [{ type: 'text', text: JSON.stringify({ lessonId, files }) }] }
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: err.message }) }] }
      }
    }
  )

  server.tool(
    'upload_lesson_asset',
    'Upload a base64-encoded asset file for a lesson. Writes to public/assets/{lessonId}/{filename} and updates manifest.json. The file will be served once committed and deployed.',
    {
      lessonId: z.string().describe('Lesson ID slug (e.g. "html-3-7")'),
      filename: z.string().describe('Filename with extension (e.g. "hero.png")'),
      base64Content: z.string().describe('File contents as a base64-encoded string'),
    },
    async ({ lessonId, filename, base64Content }) => {
      if (!/^[a-z0-9-]+$/.test(lessonId)) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'lessonId must be a lowercase slug (letters, digits, hyphens only)' }) }] }
      }
      const filenameError = validateFilename(filename)
      if (filenameError) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: filenameError }) }] }
      }

      try {
        const dir = join(PUBLIC_ASSETS, lessonId)
        await mkdir(dir, { recursive: true })

        const buffer = Buffer.from(base64Content, 'base64')
        await writeFile(join(dir, filename), buffer)

        const manifest = await readManifest()
        if (!manifest.lessons) manifest.lessons = {}
        if (!manifest.lessons[lessonId]) manifest.lessons[lessonId] = []
        if (!manifest.lessons[lessonId].includes(filename)) {
          manifest.lessons[lessonId].push(filename)
          manifest.lessons[lessonId].sort()
        }
        await writeManifest(manifest)

        return { content: [{ type: 'text', text: JSON.stringify({ success: true, lessonId, filename, bytes: buffer.length }) }] }
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: err.message }) }] }
      }
    }
  )

  server.tool(
    'delete_lesson_asset',
    'Delete an asset file for a lesson from public/assets/{lessonId}/{filename} and remove it from manifest.json.',
    {
      lessonId: z.string().describe('Lesson ID slug'),
      filename: z.string().describe('Filename to delete'),
    },
    async ({ lessonId, filename }) => {
      const filenameError = validateFilename(filename)
      if (filenameError) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: filenameError }) }] }
      }

      try {
        await unlink(join(PUBLIC_ASSETS, lessonId, filename))

        const manifest = await readManifest()
        if (manifest.lessons?.[lessonId]) {
          manifest.lessons[lessonId] = manifest.lessons[lessonId].filter(f => f !== filename)
          if (manifest.lessons[lessonId].length === 0) delete manifest.lessons[lessonId]
          await writeManifest(manifest)
        }

        return { content: [{ type: 'text', text: JSON.stringify({ success: true, lessonId, filename }) }] }
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: err.message }) }] }
      }
    }
  )
}
