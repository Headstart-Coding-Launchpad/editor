import { useEffect } from 'react'
import { decodeFileKey } from '../../shared/fileKeys'
import { getModuleDefinition } from '../../modules/definitions.js'

function fileTypeFor(name) {
  if (name.endsWith('.html')) return 'html'
  if (name.endsWith('.css')) return 'css'
  return 'js'
}

/**
 * Loads content the teacher pushes into the sandbox, on the lesson module's wire channel
 * (`wire.sandboxChannel`, plan step 4.6):
 *
 * - 'code': `sandboxCode` decoded with `wire.fromCode` (the code string itself, or the parsed
 *   Scratch project / filesystem tree / desktop state) and handed to `onPushedWork`, whenever
 *   the session's sandboxCodePushedAt timestamp changes while the student is in the sandbox.
 *   A string that doesn't decode (malformed JSON) is ignored.
 * - 'files' (html): the `sandboxFiles` map, decoded, handed to `onPushedFiles(files)`, on its
 *   own sandboxFilesUpdatedAt timestamp; with no pushed files, the lesson's sandbox starter
 *   files.
 *
 * Both effects key off the push timestamps rather than the content, so a teacher pushing
 * the same code twice still replaces whatever the student has typed since.
 */
export function useSandboxCodePush({ phase, lesson, session, onPushedWork, onPushedFiles }) {
  useEffect(() => {
    if (phase !== 'sandbox' || !session?.sandboxCode) return
    const wire = getModuleDefinition(lesson?.type)?.wire
    if (wire?.sandboxChannel !== 'code') return
    const work = wire.fromCode(session.sandboxCode)
    if (work != null) onPushedWork(work)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, session?.sandboxCodePushedAt])

  useEffect(() => {
    if (phase !== 'sandbox') return
    if (getModuleDefinition(lesson?.type)?.wire.sandboxChannel !== 'files') return
    if (session?.sandboxFiles) {
      const decoded = Object.entries(session.sandboxFiles).map(([key, content]) => {
        const name = decodeFileKey(key)
        return { name, content, type: fileTypeFor(name) }
      })
      onPushedFiles(decoded)
    } else if (lesson?.sandboxStarterFiles?.length > 0) {
      onPushedFiles(lesson.sandboxStarterFiles)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, session?.sandboxFilesUpdatedAt])
}
