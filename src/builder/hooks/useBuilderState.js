import { useState } from 'react'
import { flattenTasks, findGroupForTask, updateTaskInTasks, updateSubtaskTitles } from '../../shared/taskUtils'
import { renumberTasks, validateLesson } from '../lessonUtils'
import { HTML_ONLY } from '../components/FileManager'
import { createSpriteFromPreset } from '../spritePresets'
import { DEFAULT_CIRCUIT, cloneCircuit } from '../../modules/electronics/circuit'
import { DEFAULT_FS } from '../../modules/filesystem/filesystem'
import { getEffectiveLessonForTask, isComposedLesson } from '../../shared/composedLesson'

export function useBuilderState({ lesson, onUpdate, defaultSprites = [] }) {
  const [selectedTaskId, setSelectedTaskId] = useState(() => {
    const first = lesson.tasks[0]
    if (!first) return null
    if (first.type === 'group') return first.subtasks?.[0]?.id ?? null
    return first.id
  })
  const [selectedGroupId, setSelectedGroupId] = useState(null)

  function handleLessonUpdate(updater) {
    if (typeof updater === 'function') {
      onUpdate(prev => {
        const next = updater(prev)
        return { ...next, tasks: updateSubtaskTitles(next.tasks) }
      })
    } else {
      onUpdate({ ...updater, tasks: updateSubtaskTitles(updater.tasks) })
    }
  }

  function selectTask(id) {
    setSelectedTaskId(id)
    setSelectedGroupId(null)
  }

  function selectGroup(id) {
    setSelectedGroupId(id)
    setSelectedTaskId(null)
  }

  function defaultTypeFields(prevTask = null, moduleType = lesson.type) {
    if (moduleType === 'python' || moduleType === 'arcade') {
      return {
        starterCode: prevTask ? (prevTask.completeCode ?? prevTask.starterCode ?? '') : '',
        carryCodeFrom: prevTask?.id ?? null,
      }
    }
    if (moduleType === 'scratch') {
      if (prevTask) {
        return {
          toolbox: '',
          starterBlocks: prevTask.completeBlocks ?? prevTask.starterBlocks ?? null,
          carryBlocksFrom: prevTask.id,
          sprites: JSON.parse(JSON.stringify(prevTask.sprites ?? [])),
          backdrops: JSON.parse(JSON.stringify(prevTask.backdrops ?? [])),
          variables: JSON.parse(JSON.stringify(prevTask.variables ?? [])),
        }
      }
      const sprites = defaultSprites.length > 0 ? [createSpriteFromPreset([], defaultSprites[0])] : undefined
      return {
        toolbox: '',
        starterBlocks: null,
        carryBlocksFrom: null,
        ...(sprites ? { sprites } : {}),
      }
    }
    if (moduleType === 'electronics') {
      return {
        starterCircuit: prevTask ? cloneCircuit(prevTask.completeCircuit ?? prevTask.starterCircuit ?? DEFAULT_CIRCUIT) : cloneCircuit(DEFAULT_CIRCUIT),
        carryCircuitFrom: prevTask?.id ?? null,
        microcontroller: prevTask?.microcontroller ? { ...prevTask.microcontroller } : { enabled: false, boardType: null, starterCode: '' },
      }
    }
    if (moduleType === 'filesystem') {
      return {
        starterFs: prevTask?.completeFs ?? prevTask?.starterFs ?? DEFAULT_FS,
        carryFsFrom: prevTask?.id ?? null,
      }
    }
    return {
      starterFiles: prevTask
        ? (prevTask.completeFiles ?? prevTask.starterFiles ?? []).map(f => ({ ...f }))
        : [{ name: 'index.html', type: 'html', content: HTML_ONLY }],
      entryFile: prevTask ? (prevTask.completeEntryFile ?? prevTask.entryFile ?? 'index.html') : 'index.html',
      carryCodeFrom: prevTask?.id ?? null,
    }
  }

  function nextId() {
    const allTasks = (lesson.tasks ?? []).flatMap(item => item.type === 'group' ? (item.subtasks ?? []) : [item])
    return allTasks.reduce((m, t) => Math.max(m, t.id), 0) + 1
  }

  function topLevelInsertPosition() {
    const flat = flattenTasks(lesson.tasks)
    const defaultPrev = flat[flat.length - 1] ?? null
    if (selectedTaskId != null) {
      const topIdx = lesson.tasks.findIndex(item => item.type !== 'group' && item.id === selectedTaskId)
      if (topIdx >= 0) return { index: topIdx + 1, prevTask: lesson.tasks[topIdx] }
      const groupIdx = lesson.tasks.findIndex(
        item => item.type === 'group' && (item.subtasks ?? []).some(s => s.id === selectedTaskId)
      )
      if (groupIdx >= 0) {
        const group = lesson.tasks[groupIdx]
        return {
          index: groupIdx + 1,
          prevTask: (group.subtasks ?? []).find(s => s.id === selectedTaskId) ?? defaultPrev,
        }
      }
    }
    if (selectedGroupId != null) {
      const groupIdx = lesson.tasks.findIndex(item => item.type === 'group' && item.id === selectedGroupId)
      if (groupIdx >= 0) {
        const group = lesson.tasks[groupIdx]
        return { index: groupIdx + 1, prevTask: (group.subtasks ?? []).at(-1) ?? defaultPrev }
      }
    }
    return { index: lesson.tasks.length, prevTask: defaultPrev }
  }

  function handleAddTask() {
    if (isComposedLesson(lesson)) {
      const newId = nextId()
      const newTask = {
        id: newId,
        title: 'New code task',
        intent: '',
        explainer: '',
      }
      handleLessonUpdate(prev => ({ ...prev, tasks: [...prev.tasks, newTask] }))
      selectTask(newId)
      return
    }
    const { index, prevTask } = topLevelInsertPosition()
    const newId = nextId()
    const newTask = { id: newId, title: '', intent: '', explainer: '', ...defaultTypeFields(prevTask) }
    handleLessonUpdate(prev => {
      const next = [...prev.tasks]
      next.splice(index, 0, newTask)
      return { ...prev, tasks: next }
    })
    selectTask(newId)
  }

  function handleAddGroup() {
    const { index, prevTask } = topLevelInsertPosition()
    const newId = nextId()
    const groupId = `g-${Date.now()}`
    const firstSubtask = {
      id: newId,
      title: '',
      intent: '',
      explainer: '',
      ...(isComposedLesson(lesson) ? {} : defaultTypeFields(null)),
    }
    const newGroup = { id: groupId, type: 'group', title: 'New Group', subtasks: [firstSubtask] }
    handleLessonUpdate(prev => {
      const next = [...prev.tasks]
      next.splice(index, 0, newGroup)
      return { ...prev, tasks: next }
    })
    selectGroup(groupId)
  }

  function handleAddSubtask(groupId) {
    const group = lesson.tasks.find(t => t.type === 'group' && t.id === groupId)
    if (!group) return
    const newId = nextId()
    const subtasks = group.subtasks ?? []
    const selectedSubtaskIdx = selectedTaskId != null
      ? subtasks.findIndex(s => s.id === selectedTaskId)
      : -1
    const insertIndex = selectedSubtaskIdx >= 0 ? selectedSubtaskIdx + 1 : subtasks.length
    const prevSubtask = selectedSubtaskIdx >= 0 ? subtasks[selectedSubtaskIdx] : (subtasks[subtasks.length - 1] ?? null)
    const newSubtask = {
      id: newId,
      title: '',
      intent: '',
      explainer: '',
      ...(isComposedLesson(lesson) ? {} : defaultTypeFields(prevSubtask, group.moduleType ?? lesson.type)),
    }
    handleLessonUpdate(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => {
        if (t.type !== 'group' || t.id !== groupId) return t
        const subs = t.subtasks ?? []
        return { ...t, subtasks: [...subs.slice(0, insertIndex), newSubtask, ...subs.slice(insertIndex)] }
      }),
    }))
    selectTask(newId)
  }

  function handleDuplicate(task, groupId = null) {
    const newId = nextId()
    if (groupId) {
      const dup = { ...task, id: newId, title: task.title ? `${task.title} (copy)` : '' }
      handleLessonUpdate(prev => ({
        ...prev,
        tasks: prev.tasks.map(t =>
          t.type === 'group' && t.id === groupId
            ? { ...t, subtasks: [...(t.subtasks ?? []), dup] }
            : t
        ),
      }))
    } else {
      const dup = { ...task, id: newId, title: task.title + ' (copy)' }
      handleLessonUpdate(prev => ({ ...prev, tasks: [...prev.tasks, dup] }))
      selectTask(dup.id)
      return
    }
    selectTask(newId)
  }

  function handleDelete(taskId, { skipConfirm = false } = {}) {
    if (!skipConfirm && !confirm('Delete this task?')) return
    const group = findGroupForTask(lesson.tasks, taskId)
    if (group) {
      const newSubtasks = (group.subtasks ?? []).filter(t => t.id !== taskId)
      if (newSubtasks.length === 0) {
        handleLessonUpdate(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== group.id) }))
        const remaining = flattenTasks(lesson.tasks.filter(t => t.id !== group.id))
        selectTask(remaining[0]?.id ?? null)
      } else {
        handleLessonUpdate(prev => ({
          ...prev,
          tasks: prev.tasks.map(t =>
            t.type === 'group' && t.id === group.id ? { ...t, subtasks: newSubtasks } : t
          ),
        }))
        selectTask(newSubtasks[0]?.id ?? null)
      }
    } else {
      handleLessonUpdate(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== taskId) }))
      const remaining = flattenTasks(lesson.tasks.filter(t => !(t.type !== 'group' && t.id === taskId)))
      selectTask(remaining[0]?.id ?? null)
    }
  }

  function handleDeleteGroup(groupId, { skipConfirm = false } = {}) {
    if (!skipConfirm && !confirm('Delete this group and all its subtasks?')) return
    handleLessonUpdate(prev => ({ ...prev, tasks: prev.tasks.filter(t => !(t.type === 'group' && t.id === groupId)) }))
    const remaining = flattenTasks(lesson.tasks.filter(t => !(t.type === 'group' && t.id === groupId)))
    selectTask(remaining[0]?.id ?? null)
  }

  function handleReorder(reorderedTasks) {
    onUpdate(prev => ({ ...prev, tasks: reorderedTasks }))
  }

  function handleReorderSubtask(groupId, reorderedSubtasks) {
    const updated = lesson.tasks.map(item => {
      if (item.type !== 'group') return item
      return { ...item, subtasks: item.id === groupId ? reorderedSubtasks : (item.subtasks ?? []) }
    })
    onUpdate(prev => ({ ...prev, tasks: updated }))
  }

  function handleRenumberTasks() {
    const selectedIndex = selectedTaskId != null
      ? flattenTasks(lesson.tasks).findIndex(task => task.id === selectedTaskId)
      : -1
    handleLessonUpdate(prev => ({ ...prev, tasks: renumberTasks(prev.tasks) }))
    if (selectedIndex >= 0) selectTask(selectedIndex + 1)
  }

  // Derived state
  const { errors, warnings } = validateLesson(lesson)
  const flatTasks = flattenTasks(lesson.tasks)
  const selectedTask = selectedTaskId != null ? flatTasks.find(t => t.id === selectedTaskId) : null
  const selectedGroup = selectedGroupId != null
    ? lesson.tasks.find(t => t.type === 'group' && t.id === selectedGroupId)
    : null
  const lessonForEditor = selectedTask ? { ...getEffectiveLessonForTask(lesson, selectedTask), tasks: flatTasks } : lesson
  const selectedTaskGroup = selectedTask
    ? (lesson.tasks.find(t => t.type === 'group' && (t.subtasks ?? []).some(s => s.id === selectedTask.id)) ?? null)
    : null

  return {
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
    handleRenumberTasks,
    errors,
    warnings,
    flatTasks,
    selectedTask,
    selectedGroup,
    lessonForEditor,
    selectedTaskGroup,
  }
}
