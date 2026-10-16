import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Compartment } from '@codemirror/state'
import { scrubExtension } from './scrubExtension.js'
import ScrubPopover from './ScrubPopover.jsx'
import { scrubNoticeText } from './replay.js'

// The scrub extension sits in its own compartment, reconfigured when the task's settings, the
// language or read-only change.
const scrubCompartment = new Compartment()

const NOTICE_MS = 2500

/**
 * Scrubbing for the shared CodeEditor (./scrubExtension.js). Returns the compartment `extension`
 * for the editor's initial state and the `element` (popover and "Press Run to see it" notice)
 * the editor renders beside itself.
 * - `scrub`: getTaskScrub's settings, or null for none. Read-only editors never scrub.
 * - `onScrubPreview(code, { notify })`: re-runs the code as a preview; returns 'preview', or
 *   'press-run' / 'press-run-answers' when the program can't re-run live (the notice is shown).
 *   A preview that finds out later it can't run (an input() program asking for more answers
 *   than the last Run gave) calls `notify('press-run-answers')`.
 * - `onScrubCommit({ kind })`: a scrub ended as an edit (the session report, and the checks on
 *   release, useScrubPreview).
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
      const show = (status) => {
        const text = scrubNoticeText(status)
        if (!text || !view) return
        const coords = view.coordsAtPos(Math.min(from ?? 0, view.state.doc.length))
        clearTimeout(noticeTimerRef.current)
        setNotice(
          coords ? { left: coords.left, top: coords.top, text } : { left: 16, top: 16, text }
        )
        noticeTimerRef.current = setTimeout(() => setNotice(null), NOTICE_MS)
      }
      show(onScrubPreview?.(code, { notify: show }) ?? null)
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
              left: Math.max(8, Math.min(notice.left, window.innerWidth - 300)),
              top: Math.max(8, notice.top - 34),
            }}
          >
            {notice.text}
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
