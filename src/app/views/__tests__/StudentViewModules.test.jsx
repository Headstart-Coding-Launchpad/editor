import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import StudentView from '../StudentView'
import { getLessonModules } from '../../../modules/registry'

// Real click-through of <StudentView> for every lesson module.
//
// Unit tests of each module passed while the first real Run click on a Turtle lesson crashed
// (`mod.runtime.buildPreviewSrc is not a function`) because useStudentCodeState's inline
// `lesson.type === …` branches didn't know the new type. So this suite renders the real
// StudentView → LessonTaskContent → module StudentWorkspace → useStudentCodeState chain and
// clicks the primary action, mocking only what jsdom cannot run:
//   - the Pyodide worker (python/turtle/electronics runtimes sit on top of it),
//   - the HTML iframe builder and the Arcade game iframe document,
//   - Firebase-backed hooks (session writes, identity, lesson fetch, storage assets).
// Module StudentWorkspaces and useStudentCodeState are never mocked.

const mocks = vi.hoisted(() => ({
  session: null,
  identity: null,
  pendingRun: null,
  runPython: null,
  stopPython: null,
}))

// ─── Lowest-level runtimes ───────────────────────────────────────────────────
// The fake Pyodide keeps each run pending until the test finishes or stops it, like the
// real worker does.
vi.mock('../../../modules/python/pyodide', () => {
  mocks.runPython = vi.fn(
    (code, callbacks) =>
      new Promise((resolve) => {
        mocks.pendingRun = { code, callbacks, resolve }
      })
  )
  mocks.stopPython = vi.fn(() => {
    mocks.pendingRun?.resolve({ status: 'stopped' })
    mocks.pendingRun = null
  })
  return {
    initPyodide: vi.fn(() => Promise.resolve()),
    isPyodideReady: () => true,
    runPython: (...args) => mocks.runPython(...args),
    stopPython: (...args) => mocks.stopPython(...args),
    provideInput: vi.fn(),
    updateGpioInputs: vi.fn(),
  }
})

vi.mock('../../../modules/html/iframe', () => ({
  buildIframeSrc: vi.fn(() => 'about:blank'),
  waitForIframeText: vi.fn(() => Promise.resolve('Hello')),
}))

// Arcade games run in their own iframe document (Pyodide from a CDN); an empty page keeps
// jsdom from loading it.
vi.mock('../../../modules/arcade/runtime', () => ({
  buildArcadeIframeSrc: vi.fn(() => '<!doctype html><title>game</title>'),
}))

// ─── Classroom plumbing (Firebase) ───────────────────────────────────────────
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

vi.mock('../../hooks/useSession', () => ({
  useSession: () => mocks.session,
}))

vi.mock('../../hooks/useIdentity', () => ({
  useIdentity: () => mocks.identity,
}))

// A live, active session: phase 'lesson' is where student runs are written to RTDB. Every
// writer useSession exposes is a spy, created on first access by the Proxy, so a writer
// added later can't crash this suite with "is not a function".
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

// ─── jsdom environment gaps ─────────────────────────────────────────────────
// Layout APIs jsdom lacks. These are environment shims, not behaviour mocks: CodeMirror
// measures text through Range rects, and canvas-backed stages (Scratch, Turtle) ask for a
// 2D context that jsdom returns as null. Every context method becomes a no-op.
const emptyRect = { x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 }
const originalGetContext = HTMLCanvasElement.prototype.getContext
const originalRangeRects = Range.prototype.getClientRects
const originalRangeBounds = Range.prototype.getBoundingClientRect

function fakeContext2d(canvas) {
  const state = { canvas }
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop]
      if (prop === 'measureText') return () => ({ width: 0 })
      if (prop === 'getImageData' || prop === 'createImageData')
        return (x, y, w = 1, h = 1) => ({ width: w, height: h, data: new Uint8ClampedArray(4) })
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient')
        return () => ({ addColorStop() {} })
      return () => {}
    },
    set(target, prop, value) {
      target[prop] = value
      return true
    },
  })
}

beforeAll(() => {
  Range.prototype.getClientRects = () => ({
    length: 0,
    item: () => null,
    [Symbol.iterator]: [][Symbol.iterator],
  })
  Range.prototype.getBoundingClientRect = () => emptyRect
  HTMLCanvasElement.prototype.getContext = function getContext(kind) {
    return kind === '2d' ? fakeContext2d(this) : null
  }
})

afterAll(() => {
  Range.prototype.getClientRects = originalRangeRects
  Range.prototype.getBoundingClientRect = originalRangeBounds
  HTMLCanvasElement.prototype.getContext = originalGetContext
})

