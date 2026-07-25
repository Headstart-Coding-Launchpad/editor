import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BuilderView from '../views/BuilderView'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setDoc: vi.fn(),
  lessonDoc: { path: 'lessons/incomplete-lesson' },
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(() => mocks.lessonDoc),
  getDocs: vi.fn(),
  query: vi.fn(),
  setDoc: mocks.setDoc,
  where: vi.fn(),
}))

vi.mock('../../shared/firebase', () => ({
  firestore: {},
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ role: 'admin' }),
}))

vi.mock('../../shared/useTypeAssets', () => ({
  useTypeAssets: () => ({ defaultSprites: [] }),
}))

vi.mock('../hooks/useBuilderState', () => ({
  useBuilderState: ({ lesson }) => ({
    selectedTaskId: null,
    selectedGroupId: null,
    selectTask: vi.fn(),
    selectGroup: vi.fn(),
    handleLessonUpdate: vi.fn(),
    handleAddTask: vi.fn(),
    handleAddGroup: vi.fn(),
    handleAddSubtask: vi.fn(),
    handleDuplicate: vi.fn(),
    handleDelete: vi.fn(),
    handleDeleteGroup: vi.fn(),
    handleReorder: vi.fn(),
    handleReorderSubtask: vi.fn(),
    errors: ['Lesson title is required'],
    warnings: [],
    selectedTask: null,
    selectedGroup: null,
    lessonForEditor: lesson,
    selectedTaskGroup: null,
  }),
}))

vi.mock('../components/LessonMetaPanel', () => ({ default: () => null }))
vi.mock('../components/TaskList', () => ({ default: () => null }))
vi.mock('../components/TaskEditor', () => ({ default: () => null }))
vi.mock('../components/GroupEditor', () => ({ default: () => null }))
vi.mock('../components/ValidationPanel', () => ({ default: () => null }))
vi.mock('../components/TaskFeedbackPanel', () => ({ default: () => null }))
vi.mock('../views/PreviewView', () => ({ default: () => null }))

describe('BuilderView Firestore save', () => {
  beforeEach(() => {
    mocks.navigate.mockReset()
    mocks.setDoc.mockReset().mockResolvedValue(undefined)
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(window, 'confirm').mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('refuses legacy draft records instead of silently saving them', async () => {
    const lesson = {
      id: 'incomplete-lesson',
      title: 'Legacy lesson',
      type: 'python',
      tasks: [{ id: 'draft-1', taskType: 'draft', title: '' }],
    }
    const onMarkSaved = vi.fn()

    render(
      <BuilderView
        lesson={lesson}
        dirty
        onUpdate={vi.fn()}
        onNew={vi.fn()}
        onMarkSaved={onMarkSaved}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(mocks.setDoc).not.toHaveBeenCalled()
    expect(window.alert).toHaveBeenCalledOnce()
    expect(window.confirm).not.toHaveBeenCalled()
    expect(onMarkSaved).not.toHaveBeenCalled()
    expect(mocks.navigate).not.toHaveBeenCalled()
  })
})
