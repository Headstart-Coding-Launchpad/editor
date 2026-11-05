import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AuthContext from '../../../auth/AuthContext'
import StudentView from '../../views/StudentView'

// Fun moment (platform request #127, sketch 2026-11-05 section 5): an admin previewing a
// lesson taps Feedback on task 3, types one line, tags it and saves. The note lands on
// lessons/L/reviewNotes with the task id and lesson version, the chip on task 3 reads New,
// and as Lesson Gen moves it on (picked_up, then done) the chip follows and the note locks.
// Real StudentView → LessonTaskContent → preview strip; only Firebase-backed hooks are faked.

const mocks = vi.hoisted(() => ({
  lesson: null,
  notes: [],
  listeners: new Set(),
  calls: [],
  subscribedTaskIds: [],
}))

vi.mock('../../../shared/lessonService', () => ({
  fetchLessonById: vi.fn(() => Promise.resolve(mocks.lesson)),
  findSoloCompanion: vi.fn(() => Promise.resolve(null)),
  applyLessonOverride: (lesson) => lesson,
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

// Preview is solo: no live session. Every writer useSession exposes is a no-op spy.
vi.mock('../../hooks/useSession', () => {
  const writers = new Map()
  const session = new Proxy(
    { session: null, loading: false, connected: true },
    {
      get(target, prop) {
        if (prop in target) return target[prop]
        if (typeof prop !== 'string' || prop === 'then') return undefined
        if (!writers.has(prop)) writers.set(prop, () => Promise.resolve())
        return writers.get(prop)
      },
    }
  )
  return { useSession: () => session }
})
vi.mock('../../hooks/useIdentity', () => ({
  useIdentity: () => ({
    identity: { anonymousId: 'preview-1', displayName: 'Preview' },
    loaded: true,
    createIdentity: vi.fn(),
    updateTimestamp: vi.fn(),
    updateDisplayName: vi.fn(),
  }),
}))

// The Firestore side of review notes, kept in memory: one snapshot listener per task, which
// (like the real where('taskId', ...) query) only ever hears that task's notes.
function emit() {
  for (const fn of mocks.listeners) fn()
}
vi.mock('../../reviewNotes/reviewNotesService', () => ({
  subscribeReviewNotes: (lessonId, taskId, onNotes) => {
    mocks.subscribedTaskIds.push(taskId)
    const listener = () =>
      onNotes(mocks.notes.filter((n) => String(n.taskId) === String(taskId)).map((n) => ({ ...n })))
    mocks.listeners.add(listener)
    listener()
    return () => mocks.listeners.delete(listener)
  },
  addReviewNote: vi.fn(async (lessonId, note) => {
    mocks.calls.push({ op: 'add', lessonId, note })
    const id = `note-${mocks.notes.length + 1}`
    mocks.notes.push({
      id,
      lessonId,
      ...note,
      status: 'new',
      createdAt: Date.now(),
      statusChangedAt: Date.now(),
    })
    emit()
    return id
  }),
  updateReviewNote: vi.fn(async (lessonId, noteId, patch) => {
    mocks.calls.push({ op: 'update', lessonId, noteId, patch })
    mocks.notes = mocks.notes.map((n) => (n.id === noteId ? { ...n, ...patch } : n))
    emit()
  }),
  deleteReviewNote: vi.fn(async (lessonId, noteId) => {
    mocks.calls.push({ op: 'delete', lessonId, noteId })
    mocks.notes = mocks.notes.filter((n) => n.id !== noteId)
    emit()
  }),
}))

const LESSON = {
  id: 'L',
  title: 'Spy lesson',
  type: 'python',
  version: 7,
  tasks: [1, 2, 3, 4].map((id) => ({
    id,
    taskType: 'information',
    title: `Task ${id}`,
    explainer: `Explainer ${id}`,
  })),
}

function renderPreview({ role = 'admin', uid = 'admin-1', taskId = 3, lessonProp } = {}) {
  return render(
    <AuthContext.Provider value={{ user: { uid }, role, handle: null, loading: false }}>
      <StudentView
        lessonId="L"
        lesson={lessonProp}
        forceSolo
        previewMode
        allowUnrestrictedTaskNavigation
        initialTaskId={taskId}
      />
    </AuthContext.Provider>
  )
}

function setStatus(status) {
  act(() => {
    mocks.notes = mocks.notes.map((n) => ({ ...n, status, statusChangedAt: Date.now() }))
    emit()
  })
}

beforeEach(() => {
  localStorage.clear()
  mocks.lesson = LESSON
  mocks.notes = []
  mocks.listeners.clear()
  mocks.calls = []
  mocks.subscribedTaskIds = []
})

describe('Preview review notes (Fun moment)', () => {
  it('saves a note on task 3 and its chip follows New, Picked up, Done', async () => {
    const user = userEvent.setup()
    const view = renderPreview()

    await user.click(await screen.findByRole('button', { name: /^Feedback/ }))
    const box = screen.getByRole('dialog', { name: /Feedback on task 3/ })
    await user.type(
      within(box).getByRole('textbox', { name: 'Note' }),
      'Hint gives the answer away'
    )
    await user.selectOptions(within(box).getByRole('combobox', { name: 'Tag' }), 'wrong')
    await user.click(within(box).getByRole('button', { name: 'Save' }))

    const adds = mocks.calls.filter((c) => c.op === 'add')
    expect(adds).toHaveLength(1)
    expect(adds[0]).toMatchObject({
      lessonId: 'L',
      note: {
        taskId: 3,
        lessonVersion: 7,
        text: 'Hint gives the answer away',
        tag: 'wrong',
        createdBy: 'admin-1',
      },
    })

    const chip = await screen.findByTestId('review-notes-chip')
    expect(chip).toHaveTextContent('New')
    expect(screen.getByRole('button', { name: /^Feedback \(1\)/ })).toBeInTheDocument()
    // While New, the note can still be changed or removed from its "..." menu.
    expect(within(box).getByRole('button', { name: 'Note options' })).toBeInTheDocument()

    setStatus('picked_up')
    expect(screen.getByTestId('review-notes-chip')).toHaveTextContent('Picked up')
    expect(within(box).queryByRole('button', { name: 'Note options' })).not.toBeInTheDocument()
    expect(within(box).getByText('Hint gives the answer away')).toBeInTheDocument()

    setStatus('done')
    expect(screen.getByTestId('review-notes-chip')).toHaveTextContent('Done')

    view.unmount()

    // Task 4 has no notes: the button shows, the chip does not.
    renderPreview({ taskId: 4 })
    expect(await screen.findByRole('button', { name: /^Feedback/ })).toBeInTheDocument()
    expect(screen.queryByTestId('review-notes-chip')).not.toBeInTheDocument()
  })

  it('lets the writer edit and delete a note while it is New', async () => {
    const user = userEvent.setup()
    renderPreview()
    await user.click(await screen.findByRole('button', { name: /^Feedback/ }))
    const box = screen.getByRole('dialog', { name: /Feedback on task 3/ })
    await user.type(within(box).getByRole('textbox', { name: 'Note' }), 'Swap 2 and 3')
    await user.click(within(box).getByRole('button', { name: 'Save' }))

    await user.click(await within(box).findByRole('button', { name: 'Note options' }))
    await user.click(within(box).getByRole('button', { name: 'Edit' }))
    const input = within(box).getByRole('textbox', { name: 'Note' })
    expect(input).toHaveValue('Swap 2 and 3')
    await user.clear(input)
    await user.type(input, 'Swap tasks 2 and 3')
    await user.click(within(box).getByRole('button', { name: 'Save' }))
    expect(mocks.calls.at(-1)).toMatchObject({
      op: 'update',
      noteId: 'note-1',
      patch: { text: 'Swap tasks 2 and 3', tag: null },
    })

    await user.click(within(box).getByRole('button', { name: 'Note options' }))
    await user.click(within(box).getByRole('button', { name: 'Delete' }))
    expect(mocks.calls.at(-1)).toMatchObject({ op: 'delete', noteId: 'note-1' })
    await waitFor(() => expect(screen.queryByTestId('review-notes-chip')).not.toBeInTheDocument())
  })

  it('listens to the shown task only', async () => {
    mocks.notes = [
      { id: 'x', lessonId: 'L', taskId: 2, text: 'On task 2', status: 'done', createdBy: 'a' },
    ]
    renderPreview()
    expect(await screen.findByRole('button', { name: /^Feedback$/ })).toBeInTheDocument()
    expect(mocks.subscribedTaskIds).toEqual([3])
    expect(screen.queryByTestId('review-notes-chip')).not.toBeInTheDocument()
  })

  it('Escape closes the box and drops the draft, like Close', async () => {
    const user = userEvent.setup()
    renderPreview()
    await user.click(await screen.findByRole('button', { name: /^Feedback/ }))
    let box = screen.getByRole('dialog', { name: /Feedback on task 3/ })
    await user.type(within(box).getByRole('textbox', { name: 'Note' }), 'Half a thought')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Feedback/ }))
    box = screen.getByRole('dialog', { name: /Feedback on task 3/ })
    expect(within(box).getByRole('textbox', { name: 'Note' })).toHaveValue('')
  })

  it('does not save on the Enter that ends an IME composition', async () => {
    const user = userEvent.setup()
    renderPreview()
    await user.click(await screen.findByRole('button', { name: /^Feedback/ }))
    const input = within(screen.getByRole('dialog')).getByRole('textbox', { name: 'Note' })
    await user.type(input, 'kanji')
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    expect(mocks.calls).toHaveLength(0)
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(mocks.calls).toHaveLength(1))
  })

  it('never mounts outside the Classroom preview (the student path)', async () => {
    render(
      <AuthContext.Provider
        value={{ user: { uid: 'admin-1' }, role: 'admin', handle: null, loading: false }}
      >
        <StudentView lessonId="L" forceSolo allowUnrestrictedTaskNavigation initialTaskId={3} />
      </AuthContext.Provider>
    )
    expect(await screen.findByText('Explainer 3')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Feedback/ })).not.toBeInTheDocument()
    expect(mocks.subscribedTaskIds).toEqual([])
  })

  it('shows nothing to a tutor', async () => {
    renderPreview({ role: 'teacher', uid: 'tutor-1' })
    expect(await screen.findByText('Explainer 3')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Feedback/ })).not.toBeInTheDocument()
  })

  it('does not show in the Builder preview (lesson passed in)', async () => {
    renderPreview({ lessonProp: LESSON })
    expect(await screen.findByText('Explainer 3')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Feedback/ })).not.toBeInTheDocument()
  })
})
