import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveAfterClassFeedback } from '../afterClassFeedback'
import { addReportTaskNote, saveReportTeacherFeedback } from '../../shared/lessonService'

vi.mock('../../shared/lessonService', () => ({
  saveReportTeacherFeedback: vi.fn().mockResolvedValue(undefined),
  addReportTaskNote: vi.fn().mockResolvedValue(undefined),
}))

const report = { lessonId: 'demo', lessonTitle: 'Demo', sessionId: '1000', taskSummary: [] }

describe('saveAfterClassFeedback', () => {
  beforeEach(() => vi.clearAllMocks())

  it('writes teacherFeedback in the existing shape on that run report', async () => {
    const updated = await saveAfterClassFeedback({
      lessonId: 'demo',
      report,
      feedback: { rating: 4, whatWorkedWell: ' Good ', whatDidntWork: '' },
      taskNotes: [],
      teacherEmail: 't@x.test',
    })
    expect(saveReportTeacherFeedback).toHaveBeenCalledWith(
      'demo',
      '1000',
      expect.objectContaining({ rating: 4, whatWorkedWell: 'Good', whatDidntWork: '' })
    )
    expect(typeof updated.teacherFeedback.submittedAt).toBe('number')
    expect(addReportTaskNote).not.toHaveBeenCalled()
  })

  it('stores each task note in the lesson feedback store, linked by reportId', async () => {
    await saveAfterClassFeedback({
      lessonId: 'demo',
      report,
      feedback: { rating: null, whatWorkedWell: '', whatDidntWork: '' },
      taskNotes: [
        { taskId: 3, taskTitle: 'Loops', text: ' Hint too long ' },
        { taskId: 4, taskTitle: 'Blank', text: '  ' },
      ],
      teacherEmail: 't@x.test',
    })
    expect(saveReportTeacherFeedback).not.toHaveBeenCalled()
    expect(addReportTaskNote).toHaveBeenCalledTimes(1)
    expect(addReportTaskNote).toHaveBeenCalledWith(
      'demo',
      expect.objectContaining({
        lessonId: 'demo',
        taskId: 3,
        taskTitle: 'Loops',
        text: 'Hint too long',
        teacherEmail: 't@x.test',
        reportId: '1000',
      })
    )
  })
})
