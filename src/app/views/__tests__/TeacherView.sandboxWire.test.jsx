import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CIRCUIT, serializeCircuit } from '../../../modules/electronics/circuit'
import { makeDefaultDesktop, normaliseDesktop } from '../../../modules/desktop/desktopState'

// Plan step 4.6: the teacher sandbox (stage, edit, go live, push, reset, leave) goes through the
// module definitions' wire and lifecycle hooks. For every module this drives the real TeacherView
// and pins the Realtime Database writes (enterSandbox / pushSandboxCode / pushSandboxFiles
// arguments) to the values the per-type branches used to send, byte for byte.

const captured = {}

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(),
}))
vi.mock('../../../shared/firebase', () => ({ firestore: {} }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 't1' }, role: 'teacher' }),
}))
vi.mock('../../../shared/topicLibrary', () => ({ useTopicLibrary: () => ({ topics: [] }) }))

const sessionCommands = {}
let mockSession = null
vi.mock('../../hooks/usePeerHelp', async () => {
  const { peerHelpModuleMock } = await import('../../hooks/__tests__/peerHelpMock.js')
  return peerHelpModuleMock
})
vi.mock('../../hooks/useSession', () => ({
  useSession: () =>
    new Proxy(
      { session: mockSession, loading: false },
      {
        get(target, key) {
          if (key in target) return target[key]
          if (!sessionCommands[key]) sessionCommands[key] = vi.fn(async () => {})
          return sessionCommands[key]
        },
      }
    ),
}))

function capture(name) {
  return (props) => {
    captured[name] = props
    return null
  }
}
vi.mock('../teacher/TeacherEditorPanel', () => ({ default: capture('editor') }))
vi.mock('../../components/TaskNavigator', () => ({ default: capture('navigator') }))
vi.mock('../../components/TeacherSandboxBanner', () => ({ default: capture('sandboxBanner') }))
vi.mock('../../components/TopBar', () => ({ default: () => null }))
vi.mock('../../components/StudentGrid', () => ({ default: () => null }))
vi.mock('../../components/ExplainerPanel', () => ({ default: () => null }))
vi.mock('../../components/TeacherTimers', () => ({ default: () => null }))
vi.mock('../teacher/TaskRatingPanel', () => ({ default: () => null }))
vi.mock('../teacher/CheckConditionsPanel', () => ({ default: () => null }))

import { getDoc } from 'firebase/firestore'
import TeacherView from '../TeacherView'

const HTML_STARTER = [{ name: 'index.html', type: 'html', content: '<p>starter</p>' }]
const FS_STARTER = { '/': { type: 'dir', children: ['starter.txt'] } }
const FS_EDIT = { '/': { type: 'dir', children: ['starter.txt', 'new.txt'] } }
const DESKTOP_STARTER = normaliseDesktop({ ...makeDefaultDesktop(), lastSearchQuery: 'start' })
const DESKTOP_EDIT = normaliseDesktop({ ...makeDefaultDesktop(), lastSearchQuery: 'edited' })
const CIRCUIT_STARTER = serializeCircuit(DEFAULT_CIRCUIT)
const CIRCUIT_EDIT = serializeCircuit({ ...DEFAULT_CIRCUIT, wires: [] })

// Per module: the lesson's sandbox fields, what the teacher sees on staging, an edit (the
// arguments TeacherLiveView's onChange passes), what the editor shows after it, and the RTDB
// writes the pre-4.6 branches made for the edit (go live, push) and for the starter (reset).
const MODULE_CASES = {
  python: {
    lesson: { sandboxStarter: 'print("sandbox")' },
    staged: 'print("sandbox")',
    edit: ['print("edited")'],
    edited: 'print("edited")',
    wire: { code: 'print("edited")' },
    resetWire: { code: 'print("sandbox")' },
  },
  turtle: {
    lesson: { sandboxStarter: 'turtle.circle(20)' },
    staged: 'turtle.circle(20)',
    edit: ['turtle.left(90)'],
    edited: 'turtle.left(90)',
    wire: { code: 'turtle.left(90)' },
    resetWire: { code: 'turtle.circle(20)' },
  },
  arcade: {
    lesson: { sandboxStarter: 'game.run()' },
    staged: 'game.run()',
    edit: ['x = 1\ngame.run()'],
    edited: 'x = 1\ngame.run()',
    wire: { code: 'x = 1\ngame.run()' },
    resetWire: { code: 'game.run()' },
  },
  electronics: {
    lesson: { sandboxStarterCircuit: DEFAULT_CIRCUIT },
    staged: CIRCUIT_STARTER,
    edit: [CIRCUIT_EDIT],
    edited: CIRCUIT_EDIT,
    wire: { code: CIRCUIT_EDIT },
    resetWire: { code: CIRCUIT_STARTER },
  },
  scratch: {
    lesson: { sandboxStarter: JSON.stringify({ Stage: { blocks: { s: 1 } } }) },
    staged: { Stage: { blocks: { s: 1 } } },
    edit: [{ Stage: { blocks: { e: 1 } } }],
    edited: { Stage: { blocks: { e: 1 } } },
    wire: { code: '{"Stage":{"blocks":{"e":1}}}' },
    resetWire: { code: '{"Stage":{"blocks":{"s":1}}}' },
  },
  filesystem: {
    lesson: { sandboxStarterFs: FS_STARTER },
    staged: FS_STARTER,
    edit: [FS_EDIT],
    edited: FS_EDIT,
    wire: { code: JSON.stringify(FS_EDIT) },
    resetWire: { code: JSON.stringify(FS_STARTER) },
  },
  desktop: {
    lesson: { sandboxStarterDesktop: DESKTOP_STARTER },
    staged: DESKTOP_STARTER,
    edit: [DESKTOP_EDIT],
    edited: DESKTOP_EDIT,
    wire: { code: JSON.stringify(DESKTOP_EDIT) },
    resetWire: { code: JSON.stringify(DESKTOP_STARTER) },
  },
  html: {
    lesson: { sandboxStarterFiles: HTML_STARTER },
    staged: { files: HTML_STARTER, entryFile: 'index.html' },
    edit: ['index.html', '<p>edited</p>'],
    edited: {
      files: [{ name: 'index.html', type: 'html', content: '<p>edited</p>' }],
      entryFile: 'index.html',
    },
    wire: { files: [{ name: 'index.html', type: 'html', content: '<p>edited</p>' }] },
    resetWire: { files: HTML_STARTER },
  },
}

