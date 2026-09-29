import { useRemoteRunTrigger } from '../../shared/useRemoteRunTrigger'
import definition from './definition.js'

// The student's Template Module workspace, rendered by LessonTaskContent with the classroom state
// hook as `cs` (src/app/hooks/useStudentCodeState.js). It never writes to Firebase or storage
// itself: every change goes through `cs`, which saves locally, mirrors to a watching teacher
// only while this student is watched, and checks the work.
//
// TODO(new-module): replace the textarea with the real workspace. Keep:
// - edits → cs.handleCodeChange(next) (a code-string work slot; structured work uses
//   cs.handleWorkChange(next, { moduleType: task module }))
// - the check → cs.handleWorkspaceRun(work) (capabilities.run 'workspace'); a 'runtime' module
//   uses cs.handleRun / cs.handleStop instead
// - read-only while viewing an earlier task, during a forced teacher broadcast and while the
//   teacher is editing; controls at least 44px, keyboard reachable (docs/UI_STYLE_GUIDE.md).
export default function StudentWorkspace({
  task,
  cs,
  viewingTaskId,
  isViewingPrev,
  isForcedTeacherLive,
  isTeacherEditing,
  displayCode,
  teacherLiveCode,
}) {
  const readOnly = isViewingPrev || isForcedTeacherLive || isTeacherEditing
  const work = isForcedTeacherLive
    ? (displayCode ?? '')
    : isTeacherEditing
      ? (teacherLiveCode ?? '')
      : isViewingPrev
        ? (cs.readSavedTaskWork(definition.type, viewingTaskId) ?? task?.starterCode ?? '')
        : cs.code

  function check() {
    if (!readOnly) cs.handleWorkspaceRun(work)
  }

  // A teacher's "Run on student" behaves exactly like the student pressing Check.
  useRemoteRunTrigger(cs.remoteRunToken, check, {
    enabled: !readOnly,
    onHandled: cs.acknowledgeRemoteRun,
  })

  return (
    <div style={s.wrap}>
      <label style={s.label} htmlFor="template-module-work">
        Your work
      </label>
      <textarea
        id="template-module-work"
        style={s.textarea}
        value={work}
        readOnly={readOnly}
        spellCheck={false}
        onChange={(event) => cs.handleCodeChange(event.target.value)}
      />
      <div style={s.actions}>
        <button type="button" className="btn-primary" onClick={check} disabled={readOnly}>
          Check
        </button>
        {!readOnly && (
          <button type="button" className="btn-secondary" onClick={() => cs.handleResetCode()}>
            Reset
          </button>
        )}
      </div>
    </div>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 },
  label: { fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--colour-primary)' },
  textarea: {
    minHeight: 220,
    padding: 12,
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: 15,
    border: '1px solid var(--colour-border, #cbd5e1)',
    borderRadius: 8,
    resize: 'vertical',
  },
  actions: { display: 'flex', gap: 8 },
}
