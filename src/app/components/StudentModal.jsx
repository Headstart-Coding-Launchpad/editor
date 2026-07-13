import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { CodeEditor } from '../../shared/CodeEditor'
import OutputPanel from './OutputPanel'
import IframePreview from './IframePreview'
import ScratchWorkspace from './ScratchWorkspace'
import FilesystemTask from './FilesystemTask'
import { buildIframeSrc } from '../../shared/iframe'
import { decodeFileKey } from '../../shared/fileKeys'
import QuizTask from './QuizTask'
import ExplainerPanel from './ExplainerPanel'
import LiveActivityToast from './LiveActivityToast'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { decodeSessionFiles, parseScratchState } from '../../shared/workspaceData'
import { findTaskById, deriveTaskContext, buildStageOptions } from '../../shared/taskUtils'
import PresenceBadge from './PresenceBadge'
import { DEFAULT_FS } from '../../shared/filesystem'
import { TopicLibraryDialog } from '../../shared/TopicLibraryView'
import { MarkdownRenderer } from '../../shared/markdown'

function parseSpriteState(raw) {
  if (!raw) return null
  try {
    const parsed = typeof raw === 'object' ? raw : JSON.parse(raw)
    return parsed && typeof parsed === 'object' && 'x' in parsed && 'y' in parsed ? parsed : null
  } catch {
    return null
  }
}

// ─── Dropdown menu (shared pattern) ─────────────────────────────────────────

function DropdownMenu({ label, children, buttonClassName = 'btn-ghost', buttonStyle }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className={buttonClassName}
        style={{ fontSize: 13, padding: '5px 12px', ...buttonStyle }}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        {label} ▾
      </button>
      {open && (
        <div style={sDD.panel} className="ui-popover">
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  )
}

const sDD = {
  panel: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    minWidth: 180,
    zIndex: 200,
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    background: '#fff',
    boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
    borderRadius: 8,
  },
}

// ─── Override dropdown ───────────────────────────────────────────────────────

