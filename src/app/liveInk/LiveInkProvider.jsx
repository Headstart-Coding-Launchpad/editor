import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LiveInkConfigContext, LiveInkDataContext } from './liveInkContext'
import {
  EMPTY_LIVE_INK,
  EXPLAINER_FORCE_INTERVAL_MS,
  isExplainerSurface,
  normaliseLiveInk,
} from './liveInkData'
import PresentationInkToolbar from './PresentationInkToolbar'

// Presentation annotations: the teacher's live pointer, fading ink and text highlights on
// information tasks and code-task explainers, shown to the whole class.
//
// `role`: 'teacher' in the Presentation window (draws, and sees its own marks), 'student' in a
// live lesson (sees them), null anywhere else (solo, preview, Builder) — then the surfaces stay
// inert and nothing subscribes.
//
// Two contexts on purpose: the data one changes at ~12Hz while the teacher points, and only
// LiveInkOverlay reads it. Surfaces (InkSurface) read the config one, which changes when the
// teacher picks a tool, so the Markdown underneath never re-renders for a pointer move.
//
// The RTDB side comes in from useSession (`subscribeLiveInk`, `createLiveInkWriter`), like
// every other realtime read/write in the classroom; without them nothing subscribes.
export default function LiveInkProvider({
  lessonId,
  role = null,
  subscribe,
  createWriter,
  onExplainerAnnotate,
  children,
}) {
  const enabled = !!lessonId && (role === 'teacher' || role === 'student')
  const isTeacher = enabled && role === 'teacher'
  const [ink, setInk] = useState(EMPTY_LIVE_INK)
  const inkRef = useRef(EMPTY_LIVE_INK)
  const [tool, setTool] = useState(null)
  const [surfaceCounts, setSurfaceCounts] = useState({})
  const [writer, setWriter] = useState(null)
  // useSession hands out fresh function identities every render; only the latest matters.
  const subscribeRef = useRef(subscribe)
  subscribeRef.current = subscribe
  const createWriterRef = useRef(createWriter)
  createWriterRef.current = createWriter

  useEffect(() => {
    if (!enabled) {
      inkRef.current = EMPTY_LIVE_INK
      setInk(EMPTY_LIVE_INK)
      return
    }
    // A separate subscription from the session's: liveInk/{lessonId} never sits under
    // sessions/{lessonId}, which every client streams in full.
    const unsubscribe = subscribeRef.current?.((value) => {
      const next = normaliseLiveInk(value)
      inkRef.current = next
      setInk(next)
    })
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [enabled, lessonId])

  useEffect(() => {
    if (!isTeacher) return
    const created = createWriterRef.current?.()
    if (!created) return
    created.armDisconnectCleanup()
    setWriter(created)
    return () => {
      created.clearAll()
      created.dispose()
      setWriter(null)
    }
  }, [isTeacher, lessonId])

  const registerSurface = useCallback((id) => {
    setSurfaceCounts((counts) => ({ ...counts, [id]: (counts[id] ?? 0) + 1 }))
    return () =>
      setSurfaceCounts((counts) => {
        const next = { ...counts }
        if ((next[id] ?? 0) <= 1) delete next[id]
        else next[id] -= 1
        return next
      })
  }, [])

  const hasSurface = Object.keys(surfaceCounts).length > 0

  // No annotatable content on screen (a code task with its explainer collapsed, a quiz): the
  // toolbar hides, so the tool goes too.
  useEffect(() => {
    if (!hasSurface) setTool(null)
  }, [hasSurface])

  // The pointer only shows while pointer mode is on.
  useEffect(() => {
    if (tool !== 'pointer') writer?.hidePointer()
  }, [tool, writer])

  useEffect(() => {
    if (!isTeacher || !tool) return
    function onKeyDown(event) {
      if (event.key === 'Escape') setTool(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isTeacher, tool])

  // Annotating a code task's explainer opens it for any student who has it collapsed, through
  // the existing whole-class pane command ('force' → instructions). Re-pushed at most every
  // EXPLAINER_FORCE_INTERVAL_MS so a student can still close it again.
  const lastForceRef = useRef(0)
  const onExplainerAnnotateRef = useRef(onExplainerAnnotate)
  onExplainerAnnotateRef.current = onExplainerAnnotate
  const noteAnnotate = useCallback((surface) => {
    if (!isExplainerSurface(surface)) return
    const now = Date.now()
    if (now - lastForceRef.current < EXPLAINER_FORCE_INTERVAL_MS) return
    lastForceRef.current = now
    onExplainerAnnotateRef.current?.()
  }, [])

  const getInk = useCallback(() => inkRef.current, [])

  const config = useMemo(
    () =>
      enabled
        ? {
            role,
            tool: isTeacher ? tool : null,
            setTool,
            writer: isTeacher ? writer : null,
            registerSurface,
            noteAnnotate,
            getInk,
          }
        : null,
    [enabled, role, isTeacher, tool, writer, registerSurface, noteAnnotate, getInk]
  )

  // Always rendered (with a null config when disabled), so a student's phase change in and out
  // of the lesson never changes the tree above the lesson content and remounts it.
  return (
    <LiveInkConfigContext.Provider value={config}>
      <LiveInkDataContext.Provider value={ink}>
        {children}
        {isTeacher && hasSurface && (
          <PresentationInkToolbar
            tool={tool}
            onToolChange={setTool}
            onClear={() => writer?.clearAll()}
            canClear={!!(ink.pointer || ink.strokes.length || ink.highlights.length)}
          />
        )}
      </LiveInkDataContext.Provider>
    </LiveInkConfigContext.Provider>
  )
}
