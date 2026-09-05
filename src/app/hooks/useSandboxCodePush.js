import { useEffect } from 'react'
import { decodeFileKey } from '../../shared/fileKeys'

function fileTypeFor(name) {
  if (name.endsWith('.html')) return 'html'
  if (name.endsWith('.css')) return 'css'
  return 'js'
}

/**
 * Loads content the teacher pushes into the sandbox. Each lesson type keeps its work in a
 * different piece of state, so the push lands in a different setter — but the trigger is
 * the same for all of them: the session's sandboxCodePushedAt timestamp changing while
 * the student is in the sandbox. HTML is the exception, pushing a file map on its own
 * sandboxFilesUpdatedAt timestamp.
 *
 * Both effects key off the push timestamps rather than the content, so a teacher pushing
 * the same code twice still replaces whatever the student has typed since.
 */
export function useSandboxCodePush({
  phase,
  lesson,
  session,
  setCode,
  setFiles,
  setActiveFile,
  setFsState,
  setScratchSandboxProject,
}) {
  useEffect(() => {
    if (phase !== 'sandbox' || !session?.sandboxCode) return
    const type = lesson?.type
    if (type === 'python' || type === 'arcade' || type === 'electronics') {
      // Electronics keeps its circuit as serialised JSON in `code`, same as the others.
      setCode(session.sandboxCode)
    } else if (type === 'scratch') {
      try {
        setScratchSandboxProject(JSON.parse(session.sandboxCode))
      } catch {}
    } else if (type === 'filesystem') {
      try {
        setFsState(JSON.parse(session.sandboxCode))
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, session?.sandboxCodePushedAt])

  useEffect(() => {
    if (phase !== 'sandbox' || lesson?.type !== 'html') return
    if (session?.sandboxFiles) {
      const decoded = Object.entries(session.sandboxFiles).map(([key, content]) => {
        const name = decodeFileKey(key)
        return { name, content, type: fileTypeFor(name) }
      })
      setFiles(decoded)
      if (decoded.length > 0) setActiveFile(decoded[0].name)
    } else if (lesson?.sandboxStarterFiles?.length > 0) {
      setFiles(lesson.sandboxStarterFiles)
      setActiveFile(lesson.sandboxStarterFiles[0].name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, session?.sandboxFilesUpdatedAt])
}
