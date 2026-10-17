import { attachTeacherFeedback, buildReportTaskNotes } from '../shared/lessonReport'
import { addReportTaskNote, saveReportTeacherFeedback } from '../shared/lessonService'

// Saves the one after-class feedback step: the rating and two notes become `teacherFeedback`
// on the run's report (merged, today's shape), and each per-task note becomes a
// lessons/{lessonId}/feedback item tagged with `reportId`. Returns the updated report.
export async function saveAfterClassFeedback({
  lessonId,
  report,
  feedback,
  taskNotes,
  teacherEmail,
}) {
  if (!report) return report
  const reportLessonId = lessonId ?? report.lessonId
  const updated = attachTeacherFeedback(report, feedback)
  if (updated !== report) {
    await saveReportTeacherFeedback(
      reportLessonId,
      String(report.sessionId),
      updated.teacherFeedback
    )
  }
  const notes = buildReportTaskNotes(report, taskNotes, teacherEmail)
  for (const note of notes) {
    await addReportTaskNote(reportLessonId, { ...note, lessonId: reportLessonId })
  }
  return updated
}
