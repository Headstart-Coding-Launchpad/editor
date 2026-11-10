import { getCompleteStage, getRevealableStages } from '../../../shared/taskStages'

// What a student can see on their task, for the tutor's "Student can see" strip (CanSeeStrip):
// the Type this out code, the Support stage on their screen and the Complete stage. Read only
// from data the platform already logs; nothing here writes.
//
// - revealLog: session.supportRevealLog[studentId][taskId] ({ [stageIndex]: { source,
//   stageLabel, revealedAt } }). The teacher live-code keys (teacherLive, teacherLivePinned) are
//   not stages and are skipped.
// - completeShown: session.studentSignals[studentId].completeShown[signalKey(taskId)]
//   ({ at, via: 'show' | 'preview' | 'teacherReset' }), written by the student's own device when
//   they open the Complete code. A tutor's Reveal solution is in revealLog instead. 'teacherReset'
//   means a tutor reset hid it again, so it never turns the item on.
//
// Both logs are append-only: an item that is on means "has opened", not "has it open now".
//
// Returns the items in a fixed order (copy, support, complete), each only when the task has it.

const TUTOR_SOURCES = ['teacher', 'teacher-auto']

function whoFrom(source) {
  return TUTOR_SOURCES.includes(source) ? 'tutor' : 'student'
}

function timeOf(entry) {
  return typeof entry?.revealedAt === 'number' ? entry.revealedAt : null
}

export function studentCanSee({
  task,
  copyCode = null,
  supportsCopyCode = false,
  supportsStages = false,
  revealLog = null,
  completeShown = null,
}) {
  const items = []
  if (!task) return items
  const log = revealLog && typeof revealLog === 'object' ? revealLog : {}

  if (supportsCopyCode) {
    items.push({ key: 'copy', on: typeof copyCode === 'string' && copyCode.trim() !== '' })
  }

  const supportStages = supportsStages ? getRevealableStages(task) : []
  if (supportStages.length > 0) {
    // The student sees the latest stage revealed (useStudentCodeState's activeSupportStageIndex).
    let shown = null
    supportStages.forEach(({ stage, index }, position) => {
      if (log[index]) shown = { stage, index, number: position + 1, entry: log[index] }
    })
    items.push(
      shown
        ? {
            key: 'support',
            on: true,
            number: shown.number,
            stageIndex: shown.index,
            stage: shown.stage,
            by: whoFrom(shown.entry.source),
            at: timeOf(shown.entry),
          }
        : { key: 'support', on: false }
    )
  }

  const complete = supportsStages ? getCompleteStage(task) : null
  if (complete) {
    const opens = []
    const tutorEntry = log[complete.index]
    if (tutorEntry) opens.push({ by: whoFrom(tutorEntry.source), at: timeOf(tutorEntry) })
    if (completeShown && completeShown.via !== 'teacherReset') {
      opens.push({
        by: 'student',
        at: typeof completeShown.at === 'number' ? completeShown.at : null,
      })
    }
    // Who opened it first: a tutor's reveal also makes the student's device log 'preview' a
    // moment later, so the earlier entry is the real opener.
    opens.sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity))
    items.push(
      opens.length
        ? {
            key: 'complete',
            on: true,
            stageIndex: complete.index,
            stage: complete.stage,
            ...opens[0],
          }
        : { key: 'complete', on: false }
    )
  }
  return items
}

/** "14:32" in the tutor's own time zone, or '' with no time. */
export function formatCanSeeTime(at) {
  if (typeof at !== 'number') return ''
  return new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
