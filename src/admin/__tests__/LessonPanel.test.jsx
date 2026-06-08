import React from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import LessonPanel from '../LessonPanel'

vi.mock('firebase/firestore', () => ({
  collection:   vi.fn((_db, name) => ({ __collection: name })),
  onSnapshot:   vi.fn(() => vi.fn()),
  deleteDoc:    vi.fn(() => Promise.resolve()),
  setDoc:       vi.fn(() => Promise.resolve()),
  doc:          vi.fn((_db, col, id) => ({ __collection: col, __id: id })),
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

import { onSnapshot } from 'firebase/firestore'

let snapshotCallback = null

function fireLessons(lessons) {
  act(() => {
    snapshotCallback?.({
      docs: lessons.map(l => ({ id: l.id, data: () => l })),
    })
  })
}

const PYTHON_LESSON = { id: 'py-intro', title: 'Intro to Python', type: 'python', level: 1, tasks: [] }
const HTML_LESSON   = { id: 'html-basics', title: 'HTML Basics', type: 'html', level: 1, tasks: [] }
const SCRATCH_LESSON = { id: 'scratch-1', title: 'Scratch Starter', type: 'scratch', level: null, tasks: [] }

describe('LessonPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    snapshotCallback = null

    onSnapshot.mockImplementation((_colRef, successCb) => {
      snapshotCallback = successCb
      return vi.fn()
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders lessons grouped by type with correct group headings', () => {
    render(<LessonPanel />)
    fireLessons([PYTHON_LESSON, HTML_LESSON, SCRATCH_LESSON])

    expect(screen.getByText('Python')).toBeInTheDocument()
    expect(screen.getByText('HTML')).toBeInTheDocument()
    expect(screen.getByText('Scratch')).toBeInTheDocument()
  })

  it('renders the lesson title for each lesson', () => {
    render(<LessonPanel />)
    fireLessons([PYTHON_LESSON, HTML_LESSON])

    expect(screen.getByText('Intro to Python')).toBeInTheDocument()
    expect(screen.getByText('HTML Basics')).toBeInTheDocument()
  })

  it('shows an empty state message when no lessons are loaded', () => {
    render(<LessonPanel />)
    fireLessons([])

    expect(screen.getByText(/No lessons found/i)).toBeInTheDocument()
  })

  it('renders a Launch as Teacher link pointing to the teacher URL', () => {
    render(<LessonPanel />)
    fireLessons([PYTHON_LESSON])

    const links = screen.getAllByRole('link', { name: 'Launch as Teacher' })
    expect(links[0].getAttribute('href')).toContain('/lesson/py-intro?teacher=true')
  })

  it('opens the builder in a new tab when New Lesson is clicked', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'open').mockReturnValue(null)
    render(<LessonPanel />)
    fireLessons([])

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
    fireLessons([PYTHON_LESSON])

    await user.click(screen.getByRole('button', { name: 'Share Links' }))
    expect(screen.getByText(/\?live=true/)).toBeInTheDocument()
  })

  it('shows the solo link URL in the share panel', async () => {
    const user = userEvent.setup()
    render(<LessonPanel />)
    fireLessons([PYTHON_LESSON])

    await user.click(screen.getByRole('button', { name: 'Share Links' }))
    expect(screen.getAllByText(/\/lesson\/py-intro/).length).toBeGreaterThan(0)
  })
})
