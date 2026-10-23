import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StudentView from '../../../app/views/StudentView'
import { getActivityDefinition } from '../../registry.pure.js'

// Real click-through: renders the real StudentView → LessonTaskContent → ActivityHost →
// useActivityState chain for a lesson containing this activity, mocking only Firebase-backed
// hooks. Unit tests of a view can pass while the real classroom crashes; this catches that.
// (Skipped inside src/activities/_template, which is never registered.)
// Drives the real pad (pointer events) and buttons, and asserts what is written where: the
// drawings stay in this browser's storage; Firebase only ever gets counts, rights and misses.

const mocks = vi.hoisted(() => ({ session: null, identity: null }))

vi.mock('../../../shared/lessonService', () => ({
  fetchLessonById: vi.fn(() => Promise.resolve(null)),
  findSoloCompanion: vi.fn(() => Promise.resolve(null)),
  applyLessonOverride: (lesson, overrideTasks) =>
    overrideTasks ? { ...lesson, tasks: overrideTasks } : lesson,
}))

vi.mock('../../../shared/useLessonStorageAssets', () => ({
  useLessonStorageAssets: () => ({
    storageAssets: [],
    folderAssets: [],
    loading: false,
    error: null,
    refresh: () => Promise.resolve(),
  }),
}))

vi.mock('../../../shared/useTypeAssets', () => ({
  useTypeAssets: () => ({
    typeStorageAssets: [],
    defaultSprites: [],
    defaultBackdrops: [],
    loading: false,
    error: null,
  }),
}))

vi.mock('../../../app/hooks/useSession', () => ({ useSession: () => mocks.session }))
vi.mock('../../../app/hooks/useIdentity', () => ({ useIdentity: () => mocks.identity }))

// A live session on task `currentTaskId`. Every writer useSession exposes is a spy.
function makeSession(lessonId, currentTaskId = 1) {
  const writers = new Map()
  const values = {
    session: {
      lessonId,
      state: 'active',
      createdAt: 456,
      currentTaskId,
      students: { 'student-1': { displayName: 'Sam' } },
    },
    loading: false,
    connected: true,
  }
  return new Proxy(values, {
    get(target, prop) {
      if (prop in target) return target[prop]
      if (typeof prop !== 'string' || prop === 'then') return undefined
      if (!writers.has(prop))
        writers.set(
          prop,
          vi.fn(() => Promise.resolve())
        )
      return writers.get(prop)
    },
  })
}

const LESSON = {
  id: 'classifier-click',
  title: 'Classifier click-through',
  type: 'python',
  tasks: [
    {
      id: 1,
      title: 'Train a classifier',
      taskType: 'activity',
      activityType: 'classifier',
      mode: 'drawing',
      classes: ['circle', 'line'],
      minExamplesPerClass: 3,
      liveTestSize: 3,
    },
  ],
}

beforeEach(() => {
  localStorage.clear()
  mocks.session = makeSession(LESSON.id)
  mocks.identity = {
    identity: { anonymousId: 'student-1', displayName: 'Sam', lastSessionTimestamp: 456 },
    loaded: true,
    createIdentity: vi.fn(),
    updateTimestamp: vi.fn(),
    updateDisplayName: vi.fn(),
  }
})

function drawStroke(pad, points) {
  const [first, ...rest] = points
  fireEvent.pointerDown(pad, { pointerId: 1, clientX: first[0], clientY: first[1] })
  for (const [x, y] of rest) fireEvent.pointerMove(pad, { pointerId: 1, clientX: x, clientY: y })
  fireEvent.pointerUp(pad, { pointerId: 1 })
}

const circleStroke = (r) =>
  Array.from({ length: 25 }, (_, i) => [
    0.5 + r * Math.cos((i / 24) * 2 * Math.PI),
    0.5 + r * Math.sin((i / 24) * 2 * Math.PI),
  ])

describe.skipIf(!getActivityDefinition('classifier'))(
  'Classifier StudentView click-through',
  () => {
    it('teaches, runs the round, marks as you go and sends no drawing to Firebase', async () => {
      render(<StudentView lessonId={LESSON.id} lesson={LESSON} />)
      const pad = await screen.findByTestId('classifier-pad')
      expect(screen.queryByRole('button', { name: 'Run' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /train/i })).not.toBeInTheDocument()

      for (let i = 0; i < 3; i += 1) {
        drawStroke(pad, circleStroke(0.25 + i * 0.04))
        fireEvent.click(screen.getByRole('button', { name: 'Add this drawing to circle' }))
      }
      for (let i = 0; i < 3; i += 1) {
        drawStroke(pad, [
          [0.1, 0.5 + i * 0.02],
          [0.9, 0.5 - i * 0.02],
        ])
        fireEvent.click(screen.getByRole('button', { name: 'Add this drawing to line' }))
      }

      // The round: it suggests circle, line, circle. After Done the student says what they drew;
      // each right answer shows its tick for a moment, then the round moves on by itself.
      const shapes = [
        ['circle', () => drawStroke(pad, circleStroke(0.3))],
        [
          'line',
          () =>
            drawStroke(pad, [
              [0.1, 0.5],
              [0.9, 0.5],
            ]),
        ],
        ['circle', () => drawStroke(pad, circleStroke(0.35))],
      ]
      for (const [name, draw] of shapes) {
        const done = await screen.findByRole('button', { name: 'Done' }, { timeout: 3000 })
        draw()
        fireEvent.click(done)
        fireEvent.click(await screen.findByRole('button', { name: 'I drew ' + name }))
      }
      expect(await screen.findByText('3 of 3 done')).toBeInTheDocument()

      // The latest card update has counts and misses, and no drawing (the final right answer goes with
      // the submitted run below).
      await waitFor(() => {
        const sent = mocks.session.writeStudentAnswer.mock.calls
        expect(sent.length).toBeGreaterThan(0)
        expect(JSON.parse(sent[sent.length - 1][1])).toMatchObject({
          counts: { circle: 3, line: 3 },
          trained: true,
          misses: 0,
        })
      })
      for (const [, answer] of mocks.session.writeStudentAnswer.mock.calls) {
        expect(answer).not.toMatch(/examples/)
        expect(JSON.parse(answer).shared).toBe(true)
      }

      // Reaching the right answers marks the task, with no Check button.
      expect(screen.queryByRole('button', { name: 'Check my work' })).not.toBeInTheDocument()
      await waitFor(() => expect(mocks.session.writeStudentRun).toHaveBeenCalled())
      const [id, run] = mocks.session.writeStudentRun.mock.calls[0]
      expect(id).toBe('student-1')
      expect(run.status).toBe('submitted')
      expect(run.checkPassed).toBe(true)
      expect(JSON.parse(run.answer)).toMatchObject({
        v: 1,
        shared: true,
        classes: ['circle', 'line'],
        counts: { circle: 3, line: 3 },
        trained: true,
        liveCount: 3,
        rights: 3,
        misses: 0,
      })
      expect(run.answer).not.toMatch(/examples/)

      expect(mocks.session.writeStudentCode).not.toHaveBeenCalled()

      // The drawings themselves are saved on this device only.
      const saved = Object.keys(localStorage)
        .filter((key) => key.includes('___activity_state___'))
        .map((key) => localStorage.getItem(key))
      expect(saved.some((value) => value.includes('examples'))).toBe(true)
    }, 20000)
  }
)
