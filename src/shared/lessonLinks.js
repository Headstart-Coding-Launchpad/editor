// `join` auto-joins an active/waiting session, or prompts solo-vs-wait when none exists.
// `solo` forces solo mode regardless of any session (?solo=true), for links that should
// always go straight to solo study (e.g. catch-up or recording use).
// `teacher` opens the lesson's teacher console.
// `preview` is an ephemeral, unrestricted solo run (see LessonRoute.jsx's `preview`
// handling) — nothing it does is written to real student progress, so it is safe to
// launch repeatedly while checking a lesson over.
export function getLessonLinks(lessonId) {
  const base = `${window.location.origin}${window.location.pathname}#/lesson/${lessonId}`
  return {
    join: base,
    solo: `${base}?solo=true`,
    teacher: `${base}?teacher=true`,
    preview: `${base}?preview=true`,
  }
}
