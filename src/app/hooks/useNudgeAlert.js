import { useEffect, useRef, useState } from 'react'
import { playNudgeChime, showNudgeNotification, startTitleFlash } from '../nudgeAlert'

function windowHasFocus() {
  return typeof document.hasFocus === 'function' ? document.hasFocus() : true
}

// Reacts to a teacher nudge: a per-student one (students.{id}.nudgePushedAt)
// always alerts; the class-wide "nudge everyone Away" (session.nudgeAwayPushedAt)
// only alerts a student whose window is unfocused when it arrives.
//
// Timestamps already present when the session first loads are treated as a
// baseline, not a new nudge, so reloading the page doesn't replay an old one.
// Returns whether the in-page nudge banner should show, and a dismiss handler.
export default function useNudgeAlert({ ready, enabled, studentPushedAt, classPushedAt }) {
  const baselineRef = useRef(null)
  const stopFlashRef = useRef(null)
  const [bannerVisible, setBannerVisible] = useState(false)

  if (ready && baselineRef.current == null) {
    baselineRef.current = { student: studentPushedAt ?? 0, class: classPushedAt ?? 0 }
  }

  useEffect(() => {
    const baseline = baselineRef.current
    if (!enabled || !baseline) return
    const studentIsNew = (studentPushedAt ?? 0) > baseline.student
    const classIsNew = (classPushedAt ?? 0) > baseline.class
    if (!studentIsNew && !classIsNew) return
    baselineRef.current = {
      student: Math.max(baseline.student, studentPushedAt ?? 0),
      class: Math.max(baseline.class, classPushedAt ?? 0),
    }

    const away = !windowHasFocus()
    if (!studentIsNew && !away) return

    setBannerVisible(true)
    playNudgeChime()
    if (away) {
      showNudgeNotification()
      if (!stopFlashRef.current) stopFlashRef.current = startTitleFlash()
    }
  }, [enabled, studentPushedAt, classPushedAt])

  // The flash has done its job once the student is looking at the tab again.
  useEffect(() => {
    function stopFlash() {
      stopFlashRef.current?.()
      stopFlashRef.current = null
    }
    window.addEventListener('focus', stopFlash)
    return () => {
      window.removeEventListener('focus', stopFlash)
      stopFlash()
    }
  }, [])

  return {
    nudgeBannerVisible: enabled && bannerVisible,
    dismissNudge: () => setBannerVisible(false),
  }
}
