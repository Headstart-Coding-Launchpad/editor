import React, { useEffect, useRef, useState, useCallback } from 'react'
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

function parseSpriteState(raw) {
  if (!raw) return null
  try {
    const parsed = typeof raw === 'object' ? raw : JSON.parse(raw)
    return parsed && typeof parsed === 'object' && 'x' in parsed && 'y' in parsed ? parsed : null
  } catch {
    return null
  }
}

export default function StudentModal({ student, lesson, session, topics, isLive, isLiveForAll, onGoLive, onGoLiveForAll, onStopLive, onClose, hasPrev, hasNext, onPrev, onNext, onRemoteReset, onOverrideCheck, onSendToTopic }) {
  const overlayRef = useRef(null)
  const iframeRef  = useRef(null)

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

  const [overrideSelection, setOverrideSelection] = useState(null) // null | true | false
  const [overrideHint, setOverrideHint] = useState('')
  const hasOverride = !!student.checkOverridePushedAt
  const remoteSelection = !isLive || (!isPython && student.currentSelection?.file !== activeFile)
    ? null
    : student.currentSelection

  useEffect(() => {
    const liveFile = student.currentActiveFile ?? student.currentSelection?.file ?? student.currentActivity?.file
    if (!isLive || !liveFile || !files.some(file => file.name === liveFile)) return
    setActiveFile(liveFile)
  }, [isLive, student.currentActiveFile, student.currentSelection?.file, student.currentActivity?.file])

  const stageOptions = buildStageOptions(task, lesson?.type)

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
            <PresenceBadge student={student} session={session} />
            {isLive && <span style={s.liveBadge}>● {isLiveForAll ? 'LIVE FOR ALL' : 'LIVE'}</span>}
            {student.checkPassed && <span style={s.checkBadge}>✅</span>}
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
            {onOverrideCheck && task?.check != null && (
              <div style={s.overrideWrap}>
                <div style={s.overrideToggleRow}>
                  <span style={s.setToLabel}>Override</span>
                  <button
                    style={{ ...s.overrideBtn, ...(overrideSelection === true ? s.overrideBtnPassActive : {}) }}
                    onClick={() => setOverrideSelection(v => v === true ? null : true)}
                  >Pass</button>
                  <button
                    style={{ ...s.overrideBtn, ...(overrideSelection === false ? s.overrideBtnFailActive : {}) }}
                    onClick={() => setOverrideSelection(v => v === false ? null : false)}
                  >Fail</button>
                  {overrideSelection !== null && (
                    <button
                      style={s.overrideApplyBtn}
                      onClick={() => {
                        onOverrideCheck(student.anonymousId, overrideSelection, overrideSelection ? null : (overrideHint || null))
                        setOverrideSelection(null)
                        setOverrideHint('')
                      }}
                    >Apply</button>
                  )}
                  {hasOverride && (
                    <span style={s.overrideBadge}>
                      {student.checkOverridePassed ? 'Overridden: Passed' : 'Overridden: Failed'}
                    </span>
                  )}
                </div>
                {overrideSelection === false && (
                  <textarea
                    style={s.overrideHintInput}
                    placeholder="Optional hint for student…"
                    value={overrideHint}
                    onChange={e => setOverrideHint(e.target.value)}
                    rows={2}
                  />
                )}
              </div>
            )}
            {onSendToTopic && topics?.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={s.setToLabel}>Send to topic</span>
                <select
                  style={s.setToSelect}
                  defaultValue=""
                  onChange={e => {
                    if (e.target.value) {
                      onSendToTopic(student.anonymousId, e.target.value)
                      e.target.value = ''
                    }
                  }}
                >
                  <option value="" disabled>Choose topic…</option>
                  {topics.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
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
        <div style={isInformation ? s.bodyInformation : (isQuiz && !isSessionSandbox) ? s.bodyQuiz : isPython ? s.bodyPython : isScratch ? s.bodyScratch : isFilesystem ? s.bodyFilesystem : s.bodyHtml}>
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
          />
        </div>
      </div>
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
}) {
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
  overrideWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  overrideToggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  overrideBtn: {
    fontSize: 11,
    padding: '3px 8px',
    background: 'rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.8)',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  overrideBtnPassActive: {
    background: 'rgba(34,197,94,0.3)',
    color: '#86efac',
    border: '1px solid rgba(34,197,94,0.5)',
  },
  overrideBtnFailActive: {
    background: 'rgba(239,68,68,0.3)',
    color: '#fca5a5',
    border: '1px solid rgba(239,68,68,0.5)',
  },
  overrideApplyBtn: {
    fontSize: 11,
    padding: '3px 8px',
    background: 'rgba(253,211,77,0.2)',
    color: '#fde68a',
    border: '1px solid rgba(253,211,77,0.4)',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  overrideBadge: {
    fontSize: 10,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.6)',
    whiteSpace: 'nowrap',
    paddingLeft: 4,
  },
  overrideHintInput: {
    fontSize: 11,
    padding: '4px 8px',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: 4,
    fontFamily: 'var(--font-body)',
    resize: 'vertical',
    width: '100%',
    boxSizing: 'border-box',
    minWidth: 180,
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
