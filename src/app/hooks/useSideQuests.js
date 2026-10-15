import { useCallback, useEffect, useMemo, useState } from 'react'
import { canShowSideQuests, getSideQuests, supportsSideQuests } from '../../shared/sideQuests'

/**
 * A student's side-quests on the task on screen (src/shared/sideQuests.js): which are offered,
 * which one is open, and the self-reported Done ticks. Writes only in a real live lesson (never
 * solo, a Builder preview or the presentation window): the open side-quest on open and close,
 * `openedAt` the first time, one counter per Run (and per error), and Done. The side-quest's
 * code lives in localStorage (SideQuestWorkspace); `syncCode` mirrors it to the tutor
 * (students/{id}/sideQuestCode), which SideQuestWorkspace calls on Run, and per keystroke only
 * while `watched` (activeStudentView is this student).
 *
 * A side-quest closes by itself when the task changes (the teacher moves the class on, or a solo
 * student moves to another task) or the side-quests stop being available.
 */
export function useSideQuests({
  task,
  moduleType,
  identity,
  session,
  phase,
  checkPassed,
  isViewingPrev = false,
  inPersonalSandbox = false,
  teacherPresentation = false,
  previewMode = false,
  writeSideQuestOpen,
  recordSideQuestOpened,
  recordSideQuestRun,
  setSideQuestDone,
  writeSideQuestCode,
}) {
  const quests = useMemo(
    () => (supportsSideQuests(moduleType) ? getSideQuests(task) : []),
    [task, moduleType]
  )
  const taskId = task?.id ?? null
  const anonymousId = identity?.anonymousId ?? null
  const available = canShowSideQuests({
    quests,
    moduleType,
    phase,
    checkPassed,
    isViewingPrev,
    inPersonalSandbox,
    teacherPresentation,
  })
  // Status reaches the teacher only from a real student in a live lesson.
  const live = phase === 'lesson' && !teacherPresentation && !previewMode && !!anonymousId
  // The side-quest's code is kept in localStorage for a real student (live or solo); a preview
  // or the presentation window keeps it in memory only.
  const persist = !teacherPresentation && !previewMode && !!anonymousId
  // The tutor has this student's StudentModal open: keystrokes may be mirrored too.
  const watched = live && session?.activeStudentView === anonymousId

  // `{ taskId, index }`: tied to its task, so moving to another task can never open that task's
  // side-quest with the same number.
  const [open, setOpen] = useState(null)
  // Done ticks this tab has set, by `${taskId}#${index}`: the only record outside a live lesson,
  // and an instant echo of the write inside one.
  const [localDone, setLocalDone] = useState({})

  const openIndex =
    open &&
    available &&
    String(open.taskId) === String(taskId) &&
    quests.some((q) => q.index === open.index)
      ? open.index
      : null

  const writeOpen = useCallback(
    (index) => {
      if (!live) return
      writeSideQuestOpen?.(anonymousId, index, taskId)?.catch?.(() => {})
    },
    [live, anonymousId, taskId, writeSideQuestOpen]
  )

  // Close a side-quest that is no longer on screen (the class moved on, or it stopped being
  // available), and tell the teacher.
  useEffect(() => {
    if (open && openIndex == null) {
      setOpen(null)
      writeOpen(null)
    }
  }, [open, openIndex, writeOpen])

  const openQuest = useCallback(
    (index) => {
      if (!available || !quests.some((q) => q.index === index)) return
      setOpen({ taskId, index })
      if (live) {
        writeOpen(index)
        recordSideQuestOpened?.(anonymousId, taskId, index)?.catch?.(() => {})
      }
    },
    [available, quests, taskId, live, writeOpen, recordSideQuestOpened, anonymousId]
  )

  const closeQuest = useCallback(() => {
    setOpen(null)
    writeOpen(null)
  }, [writeOpen])

  const isDone = useCallback(
    (index) => {
      const local = localDone[`${taskId}#${index}`]
      if (local != null) return local
      if (!live) return false
      return session?.sideQuestLog?.[anonymousId]?.[taskId]?.[index]?.done === true
    },
    [localDone, taskId, live, session, anonymousId]
  )

  const toggleDone = useCallback(
    (index) => {
      const next = !isDone(index)
      setLocalDone((current) => ({ ...current, [`${taskId}#${index}`]: next }))
      if (live) setSideQuestDone?.(anonymousId, taskId, index, next)?.catch?.(() => {})
    },
    [isDone, taskId, live, setSideQuestDone, anonymousId]
  )

  const reportRun = useCallback(
    (index, { error = false } = {}) => {
      if (!live) return
      recordSideQuestRun?.(anonymousId, taskId, index, { error })?.catch?.(() => {})
    },
    [live, recordSideQuestRun, anonymousId, taskId]
  )

  // Mirrors the open side-quest's work to the tutor (students/{id}/sideQuestCode). The caller
  // gates keystrokes on `watched`; this only refuses outside a live lesson or a side-quest that
  // is no longer the open one.
  const syncCode = useCallback(
    (index, patch) => {
      if (!live || index !== openIndex) return
      writeSideQuestCode?.(anonymousId, { ...patch, taskId, index })?.catch?.(() => {})
    },
    [live, openIndex, writeSideQuestCode, anonymousId, taskId]
  )

  return {
    quests,
    available,
    live,
    watched,
    syncCode,
    persist,
    taskId,
    openIndex,
    openQuest,
    closeQuest,
    isDone,
    toggleDone,
    doneCount: quests.filter((quest) => isDone(quest.index)).length,
    reportRun,
  }
}
