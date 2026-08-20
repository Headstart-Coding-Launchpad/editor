import React, { useEffect, useRef, useState, useMemo } from 'react'
import { CodeEditor } from '../../shared/CodeEditor'
import { decodeFileKey } from '../../shared/fileKeys'
import LiveActivityToast from './LiveActivityToast'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { decodeSessionFiles, parseScratchState } from '../../shared/workspaceData'
import { findTaskById, deriveTaskContext, buildStageOptions, getCompleteStage, getRevealableStages } from '../../shared/taskUtils'
import PresenceBadge from './PresenceBadge'
import ScratchWorkspace from '../../modules/scratch/ScratchWorkspace.jsx'
import HtmlTeacherLiveView from '../../modules/html/TeacherLiveView.jsx'
import ArcadeTeacherLiveView from '../../modules/arcade/TeacherLiveView.jsx'
import ElectronicsTeacherLiveView from '../../modules/electronics/TeacherLiveView.jsx'
import { TopicLibraryDialog } from '../../shared/TopicLibraryView'
import { MarkdownRenderer } from '../../shared/markdown'
import { getLessonModule } from '../../modules/registry'
import { getEffectiveLessonForTask } from '../../shared/composedLesson'
import DropdownMenu from './student-modal/DropdownMenu'
import MessageCompose from './student-modal/MessageCompose'
import OverrideDropdown from './student-modal/OverrideDropdown'
import StageDropdown from './student-modal/StageDropdown'
import StudentWorkspaceBody from './student-modal/StudentWorkspaceBody'
import { HIGHLIGHT_EMOJI_OPTIONS } from './student-modal/constants'

function getModuleDisplayState(module, raw) {
  if (!module) return null
  if (raw != null && raw !== '') return module.deserializeState ? module.deserializeState(raw) : raw
  return module.defaultState ?? null
}

// ─── Main modal ──────────────────────────────────────────────────────────────

