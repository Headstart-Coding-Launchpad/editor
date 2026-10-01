import { useEffect, useRef, useState } from 'react'

/** Student phases that can show the teacher's "join the video call" prompt. */
export const VIDEO_CALL_PROMPT_PHASES = ['name-entry', 'waiting', 'lesson', 'sandbox']

/**
 * A push older than this when it reaches the student is not shown: it was sent long ago
 * (e.g. a student record restored with an old stamp), not to the student who is here now.
 */
export const VIDEO_CALL_PROMPT_STALE_MS = 10 * 60 * 1000

// Decides when the student sees the "Your teacher wants you on the video call" prompt.
// Two teacher pushes raise it: the per-student send (students.{id}.videoCallLinkPushedAt)
// and the class-wide "Send to all" (session.videoCallBroadcastAt). The broadcast also reaches
// name-entry students, who have no student record yet.
//
// - Timestamps already present when the session first loads are a baseline, not a new push,
//   so reloading the page doesn't replay an old one (same approach as useNudgeAlert).
// - A push that lands while the prompt is disabled (e.g. teacher presentation, solo, end
//   screen) is consumed, so it doesn't pop up later.
// - The prompt belongs to the phase it was shown in: moving on (name entry → waiting room →
//   lesson) closes it, so a waiting-room prompt doesn't reappear once the lesson starts.
export default function useVideoCallPrompt({
  ready,
  enabled,
  phase,
  link,
  studentPushedAt,
  broadcastAt,
  now = Date.now,
}) {
  const baselineRef = useRef(null)
  // The phase the prompt was raised in; null when it isn't showing.
  const [shownInPhase, setShownInPhase] = useState(null)

  if (ready && baselineRef.current == null) {
    baselineRef.current = { student: studentPushedAt ?? 0, broadcast: broadcastAt ?? 0 }
  }

  // Leaving the phase closes the prompt for good (it must not come back if the student
  // later returns to the same phase).
  useEffect(() => {
    setShownInPhase((shown) => (shown != null && shown !== phase ? null : shown))
  }, [phase])

  useEffect(() => {
    const baseline = baselineRef.current
    if (!baseline) return
    const student = studentPushedAt ?? 0
    const broadcast = broadcastAt ?? 0
    const studentIsNew = student > baseline.student
    const broadcastIsNew = broadcast > baseline.broadcast
    if (!studentIsNew && !broadcastIsNew) return
    baselineRef.current = {
      student: Math.max(baseline.student, student),
      broadcast: Math.max(baseline.broadcast, broadcast),
    }
    if (!enabled) return
    const latest = Math.max(studentIsNew ? student : 0, broadcastIsNew ? broadcast : 0)
    if (now() - latest > VIDEO_CALL_PROMPT_STALE_MS) return
    setShownInPhase(phase)
    // Only a new push raises the prompt; enabled/phase are read as of that push.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentPushedAt, broadcastAt])

  return {
    videoCallPromptVisible: enabled && !!link && shownInPhase != null && shownInPhase === phase,
    dismissVideoCallPrompt: () => setShownInPhase(null),
  }
}
