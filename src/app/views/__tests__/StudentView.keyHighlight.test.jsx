import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import StudentView from '../StudentView'

// The Fun moment for the tutor key highlight (request #126): the tutor says "now the bracket"
// and that exact key on the student's iPad glows; the student taps it, the glow stops and the
// bracket is in their code. Real StudentView → Python StudentWorkspace → PythonEditor →
// CodeMirror; only Firebase hooks, Pyodide and the touch probe are mocked.

const mocks = vi.hoisted(() => ({ session: null, identity: null, touch: true }))

vi.mock('../../../modules/python/pyodide', () => ({
  initPyodide: vi.fn(() => Promise.resolve()),
  isPyodideReady: () => true,
  runPython: vi.fn(() => new Promise(() => {})),
  stopPython: vi.fn(),
  provideInput: vi.fn(),
  updateGpioInputs: vi.fn(),
  getStopCount: () => 0,
  isPythonRunning: () => false,
}))

vi.mock('../../../shared/useIsTouchDevice', () => ({
  useIsTouchDevice: () => mocks.touch,
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
function makeSession(lessonId, extra = {}) {
  const writers = new Map()
  const values = {
    session: {
      lessonId,
      state: 'active',
      createdAt: 456,
      currentTaskId: 1,
      students: { 'student-1': { displayName: 'Sam' }, 'student-2': { displayName: 'Ali' } },
      ...extra,
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

// jsdom has no layout: every element gets a full-screen box, and each <button> its own small
// box (by document order), so the ring's position says exactly which button it is on.
const PAD = 5 // ControlHighlightRing's padding
const originalElementRect = Element.prototype.getBoundingClientRect
const originalRangeRects = Range.prototype.getClientRects
const originalRangeBounds = Range.prototype.getBoundingClientRect
const emptyRect = { x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 }

function buttonBox(button) {
  const index = [...document.querySelectorAll('button')].indexOf(button)
  const left = 10 + (index % 18) * 50
  const top = 100 + Math.floor(index / 18) * 50
  return { x: left, y: top, left, top, right: left + 44, bottom: top + 44, width: 44, height: 44 }
}

beforeAll(() => {
  Range.prototype.getClientRects = () => ({
    length: 0,
    item: () => null,
    [Symbol.iterator]: [][Symbol.iterator],
  })
  Range.prototype.getBoundingClientRect = () => emptyRect
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    if (!this.isConnected) return emptyRect
    if (this.tagName === 'BUTTON') return buttonBox(this)
    return { x: 0, y: 0, left: 0, top: 0, right: 1024, bottom: 768, width: 1024, height: 768 }
  }
})

afterAll(() => {
  Element.prototype.getBoundingClientRect = originalElementRect
  Range.prototype.getClientRects = originalRangeRects
  Range.prototype.getBoundingClientRect = originalRangeBounds
})

const LESSON = {
  id: 'key-highlight',
  title: 'Keys',
  type: 'python',
  tasks: [{ id: 1, title: 'Say hi', starterCode: 'print' }],
}

function classCommand(target) {
  return { teacherClassControlHighlight: { target, taskId: 1, pushedAt: Date.now() } }
}

function renderAs(studentId, extra) {
  mocks.identity = {
    identity: { anonymousId: studentId, displayName: 'Sam', lastSessionTimestamp: 456 },
    loaded: true,
    createIdentity: vi.fn(),
    updateTimestamp: vi.fn(),
    updateDisplayName: vi.fn(),
  }
  mocks.session = makeSession(LESSON.id, extra)
  const user = userEvent.setup()
  render(<StudentView lessonId={LESSON.id} lesson={LESSON} />)
  return { user }
}

const ring = () => screen.queryByTestId('control-highlight-ring')
const keyButton = (symbol) => screen.getByRole('button', { name: symbol })

function expectRingOn(button) {
  const box = buttonBox(button)
  const el = ring()
  expect(el).not.toBeNull()
  expect(el.style.left).toBe(`${box.left - PAD}px`)
  expect(el.style.top).toBe(`${box.top - PAD}px`)
}

const editorText = () => document.querySelector('.cm-content')?.textContent ?? ''
// Let the highlight's animation-frame loop place (or remove) the ring.
const frames = () => act(() => new Promise((resolve) => setTimeout(resolve, 60)))

describe('tutor key highlight (request #126)', { timeout: 20000 }, () => {
  beforeEach(() => {
    mocks.touch = true
  })

  it('a class command key:( glows only the ( key; tapping it types ( and the glow goes', async () => {
    const { user } = renderAs('student-1', classCommand('key:('))
    await waitFor(() => expect(editorText()).toContain('print'))
    await waitFor(() => expectRingOn(keyButton('(')))
    expect(ring().className).not.toContain('reveal')
    expect(document.body.textContent).toContain('Your tutor is pointing at the ( (keys)')

    await user.click(keyButton('('))
    await frames()
    expect(ring()).toBeNull()
    expect(editorText()).toContain('(')
  })

  it('a key sent to student A does not glow for student B', async () => {
    const command = { target: 'key:(', taskId: 1, pushedAt: Date.now() }
    renderAs('student-2', {
      students: {
        'student-1': { displayName: 'Sam', teacherControlHighlight: command },
        'student-2': { displayName: 'Ali' },
      },
    })
    await waitFor(() => expect(editorText()).toContain('print'))
    await frames()
    await frames()
    expect(ring()).toBeNull()
  })

  it('a key sent to student A glows for student A', async () => {
    const command = { target: 'key:(', taskId: 1, pushedAt: Date.now() }
    renderAs('student-1', {
      students: {
        'student-1': { displayName: 'Sam', teacherControlHighlight: command },
        'student-2': { displayName: 'Ali' },
      },
    })
    await waitFor(() => expectRingOn(keyButton('(')))
  })

  it('on a non-touch screen (no key row) nothing glows and nothing else pulses', async () => {
    mocks.touch = false
    renderAs('student-1', classCommand('key:('))
    await waitFor(() => expect(editorText()).toContain('print'))
    expect(screen.queryByRole('button', { name: '(' })).not.toBeInTheDocument()
    await frames()
    await frames()
    expect(ring()).toBeNull()
  })
})