export default function StudentModal({ student, lesson, session, topics, isLive, isLiveForAll, onGoLive, onGoLiveForAll, onStopLive, onClose, hasPrev, hasNext, onPrev, onNext, onRemoteReset, onOverrideCheck, onDismissHelp, onSendToTopic, onSendTopicToAll, onSendMessage, onRequestTeacherEdit, onPushTeacherLiveCode, onCommitTeacherEdit, onCancelTeacherEdit, onRequestTeacherStage, onClearTeacherStage, onAddHighlight, onRemoveHighlight, onRevealSupportStage }) {
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
  const [teacherFiles, setTeacherFiles] = useState([])
  const [teacherArcadeDesign, setTeacherArcadeDesign] = useState(null)
  const [teacherWorkspace, setTeacherWorkspace] = useState('code')
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
        setTeacherFiles(files)
        setTeacherArcadeDesign(student.currentArcadeDesign ?? null)
        setTeacherWorkspace(isElectronics ? 'breadboard' : 'code')
        if (isScratch) {
          setTeacherScratchState(parseScratchState(initialCode))
        }
        setTeacherEditState('editing')
        setDeclinedNotice(false)
        onPushTeacherLiveCode?.(student.anonymousId, isHtml
          ? { files, activeFile: files[0]?.name ?? null }
          : isArcade
            ? { code: initialCode, arcadeDesign: student.currentArcadeDesign ?? null, workspace: 'code' }
            : isElectronics
              ? { code: initialCode, workspace: 'breadboard' }
              : { code: initialCode })
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
    setTeacherFiles([])
    setTeacherArcadeDesign(null)
    setTeacherWorkspace('code')
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
      onPushTeacherLiveCode?.(student.anonymousId, { code: newCode })
    }, 120)
  }

  function handleScratchStateChange(workspaceStates) {
    setTeacherScratchState(workspaceStates)
    clearTimeout(pushDebounceRef.current)
    pushDebounceRef.current = setTimeout(() => {
      onPushTeacherLiveCode?.(student.anonymousId, { code: JSON.stringify(workspaceStates) })
    }, 300)
  }

  function handleTeacherFileChange(filename, content) {
    const nextFiles = teacherFiles.map(file => file.name === filename ? { ...file, content } : file)
    setTeacherFiles(nextFiles)
    clearTimeout(pushDebounceRef.current)
    pushDebounceRef.current = setTimeout(() => {
      onPushTeacherLiveCode?.(student.anonymousId, { files: nextFiles })
    }, 120)
  }

  function handleTeacherHtmlTabChange(activeFile) {
    onPushTeacherLiveCode?.(student.anonymousId, { activeFile })
  }

  function handleTeacherWorkspaceChange(workspace) {
    setTeacherWorkspace(workspace)
    onPushTeacherLiveCode?.(student.anonymousId, { workspace })
  }

  function handleTeacherArcadeDesignChange(nextDesign) {
    setTeacherArcadeDesign(nextDesign)
    clearTimeout(pushDebounceRef.current)
    pushDebounceRef.current = setTimeout(() => {
      onPushTeacherLiveCode?.(student.anonymousId, { arcadeDesign: nextDesign })
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
      onCommitTeacherEdit?.(student.anonymousId, { code: JSON.stringify(teacherScratchState) })
      setTeacherScratchState(null)
    } else if (isHtml) {
      onCommitTeacherEdit?.(student.anonymousId, { files: teacherFiles })
      setTeacherFiles([])
    } else if (isArcade) {
      onCommitTeacherEdit?.(student.anonymousId, { code: teacherCode, arcadeDesign: teacherArcadeDesign })
      setTeacherArcadeDesign(null)
    } else {
      onCommitTeacherEdit?.(student.anonymousId, { code: teacherCode })
    }
    setTeacherEditState('idle')
    setTeacherCode('')
    setTeacherWorkspace('code')
  }

  function handleCancelEdit() {
    clearTimeout(pushDebounceRef.current)
    onCancelTeacherEdit?.(student.anonymousId)
    setTeacherEditState('idle')
    setTeacherCode('')
    setTeacherFiles([])
    setTeacherArcadeDesign(null)
    setTeacherWorkspace('code')
    setTeacherScratchState(null)
  }

  function handleRequestStage(action) {
    onRequestTeacherStage?.(student.anonymousId, action)
    setStagePendingAction(action)
    setStageRequestState('requesting')
    setStageDeclinedNotice(false)
  }

  function handleRevealSupportStage(stageIndex, stage) {
    if (!task?.id) return
    onRevealSupportStage?.(student.anonymousId, task.id, stageIndex, {
      source: 'teacher',
      stageLabel: stage?.label || `Stage ${stageIndex + 1}`,
    })
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
  const taskLesson = getEffectiveLessonForTask(lesson, task)
  const { isPython, isScratch, isFilesystem, isHtml, isQuiz, isInformation, isSessionSandbox } = deriveTaskContext(taskLesson, task, session)
  const isCodeArrangeTask = task?.taskType === 'code_arrange' && !isSessionSandbox
  const isArcade = taskLesson?.type === 'arcade'
  const isElectronics = taskLesson?.type === 'electronics'
  const supportsTeacherEdit = isPython || isScratch || isHtml || isArcade || isElectronics
  const lessonModule = getLessonModule(taskLesson?.type)
  const ModuleTeacherLiveView = !isPython && !isScratch && !isHtml ? lessonModule?.TeacherLiveView : null
  const scratchState = isScratch ? parseScratchState(student.currentCode) : null
  const spriteState = isScratch ? (student.currentSpriteState ?? null) : null
  const cursorState = isScratch ? (student.currentCursor ?? null) : null
  const blockDragState = isScratch ? (student.currentBlockDrag ?? null) : null
  const moduleDisplayState = ModuleTeacherLiveView
    ? getModuleDisplayState(lessonModule, student.currentCode)
    : null
  const iframeSrc = isHtml && !isQuiz && files.length
    ? getLessonModule('html').runtime.buildPreviewSrc({ files, entryFile: task?.entryFile ?? 'index.html' }, task)
    : null

  const [activeFile, setActiveFile] = useState(task?.entryFile ?? files[0]?.name ?? '')
  const activeFileObj = files.find(f => f.name === activeFile) ?? files[0]

  const hasOverride = !!student.checkOverridePushedAt
  const remoteSelection = !isLive || (!isPython && student.currentSelection?.file !== activeFile)
    ? null
    : student.currentSelection

  const canHighlight = isLive && !isInformation && !isQuiz && !isCodeArrangeTask && (isPython || isHtml) && !isScratch && !isFilesystem && teacherEditState === 'idle'
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

  const stageOptions = buildStageOptions(task, taskLesson?.type)
  const supportsStageReveal = isPython || isHtml || taskLesson?.type === 'arcade' || taskLesson?.type === 'electronics' || taskLesson?.type === 'scratch'
  const revealableStages = !isInformation && !isQuiz && supportsStageReveal ? getRevealableStages(task) : []
  const completeStage = !isInformation && !isQuiz && supportsStageReveal ? getCompleteStage(task) : null
  const revealedSupportStages = session?.supportRevealLog?.[student.anonymousId]?.[task?.id] ?? {}

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
            {Object.keys(revealedSupportStages).length > 0 && (
              <span style={s.supportBadge} title="Student has opened a stage reference">
                Reference opened
              </span>
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

            {/* Stage reference reveal dropdown */}
            {onRevealSupportStage && revealableStages.length > 0 && (
              <DropdownMenu label="Reveal" buttonClassName="btn-ghost">
                {close => (
                  <>
                    {revealableStages.map(({ stage, index }) => {
                      const alreadyRevealed = !!revealedSupportStages[index]
                      return (
                        <button
                          key={index}
                          style={sTo.toolBtn}
                          disabled={alreadyRevealed}
                          onClick={() => {
                            close()
                            handleRevealSupportStage(index, stage)
                          }}
                        >
                          {alreadyRevealed ? 'Opened: ' : 'Reveal: '}{stage.label || `Stage ${index + 1}`}
                        </button>
                      )
                    })}
                    {completeStage && (
                      <button
                        style={sTo.toolBtn}
                        onClick={() => {
                          close()
                          onRemoteReset?.(student.anonymousId, `reveal_stage_${completeStage.index}`)
                        }}
                      >
                        Reveal solution: {completeStage.stage.label || 'Complete'}
                      </button>
                    )}
                  </>
                )}
              </DropdownMenu>
            )}

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
            {onRequestTeacherEdit && supportsTeacherEdit && !isInformation && !isQuiz && teacherEditState === 'editing' && (
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
            {onRequestTeacherEdit && supportsTeacherEdit && !isInformation && !isQuiz && teacherEditState === 'requesting' && (
              <>
                <span style={sEd.waitingText}>Waiting for {student.displayName}…</span>
                <button className="btn-ghost" style={{ fontSize: 13, padding: '5px 10px' }} onClick={handleCancelEdit}>
                  Cancel
                </button>
              </>
            )}

            {/* Declined notice */}
            {onRequestTeacherEdit && supportsTeacherEdit && !isInformation && !isQuiz && declinedNotice && (
              <span style={sEd.declinedNotice}>Student declined</span>
            )}

            {/* More dropdown: topic, message, edit code — grouped when idle */}
            {teacherEditState === 'idle' && (() => {
              const hasEdit = !!(onRequestTeacherEdit && supportsTeacherEdit && !isInformation && !isQuiz)
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
        <div style={isInformation ? s.bodyInformation : (isQuiz && !isSessionSandbox) ? s.bodyQuiz : isCodeArrangeTask ? s.bodyCodeArrange : isPython ? s.bodyPython : isScratch ? s.bodyScratch : ModuleTeacherLiveView ? s.bodyFilesystem : s.bodyHtml}>
          {teacherEditState === 'editing' && isScratch ? (
            <ScratchWorkspace
              key={`teacher-edit-scratch-${student.anonymousId}-${session?.currentTaskId}`}
              task={task}
              readOnly={false}
              assetsPath={resolveAssetsPath(lesson?.assetsPath) || undefined}
              initialState={parseScratchState(student.currentCode)}
              onStateChange={handleScratchStateChange}
            />
          ) : teacherEditState === 'editing' && isHtml ? (
            <HtmlTeacherLiveView
              lesson={taskLesson}
              displayState={{ files: teacherFiles }}
              readOnly={false}
              onChange={handleTeacherFileChange}
              onTabChange={handleTeacherHtmlTabChange}
            />
          ) : teacherEditState === 'editing' && isArcade ? (
            <ArcadeTeacherLiveView
              task={task}
              student={student}
              displayState={teacherCode}
              design={teacherArcadeDesign}
              activeWorkspace={teacherWorkspace}
              readOnly={false}
              onChange={handleTeacherCodeChange}
              onDesignChange={handleTeacherArcadeDesignChange}
              onWorkspaceChange={handleTeacherWorkspaceChange}
            />
          ) : teacherEditState === 'editing' && isElectronics ? (
            <ElectronicsTeacherLiveView
              task={task}
              displayState={teacherCode}
              readOnly={false}
              onChange={handleTeacherCodeChange}
              onTabChange={handleTeacherWorkspaceChange}
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
              lesson={taskLesson}
              task={task}
              student={student}
              session={session}
              isInformation={isInformation}
              isQuiz={isQuiz}
              isSessionSandbox={isSessionSandbox}
              isPython={isPython}
              isScratch={isScratch}
              isHtml={isHtml}
              isCodeArrangeTask={isCodeArrangeTask}
              ModuleTeacherLiveView={ModuleTeacherLiveView}
              moduleDisplayState={moduleDisplayState}
              files={files}
              activeFile={activeFile}
              setActiveFile={setActiveFile}
              activeFileObj={activeFileObj}
              remoteSelection={remoteSelection}
              scratchState={scratchState}
              spriteState={spriteState}
              cursorState={cursorState}
              blockDragState={blockDragState}
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
  supportBadge: {
    fontSize: '0.72rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    color: '#bfdbfe',
    whiteSpace: 'nowrap',
    background: 'rgba(37,99,235,0.24)',
    border: '1px solid rgba(191,219,254,0.45)',
    padding: '2px 7px',
    borderRadius: 999,
  },
  bodyPython: {
    flex: 1,
    overflow: 'hidden',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  bodyCodeArrange: {
    flex: 1,
    overflow: 'auto',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
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
  editorWrap: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
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
