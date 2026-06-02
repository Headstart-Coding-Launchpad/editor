import React, { useEffect, useRef, useState } from 'react'
import { CodeEditor } from '../../shared/CodeEditor'
import OutputPanel from './OutputPanel'
import IframePreview from './IframePreview'
import ScratchWorkspace from './ScratchWorkspace'
import FilesystemTask from './FilesystemTask'
import { buildIframeSrc } from '../../shared/iframe'
import { decodeFileKey } from '../hooks/useSession'
import QuizTask from './QuizTask'
import ExplainerPanel from './ExplainerPanel'
import LiveActivityToast from './LiveActivityToast'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { decodeSessionFiles, parseScratchState } from '../../shared/workspaceData'
import { findTaskById } from '../../shared/taskUtils'
import { DEFAULT_FS } from '../../shared/filesystem'

function parseSpriteState(raw) {
  if (!raw) return null
  try {
    const parsed = typeof raw === 'object' ? raw : JSON.parse(raw)
    return parsed && typeof parsed === 'object' && 'x' in parsed && 'y' in parsed ? parsed : null
  } catch {
    return null
  }
}

export default function StudentModal({ student, lesson, session, isLive, isLiveForAll, onGoLive, onGoLiveForAll, onStopLive, onClose, hasPrev, hasNext, onPrev, onNext, onRemoteReset }) {
  const overlayRef = useRef(null)
  const iframeRef  = useRef(null)

  const isPython     = lesson?.type === 'python'
  const isScratch    = lesson?.type === 'scratch'
  const isFilesystem = lesson?.type === 'filesystem'
  const files = decodeSessionFiles(student.currentFiles, decodeFileKey, 'html')
  const task      = findTaskById(lesson?.tasks, session?.currentTaskId)
  const isQuiz    = task?.taskType === 'quiz'
  const isInformation = task?.taskType === 'information'
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
  const remoteSelection = !isLive || (!isPython && student.currentSelection?.file !== activeFile)
    ? null
    : student.currentSelection

  useEffect(() => {
    const liveFile = student.currentActiveFile ?? student.currentSelection?.file ?? student.currentActivity?.file
    if (!isLive || !liveFile || !files.some(file => file.name === liveFile)) return
    setActiveFile(liveFile)
  }, [isLive, student.currentActiveFile, student.currentSelection?.file, student.currentActivity?.file])

  const hasComplete = isQuiz
    ? false
    : isPython
    ? !!task?.completeCode
    : isScratch
    ? !!task?.completeBlocks
    : isFilesystem
    ? !!task?.completeFs
    : (task?.completeFiles?.length > 0)

  const codeStages = !isQuiz ? (task?.codeStages ?? []) : []

  function buildStageOptions() {
    const starterLabel = isScratch ? 'Starter blocks' : isFilesystem ? 'Starter folders' : 'Starter code'
    const completeLabel = isScratch ? 'Complete blocks' : isFilesystem ? 'Complete folders' : 'Complete code'
    const opts = [{ value: 'starter', label: starterLabel }]
    codeStages.forEach((stage, i) => {
      opts.push({ value: `stage_${i}`, label: stage.label || `Stage ${i + 1}` })
    })
    if (hasComplete) opts.push({ value: 'complete', label: completeLabel })
    return opts
  }

  const stageOptions = buildStageOptions()

  function handleSetToStage(action) {
    const opt = stageOptions.find(o => o.value === action)
    const label = opt?.label ?? action
    if (!window.confirm(`Set ${student.displayName}'s code to ${label}?`)) return
    onRemoteReset?.(student.anonymousId, action)
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      ref={overlayRef}
      style={s.overlay}
      onClick={e => { if (e.target === overlayRef.current) onClose?.() }}
      role="dialog"
      aria-modal="true"
    >
      <div style={s.modal}>
        {isLive && <LiveActivityToast activity={student.currentActivity} style={{ top: 86 }} />}
        {/* Modal header */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <span style={s.name}>{student.displayName}</span>
            <span
              className={student.online ? 'presence-badge presence-badge--online' : 'presence-badge presence-badge--offline'}
              title={student.online ? 'Student is connected now' : 'Student is offline'}
            >
              <span className="presence-badge__dot" />
              {student.online ? 'Online' : 'Offline'}
            </span>
            {isLive && <span style={s.liveBadge}>● {isLiveForAll ? 'LIVE FOR ALL' : 'LIVE'}</span>}
            {student.checkPassed && <span style={s.checkBadge}>✅</span>}
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
            {onRemoteReset && !isInformation && !isQuiz && stageOptions.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={s.setToLabel}>Set to</span>
                <select
                  style={s.setToSelect}
                  defaultValue=""
                  onChange={e => {
                    if (e.target.value) {
                      handleSetToStage(e.target.value)
                      e.target.value = ''
                    }
                  }}
                >
                  <option value="" disabled>Choose stage…</option>
                  {stageOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
            {!isInformation && !isQuiz && (
              isLive ? (
                <button
                  className="btn-danger"
                  style={{ fontSize: 13, padding: '5px 14px' }}
                  onClick={onStopLive}
                >
                  Stop Live
                </button>
              ) : (
                <>
                  <button
                    className="btn-primary"
                    style={{ fontSize: 13, padding: '5px 14px' }}
                    onClick={onGoLive}
                  >
                    Go live for me
                  </button>
                  <button
                    className="btn-primary"
                    style={{ fontSize: 13, padding: '5px 14px' }}
                    onClick={onGoLiveForAll}
                  >
                    Go live for all
                  </button>
                </>
              )
            )}
            <button
              className="btn-ghost"
              style={{ fontSize: 13, padding: '5px 10px' }}
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={isInformation ? s.bodyInformation : isQuiz ? s.bodyQuiz : isPython ? s.bodyPython : isScratch ? s.bodyScratch : isFilesystem ? s.bodyFilesystem : s.bodyHtml}>
          {isInformation ? (
            <ExplainerPanel title={task?.title} content={task?.explainer ?? ''} collapsible={false} fill topicType={lesson?.type} />
          ) : isQuiz ? (
            <QuizTask
              task={task}
              showQuestion
              selectedAnswer={student.currentAnswer ?? ''}
              submitted={student.lastRunStatus === 'submitted'}
              checkPassed={student.checkPassed}
              disabled
              showCorrectAnswer
            />
          ) : isPython ? (
            <>
              <div style={s.editorWrap}>
                 <CodeEditor
                   value={student.currentCode ?? ''}
                  language="python"
                  readOnly
                  remoteSelection={remoteSelection}
                  style={{ height: '100%' }}
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
          ) : isScratch ? (
            <ScratchWorkspace
              key={`student-scratch-${student.anonymousId}-${session?.currentTaskId}`}
              task={task}
              readOnly
              assetsPath={resolveAssetsPath(lesson?.assetsPath) || undefined}
              initialState={scratchState}
              externalState={scratchState}
              initialSpriteState={spriteState}
            />
          ) : isFilesystem ? (
            <FilesystemTask fs={studentFs} disabled />
          ) : (
            <>
              {/* Left: tabbed file editor */}
              <div style={s.htmlEditorPane}>
                {files.length > 1 && (
                  <div style={s.tabBar} className="ui-tabs">
                    {files.map(f => (
                      <button
                        key={f.name}
                        className={`ui-tab ui-tab--code${f.name === activeFile ? ' is-active' : ''}`}
                        style={{ ...s.tab, ...(f.name === activeFile ? s.tabActive : {}) }}
                        onClick={() => setActiveFile(f.name)}
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                )}
                {files.length === 1 && (
                  <div style={s.singleFileLabel}>{files[0]?.name}</div>
                )}
                <div style={s.editorWrap}>
                  {activeFileObj && (
                     <CodeEditor
                       key={activeFileObj.name}
                       value={activeFileObj.content}
                      language={activeFileObj.type}
                      readOnly
                      remoteSelection={remoteSelection}
                      style={{ height: '100%' }}
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
          )}
        </div>
      </div>
    </div>
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
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8 },
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
  },
  liveBadge: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.78rem',
    color: '#86efac',
    letterSpacing: '0.05em',
  },
  checkBadge: { fontSize: '1rem' },
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
  teacherActionBtn: {
    fontSize: 12,
    padding: '4px 10px',
    background: 'rgba(253,211,77,0.15)',
    color: '#fde68a',
    border: '1px solid rgba(253,211,77,0.4)',
    borderRadius: 5,
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  teacherActionBtnComplete: {
    background: 'rgba(134,239,172,0.15)',
    color: '#86efac',
    border: '1px solid rgba(134,239,172,0.4)',
  },
  setToLabel: {
    fontFamily: 'var(--font-body)',
    fontSize: 12,
    fontWeight: 600,
    color: '#fde68a',
    whiteSpace: 'nowrap',
  },
  setToSelect: {
    fontSize: 12,
    padding: '3px 8px',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: 5,
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
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
