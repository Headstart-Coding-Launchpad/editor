// The teacher's presentation window joins the live session as a pseudo-student with this id.
// Anything it writes under sessions/{lessonId}/students/teacher-presenter (a quiz or activity it
// shows, a poll) made it a "student" in the tutor's list, as offline, and in session reports.
export const TEACHER_PRESENTER_ID = 'teacher-presenter'

/** The session without the presentation window's student node (same object when it has none). */
export function withoutPresenter(session) {
  const students = session?.students
  if (!students || !(TEACHER_PRESENTER_ID in students)) return session
  const { [TEACHER_PRESENTER_ID]: _presenter, ...rest } = students
  return { ...session, students: rest }
}
