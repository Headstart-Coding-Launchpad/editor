import { render, screen, waitFor, act, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StudentView from '../StudentView'
import { setPythonStuck } from '../../../modules/python/pythonHealth'

// The Fun moment for "Python fell asleep" (deep review 2026-11-10, R3; sketch OK'd by Ryan
// 10 Nov): Python dies under a student in a live class (a mid-class deploy left the old worker
// file gone). Instead of "Getting Python ready..." forever, the code pane says
// "😴 Python fell asleep. Your code is safe 💾" with ONE button, "Reload 🔄". Tapping it saves the
// code and reloads the page, and the same task comes back with their code. The tutor learns once
// (students/{id}/health = 'python_stuck'). Real StudentView → Python StudentWorkspace; only
// Firebase hooks, Pyodide and the page reload itself are mocked.

const mocks = vi.hoisted(() => ({ session: null, identity: null, reloadPage: null }))

vi.mock('../../../modules/python/pyodide', () => ({
  initPyodide: vi.fn(() => Promise.resolve()),
  isPyodideReady: () => true,
  runPython: vi.fn(() => Promise.resolve({ status: 'success' })),
  stopPython: vi.fn(),
  provideInput: vi.fn(),
  updateGpioInputs: vi.fn(),
  getStopCount: () => 0,
  isPythonRunning: () => false,
}))

vi.mock('../../pythonReload', async (importOriginal) => ({
  ...(await importOriginal()),
  reloadPage: (...args) => mocks.reloadPage(...args),
}))

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

vi.mock('../../hooks/usePeerHelp', async () => {
  const { peerHelpModuleMock } = await import('../../hooks/__tests__/peerHelpMock.js')
  return peerHelpModuleMock
})
vi.mock('../../hooks/useSession', () => ({ useSession: () => mocks.session }))
vi.mock('../../hooks/useIdentity', () => ({ useIdentity: () => mocks.identity }))

// A live session; every writer useSession exposes is a spy made on first access.
function makeSession(lessonId) {
  const writers = new Map()
  const values = {
    session: {
      lessonId,
      state: 'active',
      createdAt: 456,
      currentTaskId: 1,
      students: { 'student-1': { displayName: 'Sam', online: true } },
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
  id: 'loops-python',
  title: 'Loops',
  type: 'python',
  tasks: [
    {
      id: 1,
      title: 'Repeat with a loop',
      starterCode: 'for i in range(3):\n    print("Hello!")',
      check: { type: 'output', operator: 'contains', value: 'Hello' },
    },
  ],
}

function renderLesson() {
  mocks.identity = {
    identity: { anonymousId: 'student-1', displayName: 'Sam', lastSessionTimestamp: 456 },
    loaded: true,
    createIdentity: vi.fn(),
    updateTimestamp: vi.fn(),
    updateDisplayName: vi.fn(),
  }
  mocks.session = makeSession(LESSON.id)
  const user = userEvent.setup()
  const view = render(<StudentView lessonId={LESSON.id} lesson={LESSON} />)
  return { user, view, session: mocks.session }
}

const editorText = (container) => container.querySelector('.cm-content')?.textContent ?? ''
const savedKeys = () =>
  Object.keys(localStorage).filter(
    (key) => key.includes(LESSON.id) && key.includes('student-1') && !key.includes('__')
  )

describe('Python fell asleep: one Reload button (R3)', { timeout: 20000 }, () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.reloadPage = vi.fn()
  })
  afterEach(() => {
    act(() => setPythonStuck(false))
    cleanup()
  })

  it('swaps the endless wait for a calm prompt, saves the code and reloads', async () => {
    const { user, view, session } = renderLesson()
    await screen.findByRole('button', { name: 'Run' })
    expect(screen.queryByText(/Python fell asleep/)).toBeNull()

    // The worker dies (onerror, or no "ready" in time).
    act(() => setPythonStuck(true))

    const prompt = await screen.findByTestId('python-asleep')
    expect(prompt).toHaveTextContent('😴 Python fell asleep. Your code is safe 💾')
    expect(screen.queryByText(/Getting Python ready/)).toBeNull()
    // One control in the prompt, and Run cannot be pressed into a dead Python.
    const buttons = prompt.querySelectorAll('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveTextContent('Reload 🔄')
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled()
    // Kid words only.
    expect(prompt.textContent).not.toMatch(/worker|pyodide|error|deploy/i)

    // The tutor learns once.
    await waitFor(() =>
      expect(session.writeStudentHealth).toHaveBeenCalledWith('student-1', 'python_stuck')
    )

    await user.click(buttons[0])
    expect(mocks.reloadPage).toHaveBeenCalledTimes(1)
    // The draft was saved before the reload, through the usual per-task save.
    expect(savedKeys().length).toBeGreaterThan(0)
    expect(editorText(view.container)).toContain('print("Hello!")')
  })

  it('brings the same task back with their own code after the reload', async () => {
    const first = renderLesson()
    await screen.findByRole('button', { name: 'Run' })
    act(() => setPythonStuck(true))
    const prompt = await screen.findByTestId('python-asleep')
    await first.user.click(prompt.querySelector('button'))
    first.view.unmount()

    // Their edits, as the save before the reload would hold them.
    const [key] = savedKeys()
    const record = JSON.parse(localStorage.getItem(key))
    localStorage.setItem(key, JSON.stringify({ ...record, code: 'print("my own loop")' }))

    // The page loads again with a fresh Python.
    act(() => setPythonStuck(false))
    const second = renderLesson()
    await screen.findByRole('button', { name: 'Run' })
    await waitFor(() => expect(editorText(second.view.container)).toContain('my own loop'))
    expect(screen.queryByTestId('python-asleep')).toBeNull()
  })
})
