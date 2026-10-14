import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Compartment } from '@codemirror/state'
import { scrubExtension } from './scrubExtension.js'
import ScrubPopover from './ScrubPopover.jsx'

// The scrub extension sits in its own compartment, reconfigured when the task's settings, the
// language or read-only change.
const scrubCompartment = new Compartment()

const NOTICE_MS = 2500

/**
 * Scrubbing for the shared CodeEditor (./scrubExtension.js). Returns the compartment `extension`
 * for the editor's initial state and the `element` (popover and "Press Run to see it" notice)
 * the editor renders beside itself.
 * - `scrub`: getTaskScrub's settings, or null for none. Read-only editors never scrub.
 * - `onScrubPreview(code)`: re-runs the code as a preview; returns 'preview', or 'press-run' when
 *   the program can't re-run live (the notice is shown).
 * - `onScrubCommit({ kind })`: a scrub ended as an edit (for the session report).
 */
export function useEditorScrub({
  viewRef,
  scrub = null,
  language,
  readOnly,
  onScrubPreview,
  onScrubCommit,
}) {
  const [popover, setPopover] = useState(null)
  const [notice, setNotice] = useState(null)
  const noticeTimerRef = useRef(null)
  const handlersRef = useRef(null)
  const popoverIdRef = useRef(0)
  handlersRef.current = {
    onPreview(code, { view, from } = {}) {
      const status = onScrubPreview?.(code) ?? null
      if (status !== 'press-run' || !view) return
      const coords = view.coordsAtPos(Math.min(from ?? 0, view.state.doc.length))
      clearTimeout(noticeTimerRef.current)
      setNotice(coords ? { left: coords.left, top: coords.top } : { left: 16, top: 16 })
      noticeTimerRef.current = setTimeout(() => setNotice(null), NOTICE_MS)
    },
    onCommit(info) {
      onScrubCommit?.(info)
    },
    openPopover(request) {
      popoverIdRef.current += 1
      setPopover({ ...request, id: popoverIdRef.current })
    },
  }

  const active = !readOnly && !!scrub
  const config = active ? scrub : null
  const key = JSON.stringify([config, language])
  const build = () => scrubExtension({ config, language, handlersRef })
  const initialRef = useRef(null)
  if (!initialRef.current) initialRef.current = { key, extension: scrubCompartment.of(build()) }

  useEffect(() => {
    const view = viewRef.current
    if (!view || key === initialRef.current.key) return
    initialRef.current.key = key
    view.dispatch({ effects: scrubCompartment.reconfigure(build()) })
    if (!config) setPopover(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => () => clearTimeout(noticeTimerRef.current), [])

  const element = (
    <>
      {popover && (
        <ScrubPopover key={popover.id} request={popover} onClose={() => setPopover(null)} />
      )}
      {notice &&
        createPortal(
          <div
            role="status"
            style={{
              ...s.notice,
              left: Math.max(8, Math.min(notice.left, window.innerWidth - 180)),
              top: Math.max(8, notice.top - 34),
            }}
          >
            Press Run to see it
          </div>,
          document.body
        )}
    </>
  )

  return { extension: initialRef.current.extension, element }
}

const s = {
  notice: {
    position: 'fixed',
    zIndex: 2000,
    padding: '5px 10px',
    borderRadius: 999,
    background: '#1f2937',
    color: '#fff',
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    fontWeight: 600,
    pointerEvents: 'none',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
  },
}
