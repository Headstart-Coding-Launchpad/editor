import React, { useEffect, useRef, useState } from 'react'
import { CodeEditor } from '../../../shared/CodeEditor'
import ExplainerPanel from '../ExplainerPanel'
import IframePreview from '../IframePreview'
import OutputPanel from '../OutputPanel'
import { ActivityView } from '../../../activities/ActivityHost.jsx'
import { getTaskActivity } from '../../../activities/registry.pure.js'
import { getModuleHostedActivityUi } from '../../../activities/registry.js'
import { readActivityAnswer, studentStateField } from '../../../activities/state.js'
import { HIGHLIGHT_EMOJI_OPTIONS } from './constants'

function answerKey(value) {
  return typeof value === 'string' ? value : JSON.stringify(value ?? null)
}

// While the teacher is editing a student's answer, show the teacher's own
// latest edit immediately instead of waiting for it to round-trip through
// Firebase (which would make typed Fill in the Gaps answers drop keystrokes).
// A remote value the teacher didn't push is the student changing it
// themselves — last write wins, so it replaces the teacher's local copy.
function useTeacherEditableValue(remoteValue, editing) {
  const [local, setLocal] = useState(null)
  const pushedKeysRef = useRef(new Set())
  useEffect(() => {
    if (!editing) {
      setLocal(null)
      pushedKeysRef.current.clear()
    }
  }, [editing])
  const remoteKey = answerKey(remoteValue)
  useEffect(() => {
    if (pushedKeysRef.current.has(remoteKey)) return
    setLocal(null)
  }, [remoteKey])
  function push(value) {
    const keys = pushedKeysRef.current
    keys.add(answerKey(value))
    if (keys.size > 50) keys.delete(keys.values().next().value)
    setLocal({ value })
  }
  return [local ? local.value : remoteValue, push]
}