function OverrideDropdown({ student, task, onOverrideCheck }) {
  const [showFailModal, setShowFailModal] = useState(false)
  const [failHint, setFailHint] = useState('')
  const hasOverride = !!student.checkOverridePushedAt

  function applyOverride(passed, hint) {
    onOverrideCheck(student.anonymousId, passed, passed ? null : (hint || null))
    setShowFailModal(false)
    setFailHint('')
  }

  return (
    <>
      <DropdownMenu
        label={hasOverride ? (student.checkOverridePassed ? 'Override: Pass' : 'Override: Fail') : 'Override'}
        buttonClassName="btn-ghost"
      >
        {close => (
          <>
            <button
              style={sOv.passBtn}
              onClick={() => { close(); applyOverride(true, null) }}
            >
              ✓ Pass
            </button>
            <button
              style={sOv.failBtn}
              onClick={() => { close(); setShowFailModal(true) }}
            >
              ✕ Fail
            </button>
          </>
        )}
      </DropdownMenu>

      {showFailModal && (
        <div style={sOv.modalOverlay} onClick={e => { if (e.target === e.currentTarget) { setShowFailModal(false); setFailHint('') } }}>
          <div style={sOv.modal}>
            <div style={sOv.modalHeader}>
              <span style={sOv.modalTitle}>Override: Fail</span>
              <button style={sOv.modalClose} onClick={() => { setShowFailModal(false); setFailHint('') }}>✕</button>
            </div>
            <div style={sOv.modalBody}>
              <p style={sOv.modalHint}>Optional hint for student (supports Markdown):</p>
              <textarea
                style={sOv.hintTextarea}
                placeholder="e.g. Check your indentation, or try using a `for` loop…"
                value={failHint}
                onChange={e => setFailHint(e.target.value)}
                rows={5}
                autoFocus
              />
            </div>
            <div style={sOv.modalFooter}>
              <button className="btn-ghost-outline" style={{ fontSize: 13 }} onClick={() => { setShowFailModal(false); setFailHint('') }}>
                Cancel
              </button>
              <button className="btn-danger" style={{ fontSize: 13 }} onClick={() => applyOverride(false, failHint)}>
                Apply Fail
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const sOv = {
  passBtn: {
    width: '100%',
    padding: '7px 12px',
    background: 'rgba(34,197,94,0.12)',
    color: '#166534',
    border: '1px solid rgba(34,197,94,0.35)',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
  },
  failBtn: {
    width: '100%',
    padding: '7px 12px',
    background: 'rgba(239,68,68,0.12)',
    color: '#991b1b',
    border: '1px solid rgba(239,68,68,0.35)',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 1100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    background: '#fff',
    borderRadius: 10,
    width: 'min(480px, 90vw)',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    overflow: 'hidden',
  },
  modalHeader: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  modalTitle: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1rem',
  },
  modalClose: {
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#fff',
    borderRadius: 5,
    width: 28,
    height: 28,
    fontSize: '0.85rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  modalBody: {
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  modalHint: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: '#374151',
    margin: 0,
  },
  hintTextarea: {
    fontFamily: 'var(--font-code)',
    fontSize: '0.85rem',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    resize: 'vertical',
    width: '100%',
    color: 'var(--colour-text)',
  },
  modalFooter: {
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    borderTop: '1px solid #e5e7eb',
    flexShrink: 0,
  },
}

// ─── Message compose ─────────────────────────────────────────────────────────

function MessageCompose({ student, onSendMessage, isOpen, onClose }) {
  const [text, setText] = useState('')

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed) return
    onSendMessage(student.anonymousId, trimmed)
    onClose()
    setText('')
  }

  if (!isOpen) return null

  return (
    <div
      style={sMc.overlay}
      onClick={e => { if (e.target === e.currentTarget) { onClose(); setText('') } }}
    >
      <div style={sMc.modal}>
        <div style={sMc.header}>
          <span style={sMc.title}>Message {student.displayName}</span>
          <button style={sMc.closeBtn} onClick={() => { onClose(); setText('') }}>✕</button>
        </div>
        <div style={sMc.body}>
          <p style={sMc.hint}>A friendly pop-up will appear on {student.displayName}&apos;s screen.</p>
          <textarea
            style={sMc.textarea}
            placeholder='e.g. "Great work so far!" or "Try a different approach…"'
            value={text}
            onChange={e => setText(e.target.value)}
            rows={4}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend() }}
          />
          <p style={sMc.hint2}>Ctrl+Enter to send</p>
        </div>
        <div style={sMc.footer}>
          <button className="btn-ghost-outline" style={{ fontSize: 13 }} onClick={() => { onClose(); setText('') }}>
            Cancel
          </button>
          <button className="btn-primary" style={{ fontSize: 13 }} onClick={handleSend} disabled={!text.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

const sMc = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 1200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    background: 'var(--ui-surface)',
    borderRadius: 10,
    width: 'min(460px, 92vw)',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    borderRadius: '10px 10px 0 0',
  },
  title: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1rem',
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#fff',
    borderRadius: 5,
    width: 28,
    height: 28,
    fontSize: '0.85rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  body: {
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  hint: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
    margin: 0,
  },
  hint2: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    color: '#9ca3af',
    margin: 0,
    textAlign: 'right',
  },
  textarea: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    padding: '10px 12px',
    resize: 'vertical',
    width: '100%',
    lineHeight: 1.5,
  },
  footer: {
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    borderTop: '1px solid var(--ui-border)',
    flexShrink: 0,
    borderRadius: '0 0 10px 10px',
  },
}

// ─── Stage dropdown ──────────────────────────────────────────────────────────

function StageDropdown({ stageOptions, onRequest, declinedNotice }) {
  return (
    <DropdownMenu
      label={declinedNotice ? 'Student declined' : 'Set Stage'}
      buttonClassName="btn-ghost"
      buttonStyle={declinedNotice ? { color: '#ef4444', borderColor: '#ef4444' } : undefined}
    >
      {close => (
        <>
          {stageOptions.map(opt => (
            <button
              key={opt.value}
              style={sSt.stageBtn}
              onClick={() => { close(); onRequest(opt.value, opt.label) }}
            >
              {opt.label}
            </button>
          ))}
        </>
      )}
    </DropdownMenu>
  )
}

const sSt = {
  stageBtn: {
    width: '100%',
    padding: '7px 12px',
    background: 'rgba(98,34,204,0.06)',
    color: 'var(--colour-primary-dark)',
    border: '1px solid rgba(98,34,204,0.18)',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
  },
}

// ─── Main modal ──────────────────────────────────────────────────────────────

const HIGHLIGHT_EMOJI_OPTIONS = ['✅', '❌', '❓', '💡', '⭐']

