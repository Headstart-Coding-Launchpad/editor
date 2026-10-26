// @vitest-environment node
// The activity badges end to end: real activity submissions (as each activity's buildSubmission
// writes them to the attemptLog) through buildLiveTimelines and the badge rules.
import { describe, expect, it } from 'vitest'
import { evaluateBadgeRules } from '../evaluate.js'
import { buildLiveTimelines, liveBadgeLesson } from '../liveTimeline.js'
import { getBadgeDefinitions } from '../registry.pure.js'
import { getTaskActivity } from '../../activities/registry.pure.js'

const TASKS = {
  classifier: {
    id: 'c1',
    title: 'Teach the pad',
    taskType: 'activity',
    activityType: 'classifier',
    mode: 'drawing',
    classes: ['circle', 'line'],
    minExamplesPerClass: 3,
    testSet: 'live',
    liveTestSize: 3,
  },
  nextWord: {
    id: 'n1',
    title: 'Next word',
    taskType: 'activity',
    activityType: 'next_word',
    guesses: 2,
  },
  mouse: {
    id: 'm1',
    title: 'Mouse skills',
    taskType: 'activity',
    activityType: 'mouse',
    targets: [{ id: 'a', x: 0.2, y: 0.5 }],
    items: [{ id: 'i1', action: 'click', target: 'a' }],
  },
  keyboard: {
    id: 'k1',
    title: 'Type it',
    taskType: 'activity',
    activityType: 'keyboard',
    mode: 'type_text',
    items: [{ id: 'a', text: 'Hi' }],
  },
}
const LESSON = { id: 'acts', type: 'python', title: 'Activities', tasks: Object.values(TASKS) }

// What the activity writes to the attemptLog for a state: buildSubmission, as JSON text.
const submission = (task, state) => {
  const def = getTaskActivity(task)
  return JSON.stringify(def.buildSubmission(task, state))
}

function sessionWith(taskId, text, { assisted = false } = {}) {
  return {
    state: 'active',
    currentTaskId: taskId,
    students: { alex: { displayName: 'alex', joinedAt: 1, online: true, currentCode: '' } },
    attemptLog: {
      alex: {
        [taskId]: {
          '-N0001': {
            submission: text,
            passed: true,
            attemptNumber: 1,
            loggedAt: 1000,
            passedAt: 1000,
            ...(assisted ? { teacherAssisted: true } : {}),
          },
        },
      },
    },
  }
}

const timelineOf = (session) => buildLiveTimelines({ session, lesson: LESSON }).alex
const attemptOf = (session) => timelineOf(session).find((event) => event.type === 'attempt')
const suggestedIds = (session) =>
  evaluateBadgeRules({
    timelines: buildLiveTimelines({ session, lesson: LESSON }),
    lesson: liveBadgeLesson(LESSON),
    decisions: {},
    options: { badgeIds: getBadgeDefinitions().map((badge) => badge.id) },
  }).map((suggestion) => suggestion.badgeId)

describe('activity badge results in the live timeline', () => {
  it('Classifier: a round that taught a miss gives AI Fooler, with the ready time', () => {
    const task = TASKS.classifier
    const state = {
      ...getTaskActivity(task).initialState(task),
      live: [
        ['circle', 'circle'],
        ['line', 'circle'],
        ['line', 'line'],
      ],
      misses: [{ actual: 'line', predicted: 'circle', grid: '0'.repeat(256), fixed: true }],
      taught: 1,
      readyAt: 5000,
      examples: { circle: [], line: [] },
    }
    const session = sessionWith('c1', submission(task, state))
    expect(attemptOf(session).result).toEqual({
      core: 3,
      tries: 3,
      right: 2,
      misses: 1,
      taught: 1,
      readyAt: 5000,
    })
    expect(suggestedIds(session)).toContain('ai_fooler')
    expect(suggestedIds(session)).not.toContain('perfect_round')
  })

  it('Next Word: keeps numbers only, never the student sentences', () => {
    const task = TASKS.nextWord
    const def = getTaskActivity(task)
    const state = {
      ...def.initialState(task),
      own: 'my own secret sentence here',
      guesses: 2,
      right: 2,
      generated: 5,
      history: 'rr',
    }
    const session = sessionWith('n1', def.serializeShared(state))
    expect(attemptOf(session).result).toEqual({
      core: 2,
      tries: 2,
      right: 2,
      ownWords: 5,
      generated: 5,
    })
    expect(JSON.stringify(timelineOf(session))).not.toMatch(/secret/)
    expect(suggestedIds(session)).toEqual(expect.arrayContaining(['perfect_round', 'storyteller']))
  })

  it('Mouse: no misses gives Steady Hand, a miss does not', () => {
    const task = TASKS.mouse
    const clean = { v: 1, device: { touch: false }, misses: 0, items: { i1: { via: 'click' } } }
    const session = sessionWith('m1', submission(task, clean))
    expect(attemptOf(session).result).toEqual({ core: 1, tries: 1, misses: 0 })
    expect(suggestedIds(session)).toEqual(['steady_hand'])
    const slip = { ...clean, misses: 2 }
    expect(suggestedIds(sessionWith('m1', submission(task, slip)))).toEqual([])
  })

  it('Keyboard: 100% accuracy gives Keyboard Ace', () => {
    const task = TASKS.keyboard
    const typed = (accuracy) => ({
      v: 1,
      items: { a: { typed: 'Hi', accuracy, wpm: 10, cpm: 50, done: true } },
    })
    expect(suggestedIds(sessionWith('k1', submission(task, typed(1))))).toEqual(['keyboard_ace'])
    expect(suggestedIds(sessionWith('k1', submission(task, typed(0.5))))).toEqual([])
  })

  it('leaves no result for a bad submission or a failed attempt', () => {
    const bad = sessionWith('m1', '{not json')
    expect(attemptOf(bad)).not.toHaveProperty('result')
    const failed = sessionWith('m1', submission(TASKS.mouse, { v: 1, items: {} }))
    failed.attemptLog.alex.m1['-N0001'].passed = false
    expect(attemptOf(failed)).not.toHaveProperty('result')
  })

  it('a teacher-assisted pass is not real, so earns nothing', () => {
    const clean = { v: 1, device: { touch: false }, misses: 0, items: { i1: { via: 'click' } } }
    const session = sessionWith('m1', submission(TASKS.mouse, clean), { assisted: true })
    expect(suggestedIds(session)).toEqual([])
  })
})
