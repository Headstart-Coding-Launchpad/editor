// Reads docs/authoring/authoring-requests/*.md into { file, title, kind, status, ... } so
// `lessons capabilities` can list what is already requested or in progress. Each request's
// header is the template's bullet list (see that folder's README.md):
//   - **Status:** open            <!-- comment -->
//   - **Kind:** activity mode
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const AUTHORING_REQUESTS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../docs/authoring/authoring-requests'
)

const HEADER_FIELDS = {
  Status: 'status',
  Kind: 'kind',
  'Requested by': 'requestedBy',
  'Lessons blocked': 'lessonsBlocked',
}

export function parseAuthoringRequest(file, markdown) {
  const request = { file, title: '', kind: '', status: '' }
  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.replace(/<!--.*?-->/g, '').trim()
    if (!request.title && line.startsWith('# ')) {
      request.title = line.slice(2).trim()
      continue
    }
    const match = /^- \*\*([^*]+):\*\*\s*(.*)$/.exec(line)
    const key = match && HEADER_FIELDS[match[1].trim()]
    if (key && !request[key]) request[key] = match[2].trim()
    if (line.startsWith('## ')) break
  }
  return request
}

export function readAuthoringRequests(dir = AUTHORING_REQUESTS_DIR) {
  let files
  try {
    files = fs.readdirSync(dir)
  } catch {
    return []
  }
  return files
    .filter((file) => file.endsWith('.md') && file.toLowerCase() !== 'readme.md')
    .sort()
    .map((file) =>
      parseAuthoringRequest(
        `docs/authoring/authoring-requests/${file}`,
        fs.readFileSync(path.join(dir, file), 'utf8')
      )
    )
}
