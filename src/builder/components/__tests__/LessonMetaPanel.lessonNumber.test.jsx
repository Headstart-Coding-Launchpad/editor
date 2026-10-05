import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import LessonMetaPanel from '../LessonMetaPanel'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  onSnapshot: vi.fn(() => () => {}),
}))
vi.mock('../../../shared/firebase', () => ({ firestore: {} }))
vi.mock('../../../shared/useAssets', () => ({
  useAssets: () => ({ lessonAssets: () => [], loading: true }),
}))
vi.mock('../../../shared/useLessonStorageAssets', () => ({
  useLessonStorageAssets: () => ({ storageAssets: [], refresh: () => {} }),
}))
vi.mock('../../../shared/useTypeAssets', () => ({
  useTypeAssets: () => ({ typeStorageAssets: [] }),
}))
vi.mock('../../../auth/useAuth', () => ({ useAuth: () => ({ role: 'teacher' }) }))
vi.mock('../LessonTopicSummary', () => ({ default: () => null }))

const baseLesson = {
  id: 'k3f9x2qp7a',
  type: 'python',
  title: 'Boolean Flags',
  description: '',
  assetsPath: '/assets/k3f9x2qp7a/',
  tasks: [],
}

// Renders the panel against a captured lesson so each onUpdate updater can be applied.
function renderPanel(lesson) {
  let current = lesson
  const onUpdate = vi.fn((updater) => {
    current = typeof updater === 'function' ? updater(current) : updater
  })
  render(<LessonMetaPanel lesson={lesson} onUpdate={onUpdate} />)
  return { onUpdate, getLesson: () => current }
}

describe('LessonMetaPanel lessonNumber field', () => {
  it('shows the current lessonNumber', () => {
    renderPanel({ ...baseLesson, lessonNumber: 9 })
    expect(screen.getByLabelText('Lesson number')).toHaveValue(9)
  })

  it('is empty when the lesson has no number', () => {
    renderPanel(baseLesson)
    expect(screen.getByLabelText('Lesson number')).toHaveValue(null)
  })

  it('stores a typed number as a number', () => {
    const { getLesson } = renderPanel(baseLesson)
    fireEvent.change(screen.getByLabelText('Lesson number'), { target: { value: '6' } })
    expect(getLesson().lessonNumber).toBe(6)
  })

  it('clears to null so a save removes a stored number', () => {
    const { getLesson } = renderPanel({ ...baseLesson, lessonNumber: 9 })
    fireEvent.change(screen.getByLabelText('Lesson number'), { target: { value: '' } })
    expect(getLesson().lessonNumber).toBeNull()
  })
})