export default function StudentModal({ student, lesson, session, topics, isLive, isLiveForAll, onGoLive, onGoLiveForAll, onStopLive, onClose, hasPrev, hasNext, onPrev, onNext, onRemoteReset, onOverrideCheck, onDismissHelp, onSendToTopic, onSendTopicToAll, onSendMessage, onRequestTeacherEdit, onPushTeacherLiveCode, onCommitTeacherEdit, onCancelTeacherEdit, onRequestTeacherStage, onClearTeacherStage, onAddHighlight, onRemoveHighlight }) {
  const overlayRef = useRef(null)
  const iframeRef  = useRef(null)
  const [showTopicLibrary, setShowTopicLibrary] = useState(false)
  const [showMessageModal, setShowMessageModal] = useState(false)

  // Teacher highlight: select a range in the mirrored view, tag it, send it
  const [pendingHighlight, setPendingHighlight] = useState(null) // {from, to} | null
  const [highlightEmoji, setHighlightEmoji] = useState(HIGHLIGHT_EMOJI_OPTIONS[0])
  const [highlightNote, setHighlightNote] = useState('')

  // Teacher live-edit state machine
  const [teacherEditState, setTeacherEditState] = useState('idle') // 'idle' | 'requesting' | 'editing'
  const [teacherCode, setTeacherCode] = useState('')
  const [teacherScratchState, setTeacherScratchState] = useState(null)
  const [declinedNotice, setDeclinedNotice] = useState(false)
  const pushDebounceRef = useRef(null)

  // Teacher stage-change state machine
  const [stageRequestState, setStageRequestState] = useState('idle') // 'idle' | 'requesting'
  const [stagePendingAction, setStagePendingAction] = useState(null)
  const [stageDeclinedNotice, setStageDeclinedNotice] = useState(false)

  // React to student accepting or declining
  useEffect(() => {
    if (teacherEditState === 'requesting') {
      if (student.teacherEditAcceptedAt) {
        const initialCode = student.currentCode ?? ''
        setTeacherCode(initialCode)
        if (isScratch) {
          setTeacherScratchState(parseScratchState(initialCode))
        }
        setTeacherEditState('editing')
        setDeclinedNotice(false)
        onPushTeacherLiveCode?.(student.anonymousId, initialCode)
      } else if (!student.teacherEditRequestedAt) {
        setTeacherEditState('idle')
        setDeclinedNotice(true)
        setTimeout(() => setDeclinedNotice(false), 4000)
      }
    }
    if (teacherEditState === 'editing' && !student.teacherEditAcceptedAt && !student.teacherEditRequestedAt) {
      setTeacherEditState('idle')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.teacherEditRequestedAt, student.teacherEditAcceptedAt])

  // React to student accepting or declining stage change
  useEffect(() => {
    if (stageRequestState === 'requesting') {
      if (student.teacherStageAcceptedAt) {
        onRemoteReset(student.anonymousId, stagePendingAction)
        onClearTeacherStage?.(student.anonymousId)
        setStageRequestState('idle')
        setStagePendingAction(null)
      } else if (!student.teacherStageRequestedAt) {
        setStageRequestState('idle')
        setStagePendingAction(null)
        setStageDeclinedNotice(true)
        setTimeout(() => setStageDeclinedNotice(false), 4000)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.teacherStageRequestedAt, student.teacherStageAcceptedAt])

  // Clean up edit state when navigating to a different student
  useEffect(() => {
    setTeacherEditState('idle')
    setTeacherCode('')
    setTeacherScratchState(null)
    setDeclinedNotice(false)
    setStageRequestState('idle')
    setStagePendingAction(null)
    setStageDeclinedNotice(false)
    setShowMessageModal(false)
    setPendingHighlight(null)
    setHighlightNote('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.anonymousId])

  function handleTeacherCodeChange(newCode) {
    setTeacherCode(newCode)
    clearTimeout(pushDebounceRef.current)
    pushDebounceRef.current = setTimeout(() => {
      onPushTeacherLiveCode?.(student.anonymousId, newCode)
    }, 120)
  }

  function handleScratchStateChange(workspaceStates) {
    setTeacherScratchState(workspaceStates)
    clearTimeout(pushDebounceRef.current)
    pushDebounceRef.current = setTimeout(() => {
      onPushTeacherLiveCode?.(student.anonymousId, JSON.stringify(workspaceStates))
    }, 300)
  }

  function handleStartEdit() {
    onRequestTeacherEdit?.(student.anonymousId)
    setTeacherEditState('requesting')
    setDeclinedNotice(false)
  }

  function handleCommitEdit() {
    clearTimeout(pushDebounceRef.current)
    if (isScratch) {
      onCommitTeacherEdit?.(student.anonymousId, JSON.stringify(teacherScratchState))
      setTeacherScratchState(null)
    } else {
      onCommitTeacherEdit?.(student.anonymousId, teacherCode)
    }
    setTeacherEditState('idle')
    setTeacherCode('')
  }

  function handleCancelEdit() {
    clearTimeout(pushDebounceRef.current)
    onCancelTeacherEdit?.(student.anonymousId)
    setTeacherEditState('idle')
    setTeacherCode('')
    setTeacherScratchState(null)
  }

  function handleRequestStage(action) {
    onRequestTeacherStage?.(student.anonymousId, action)
    setStagePendingAction(action)
    setStageRequestState('requesting')
    setStageDeclinedNotice(false)
  }

  function handleCancelStage() {
    onClearTeacherStage?.(student.anonymousId)
    setStageRequestState('idle')
    setStagePendingAction(null)
  }

  function handleClose() {
    if (teacherEditState !== 'idle') handleCancelEdit()
    if (stageRequestState !== 'idle') handleCancelStage()
    onClose?.()
  }

  function handleMirrorSelectionChange({ from, to }) {
    setPendingHighlight(from === to ? null : { from, to })
  }

  function handleSendHighlight(activeFile) {
    if (!pendingHighlight) return
    onAddHighlight?.(student.anonymousId, {
      file: activeFile,
      from: pendingHighlight.from,
      to:   pendingHighlight.to,
      emoji: highlightEmoji,
      note:  highlightNote.trim() || null,
    })
    setPendingHighlight(null)
    setHighlightNote('')
  }

  function handleCancelHighlight() {
    setPendingHighlight(null)
    setHighlightNote('')
  }

  function handleDismissHighlight(highlightId) {
    onRemoveHighlight?.(student.anonymousId, highlightId)
  }

  const files = decodeSessionFiles(student.currentFiles, decodeFileKey, 'html')
  const task = findTaskById(lesson?.tasks, session?.currentTaskId)
  const { isPython, isScratch, isFilesystem, isQuiz, isInformation, isSessionSandbox } = deriveTaskContext(lesson, task, session)
  const scratchState = isScratch ? parseScratchState(student.currentCode) : null
  const spriteState = isScratch ? parseSpriteState(student.currentOutput) : null
  const studentFs = isFilesystem
    ? (() => { try { return student.currentCode ? JSON.parse(student.currentCode) : DEFAULT_FS } catch { return DEFAULT_FS } })()
    : null
  const iframeSrc = !isPython && !isScratch && !isFilesystem && !isQuiz && files.length
    ? buildIframeSrc(files, task?.entryFile ?? 'index.html')
    : null

  const [activeFile, setActiveFile] = useState(task?.entryFile ?? files[0]?.name ?? '')
  const activeFileObj = files.find(f => f.name === activeFile) ?? files[0]

  const hasOverride = !!student.checkOverridePushedAt
  const remoteSelection = !isLive || (!isPython && student.currentSelection?.file !== activeFile)
    ? null
    : student.currentSelection

  const canHighlight = isLive && !isInformation && !isQuiz && !isScratch && !isFilesystem && teacherEditState === 'idle'
  const highlightsForActiveFile = useMemo(() => {
    const raw = student.teacherHighlights
    if (!raw) return []
    return Object.entries(raw)
      .filter(([, h]) => (isPython ? true : decodeFileKey(h.file) === activeFile))
      .map(([id, h]) => ({ id, from: h.from, to: h.to, emoji: h.emoji, note: h.note }))
  }, [student.teacherHighlights, isPython, activeFile])

  useEffect(() => {
    const liveFile = student.currentActiveFile ?? student.currentSelection?.file ?? student.currentActivity?.file
    if (!isLive || !liveFile || !files.some(file => file.name === liveFile)) return
    setActiveFile(liveFile)
  }, [isLive, student.currentActiveFile, student.currentSelection?.file, student.currentActivity?.file])

  const stageOptions = buildStageOptions(task, lesson?.type)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherEditState])

  return (
    <div
      ref={overlayRef}
      style={s.overlay}
      onClick={e => { if (e.target === overlayRef.current) handleClose() }}
      role="dialog"
      aria-modal="true"
    >
      <div style={s.modal}>
        {isLive && <LiveActivityToast activity={student.currentActivity} style={{ top: 86 }} />}
        {/* Modal header */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <span style={s.name}>{student.displayName}</span>
            <PresenceBadge student={student} session={session} />
            {isLive && <span style={s.liveBadge}>● {isLiveForAll ? 'LIVE FOR ALL' : 'LIVE'}</span>}
            {student.checkPassed && <span style={s.checkBadge}>✅</span>}
            {hasOverride && (
              <span style={s.overrideBadge}>
                {student.checkOverridePassed ? 'Overridden: Passed' : 'Overridden: Failed'}
              </span>
            )}
            {student.needsHelp && (
              <button
                style={s.helpedBtn}
                onClick={() => onDismissHelp?.(student.anonymousId)}
                title="Mark as helped"
              >
                Help Needed — Helped ✓
              </button>
            )}
            {student.currentTopicId && (() => {
              const topic = topics?.find(t => t.id === student.currentTopicId)
              return (
                <span style={s.topicBadge} title={`Student has topic "${topic?.title ?? student.currentTopicId}" open`}>
                  📖 {topic?.title ?? student.currentTopicId}
                </span>
              )
            })()}
          </div>
          <div style={s.headerRight}>
            <div style={s.navButtons}>
              <button
                style={{ ...s.navBtn, opacity: hasPrev ? 1 : 0.35 }}
                disabled={!hasPrev}
                onClick={onPrev}
                title="Previous student"
              >
                ←
              </button>
              <button
                style={{ ...s.navBtn, opacity: hasNext ? 1 : 0.35 }}
                disabled={!hasNext}
                onClick={onNext}
                title="Next student"
              >
                →
              </button>
            </div>

            {/* Stage dropdown */}
            {onRemoteReset && !isInformation && !isQuiz && stageOptions.length > 0 && (
              stageRequestState === 'requesting' ? (
                <>
                  <span style={sEd.waitingText}>Waiting for {student.displayName}…</span>
                  <button className="btn-ghost" style={{ fontSize: 13, padding: '5px 10px' }} onClick={handleCancelStage}>
                    Cancel
                  </button>
                </>
              ) : (
                <StageDropdown
                  stageOptions={stageOptions}
                  onRequest={handleRequestStage}
                  declinedNotice={stageDeclinedNotice}
                />
              )
            )}

            {/* Override dropdown */}
            {onOverrideCheck && task?.check != null && (
              <OverrideDropdown student={student} task={task} onOverrideCheck={onOverrideCheck} />
            )}


            {/* Active edit states (shown outside More dropdown while in progress) */}
            {onRequestTeacherEdit && (isPython || isScratch) && !isInformation && !isQuiz && teacherEditState === 'editing' && (
              <>
                <button
                  className="btn-primary"
                  style={{ fontSize: 13, padding: '5px 12px', background: '#0f766e', borderColor: '#0f766e' }}
                  onClick={handleCommitEdit}
                >
                  Done Editing
                </button>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 13, padding: '5px 10px' }}
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
              </>
            )}
            {onRequestTeacherEdit && (isPython || isScratch) && !isInformation && !isQuiz && teacherEditState === 'requesting' && (
              <>
                <span style={sEd.waitingText}>Waiting for {student.displayName}…</span>
                <button className="btn-ghost" style={{ fontSize: 13, padding: '5px 10px' }} onClick={handleCancelEdit}>
                  Cancel
                </button>
              </>
            )}

            {/* Declined notice */}
            {onRequestTeacherEdit && (isPython || isScratch) && !isInformation && !isQuiz && declinedNotice && (
              <span style={sEd.declinedNotice}>Student declined</span>
            )}

            {/* More dropdown: topic, message, edit code — grouped when idle */}
            {teacherEditState === 'idle' && (() => {
              const hasEdit = !!(onRequestTeacherEdit && (isPython || isScratch) && !isInformation && !isQuiz)
              const hasTopic = !!(onSendToTopic && topics?.length > 0)
              const hasMessage = !!onSendMessage
              if (!hasEdit && !hasTopic && !hasMessage) return null
              return (
                <DropdownMenu label="More" buttonClassName="btn-ghost">
                  {close => (
                    <>
                      {hasEdit && (
                        <button style={sTo.toolBtn} onClick={() => { close(); handleStartEdit() }}>
                          {isScratch ? '✏ Edit Blocks' : '✏ Edit Code'}
                        </button>
                      )}
                      {hasTopic && (
                        <button style={sTo.toolBtn} onClick={() => { close(); setShowTopicLibrary(true) }}>
                          📖 Send Topic
                        </button>
                      )}
                      {hasMessage && (
                        <button style={sTo.toolBtn} onClick={() => { close(); setShowMessageModal(true) }}>
                          ✉ Message
                        </button>
                      )}
                    </>
                  )}
                </DropdownMenu>
              )
            })()}

            {/* Go Live for All / Stop Live */}
            {!isInformation && !isQuiz && teacherEditState === 'idle' && (
              isLiveForAll ? (
                <button
                  className="btn-danger"
                  style={{ fontSize: 13, padding: '5px 14px' }}
                  onClick={onStopLive}
                >
                  Stop Live
                </button>
              ) : (
                <button
                  className="btn-primary"
                  style={{ fontSize: 13, padding: '5px 14px' }}
                  onClick={onGoLiveForAll}
                >
                  Go Live for All
                </button>
              )
            )}
          </div>
          <button
            className="btn-ghost"
            style={s.closeBtnHeader}
            onClick={handleClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={isInformation ? s.bodyInformation : (isQuiz && !isSessionSandbox) ? s.bodyQuiz : isPython ? s.bodyPython : isScratch ? s.bodyScratch : isFilesystem ? s.bodyFilesystem : s.bodyHtml}>
          {teacherEditState === 'editing' && isScratch ? (
            <ScratchWorkspace
              key={`teacher-edit-scratch-${student.anonymousId}-${session?.currentTaskId}`}
              task={task}
              readOnly={false}
              assetsPath={resolveAssetsPath(lesson?.assetsPath) || undefined}
              initialState={parseScratchState(student.currentCode)}
              onStateChange={handleScratchStateChange}
            />
          ) : teacherEditState === 'editing' ? (
            <div style={s.editorWrap}>
              <CodeEditor
                value={teacherCode}
                language="python"
                readOnly={false}
                onChange={handleTeacherCodeChange}
                style={{ height: '100%' }}
              />
            </div>
          ) : (
            <StudentWorkspaceBody
              lesson={lesson}
              task={task}
              student={student}
              session={session}
              isInformation={isInformation}
              isQuiz={isQuiz}
              isSessionSandbox={isSessionSandbox}
              isPython={isPython}
              isScratch={isScratch}
              isFilesystem={isFilesystem}
              files={files}
              activeFile={activeFile}
              setActiveFile={setActiveFile}
              activeFileObj={activeFileObj}
              remoteSelection={remoteSelection}
              scratchState={scratchState}
              spriteState={spriteState}
              studentFs={studentFs}
              iframeSrc={iframeSrc}
              iframeRef={iframeRef}
              canHighlight={canHighlight}
              pendingHighlight={pendingHighlight}
              highlights={highlightsForActiveFile}
              onMirrorSelectionChange={handleMirrorSelectionChange}
              onDismissHighlight={handleDismissHighlight}
              highlightEmoji={highlightEmoji}
              onHighlightEmojiChange={setHighlightEmoji}
              highlightNote={highlightNote}
              onHighlightNoteChange={setHighlightNote}
              onSendHighlight={() => handleSendHighlight(activeFile)}
              onCancelHighlight={handleCancelHighlight}
            />
          )}
        </div>
      </div>

      {/* Topic library dialog */}
      {showTopicLibrary && topics?.length > 0 && (
        <TopicLibraryDialog
          topics={topics}
          topicType={lesson?.type}
          renderMarkdown={({ content, textScale, topicType: tt }) => (
            <MarkdownRenderer content={content} textScale={textScale} topicType={tt} />
          )}
          onClose={() => setShowTopicLibrary(false)}
          studentName={student.displayName}
          onSendToStudent={topicId => {
            onSendToTopic?.(student.anonymousId, topicId)
            setShowTopicLibrary(false)
          }}
          onSendToAll={onSendTopicToAll ? topicId => {
            onSendTopicToAll(topicId)
            setShowTopicLibrary(false)
          } : undefined}
        />
      )}

      {/* Message compose modal */}
      {onSendMessage && (
        <MessageCompose
          student={student}
          onSendMessage={onSendMessage}
          isOpen={showMessageModal}
          onClose={() => setShowMessageModal(false)}
        />
      )}
    </div>
  )
}

// ─── Student workspace body (lesson.type dispatch) ───────────────────────────

function StudentWorkspaceBody({
  lesson, task, student, session,
  isInformation, isQuiz, isSessionSandbox, isPython, isScratch, isFilesystem,
  files, activeFile, setActiveFile, activeFileObj,
  remoteSelection, scratchState, spriteState, studentFs,
  iframeSrc, iframeRef,
  canHighlight, pendingHighlight, highlights, onMirrorSelectionChange, onDismissHighlight,
  highlightEmoji, onHighlightEmojiChange, highlightNote, onHighlightNoteChange,
  onSendHighlight, onCancelHighlight,
}) {
  const highlightComposer = canHighlight && (
    <div style={s.highlightComposer}>
      <div style={s.highlightEmojiRow}>
        {HIGHLIGHT_EMOJI_OPTIONS.map(emoji => (
          <button
            key={emoji}
            type="button"
            style={{ ...s.highlightEmojiBtn, ...(emoji === highlightEmoji ? s.highlightEmojiBtnActive : {}) }}
            onClick={() => onHighlightEmojiChange(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
      <input
        type="text"
        style={s.highlightNoteInput}
        placeholder={pendingHighlight ? 'Optional note…' : 'Select code above to highlight it…'}
        value={highlightNote}
        onChange={e => onHighlightNoteChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && pendingHighlight) onSendHighlight() }}
      />
      <button
        className="btn-primary"
        style={{ fontSize: 12, padding: '4px 10px' }}
        onClick={onSendHighlight}
        disabled={!pendingHighlight}
      >
        Send Highlight
      </button>
      {(pendingHighlight || highlightNote) && (
        <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={onCancelHighlight}>
          Clear
        </button>
      )}
    </div>
  )
  if (isInformation) return (
    <ExplainerPanel title={task?.title} content={task?.explainer ?? ''} collapsible={false} fill topicType={lesson?.type} />
  )

  if (isQuiz && !isSessionSandbox) return (
    <QuizTask
      task={task}
      showQuestion
      selectedAnswer={student.currentAnswer ?? ''}
      submitted={student.lastRunStatus === 'submitted'}
      checkPassed={student.checkPassed}
      disabled
      showCorrectAnswer
    />
  )

  if (isPython) return (
    <>
      {highlightComposer}
      <div style={s.editorWrap}>
        <CodeEditor
          value={student.currentCode ?? ''}
          language="python"
          readOnly
          remoteSelection={remoteSelection}
          teacherHighlights={highlights}
          onSelectionChange={canHighlight ? onMirrorSelectionChange : undefined}
          onHighlightDismiss={onDismissHighlight}
          style={{ height: '100%', ...(canHighlight ? s.editorHighlightMode : {}) }}
        />
      </div>
      {task?.interactionMode === 'submit' ? (
        <div style={s.submitNotice}>
          {student.lastRunStatus === 'submitted' ? 'Code submitted' : 'Waiting for submission'}
        </div>
      ) : (
        <OutputPanel
          output={student.currentOutput ?? ''}
          runStatus={student.lastRunStatus}
          hasCheck={!!task?.check}
          checkPassed={student.checkPassed}
        />
      )}
    </>
  )

  if (isScratch) return (
    <ScratchWorkspace
      key={`student-scratch-${student.anonymousId}-${session?.currentTaskId}`}
      task={task}
      readOnly
      assetsPath={resolveAssetsPath(lesson?.assetsPath) || undefined}
      initialState={scratchState}
      externalState={scratchState}
      initialSpriteState={spriteState}
    />
  )

  if (isFilesystem) return (
    <FilesystemTask
      fs={studentFs}
      assetsPath={resolveAssetsPath(lesson?.assetsPath) || undefined}
      assets={lesson?.assets}
      disabled
    />
  )

  return (
    <>
      <div style={s.htmlEditorPane}>
        {files.length > 1 && (
          <div style={s.tabBar} className="ui-tabs">
            {files.map(f => (
              <button
                key={f.name}
                className={`ui-tab ui-tab--code${f.name === activeFile ? ' is-active' : ''}`}
                style={{ ...s.tab, ...(f.name === activeFile ? s.tabActive : {}) }}
                onClick={() => { onCancelHighlight?.(); setActiveFile(f.name) }}
              >
                {f.name}
              </button>
            ))}
          </div>
        )}
        {files.length === 1 && (
          <div style={s.singleFileLabel}>{files[0]?.name}</div>
        )}
        {highlightComposer}
        <div style={s.editorWrap}>
          {activeFileObj && (
            <CodeEditor
              key={activeFileObj.name}
              value={activeFileObj.content}
              language={activeFileObj.type}
              readOnly
              remoteSelection={remoteSelection}
              teacherHighlights={highlights}
              onSelectionChange={canHighlight ? onMirrorSelectionChange : undefined}
              onHighlightDismiss={onDismissHighlight}
              style={{ height: '100%', ...(canHighlight ? s.editorHighlightMode : {}) }}
            />
          )}
        </div>
      </div>
      {task?.interactionMode !== 'submit' && (
        <div style={s.iframePane}>
          <IframePreview src={iframeSrc} iframeRef={iframeRef} fill />
        </div>
      )}
    </>
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 24,
  },
  modal: {
    background: '#fff',
    borderRadius: 12,
    width: 'min(1200px, 92vw)',
    height: '88vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    gap: 8,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: '1 1 0', flexWrap: 'wrap' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'wrap' },
  closeBtnHeader: { flexShrink: 0, fontSize: 13, padding: '5px 10px' },
  navButtons: {
    display: 'flex',
    gap: 2,
    marginRight: 4,
  },
  navBtn: {
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#fff',
    borderRadius: 5,
    width: 30,
    height: 28,
    fontSize: '0.95rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    transition: 'background 0.15s',
  },
  name: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.05rem',
    whiteSpace: 'nowrap',
  },
  liveBadge: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.78rem',
    color: '#86efac',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
  },
  checkBadge: { fontSize: '1rem' },
  helpedBtn: {
    background: '#f59e0b',
    border: 'none',
    borderRadius: 5,
    padding: '3px 10px',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.78rem',
    color: '#fff',
    cursor: 'pointer',
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
  },
  overrideBadge: {
    fontSize: '0.72rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.75)',
    whiteSpace: 'nowrap',
    background: 'rgba(255,255,255,0.12)',
    padding: '2px 7px',
    borderRadius: 999,
  },
  topicBadge: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.75rem',
    color: '#bae6fd',
    padding: '3px 8px',
    background: 'rgba(14,165,233,0.2)',
    border: '1px solid rgba(14,165,233,0.4)',
    borderRadius: 999,
    whiteSpace: 'nowrap',
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  bodyPython: {
    flex: 1,
    overflow: 'hidden',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  bodyHtml: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'row',
    gap: 0,
  },
  bodyFilesystem: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  bodyScratch: {
    flex: 1,
    overflow: 'hidden',
    padding: 16,
    display: 'flex',
  },
  bodyQuiz: {
    flex: 1,
    overflow: 'auto',
    padding: 16,
    display: 'flex',
    alignItems: 'flex-start',
  },
  bodyInformation: {
    flex: 1,
    overflow: 'hidden',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
  },
  htmlEditorPane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRight: '1px solid #e5e7eb',
  },
  iframePane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  tabBar: {
    display: 'flex',
    flexShrink: 0,
    borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb',
    overflowX: 'auto',
  },
  tab: {
    fontFamily: 'var(--font-code)',
    fontSize: '0.8rem',
    padding: '7px 14px',
    border: 'none',
    borderBottom: '2px solid transparent',
    background: 'transparent',
    color: '#6b7280',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  tabActive: {
    color: 'var(--colour-primary)',
    borderBottom: '2px solid var(--colour-primary)',
    background: '#fff',
    fontWeight: 600,
  },
  singleFileLabel: {
    fontFamily: 'var(--font-code)',
    fontSize: '0.78rem',
    color: '#6b7280',
    padding: '6px 12px',
    borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb',
    flexShrink: 0,
  },
  editorWrap: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  editorHighlightMode: {
    border: '1px solid rgba(37,99,235,0.5)',
    boxShadow: '0 0 0 2px rgba(37,99,235,0.15)',
  },
  highlightComposer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    background: '#eff6ff',
    borderBottom: '1px solid #bfdbfe',
    flexShrink: 0,
  },
  highlightEmojiRow: {
    display: 'flex',
    gap: 2,
  },
  highlightEmojiBtn: {
    border: '1px solid transparent',
    background: 'transparent',
    borderRadius: 6,
    fontSize: '1rem',
    padding: '2px 5px',
    cursor: 'pointer',
    lineHeight: 1,
  },
  highlightEmojiBtnActive: {
    border: '1px solid rgba(37,99,235,0.5)',
    background: 'rgba(37,99,235,0.1)',
  },
  highlightNoteInput: {
    flex: 1,
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    padding: '4px 8px',
    border: '1px solid #bfdbfe',
    borderRadius: 6,
  },
  submitNotice: {
    padding: '10px 14px',
    borderRadius: 8,
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    color: '#1e40af',
    fontWeight: 600,
    flexShrink: 0,
  },
}

const sEd = {
  waitingText: {
    fontFamily: 'var(--font-body)',
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontStyle: 'italic',
    whiteSpace: 'nowrap',
  },
  declinedNotice: {
    fontFamily: 'var(--font-body)',
    fontSize: 12,
    color: '#fca5a5',
    fontStyle: 'italic',
    whiteSpace: 'nowrap',
  },
}

const sTo = {
  toolBtn: {
    width: '100%',
    padding: '7px 12px',
    background: 'rgba(98,34,204,0.06)',
    color: 'var(--colour-primary-dark)',
    border: '1px solid rgba(98,34,204,0.18)',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
  },
}
