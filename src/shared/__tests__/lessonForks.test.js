import { describe, expect, it } from 'vitest'
import { buildLessonFork, makeClassRecord, makeForkLessonId } from '../lessonForks'

describe('lesson fork helpers', () => {
  it('builds deterministic class fork ids and titles', () => {
    expect(makeForkLessonId('python-l3-09', 'Maple Class')).toBe('python-l3-09-maple-class')
    expect(makeClassRecord({ name: 'Maple Class' })).toMatchObject({
      id: 'maple-class',
      name: 'Maple Class',
      archived: false,
    })
  })

  it('copies a stock lesson as a published class fork with task lineage', () => {
    const fork = buildLessonFork(
      {
        id: 'python-l3-09',
        title: 'Dictionaries',
        type: 'python',
        description: 'Practice dictionaries',
        stage: 'published',
        tasks: [
          { id: 1, title: 'Intro', taskType: 'information', explainer: 'Hi' },
          {
            id: 'g-1',
            type: 'group',
            title: 'Practice',
            subtasks: [{ id: 2, title: 'Code', starterCode: '' }],
          },
        ],
      },
      { id: 'maple', name: 'Maple' },
      123
    )

    expect(fork).toMatchObject({
      id: 'python-l3-09-maple',
      title: 'Dictionaries - Maple',
      stage: 'published',
      fork: {
        sourceLessonId: 'python-l3-09',
        classId: 'maple',
        className: 'Maple',
        createdAt: 123,
        updatedAt: 123,
        taskLinks: [
          { taskId: 1, sourceTaskId: 1, relation: 'copied' },
          { taskId: 2, sourceTaskId: 2, relation: 'copied' },
        ],
      },
    })
  })
})
