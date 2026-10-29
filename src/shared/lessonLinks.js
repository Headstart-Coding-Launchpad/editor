import { normaliseHandle } from './sessionKey.js'

// `join` auto-joins an active/waiting session, or prompts solo-vs-wait when none exists.
// `solo` forces solo mode regardless of any session (?solo=true), for links that should
// always go straight to solo study (e.g. catch-up or recording use).
// `teacher` opens the lesson's teacher console.
// `preview` is an ephemeral, unrestricted solo run (see LessonRoute.jsx's `preview`
// handling) — nothing it does is written to real student progress, so it is safe to
// launch repeatedly while checking a lesson over.
// `handle` is the tutor's short handle (src/shared/sessionKey.js): their `join` link carries it
// (`?t=sam`) so students land in that tutor's own live class; without one it is the plain link.
export function getLessonLinks(lessonId, handle = '') {
  const base = `${window.location.origin}${window.location.pathname}#/lesson/${lessonId}`
  const tutor = normaliseHandle(handle)
  return {
    join: tutor ? `${base}?t=${tutor}` : base,
    solo: `${base}?solo=true`,
    teacher: `${base}?teacher=true`,
    preview: `${base}?preview=true`,
  }
}
