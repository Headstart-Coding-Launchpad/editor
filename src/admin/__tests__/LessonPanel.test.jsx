import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import LessonPanel from '../LessonPanel'

vi.mock('firebase/firestore', () => ({
  collection:      vi.fn((_db, name) => ({ __collection: name })),
  collectionGroup: vi.fn((_db, name) => ({ __collectionGroup: name })),
  query:           vi.fn(q => q),
  orderBy:         vi.fn(),
  onSnapshot:      vi.fn(() => vi.fn()),
  getDocs:         vi.fn(() => Promise.resolve({ docs: [], size: 0 })),
  deleteDoc:       vi.fn(() => Promise.resolve()),
  setDoc:          vi.fn(() => Promise.resolve()),
  updateDoc:       vi.fn(() => Promise.resolve()),
  doc:             vi.fn((_db, col, id, subcol, subid) => ({ __collection: col, __id: id, __subcollection: subcol, __subid: subid })),
}))

vi.mock('../../shared/firebase', () => ({
  db: {},
  auth: {},
  firestore: {},
}))

vi.mock('../../shared/lessonLinks', () => ({
  getLessonLinks: (id) => ({
    live: `http://localhost/#/lesson/${id}?live=true`,
    solo: `http://localhost/#/lesson/${id}`,
  }),
}))

