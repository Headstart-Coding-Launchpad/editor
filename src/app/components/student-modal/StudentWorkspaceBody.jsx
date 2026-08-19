import React from 'react'
import { CodeEditor } from '../../../shared/CodeEditor'
import ScratchTeacherLiveView from '../../../modules/scratch/TeacherLiveView.jsx'
import ExplainerPanel from '../ExplainerPanel'
import IframePreview from '../IframePreview'
import OutputPanel from '../OutputPanel'
import QuizTask from '../QuizTask'
import { HIGHLIGHT_EMOJI_OPTIONS } from './constants'

export default function StudentWorkspaceBody({
  lesson, task, student, session,
  isInformation, isQuiz, isSessionSandbox, isPython, isScratch, isHtml,
  ModuleTeacherLiveView, moduleDisplayState,
  files, activeFile, setActiveFile, activeFileObj,
  remoteSelection, scratchState, spriteState, cursorState, blockDragState,
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

  if (isScratch) {
    return (
      <ScratchTeacherLiveView
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

  if (ModuleTeacherLiveView) {
    return (
      <ModuleTeacherLiveView
        task={task} lesson={lesson}
        student={student}
        displayState={moduleDisplayState} liveState={moduleDisplayState}
        readOnly onChange={undefined} onActivity={undefined}
        isInSandbox={false} activeStage={null}
      />
    )
  }

  if (isHtml) return (
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
