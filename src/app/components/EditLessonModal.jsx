import React, { useState } from 'react'
import { useBuilderState } from '../../builder/hooks/useBuilderState'
import TaskList from '../../builder/components/TaskList'
import TaskEditor from '../../builder/components/TaskEditor'
import GroupEditor from '../../builder/components/GroupEditor'
import ValidationPanel from '../../builder/components/ValidationPanel'
import { normalizeTasksForExport } from '../../builder/lessonUtils'
import { applyTaskUpdate } from '../../shared/taskUtils'
import { useTypeAssets } from '../../shared/useTypeAssets'

// Reuses the builder's task-editing components (TaskList, TaskEditor,
// GroupEditor, useBuilderState) inside a modal so teachers/admins can edit a
// lesson's tasks without leaving TeacherView. Edits are staged in local
// `draftLesson` state and only take effect when explicitly saved.
export default function EditLessonModal({
  lesson, role, currentTaskId,
  onApplySession, onSavePermanent, onResetToOriginal, onClose,
}) {
  const [draftLesson, setDraftLesson] = useState(() => lesson)
  const [saving, setSaving] = useState(false)
  const { defaultSprites } = useTypeAssets(draftLesson.type === 'scratch' ? 'scratch' : null)

  const {
    selectedTaskId,
    selectedGroupId,
    selectTask,
    selectGroup,
    handleLessonUpdate,
    handleAddTask,
    handleAddGroup,
    handleAddSubtask,
    handleDuplicate,
    handleDelete,
    handleDeleteGroup,
    handleReorder,
    handleReorderSubtask,
    errors,
    warnings,
    selectedTask,
    selectedGroup,
    lessonForEditor,
    selectedTaskGroup,
  } = useBuilderState({ lesson: draftLesson, onUpdate: setDraftLesson, defaultSprites })

  // Extra warning when deleting the task students are currently on — the
  // live session's currentTaskId would no longer resolve to a real task.
  function confirmIfActiveTask(taskId) {
    if (taskId !== currentTaskId) return true
    return confirm(
      'This is the task students are currently on — deleting it will leave ' +
      'their screen blank until you move the session to another task.\n\nDelete anyway?'
    )
  }

  function guardedDelete(taskId) {
    if (!confirmIfActiveTask(taskId)) return
    handleDelete(taskId)
  }

  function guardedDeleteGroup(groupId) {
    const group = draftLesson.tasks.find(t => t.type === 'group' && t.id === groupId)
    const containsActiveTask = (group?.subtasks ?? []).some(t => t.id === currentTaskId)
    if (containsActiveTask && !confirmIfActiveTask(currentTaskId)) return
    handleDeleteGroup(groupId)
  }

  function validateBeforeSave() {
    if (errors.length) {
      alert('Cannot save — please fix these errors:\n\n' + errors.join('\n'))
      return false
    }
    if (warnings.length) {
      return confirm('Warnings:\n\n' + warnings.join('\n') + '\n\nSave anyway?')
    }
    return true
  }

  async function handleApplySession() {
    if (!validateBeforeSave()) return
    setSaving(true)
    try {
      await onApplySession(normalizeTasksForExport(draftLesson.tasks, { preserveIds: true }))
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePermanent() {
    if (!validateBeforeSave()) return
    setSaving(true)
    try {
      await onSavePermanent(normalizeTasksForExport(draftLesson.tasks, { preserveIds: true }))
      onClose()
    } catch (err) {
      alert('Failed to save permanently: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleResetToOriginal() {
    if (!confirm('Discard all session edits and revert to the originally published lesson?')) return
    onResetToOriginal()
    onClose()
  }

  return (
    <div className="te-modal-backdrop" role="dialog" aria-modal="true">
      <div className="te-modal">
        <div className="te-modal__header">
          <span className="te-modal__title">
            Edit Lesson — {role === 'admin'
              ? 'apply for this session or save permanently'
              : 'changes apply to this session only'}
          </span>
          <button className="te-modal__close" onClick={onClose} title="Close">×</button>
        </div>

        <div className="te-modal__body" style={s.body}>
          <aside style={s.taskPane}>
            <TaskList
              tasks={draftLesson.tasks}
              selectedTaskId={selectedTaskId}
              selectedGroupId={selectedGroupId}
              onSelect={selectTask}
              onSelectGroup={selectGroup}
              onAdd={handleAddTask}
              onAddGroup={handleAddGroup}
              onAddSubtask={handleAddSubtask}
              onDuplicate={handleDuplicate}
              onDelete={guardedDelete}
              onDeleteGroup={guardedDeleteGroup}
              onReorder={handleReorder}
              onReorderSubtask={handleReorderSubtask}
            />
            <ValidationPanel key={selectedTaskId ?? 'none'} errors={errors} warnings={warnings} />
          </aside>

          <main style={s.main}>
            {selectedGroup && !selectedTask ? (
              <GroupEditor
                group={selectedGroup}
                onUpdate={updatedGroup => {
                  handleLessonUpdate(prev => ({
                    ...prev,
                    tasks: prev.tasks.map(t =>
                      t.type === 'group' && t.id === updatedGroup.id ? updatedGroup : t
                    ),
                  }))
                }}
              />
            ) : selectedTask ? (
              <TaskEditor
                key={selectedTask.id}
                task={selectedTask}
                lesson={lessonForEditor}
                parentGroup={selectedTaskGroup}
                onUpdate={updated => {
                  handleLessonUpdate(prev => ({
                    ...prev,
                    tasks: applyTaskUpdate(prev.tasks, selectedTaskGroup, selectedTask, updated),
                  }))
                }}
              />
            ) : (
              <div style={s.empty}>
                <p>Select a task from the left panel, or add a new one to get started.</p>
              </div>
            )}
          </main>
        </div>

        <div style={s.footer}>
          <button className="btn-ghost" style={s.footerBtn} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-ghost-outline" style={s.footerBtn} onClick={handleResetToOriginal} disabled={saving}>
            Reset to Original
          </button>
          <div style={s.footerSpacer} />
          <button
            className={role === 'admin' ? 'btn-secondary' : 'btn-primary'}
            style={s.footerBtn}
            onClick={handleApplySession}
            disabled={saving}
          >
            Apply for This Session
          </button>
          {role === 'admin' && (
            <button className="btn-primary" style={s.footerBtn} onClick={handleSavePermanent} disabled={saving}>
              {saving ? 'Saving…' : 'Save Permanently'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const s = {
  body: {
    gap: 14,
  },
  taskPane: {
    width: 280,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    minWidth: 0,
    overflow: 'auto',
    background: '#f5f5f5',
    borderRadius: 8,
    padding: 20,
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#9ca3af',
    fontFamily: 'var(--font-body)',
    fontSize: '0.95rem',
  },
  footer: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    borderTop: '1px solid #e5e7eb',
    background: '#fafafa',
  },
  footerSpacer: { flex: 1 },
  footerBtn: { fontSize: '0.85rem', padding: '7px 14px' },
}
