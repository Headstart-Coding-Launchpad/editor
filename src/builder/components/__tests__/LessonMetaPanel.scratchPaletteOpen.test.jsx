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

const scratchLesson = {
  id: 'k3f9x2qp7b',
  type: 'scratch',
  title: 'Move the cat',
  description: '',
  assetsPath: '/assets/k3f9x2qp7b/',
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

// The Field's own label ("Scratch block palette") is part of the checkbox's name too.
const LABEL = /Keep the block palette open for this lesson/

// The calm Scratch screen starts the block palette closed behind a Blocks button; this lesson-level
// opt-out (scratchPaletteOpen) starts it open again.
describe('LessonMetaPanel scratchPaletteOpen checkbox', () => {
  it('is off for a Scratch lesson without the field (the palette starts closed)', () => {
    renderPanel(scratchLesson)
    expect(screen.getByRole('checkbox', { name: LABEL })).not.toBeChecked()
  })

  it('shows a stored true as ticked', () => {
    renderPanel({ ...scratchLesson, scratchPaletteOpen: true })
    expect(screen.getByRole('checkbox', { name: LABEL })).toBeChecked()
  })

  it('sets true when ticked', () => {
    const { getLesson } = renderPanel(scratchLesson)
    fireEvent.click(screen.getByRole('checkbox', { name: LABEL }))
    expect(getLesson().scratchPaletteOpen).toBe(true)
  })

  it('removes the key when unticked (no null left behind to show up in an export diff)', () => {
    const { getLesson } = renderPanel({ ...scratchLesson, scratchPaletteOpen: true })
    fireEvent.click(screen.getByRole('checkbox', { name: LABEL }))
    expect('scratchPaletteOpen' in getLesson()).toBe(false)
  })

  it('still shows a stale field on a lesson with no Scratch, so it can be cleared', () => {
    const { getLesson } = renderPanel({
      ...scratchLesson,
      type: 'python',
      scratchPaletteOpen: true,
    })
    const box = screen.getByRole('checkbox', { name: LABEL })
    expect(box).toBeChecked()
    fireEvent.click(box)
    expect('scratchPaletteOpen' in getLesson()).toBe(false)
  })

  it('is offered on a composed lesson with a Scratch module', () => {
    renderPanel({
      ...scratchLesson,
      type: 'composed',
      modules: [{ id: 'm1', type: 'scratch' }],
    })
    expect(screen.getByRole('checkbox', { name: LABEL })).toBeInTheDocument()
  })

  it('is not offered on a lesson with no Scratch', () => {
    renderPanel({ ...scratchLesson, type: 'python' })
    expect(screen.queryByRole('checkbox', { name: LABEL })).not.toBeInTheDocument()
  })
})
