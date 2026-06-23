import { describe, expect, it } from 'vitest'
import {
  auditLessonTopics,
  collectLessonTopicReferences,
  extractTopicIdsFromText,
  normalizeTopicLinks,
  validateTopicStage,
} from '../topicAudit'

const lesson = {
  stage: 'details',
  topicProposals: [
    { id: 'range-function', title: 'range()', description: 'Produces numbers.', status: 'proposed' },
    { id: 'unused-topic', title: 'Unused', description: 'Not used yet.', status: 'proposed' },
  ],
  tasks: [
    {
      id: 1,
      title: 'Plan a loop',
      taskType: 'draft',
      topicLinks: ['for-loop', 'range-function'],
      studentFacingContent: 'Read [[iteration|repetition]].',
      hintsAndSupport: 'See #topic/loop-variable',
    },
    {
      id: 'g-1',
      type: 'group',
      title: 'Practice',
      subtasks: [
        {
          id: 2,
          title: 'Use a loop',
          explainer: 'Use [[for-loop]].',
          hints: [{ text: 'Remember [[range-function]].' }],
        },
      ],
    },
  ],
}

describe('topic audit', () => {
  it('parses supported link formats and plain topicLinks IDs', () => {
    expect(extractTopicIdsFromText('[[for-loop|Loops]] and #topic/range-function')).toEqual([
      'for-loop',
      'range-function',
    ])
    expect(normalizeTopicLinks('for-loop, range-function')).toEqual(['for-loop', 'range-function'])
  })

  it('collects draft, final, nested hint, and grouped-task references', () => {
    expect(collectLessonTopicReferences(lesson)).toEqual([
      { id: 'for-loop', tasks: [
        { id: 1, title: 'Plan a loop', index: 1, groupTitle: null },
        { id: 2, title: 'Use a loop', index: 2, groupTitle: 'Practice' },
      ] },
      { id: 'iteration', tasks: [
        { id: 1, title: 'Plan a loop', index: 1, groupTitle: null },
      ] },
      { id: 'loop-variable', tasks: [
        { id: 1, title: 'Plan a loop', index: 1, groupTitle: null },
      ] },
      { id: 'range-function', tasks: [
        { id: 1, title: 'Plan a loop', index: 1, groupTitle: null },
        { id: 2, title: 'Use a loop', index: 2, groupTitle: 'Practice' },
      ] },
    ])
  })

  it('matches proposals and reports unreferenced proposals', () => {
    const audit = auditLessonTopics(lesson, [{ id: 'for-loop' }, { id: 'iteration' }])
    expect(audit.existing.map(item => item.id)).toEqual(['for-loop', 'iteration'])
    expect(audit.missing.find(item => item.id === 'range-function')?.proposal?.status).toBe('proposed')
    expect(audit.unusedProposals.map(item => item.id)).toEqual(['unused-topic'])
  })

  it('enforces review and publication stage rules', () => {
    const review = validateTopicStage(lesson, [{ id: 'for-loop' }, { id: 'iteration' }], 'review')
    expect(review.valid).toBe(false)
    expect(review.errors[0]).toContain('loop-variable')
    expect(review.errors[0]).not.toContain('range-function')

    const published = validateTopicStage(lesson, [{ id: 'for-loop' }, { id: 'iteration' }], 'published')
    expect(published.valid).toBe(false)
    expect(published.errors[0]).toContain('range-function')
    expect(published.warnings[1]).toContain('unused-topic')
  })
})