export default function StudentWorkspaceBody({
  lesson,
  task,
  student,
  session,
  isInformation,
  isQuiz,
  isActivity = false,
  activityState = null,
  isSessionSandbox,
  // How the student's work is mirrored — the module's capabilities.studentMirror ('code',
  // 'files', 'blocks' or 'view'), null when no module applies. 'blocks' and 'view' render the
  // module's own TeacherLiveView (ModuleTeacherLiveView) with the Scratch mirrors or the
  // module display state respectively.
  mirror = null,
  isCodeArrangeTask,
  ModuleTeacherLiveView,
  moduleDisplayState,
  files,
  activeFile,
  setActiveFile,
  activeFileObj,
  remoteSelection,
  scratchState,
  spriteState,
  cursorState,
  blockDragState,
  iframeSrc,
  iframeRef,
  canHighlight,
  pendingHighlight,
  highlights,
  onMirrorSelectionChange,
  onDismissHighlight,
  highlightEmoji,
  onHighlightEmojiChange,
  highlightNote,
  onHighlightNoteChange,
  onSendHighlight,
  onCancelHighlight,
  answerEditing = false,
  onEditAnswer,
}) {
  const [editableAnswer, pushEditableAnswer] = useTeacherEditableValue(
    student.currentAnswer ?? '',
    answerEditing
  )
  const [editableSlots, pushEditableSlots] = useTeacherEditableValue(
    student.currentCodeArrangeSlots ?? null,
    answerEditing
  )
  // Teacher edits of an activity chain on the latest edited state, not the last render's, so
  // an activity UI that updates several times in one event never loses a step.
  const activityEditRef = useRef(null)

  const highlightComposer = canHighlight && (
    <div style={s.highlightComposer}>
      <div style={s.highlightEmojiRow}>
        {HIGHLIGHT_EMOJI_OPTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            style={{
              ...s.highlightEmojiBtn,
              ...(emoji === highlightEmoji ? s.highlightEmojiBtnActive : {}),
            }}
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
        onChange={(e) => onHighlightNoteChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && pendingHighlight) onSendHighlight()
        }}
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
        <button
          className="btn-ghost"
          style={{ fontSize: 12, padding: '4px 10px' }}
          onClick={onCancelHighlight}
        >
          Clear
        </button>
      )}
    </div>
  )

  if (isInformation)
    return (
      <ExplainerPanel
        title={task?.title}
        content={task?.explainer ?? ''}
        collapsible={false}
        fill
        topicType={lesson?.type}
      />
    )

  // Quizzes and activities: the student's mirrored answer, read-only, or editable with
  // "Edit answers" (pushed live, see pushTeacherAnswerEdit).
  if ((isQuiz && !isSessionSandbox) || isActivity) {
    const definition = getTaskActivity(task)
    const shownState = answerEditing
      ? readActivityAnswer(task, editableAnswer)
      : (activityState ?? readActivityAnswer(task, student.currentAnswer ?? ''))
    activityEditRef.current = shownState
    // A partial edit just updates the student's state, like dragging one quiz tile. It is
    // marked on the student's screen when it is final: a passing change for activities, or
    // the verdict the quiz UI gives an answer it submits (`submitsAnswers`: true / false when
    // every tile is placed, none — so unmarked — for a chosen option).
    const pushEdit = (update, final, verdict) => {
      if (!definition) return
      const prev = activityEditRef.current
      const next = typeof update === 'function' ? update(prev) : update
      if (next == null || (!final && next === prev)) return
      activityEditRef.current = next
      const serialized = definition.serialize(next)
      pushEditableAnswer(serialized)
      let passed = null
      if (final) passed = verdict
      else if (
        !definition.submitsAnswers &&
        definition.isGraded(task) &&
        definition.grade(task, next).passed
      )
        passed = true
      onEditAnswer?.({ answer: serialized, passed })
    }
    return (
      <ActivityView
        task={task}
        state={shownState}
        teacher
        readOnly={!answerEditing}
        lessonType={lesson?.type}
        result={{ submitted: student.lastRunStatus === 'submitted', passed: student.checkPassed }}
        onChange={(update) => pushEdit(update, false)}
        onSubmit={
          definition?.submitsAnswers
            ? (next, meta) => pushEdit(next ?? activityEditRef.current, true, meta?.passedOverride)
            : undefined
        }
      />
    )
  }

  // A module-hosted activity (code_arrange): its TeacherLiveView shows the watched student's
  // board from the live slot mirror (students/{id}/current<liveChannel>), or from the teacher's
  // own edits while editing the student's answer.
  if (isCodeArrangeTask) {
    const moduleActivity = getModuleHostedActivityUi(task)
    const TeacherLiveView = moduleActivity?.TeacherLiveView
    if (TeacherLiveView) {
      return (
        <TeacherLiveView
          task={task}
          student={student}
          mirror={mirror}
          files={files}
          slots={answerEditing ? editableSlots : student[studentStateField(moduleActivity)]}
          iframeSrc={iframeSrc}
          iframeRef={iframeRef}
          onEditSlots={
            answerEditing
              ? (next) => {
                  pushEditableSlots(next)
                  onEditAnswer?.({ [moduleActivity.liveChannel]: next })
                }
              : undefined
          }
        />
      )
    }
  }

  if (mirror === 'code')
    return (
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
        {task?.interactionMode === 'submit' && !isSessionSandbox ? (
          <div style={s.submitNotice}>
            {student.lastRunStatus === 'submitted' ? 'Code submitted' : 'Waiting for submission'}
          </div>
        ) : (
          <OutputPanel
            output={student.currentOutput ?? ''}
            runStatus={student.lastRunStatus}
            hasCheck={!!task?.check && !isSessionSandbox}
            checkPassed={student.checkPassed}
            inputPrompt={student.currentInputPrompt ?? null}
            inputReadOnly
            mirroredInputValue={student.currentInput ?? ''}
            // The teacher opened this modal to watch the student, so the
            // student's run output should appear without an extra click.
            openOnOutput
          />
        )}
      </>
    )

  if (mirror === 'blocks' && ModuleTeacherLiveView) {
    return (
      <ModuleTeacherLiveView
        key={`student-scratch-${student.anonymousId}-${session?.currentTaskId}`}
        task={task}
        lesson={lesson}
        readOnly
        scratchState={scratchState}
        spriteState={spriteState}
        cursorState={cursorState}
        blockDragState={blockDragState}
        isSessionSandbox={isSessionSandbox}
      />
    )
  }

  if (mirror === 'view' && ModuleTeacherLiveView) {
    return (
      <ModuleTeacherLiveView
        task={task}
        lesson={lesson}
        student={student}
        displayState={moduleDisplayState}
        liveState={moduleDisplayState}
        readOnly
        onChange={undefined}
        onActivity={undefined}
        isInSandbox={false}
        activeStage={null}
      />
    )
  }

  if (mirror === 'files')
    return (
      <>
        <div style={s.htmlEditorPane}>
          {files.length > 1 && (
            <div style={s.tabBar} className="ui-tabs">
              {files.map((f) => (
                <button
                  key={f.name}
                  className={`ui-tab ui-tab--code${f.name === activeFile ? ' is-active' : ''}`}
                  style={{ ...s.tab, ...(f.name === activeFile ? s.tabActive : {}) }}
                  onClick={() => {
                    onCancelHighlight?.()
                    setActiveFile(f.name)
                  }}
                >
                  {f.name}
                </button>
              ))}
            </div>
          )}
          {files.length === 1 && <div style={s.singleFileLabel}>{files[0]?.name}</div>}
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

  return null
}

const s = {
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