function lessonFor(type) {
  return {
    id: `${type}-lesson`,
    title: type,
    type,
    ...MODULE_CASES[type].lesson,
    tasks: [
      {
        id: 1,
        title: 'Task',
        starterCode: 'print("task")',
        starterFiles: [{ name: 'index.html', type: 'html', content: '<p>task</p>' }],
        entryFile: 'index.html',
        starterBlocks: { Stage: { blocks: {} } },
        starterFs: { '/': { type: 'dir', children: [] } },
        starterDesktop: makeDefaultDesktop(),
        starterCircuit: DEFAULT_CIRCUIT,
      },
    ],
  }
}

let rerenderView = null

async function renderTeacherView(lesson) {
  getDoc.mockResolvedValue({ exists: () => true, data: () => lesson })
  const { rerender } = render(<TeacherView lessonId={lesson.id} />)
  rerenderView = () => rerender(<TeacherView lessonId={lesson.id} />)
  await waitFor(() => expect(captured.editor?.task).toBeTruthy())
  // Let the task-content load effect run before the test acts: under load it can still be
  // pending here, and would then overwrite the sandbox's staged work with the task starter.
  await act(async () => {})
}

// A realtime session update: the real useSession re-renders its owner with the new session.
function setSession(next) {
  mockSession = next
  act(() => rerenderView())
}

// The session write a pre-4.6 branch made for `fields`: pushSandboxFiles for files, else code.
function expectPushed(fields) {
  if (fields.files) {
    expect(sessionCommands.pushSandboxFiles).toHaveBeenLastCalledWith(fields.files)
    expect(sessionCommands.pushSandboxCode).not.toHaveBeenCalled()
  } else {
    expect(sessionCommands.pushSandboxCode).toHaveBeenLastCalledWith(fields.code)
    expect(sessionCommands.pushSandboxFiles).not.toHaveBeenCalled()
  }
}

beforeEach(() => {
  for (const key of Object.keys(captured)) delete captured[key]
  for (const key of Object.keys(sessionCommands)) delete sessionCommands[key]
  mockSession = { state: 'active', currentTaskId: 1, students: {} }
})

describe.each(Object.keys(MODULE_CASES))('TeacherView %s sandbox', (type) => {
  const expected = MODULE_CASES[type]

  it('stages, edits, goes live, pushes, resets and leaves with the old RTDB writes', async () => {
    await renderTeacherView(lessonFor(type))

    // Stage: the configured sandbox starter.
    act(() => captured.navigator.onSandbox())
    await waitFor(() => expect(captured.editor.isInSandbox).toBe(true))
    expect(captured.editor.liveState).toEqual(expected.staged)

    // Edit.
    act(() => captured.editor.onChange(...expected.edit))
    await waitFor(() => expect(captured.editor.liveState).toEqual(expected.edited))

    // Go live: enterSandbox, then the session reports the sandbox state.
    await act(async () => captured.sandboxBanner.onGoLive())
    expect(sessionCommands.enterSandbox).toHaveBeenCalledWith({
      ...expected.wire,
      previousTaskId: 1,
    })
    setSession({ state: 'sandbox', currentTaskId: 1, students: {}, sandboxPreviousTaskId: 1 })
    // Going live keeps the teacher's edit (restored from the draft).
    await waitFor(() => expect(captured.editor.isInSandbox).toBe(true))
    await waitFor(() => expect(captured.editor.liveState).toEqual(expected.edited))

    // Push to class.
    await act(async () => captured.sandboxBanner.onPush())
    expectPushed(expected.wire)

    // Reset to the starter: shown and pushed.
    await act(async () => captured.sandboxBanner.onReset())
    expectPushed(expected.resetWire)
    await waitFor(() => expect(captured.editor.liveState).toEqual(expected.staged))

    // Leave: back on the task, out of the sandbox.
    await act(async () => captured.sandboxBanner.onDeactivate())
    expect(sessionCommands.exitSandbox).toHaveBeenCalled()
    setSession({ state: 'active', currentTaskId: 1, students: {} })
    await waitFor(() => expect(captured.editor.isInSandbox).toBe(false))
    expect(captured.editor.onChange).toBeUndefined()
  })

  it('restores the live sandbox work from the session when the teacher reloads', async () => {
    const fields = expected.wire
    mockSession = {
      state: 'sandbox',
      currentTaskId: 1,
      students: {},
      sandboxCode: fields.code ?? null,
      sandboxFiles: fields.files
        ? Object.fromEntries(
            fields.files.map((file) => [file.name.replace(/\./g, '__dot__'), file.content])
          )
        : null,
      sandboxCodePushedAt: 1,
    }
    await renderTeacherView(lessonFor(type))
    await waitFor(() => expect(captured.editor.liveState).toEqual(expected.edited))
  })
})

