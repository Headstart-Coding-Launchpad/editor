// `join` auto-joins an active/waiting session, or prompts solo-vs-wait when none exists.
// `solo` forces solo mode regardless of any session (?solo=true), for links that should
// always go straight to solo study (e.g. catch-up or recording use).
export function getLessonLinks(lessonId) {
  const base = `${window.location.origin}${window.location.pathname}#/lesson/${lessonId}`
  return { join: base, solo: `${base}?solo=true` }
}
