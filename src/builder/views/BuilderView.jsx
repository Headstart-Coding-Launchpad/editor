import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore'
import LessonMetaPanel from '../components/LessonMetaPanel'
import TaskList from '../components/TaskList'
import TaskEditor from '../components/TaskEditor'
import GroupEditor from '../components/GroupEditor'
import ValidationPanel from '../components/ValidationPanel'
import TaskFeedbackPanel from '../components/TaskFeedbackPanel'
import BuilderToolbar from '../components/BuilderToolbar'
import PreviewView from './PreviewView'
import { useBuilderState } from '../hooks/useBuilderState'
import { buildPrintHtml } from '../printLesson'
import { flattenTasks, updateTaskInTasks } from '../../shared/taskUtils'
import { normalizeTasksForExport } from '../lessonUtils'
import { firestore } from '../../shared/firebase'
import { useAuth } from '../../auth/useAuth'

export default function BuilderView({ lesson, dirty, onUpdate, onNew, onMarkSaved }) {
  const [previewing, setPreviewing] = useState(false)
  const [metaOpen, setMetaOpen] = useState(false)
  const [publishStatus, setPublishStatus] = useState(null) // null | 'publishing' | 'done' | 'error'
  const [taskFeedback, setTaskFeedback] = useState([])
  const { role } = useAuth()
  const navigate = useNavigate()

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
  } = useBuilderState({ lesson, onUpdate })

  useEffect(() => {
    if (!selectedTaskId || !lesson?.id) { setTaskFeedback([]); return }
    getDocs(query(
      collection(firestore, 'lessons', lesson.id, 'feedback'),
      where('taskId', '==', selectedTaskId)
    )).then(snap => {
      const items = snap.docs.map(d => d.data())
      items.sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0))
      setTaskFeedback(items)
    }).catch(() => setTaskFeedback([]))
  }, [lesson?.id, selectedTaskId])

  function handleDownload() {
    if (errors.length) {
      alert('Cannot download — please fix these errors:\n\n' + errors.join('\n'))
      return
    }
    if (warnings.length) {
      const ok = confirm('Warnings:\n\n' + warnings.join('\n') + '\n\nDownload anyway?')
      if (!ok) return
    }
    const exported = { ...lesson, tasks: normalizeTasksForExport(lesson.tasks) }
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${lesson.id || 'lesson'}.json`
    a.click()
    URL.revokeObjectURL(url)
    onMarkSaved()
  }

  async function handlePublish() {
    if (errors.length) {
      alert('Cannot publish — please fix these errors:\n\n' + errors.join('\n'))
      return
    }
    if (warnings.length) {
      const ok = confirm('Warnings:\n\n' + warnings.join('\n') + '\n\nPublish anyway?')
      if (!ok) return
    }
    if (!lesson.id) { alert('Cannot publish — lesson ID is required.'); return }
    setPublishStatus('publishing')
    try {
      const exported = JSON.parse(JSON.stringify({ ...lesson, tasks: normalizeTasksForExport(lesson.tasks) }))
      await setDoc(doc(firestore, 'lessons', lesson.id), exported)
      setPublishStatus('done')
      onMarkSaved()
      setTimeout(() => navigate('/admin'), 1500)
    } catch (err) {
      console.error('Publish failed:', err)
      setPublishStatus('error')
      setTimeout(() => setPublishStatus(null), 3000)
      alert('Failed to publish: ' + err.message)
    }
  }

  function handlePrint() {
    const win = window.open('', '_blank')
    if (!win) { alert('Pop-up blocked — please allow pop-ups for this page and try again.'); return }
    win.document.write(buildPrintHtml(lesson))
    win.document.close()
    win.focus()
    win.print()
  }

  function handleUpload() {
    if (dirty && !confirm('You have unsaved changes — download your lesson first.\n\nContinue?')) return
    const input = document.createElement('input')
    input.type   = 'file'
    input.accept = '.json'
    input.onchange = e => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = ev => {
        try {
          const parsed = JSON.parse(ev.target.result)
          if (!parsed.id || !parsed.tasks) throw new Error('Unrecognised format')
          handleLessonUpdate(parsed)
          const firstFlat = flattenTasks(parsed.tasks)
          selectTask(firstFlat[0]?.id ?? null)
        } catch (err) {
          alert('Could not load file: ' + err.message)
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  if (previewing) {
    return <PreviewView lesson={lesson} onClose={() => setPreviewing(false)} initialTaskId={selectedTaskId} />
  }

  return (
    <div style={s.page}>
      <BuilderToolbar
        dirty={dirty}
        role={role}
        errors={errors}
        publishStatus={publishStatus}
        hasNoTasks={lesson.tasks.length === 0}
        onNew={onNew}
        onUpload={handleUpload}
        onPreview={() => setPreviewing(true)}
        onPrint={handlePrint}
        onDownload={handleDownload}
        onPublish={handlePublish}
        onBack={() => navigate('/admin')}
      />

      <div style={{ ...s.body, gridTemplateColumns: metaOpen ? '320px 280px minmax(0, 1fr)' : '40px 280px minmax(0, 1fr)' }}>
        <aside style={metaOpen ? s.metaPane : s.metaPaneCollapsed}>
          {metaOpen ? (
            <LessonMetaPanel lesson={lesson} onUpdate={onUpdate} onCollapse={() => setMetaOpen(false)} />
          ) : (
            <div style={s.collapsedMetaStrip}>
              <button type="button" style={s.expandMetaBtn} onClick={() => setMetaOpen(true)} title="Expand lesson details">
                ›
              </button>
            </div>
          )}
        </aside>

        <aside style={s.taskPane}>
          <TaskList
            tasks={lesson.tasks}
            selectedTaskId={selectedTaskId}
            selectedGroupId={selectedGroupId}
            onSelect={selectTask}
            onSelectGroup={selectGroup}
            onAdd={handleAddTask}
            onAddGroup={handleAddGroup}
            onAddSubtask={handleAddSubtask}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onDeleteGroup={handleDeleteGroup}
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
            <>
              <TaskEditor
                key={selectedTask.id}
                task={selectedTask}
                lesson={lessonForEditor}
                parentGroup={selectedTaskGroup}
                onUpdate={updated => {
                  let finalUpdated = updated
                  if (selectedTaskGroup) {
                    if ('_customTitle' in updated && !updated._customTitle) {
                      const { _customTitle, ...withoutFlag } = finalUpdated
                      finalUpdated = withoutFlag
                    } else if (updated.title !== selectedTask.title) {
                      finalUpdated = { ...updated, _customTitle: true }
                    }
                  }
                  handleLessonUpdate(prev => ({
                    ...prev,
                    tasks: updateTaskInTasks(prev.tasks, finalUpdated),
                  }))
                }}
              />
              {taskFeedback.length > 0 && <TaskFeedbackPanel feedback={taskFeedback} />}
            </>
          ) : (
            <div style={s.empty}>
              <p>Select a task from the left panel, or add a new one to get started.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

const s = {
  page: { display: 'flex', flexDirection: 'column', height: '100%' },
  body: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '320px 280px minmax(0, 1fr)',
    overflow: 'hidden',
  },
  metaPane: {
    background: '#fff',
    borderRight: '1px solid #e5e7eb',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  metaPaneCollapsed: {
    background: '#fff',
    borderRight: '1px solid #e5e7eb',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  collapsedMetaStrip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    width: '100%',
  },
  expandMetaBtn: {
    width: 28,
    height: 28,
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: '#fff',
    color: 'var(--colour-primary)',
    cursor: 'pointer',
    fontSize: '1.15rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    padding: 0,
  },
  taskPane: {
    background: '#fff',
    borderRight: '1px solid #e5e7eb',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  main: {
    overflow: 'auto',
    background: '#f5f5f5',
    padding: 20,
    minWidth: 0,
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
}