// ─── Error capture ───────────────────────────────────────────────────────────
// A click handler that throws (sync or async) surfaces as a window error, an unhandled
// rejection, or a React error log rather than a failed assertion, so all three are
// collected and asserted empty.
let capturedErrors = []
const onWindowError = (event) => capturedErrors.push(event.error ?? event.message)
const onUnhandledRejection = (reason) => capturedErrors.push(reason)
let consoleErrorSpy

beforeEach(() => {
  capturedErrors = []
  mocks.pendingRun = null
  mocks.runPython.mockClear()
  mocks.stopPython.mockClear()
  mocks.identity = {
    identity: { anonymousId: 'student-1', displayName: 'Sam', lastSessionTimestamp: 456 },
    loaded: true,
    createIdentity: vi.fn(),
    updateTimestamp: vi.fn(),
    updateDisplayName: vi.fn(),
  }
  window.addEventListener('error', onWindowError)
  process.on('unhandledRejection', onUnhandledRejection)
  const originalError = console.error
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
    const first = args[0]
    if (first instanceof Error) capturedErrors.push(first)
    else if (typeof first === 'string' && /The above error occurred|Uncaught/.test(first))
      capturedErrors.push(first)
    originalError(...args)
  })
})

afterEach(() => {
  window.removeEventListener('error', onWindowError)
  process.off('unhandledRejection', onUnhandledRejection)
  consoleErrorSpy.mockRestore()
})

function renderLesson(lesson, { currentTaskId = 1 } = {}) {
  mocks.session = makeSession(lesson.id, currentTaskId)
  const user = userEvent.setup()
  const view = render(<StudentView lessonId={lesson.id} lesson={lesson} />)
  return { user, session: mocks.session, view }
}

// Lets awaited writes and promise callbacks flush.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

function expectNoErrors() {
  expect(capturedErrors).toEqual([])
}

// Completes the pending fake-Pyodide run with some output and a status.
async function finishPendingRun(output = 'hi\n', result = { status: 'success' }) {
  // Surface a crashed Run click (e.g. a module falling into the wrong handleRun branch)
  // as its own error rather than as "the runtime was never started".
  await waitFor(() => {
    expectNoErrors()
    expect(mocks.pendingRun).not.toBeNull()
  })
  const run = mocks.pendingRun
  mocks.pendingRun = null
  run.callbacks?.onOutput?.(output, 'stdout')
  run.resolve(result)
}

// Run to completion (asserting the run record), then Run again and Stop.
async function runThenStop({ user, session, runLabel, stopLabel, expectedRun }) {
  await user.click(await screen.findByRole('button', { name: runLabel }))
  await finishPendingRun()
  await waitFor(() => expect(session.writeStudentRun).toHaveBeenCalledTimes(1))
  expect(session.writeStudentRun).toHaveBeenLastCalledWith('student-1', expectedRun)

  await user.click(await screen.findByRole('button', { name: runLabel }))
  await waitFor(() => expect(mocks.pendingRun).not.toBeNull())
  await user.click(await screen.findByRole('button', { name: stopLabel }))
  expect(mocks.stopPython).toHaveBeenCalledTimes(1)
  await screen.findByRole('button', { name: runLabel })
  await settle()
  // A stopped run is not a run result.
  expect(session.writeStudentRun).toHaveBeenCalledTimes(1)
}

const MICROCONTROLLER_CIRCUIT = {
  components: [
    {
      id: 'microcontroller1',
      type: 'microcontroller',
      x: 100,
      y: 100,
      pins: ['3V3', 'GND', 'GP0'],
      props: { code: 'from machine import Pin\nled = Pin("GP0", Pin.OUT)\nled.on()' },
    },
  ],
  wires: [],
  controls: {},
}