function sandboxModuleSelect() {
  const select = document.querySelector('select')
  if (!select) throw new Error(document.body.innerHTML.slice(0, 2000))
  return select
}

describe('TeacherView composed-lesson sandbox', () => {
  function composedLesson() {
    return {
      id: 'composed-lesson',
      title: 'Composed',
      type: 'composed',
      modules: [
        { id: 'py', type: 'python', title: 'Python' },
        { id: 'files', type: 'filesystem', title: 'Files' },
      ],
      tasks: [
        { id: 1, title: 'Py', moduleType: 'python', moduleId: 'py', starterCode: 'print(1)' },
        {
          id: 2,
          title: 'Tree',
          moduleType: 'filesystem',
          moduleId: 'files',
          starterFs: FS_STARTER,
        },
      ],
    }
  }

  it("uses the sandbox module's own wire, switching modules by the effective lesson", async () => {
    mockSession = { state: 'active', currentTaskId: 2, students: {} }
    await renderTeacherView(composedLesson())

    // The current task's module (filesystem): its sandbox starter comes from its first task.
    act(() => captured.navigator.onSandbox())
    await waitFor(() => expect(captured.editor.isInSandbox).toBe(true))
    expect(captured.editor.liveState).toEqual(FS_STARTER)
    act(() => captured.editor.onChange(FS_EDIT))

    // Switch to the Python module: its own starter, then back to the filesystem draft.
    fireEvent.change(sandboxModuleSelect(), { target: { value: 'py' } })
    await waitFor(() => expect(captured.editor.liveState).toBe('print(1)'))
    act(() => captured.editor.onChange('print(2)'))
    fireEvent.change(sandboxModuleSelect(), { target: { value: 'files' } })
    await waitFor(() => expect(captured.editor.liveState).toEqual(FS_EDIT))

    // Going live sends the filesystem tree on the code channel.
    await act(async () => captured.sandboxBanner.onGoLive())
    expect(sessionCommands.enterSandbox).toHaveBeenCalledWith({
      code: JSON.stringify(FS_EDIT),
      previousTaskId: 2,
    })
    setSession({
      state: 'sandbox',
      currentTaskId: 2,
      students: {},
      sandboxPreviousTaskId: 2,
      sandboxCode: JSON.stringify(FS_EDIT),
      sandboxCodePushedAt: 1,
    })
    await waitFor(() => expect(captured.editor.isInSandbox).toBe(true))

    // Pushing after switching to Python sends the Python draft and moves nobody.
    fireEvent.change(sandboxModuleSelect(), { target: { value: 'py' } })
    await waitFor(() => expect(captured.editor.liveState).toBe('print(2)'))
    await act(async () => captured.sandboxBanner.onPush())
    expect(sessionCommands.pushSandboxCode).toHaveBeenLastCalledWith('print(2)')
  })

  it("goes live on the sandbox module's first task with that module's wire", async () => {
    mockSession = { state: 'active', currentTaskId: 2, students: {} }
    await renderTeacherView(composedLesson())

    act(() => captured.navigator.onSandbox())
    await waitFor(() => expect(captured.editor.isInSandbox).toBe(true))
    fireEvent.change(sandboxModuleSelect(), { target: { value: 'py' } })
    await waitFor(() => expect(captured.editor.liveState).toBe('print(1)'))

    await act(async () => captured.sandboxBanner.onGoLive())
    expect(sessionCommands.setTaskId).toHaveBeenCalledWith(1)
    expect(sessionCommands.enterSandbox).toHaveBeenCalledWith({
      code: 'print(1)',
      previousTaskId: 2,
    })
    expect(sessionCommands.pushSandboxFiles).not.toHaveBeenCalled()
  })
})
