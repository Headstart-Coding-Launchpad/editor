export function getLessonLinks(lessonId) {
  const base = `${window.location.origin}${window.location.pathname}#/lesson/${lessonId}`
  return { live: `${base}?live=true`, solo: base }
}
