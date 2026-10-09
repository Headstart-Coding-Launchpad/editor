import { describe, expect, it } from 'vitest'
import {
  CONFIDENCE_COLOURS,
  CONFIDENCE_SCALE,
  LEGACY_CONFIDENCE_SCALE,
  confidenceColour,
  confidenceLevels,
  confidenceTextColour,
  emptyConfidenceDistribution,
  formatConfidence,
  parseConfidenceRating,
  reportConfidenceScale,
  tallyConfidenceSpread,
} from '../confidenceScale'
import { buildSessionReport } from '../lessonReport'
import { validateLessonCore } from '../lessonValidation'
import { CONFIDENCE_TASK } from '../../test/fixtures/legacyActivityTasks'

describe('confidence scale', () => {
  it('is 1 to 10, red to green', () => {
    expect(CONFIDENCE_SCALE).toBe(10)
    expect(confidenceLevels()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(CONFIDENCE_COLOURS).toHaveLength(10)
    expect(confidenceColour(1)).toBe(CONFIDENCE_COLOURS[0])
    expect(confidenceColour(10)).toBe(CONFIDENCE_COLOURS[9])
  })

  it('parses whole-number ratings on the scale only', () => {
    expect(parseConfidenceRating('7')).toBe(7)
    expect(parseConfidenceRating(10)).toBe(10)
    expect(parseConfidenceRating('11')).toBeNull()
    expect(parseConfidenceRating('0')).toBeNull()
    expect(parseConfidenceRating('2.5')).toBeNull()
    expect(parseConfidenceRating('abc')).toBeNull()
    expect(parseConfidenceRating('')).toBeNull()
    expect(parseConfidenceRating('6', LEGACY_CONFIDENCE_SCALE)).toBeNull()
  })

  it('formats N/10', () => {
    expect(formatConfidence('7')).toBe('7/10')
    expect(formatConfidence('4', 5)).toBe('4/5')
    expect(formatConfidence('x')).toBe('')
  })

  it('reads an old report (no ratingScale) as 1 to 5, a new one as recorded', () => {
    expect(reportConfidenceScale({ ratingDistribution: { 1: 0 } })).toBe(5)
    expect(reportConfidenceScale({ ratingScale: 10 })).toBe(10)
  })

  it('places an old 1-5 level at the same point of the colour range', () => {
    expect(confidenceColour(1, 5)).toBe(CONFIDENCE_COLOURS[0])
    expect(confidenceColour(5, 5)).toBe(CONFIDENCE_COLOURS[9])
    expect(confidenceColour(99)).toBe('#9ca3af')
  })

  it('uses dark text on the light middle levels', () => {
    expect(confidenceTextColour(1)).toBe('#fff')
    expect(confidenceTextColour(5)).toBe('#1f2937')
    expect(confidenceTextColour(10)).toBe('#fff')
  })

  it('counts an empty distribution per level', () => {
    expect(emptyConfidenceDistribution()).toEqual({
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
      7: 0,
      8: 0,
      9: 0,
      10: 0,
    })
  })

  it('tallies the class spread from mirrored answers', () => {
    const spread = tallyConfidenceSpread([
      { anonymousId: 'a', currentAnswer: '7' },
      { anonymousId: 'b', currentAnswer: '7' },
      { anonymousId: 'c', currentAnswer: '2' },
      { anonymousId: 'd', currentAnswer: null },
      { anonymousId: 'e', currentAnswer: '12' },
    ])
    expect(spread.respondedCount).toBe(3)
    expect(spread.total).toBe(5)
    expect(spread.levels[6]).toEqual({ level: 7, count: 2, studentIds: ['a', 'b'] })
    expect(spread.levels[1]).toEqual({ level: 2, count: 1, studentIds: ['c'] })
    expect(spread.levels.reduce((sum, entry) => sum + entry.count, 0)).toBe(3)
  })
})

describe('confidence in the session report', () => {
  const lesson = { id: 'l', title: 'L', type: 'python', tasks: [CONFIDENCE_TASK] }
  const logged = (submission, loggedAt) => ({
    attemptNumber: 1,
    passed: true,
    submission,
    loggedAt,
  })

  it('records the scale and counts 1-10 ratings', () => {
    const session = {
      students: { a: { displayName: 'A' }, b: { displayName: 'B' } },
      attemptLog: {
        a: { [CONFIDENCE_TASK.id]: { k1: logged(9, 1) } },
        b: { [CONFIDENCE_TASK.id]: { k1: logged(10, 1) } },
      },
    }
    const report = buildSessionReport({ session, lesson })
    const summary = report.taskSummary.find((t) => t.taskId === CONFIDENCE_TASK.id)
    expect(summary.ratingScale).toBe(10)
    expect(summary.ratingDistribution[9]).toBe(1)
    expect(summary.ratingDistribution[10]).toBe(1)
    expect(report.students[0].tasks[0].ratingScale).toBe(10)
  })
})

describe('confidence validation', () => {
  it('warns that a scale field is ignored', () => {
    const result = validateLessonCore({
      id: 'l',
      title: 'L',
      type: 'python',
      tasks: [{ ...CONFIDENCE_TASK, scale: 5 }],
    })
    expect(result.warnings.some((w) => /scale is ignored/.test(w))).toBe(true)
    expect(result.errors.some((e) => /scale/.test(e))).toBe(false)
  })
})
