import { useEffect, useMemo, useRef, useState } from 'react'
import { findTaskById } from '../../shared/taskUtils'
import { resolveSessionClass } from '../../shared/roster/rosterModel'
import {
  carrySourceLessonLabel,
  getCrossLessonCarry,
  resolveCrossLessonCarry,
} from '../../shared/roster/crossLessonCarry'
import { readCarryInbox } from '../../shared/roster/crossLessonCarryService'
import { fetchLessonById } from '../../shared/lessonService'

// Cross-lesson carry, student side (src/shared/roster/crossLessonCarry.js). For the task being
// loaded, returns { state, carry, work, sourceLabel }:
// - state: resolveCrossLessonCarry's outcome, except that 'found' stays 'hold' until the inbox
//   payload has been read, and becomes 'missing' when it can't be read (the starter is used);
// - work: the carried work ({ kind, code | files | scratchState }) once 'found';
// - sourceLabel: "Lesson 11" for the hold message, when the source lesson has a lessonNumber.
// `live`: a real student in a live lesson (never the presentation window or Builder preview).
// `hasOwnWork(taskId)` is asked once per task load: a student who already has work saved for
// the task keeps it ('own') and never holds.
export function useCrossLessonCarry({
  lessonId,
  lesson,
  taskId,
  session,
  anonymousId,
  live,
  hasOwnWork,
}) {
  const task = useMemo(() => findTaskById(lesson?.tasks, taskId), [lesson?.tasks, taskId])
  const carry = useMemo(() => getCrossLessonCarry(lesson, task), [lesson, task])
  const loadKey = `${lessonId}:${anonymousId}:${taskId}`
  const ownRef = useRef({ key: null, own: false })
  // Decided once per task load (and again if the carry itself appears, e.g. a lesson loading).
  const ownKey = `${loadKey}:${carry ? 'carry' : ''}`
  if (ownRef.current.key !== ownKey) {
    ownRef.current = { key: ownKey, own: !!carry && !!anonymousId && !!hasOwnWork?.(taskId) }
  }
  const classSource = resolveSessionClass(lesson, session).source
  const status = anonymousId ? (session?.carryStatus?.[anonymousId]?.[taskId] ?? null) : null
  const outcome = resolveCrossLessonCarry({
    carry,
    live: live && !!session && !!anonymousId,
    classSource,
    status,
    hasOwnWork: ownRef.current.own,
  })

  const [inbox, setInbox] = useState({ key: null, work: null })
  const inboxKey = outcome === 'found' ? `${loadKey}:${status?.at ?? ''}` : null
  useEffect(() => {
    if (!inboxKey || !carry) return undefined
    let cancelled = false
    readCarryInbox(lessonId, anonymousId, taskId, carry.kind)
      .then((work) => !cancelled && setInbox({ key: inboxKey, work }))
      .catch(() => !cancelled && setInbox({ key: inboxKey, work: null }))
    return () => {
      cancelled = true
    }
    // carry is derived from the task, which loadKey covers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inboxKey])

  // The source lesson's number, only while the student is waiting.
  const [sourceLabel, setSourceLabel] = useState({ lesson: null, label: null })
  const sourceLessonId = carry?.sourceLessonId ?? null
  const holding = outcome === 'hold' || (outcome === 'found' && inbox.key !== inboxKey)
  useEffect(() => {
    if (!holding || !sourceLessonId || sourceLabel.lesson === sourceLessonId) return undefined
    let cancelled = false
    fetchLessonById(sourceLessonId)
      .then((source) => {
        if (!cancelled) {
          setSourceLabel({ lesson: sourceLessonId, label: carrySourceLessonLabel(source) })
        }
      })
      .catch(() => !cancelled && setSourceLabel({ lesson: sourceLessonId, label: null }))
    return () => {
      cancelled = true
    }
  }, [holding, sourceLessonId, sourceLabel.lesson])

  let state = outcome
  let work = null
  if (outcome === 'found') {
    if (inbox.key !== inboxKey) state = 'hold'
    else if (inbox.work) work = inbox.work
    else state = 'missing'
  }
  return {
    state,
    carry,
    work,
    taskId,
    sourceLabel: sourceLabel.lesson === sourceLessonId ? sourceLabel.label : null,
  }
}