import { deleteDoc, getDocs, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'

let snapshotCallbacks = {}

function fireLessons(lessons) {
  act(() => {
    snapshotCallbacks.lessons?.({
      docs: lessons.map(l => ({ id: l.id, data: () => l })),
    })
  })
}

function fireLevels(levels = []) {
  act(() => {
    snapshotCallbacks.lessonLevels?.({
      docs: levels.map(l => ({ id: l.id, data: () => l })),
    })
  })
}

function fireClasses(classes = []) {
  act(() => {
    snapshotCallbacks.classes?.({
      docs: classes.map(c => ({ id: c.id, data: () => c })),
    })
  })
}

function fireReports(reports = []) {
  act(() => {
    snapshotCallbacks.sessionReports?.({
      docs: reports.map(r => ({
        id: r.id,
        data: () => r,
        ref: { parent: { parent: { id: r.lessonId } } },
      })),
    })
  })
}

function fireFeedback(feedback = []) {
  act(() => {
    snapshotCallbacks.feedback?.({
      docs: feedback.map(f => ({
        id: f.id,
        data: () => f,
        ref: { parent: { parent: { id: f.lessonId } } },
      })),
    })
  })
}

function fireAll({ lessons = [], levels = [], classes = [], reports = [], feedback = [] } = {}) {
  fireLessons(lessons)
  fireLevels(levels)
  fireClasses(classes)
  fireReports(reports)
  fireFeedback(feedback)
}

async function openFirstLevel(user) {
  const levelToggle = screen.getAllByRole('button', { name: /lesson/i })
    .find(button => button.hasAttribute('aria-expanded'))
  if (levelToggle.getAttribute('aria-expanded') === 'false') {
    await user.click(levelToggle)
  }
}

async function openLesson(user, name = /Intro to Python/i) {
  const lessonToggle = screen.getByRole('button', { name })
  if (lessonToggle.getAttribute('aria-expanded') === 'false') {
    await user.click(lessonToggle)
  }
}

const PYTHON_LESSON = { id: 'py-intro', title: 'Intro to Python', type: 'python', level: 1, tasks: [] }
const HTML_LESSON   = { id: 'html-basics', title: 'HTML Basics', type: 'html', level: 1, tasks: [] }
const SCRATCH_LESSON = { id: 'scratch-1', title: 'Scratch Starter', type: 'scratch', level: null, tasks: [] }
const ELECTRONICS_LESSON = { id: 'electronics-led', title: 'LED Circuit', type: 'electronics', level: 1, tasks: [] }

describe('LessonPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    snapshotCallbacks = {}

    onSnapshot.mockImplementation((ref, successCb) => {
      const key = ref.__collection ?? ref.__collectionGroup
      snapshotCallbacks[key] = successCb
      return vi.fn()
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders lessons grouped by type with correct group headings', () => {
    render(<LessonPanel />)
    fireAll({ lessons: [PYTHON_LESSON, HTML_LESSON, SCRATCH_LESSON, ELECTRONICS_LESSON] })

    expect(screen.getByText('Python')).toBeInTheDocument()
    expect(screen.getByText('HTML')).toBeInTheDocument()
    expect(screen.getByText('Scratch')).toBeInTheDocument()
    expect(screen.getByText('Electronics')).toBeInTheDocument()
  })

  it('renders registered module headings even when that type has no lessons', async () => {
    const user = userEvent.setup()
    render(<LessonPanel />)
    fireAll({ lessons: [PYTHON_LESSON, HTML_LESSON] })

    await user.click(screen.getByRole('button', { name: /Electronics/i }))

    expect(screen.getByText('Electronics')).toBeInTheDocument()
    expect(screen.getByText('No lessons found for this lesson type.')).toBeInTheDocument()
  })

  it('renders the lesson title for each lesson', async () => {
    const user = userEvent.setup()
    render(<LessonPanel />)
    fireAll({ lessons: [PYTHON_LESSON, HTML_LESSON] })

    await openFirstLevel(user)
    expect(screen.getByText('Intro to Python')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /HTML/i }))
    await openFirstLevel(user)
    expect(screen.getByText('HTML Basics')).toBeInTheDocument()
  })

  it('shows an empty state message when no lessons are loaded', () => {
    render(<LessonPanel />)
    fireAll()

    expect(screen.getByText(/No lessons found/i)).toBeInTheDocument()
  })

  it('renders a Launch as Teacher link pointing to the teacher URL', async () => {
    const user = userEvent.setup()
    render(<LessonPanel />)
    fireAll({ lessons: [PYTHON_LESSON] })

    await openFirstLevel(user)
    const links = screen.getAllByRole('link', { name: 'Launch as Teacher' })
    expect(links[0].getAttribute('href')).toContain('/lesson/py-intro?teacher=true')
  })

  it('opens the builder in a new tab when New Lesson is clicked', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'open').mockReturnValue(null)
    render(<LessonPanel />)
    fireAll()

    await user.click(screen.getByRole('button', { name: /\+ New Lesson/i }))
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('#/builder'),
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('shows the live link URL in the share panel', async () => {
    const user = userEvent.setup()
    render(<LessonPanel />)
    fireAll({ lessons: [PYTHON_LESSON] })

    await openFirstLevel(user)
    await openLesson(user)
    await user.click(screen.getByRole('button', { name: 'Share Links' }))
    expect(screen.getByText(/\?live=true/)).toBeInTheDocument()
  })

  it('shows the solo link URL in the share panel', async () => {
    const user = userEvent.setup()
    render(<LessonPanel />)
    fireAll({ lessons: [PYTHON_LESSON] })

    await openFirstLevel(user)
    await openLesson(user)
    await user.click(screen.getByRole('button', { name: 'Share Links' }))
    expect(screen.getAllByText(/\/lesson\/py-intro/).length).toBeGreaterThan(0)
  })

  it('does not show report or feedback rows when a lesson has none', async () => {
    const user = userEvent.setup()
    render(<LessonPanel />)
    fireAll({ lessons: [PYTHON_LESSON] })

    await openFirstLevel(user)
    await openLesson(user)

    expect(screen.queryByRole('button', { name: /Reports/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Feedback/i })).not.toBeInTheDocument()
  })

  it('shows report and feedback rows collapsed below lessons that have them', async () => {
    const user = userEvent.setup()
    render(<LessonPanel />)
    fireAll({
      lessons: [PYTHON_LESSON],
      reports: [{
        id: 'report-1',
        lessonId: 'py-intro',
        lessonTitle: 'Intro report',
        startedAt: Date.UTC(2026, 0, 1),
        students: [{ id: 'student-1' }],
      }],
      feedback: [{
        id: 'feedback-1',
        lessonId: 'py-intro',
        taskTitle: 'Variables',
        teacherEmail: 'teacher@example.com',
        submittedAt: Date.UTC(2026, 0, 2),
        text: 'Clarify the example.',
      }],
    })

    await openFirstLevel(user)

    expect(screen.queryByRole('button', { name: 'Share Links' })).not.toBeInTheDocument()
    expect(screen.queryByText('Intro report')).not.toBeInTheDocument()
    expect(screen.queryByText('Clarify the example.')).not.toBeInTheDocument()

    await openLesson(user)
    expect(screen.getByRole('button', { name: 'Share Links' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Reports.*1 total/i }))
    expect(screen.getByText('Intro report')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Feedback.*1 open \/ 1 total/i }))
    expect(screen.getByText('Clarify the example.')).toBeInTheDocument()
  })

  it('creates a level from the Levels view with emoji and colour values', async () => {
    const user = userEvent.setup()
    render(<LessonPanel view="levels" />)
    fireAll()

    expect(screen.queryByLabelText('What this level applies to')).not.toBeInTheDocument()
    await user.type(screen.getByPlaceholderText('Beginner'), 'Beginner')
    await user.click(screen.getByRole('button', { name: /Use 🚀 icon/i }))
    fireEvent.change(screen.getByLabelText('Level colour'), { target: { value: '#16a34a' } })
    await user.click(screen.getByRole('button', { name: 'Create Level' }))

    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ __collection: 'lessonLevels', __id: 'python-beginner' }),
      expect.objectContaining({
        title: 'Beginner',
        scopeType: 'type',
        scopeId: 'python',
        icon: '🚀',
        color: '#16a34a',
      }),
      { merge: true },
    )
  })

  it('edits a level and updates assigned lesson badge text', async () => {
    const user = userEvent.setup()
    render(<LessonPanel view="levels" />)
    fireAll({
      lessons: [{
        ...PYTHON_LESSON,
        level: 'Beginner',
        levelId: 'python-beginner',
        levelRef: { id: 'python-beginner', scopeType: 'type', scopeId: 'python' },
      }],
      levels: [{
        id: 'python-beginner',
        title: 'Beginner',
        description: 'First steps',
        scopeType: 'type',
        scopeId: 'python',
        order: 1,
        color: '#16a34a',
        icon: '⭐',
      }],
    })

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.clear(screen.getByLabelText('Level title'))
    await user.type(screen.getByLabelText('Level title'), 'Foundations')
    await user.clear(screen.getByLabelText(/Order/))
    await user.type(screen.getByLabelText(/Order/), '2')
    fireEvent.change(screen.getByLabelText('Level colour'), { target: { value: '#2563eb' } })
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ __collection: 'lessonLevels', __id: 'python-beginner' }),
      expect.objectContaining({
        id: 'python-beginner',
        title: 'Foundations',
        scopeType: 'type',
        scopeId: 'python',
        order: 2,
        color: '#2563eb',
      }),
      { merge: true },
    )
    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ __collection: 'lessons', __id: 'py-intro' }),
      {
        level: 'Foundations',
        levelId: 'python-beginner',
        levelRef: { id: 'python-beginner', scopeType: 'type', scopeId: 'python' },
      },
    )
  })

  it('deletes a level and clears that level from assigned lessons', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<LessonPanel view="levels" />)
    fireAll({
      lessons: [{
        ...PYTHON_LESSON,
        level: 'Beginner',
        levelId: 'python-beginner',
        levelRef: { id: 'python-beginner', scopeType: 'type', scopeId: 'python' },
      }],
      levels: [{
        id: 'python-beginner',
        title: 'Beginner',
        scopeType: 'type',
        scopeId: 'python',
        order: 1,
        color: '#16a34a',
        icon: '⭐',
      }],
    })

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ __collection: 'lessons', __id: 'py-intro' }),
      { level: null, levelId: null, levelRef: null },
    )
    expect(deleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ __collection: 'lessonLevels', __id: 'python-beginner' }),
    )
  })

  it('creates a class from the Classes view', async () => {
    const user = userEvent.setup()
    render(<LessonPanel view="classes" />)
    fireAll()

    await user.type(screen.getByPlaceholderText('Maple'), 'Maple Class')
    expect(screen.getByDisplayValue('maple-class')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save Class' }))

    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ __collection: 'classes', __id: 'maple-class' }),
      expect.objectContaining({
        id: 'maple-class',
        name: 'Maple Class',
        archived: false,
      }),
      { merge: true },
    )
  })

  it('forks a stock lesson for a class and opens the fork in Builder', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'open').mockReturnValue(null)
    getDocs.mockResolvedValue({ docs: [], size: 0 })
    render(<LessonPanel />)
    fireAll({
      lessons: [{
        ...PYTHON_LESSON,
        description: 'Intro lesson',
        tasks: [{ id: 1, title: 'Say hi', starterCode: 'print("hi")' }],
      }],
      classes: [{ id: 'maple', name: 'Maple', archived: false }],
    })

    await openFirstLevel(user)
    await openLesson(user)
    await user.selectOptions(screen.getByRole('combobox'), 'maple')
    await user.click(screen.getByRole('button', { name: /Create py-intro-maple/i }))

    await waitFor(() => {
      expect(setDoc).toHaveBeenCalledWith(
        expect.objectContaining({ __collection: 'lessons', __id: 'py-intro-maple' }),
        expect.objectContaining({
          id: 'py-intro-maple',
          title: 'Intro to Python - Maple',
          stage: 'published',
          fork: expect.objectContaining({
            sourceLessonId: 'py-intro',
            classId: 'maple',
            taskLinks: [{ taskId: 1, sourceTaskId: 1, relation: 'copied' }],
          }),
        }),
      )
    })
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('#/builder?load=py-intro-maple'),
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('blocks uploaded lessons that fail builder validation', async () => {
    const user = userEvent.setup()
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const { container } = render(<LessonPanel />)
    fireAll()
    const input = container.querySelector('input[type="file"]')
    const file = new File(
      [JSON.stringify({ id: 'bad-lesson', type: 'python', title: '', tasks: [] })],
      'bad-lesson.json',
      { type: 'application/json' },
    )

    await user.upload(input, file)

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot upload lesson until these validation errors are fixed'))
    expect(setDoc).not.toHaveBeenCalled()
  })

  it('publishes a valid uploaded lesson through the shared lesson service', async () => {
    const user = userEvent.setup()
    const { container } = render(<LessonPanel />)
    fireAll()
    const input = container.querySelector('input[type="file"]')
    const file = new File(
      [JSON.stringify({
        id: 'python-upload',
        type: 'python',
        title: 'Uploaded Python',
        tasks: [{ id: 1, title: 'Say hi', starterCode: 'print("hi")' }],
      })],
      'python-upload.json',
      { type: 'application/json' },
    )

    await user.upload(input, file)

    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ __collection: 'lessons', __id: 'python-upload' }),
      expect.objectContaining({ id: 'python-upload', type: 'python', title: 'Uploaded Python' }),
    )
  })
})