// Which modules this suite clicks through. The registry test below fails when a module is
// registered without an entry here.
const CLICK_THROUGH = {
  python: async () => {
    const { user, session } = renderLesson({
      id: 'python-click',
      title: 'Python click',
      type: 'python',
      tasks: [
        {
          id: 1,
          title: 'Say hi',
          starterCode: 'print("hi")',
          check: { type: 'output', operator: 'contains', value: 'hi' },
        },
      ],
    })
    await runThenStop({
      user,
      session,
      runLabel: 'Run',
      stopLabel: 'Stop',
      expectedRun: { code: 'print("hi")', output: 'hi\n', status: 'success', checkPassed: true },
    })
    expect(mocks.runPython.mock.calls[0][0]).toBe('print("hi")')
  },

  turtle: async () => {
    const { user, session } = renderLesson({
      id: 'turtle-click',
      title: 'Turtle click',
      type: 'turtle',
      tasks: [
        {
          id: 1,
          title: 'Draw',
          starterCode: 'import turtle\nturtle.forward(50)',
          check: { type: 'code', operator: 'contains', value: 'forward' },
        },
      ],
    })
    await runThenStop({
      user,
      session,
      runLabel: 'Run',
      stopLabel: 'Stop',
      expectedRun: {
        code: 'import turtle\nturtle.forward(50)',
        output: 'hi\n',
        status: 'success',
        checkPassed: true,
      },
    })
    // Turtle runs the student code wrapped in the turtle shim, and syncs the drawing.
    expect(mocks.runPython.mock.calls[0][0]).toContain('turtle.forward(50)')
    expect(session.writeStudentTurtleResult).toHaveBeenCalledWith('student-1', null)
  },

  electronics: async () => {
    const { user, session } = renderLesson({
      id: 'electronics-click',
      title: 'Electronics click',
      type: 'electronics',
      tasks: [
        {
          id: 1,
          title: 'Blink',
          starterCircuit: MICROCONTROLLER_CIRCUIT,
          check: { type: 'code', operator: 'contains', value: 'led.on()' },
        },
      ],
    })
    await runThenStop({
      user,
      session,
      runLabel: 'Run MicroPython',
      stopLabel: 'Stop MicroPython',
      expectedRun: {
        code: expect.stringContaining('"type":"microcontroller"'),
        output: 'hi\n',
        status: 'success',
        checkPassed: true,
      },
    })
    expect(mocks.runPython.mock.calls[0][0]).toContain('led.on()')
  },

  arcade: async () => {
    // Arcade has no runtime in the registry: "Run game" starts ArcadePreview's iframe and
    // evaluates code checks via handleArcadeRun; Stop only tears the iframe down.
    const { user, session } = renderLesson({
      id: 'arcade-click',
      title: 'Arcade click',
      type: 'arcade',
      tasks: [
        {
          id: 1,
          title: 'Game',
          starterCode: 'from headstart_arcade import game\ngame.run()',
          check: { type: 'code', operator: 'contains', value: 'game.run' },
        },
      ],
    })
    await user.click(await screen.findByRole('button', { name: 'Run game' }))
    await waitFor(() => expect(session.writeStudentRun).toHaveBeenCalledTimes(1))
    expect(session.writeStudentRun).toHaveBeenCalledWith('student-1', {
      code: 'from headstart_arcade import game\ngame.run()',
      output: '',
      status: 'success',
      checkPassed: true,
    })
    expect(screen.getByTitle('Arcade game')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stop' }))
    await screen.findByRole('button', { name: 'Run game' })
    expect(screen.queryByTitle('Arcade game')).not.toBeInTheDocument()
    expect(mocks.runPython).not.toHaveBeenCalled()
  },

  html: async () => {
    const { user, session } = renderLesson({
      id: 'html-click',
      title: 'HTML click',
      type: 'html',
      tasks: [
        {
          id: 1,
          title: 'Page',
          starterFiles: [{ name: 'index.html', type: 'html', content: '<h1>Hello</h1>' }],
          check: { type: 'code', operator: 'contains', value: 'Hello' },
        },
      ],
    })
    // HTML's Run renders the preview; there is no long-running process to stop.
    await user.click(await screen.findByRole('button', { name: 'Run' }))
    await waitFor(() => expect(session.writeStudentRun).toHaveBeenCalledTimes(1))
    expect(session.writeStudentRun).toHaveBeenCalledWith('student-1', {
      files: { 'index.html': '<h1>Hello</h1>' },
      status: 'success',
      checkPassed: true,
    })
    expect(mocks.runPython).not.toHaveBeenCalled()
  },

  filesystem: async () => {
    const { session } = renderLesson({
      id: 'filesystem-click',
      title: 'Filesystem click',
      type: 'filesystem',
      tasks: [
        {
          id: 1,
          title: 'Make a folder',
          starterFs: { '/': { type: 'dir' } },
          check: { type: 'fs_path', operator: 'exists', path: '/Homework/', itemType: 'dir' },
        },
      ],
    })
    await createFolder('Homework')
    await waitFor(() =>
      expect(session.writeStudentRun).toHaveBeenCalledWith('student-1', {
        code: expect.stringContaining('"/Homework/"'),
        status: 'success',
        checkPassed: true,
      })
    )
  },

  desktop: async () => {
    const { session } = renderLesson({
      id: 'desktop-click',
      title: 'Desktop click',
      type: 'desktop',
      tasks: [
        {
          id: 1,
          title: 'Make a folder',
          availableApps: ['fileManager'],
          check: { type: 'fs_path', operator: 'exists', path: '/Homework/', itemType: 'dir' },
        },
      ],
    })
    // The default desktop may already have File Manager open; otherwise open it.
    await screen.findAllByRole('button', { name: /File Manager/i })
    if (!screen.queryByRole('button', { name: /New Folder/i })) {
      fireEvent.click(screen.getAllByRole('button', { name: /File Manager/i })[0])
    }
    await createFolder('Homework')
    await waitFor(() =>
      expect(session.writeStudentRun).toHaveBeenLastCalledWith('student-1', {
        code: expect.stringContaining('"/Homework/"'),
        status: 'success',
        checkPassed: true,
      })
    )
    const desktop = JSON.parse(session.writeStudentRun.mock.lastCall[1].code)
    expect(desktop).toHaveProperty('windows')
  },

  scratch: async () => {
    // Green flag → after-run check → handleScratchCheck → writeStudentRun, all real.
    const { user, session } = renderLesson({
      id: 'scratch-click',
      title: 'Scratch click',
      type: 'scratch',
      tasks: [
        {
          id: 1,
          title: 'Turn',
          starterBlocks: null,
          check: { type: 'sprite_property_changed', property: 'direction', spriteName: 'Sprite 1' },
        },
      ],
    })
    // Real Blockly injects into jsdom (with the canvas shim above); the green flag only
    // responds once the workspace is live.
    await waitFor(() => expect(document.querySelector('.blocklySvg')).not.toBeNull(), {
      timeout: 10000,
    })
    await user.click(await screen.findByRole('button', { name: 'Run' }))
    // The empty starter never turns the sprite, so the after-run check fails — still a
    // completed run record for the teacher.
    await waitFor(() =>
      expect(session.writeStudentRun).toHaveBeenCalledWith('student-1', {
        code: JSON.stringify({ sprite1: {} }),
        status: 'success',
        checkPassed: false,
      })
    )
    await screen.findByText('Not quite, try again!')
    await user.click(screen.getByRole('button', { name: 'Stop' }))
  },
}

async function createFolder(name) {
  fireEvent.click(await screen.findByRole('button', { name: /New Folder/i }))
  const input = await screen.findByPlaceholderText('Folder name…')
  fireEvent.change(input, { target: { value: name } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

describe('StudentView module click-through', () => {
  it('has a click-through for every registered module', () => {
    expect(Object.keys(CLICK_THROUGH).sort()).toEqual(
      getLessonModules()
        .map((mod) => mod.type)
        .sort()
    )
  })

  it.each(Object.keys(CLICK_THROUGH))(
    '%s: loads and performs its primary action without errors',
    async (type) => {
      await CLICK_THROUGH[type]()
      expectNoErrors()
    },
    20000
  )

  it('composed python → filesystem: runs python, then the filesystem task works after advancing', async () => {
    const lesson = {
      id: 'composed-click',
      title: 'Composed click',
      type: 'composed',
      tasks: [
        {
          id: 1,
          title: 'Say hi',
          moduleType: 'python',
          starterCode: 'print("hi")',
          check: { type: 'output', operator: 'contains', value: 'hi' },
        },
        {
          id: 2,
          title: 'Make a folder',
          moduleType: 'filesystem',
          starterFs: { '/': { type: 'dir' } },
          check: { type: 'fs_path', operator: 'exists', path: '/Homework/', itemType: 'dir' },
        },
      ],
    }
    const { user, session, view } = renderLesson(lesson)
    await user.click(await screen.findByRole('button', { name: 'Run' }))
    await finishPendingRun()
    await waitFor(() =>
      expect(session.writeStudentRun).toHaveBeenCalledWith('student-1', {
        code: 'print("hi")',
        output: 'hi\n',
        status: 'success',
        checkPassed: true,
      })
    )

    // The teacher advances the class to the filesystem task.
    mocks.session = makeSession(lesson.id, 2)
    view.rerender(<StudentView lessonId={lesson.id} lesson={lesson} />)
    await createFolder('Homework')
    await waitFor(() =>
      expect(mocks.session.writeStudentRun).toHaveBeenCalledWith('student-1', {
        code: expect.stringContaining('"/Homework/"'),
        status: 'success',
        checkPassed: true,
      })
    )
    expect(screen.queryByRole('button', { name: 'Run' })).not.toBeInTheDocument()
    expectNoErrors()
  })
})
