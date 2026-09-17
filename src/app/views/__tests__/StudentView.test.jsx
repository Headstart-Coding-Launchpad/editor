import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StudentView from '../StudentView'
import { runPython, stopPython } from '../../../modules/python/pyodide'

const mocks = vi.hoisted(() => ({
  fetchLessonById: vi.fn(),
  findSoloCompanion: vi.fn(),
  useSession: vi.fn(),
  useIdentity: vi.fn(),
  scratchWorkspace: vi.fn(),
  buildIframeSrc: vi.fn(() => 'blob:preview'),
}))

vi.mock('../../../shared/useIsMobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('../../../shared/lessonService', () => ({
  fetchLessonById: (...args) => mocks.fetchLessonById(...args),
  findSoloCompanion: (...args) => mocks.findSoloCompanion(...args),
  applyLessonOverride: (lesson, overrideTasks) =>
    overrideTasks ? { ...lesson, tasks: overrideTasks } : lesson,
}))

vi.mock('../../hooks/useSession', () => ({
  useSession: (...args) => mocks.useSession(...args),
}))

vi.mock('../../hooks/useIdentity', () => ({
  useIdentity: (...args) => mocks.useIdentity(...args),
}))

vi.mock('../../../modules/python/pyodide', () => ({
  initPyodide: vi.fn(() => Promise.resolve()),
  runPython: vi.fn(),
  stopPython: vi.fn(),
  provideInput: vi.fn(),
  isPyodideReady: () => true,
}))

vi.mock('../../../modules/html/iframe', () => ({
  buildIframeSrc: (...args) => mocks.buildIframeSrc(...args),
  waitForIframeText: vi.fn(() => Promise.resolve('')),
}))

vi.mock('../../components/TopBar', () => ({
  default: ({ lessonTitle, isSolo, right }) => (
    <div>
      {lessonTitle} {isSolo ? 'SOLO' : 'LIVE'}
      {right}
    </div>
  ),
}))

vi.mock('../../../modules/python/PythonEditor', () => ({
  default: ({ code }) => <textarea aria-label="code" readOnly value={code} />,
}))

vi.mock('../../components/OutputPanel', () => ({
  default: ({ output, inputPrompt, onInputSubmit }) => (
    <div>
      Output{output}
      {inputPrompt != null && (
        <button type="button" onClick={() => onInputSubmit('Sam')}>
          submit-input
        </button>
      )}
    </div>
  ),
}))

vi.mock('../../components/TaskProgressDots', () => ({
  default: ({ tasks, onDotClick }) => (
    <div>
      {tasks.map((task) => (
        <button key={task.id} type="button" onClick={() => onDotClick(task.id)}>
          {task.title}
        </button>
      ))}
    </div>
  ),
}))

vi.mock('../../components/ExplainerPanel', () => ({
  default: ({ task }) => <div>{task?.title}</div>,
}))

vi.mock('../../components/TaskSlideTransition', () => ({
  default: ({ children }) => <>{children}</>,
  useIsLeavingTaskSlide: () => false,
}))

vi.mock('../../components/LoadingScreen', () => ({
  default: ({ message }) => <div>{message}</div>,
}))

vi.mock('../../components/NameEntry', () => ({
  default: () => <div>Name entry</div>,
}))

vi.mock('../../components/WaitingRoom', () => ({
  default: ({ lessonTitle }) => <div>Waiting for {lessonTitle}</div>,
}))

vi.mock('../../components/InformationTask', () => ({
  default: () => <div>Information</div>,
}))

vi.mock('../../../modules/html/HtmlEditor', () => ({
  default: ({ files = [] }) => (
    <output data-testid="html-files">{files.map((file) => file.content).join('\n')}</output>
  ),
}))

vi.mock('../../components/CollapsibleIframePreview', () => ({
  default: () => <div>Preview</div>,
}))

vi.mock('../../../modules/scratch/ScratchWorkspace', () => ({
  default: (props) => {
    mocks.scratchWorkspace(props)
    return <div>Scratch</div>
  },
  SPRITE_TYPES: ['cat', 'ball', 'star', 'arrow', 'bat', 'parrot'],
  // Real values (not mocked) — LessonTaskContent.jsx imports these directly to keep its
  // own Instructions/Code threshold in lockstep with ScratchWorkspace's compact detection.
  NARROW_BREAKPOINT: 1000,
  NARROW_BREAKPOINT_HEIGHT: 600,
}))

vi.mock('../../components/QuizTask', () => ({
  default: () => <div>Quiz</div>,
}))

vi.mock('../../../modules/filesystem/FilesystemTask', () => ({
  default: () => <div>Filesystem</div>,
}))

vi.mock('../../components/CheckFeedbackBanner', () => ({
  default: ({ passed, suggestion }) => (
    <div data-testid="check-feedback" data-passed={String(!!passed)} data-suggestion={suggestion}>
      Feedback
    </div>
  ),
}))

vi.mock('../../../modules/arcade/ArcadePreview', () => ({
  default: () => <div>arcade-preview</div>,
}))

vi.mock('../../../shared/SplitPane', () => ({
  default: ({ left, right }) => (
    <div>
      {left}
      {right}
    </div>
  ),
}))

vi.mock('../../components/StudentEditorHeader', () => ({
  default: () => <div>Editor header</div>,
}))

describe('StudentView', () => {
  beforeEach(() => {
    mocks.scratchWorkspace.mockClear()
    mocks.buildIframeSrc.mockClear()
    mocks.findSoloCompanion.mockReset().mockResolvedValue(null)
    mocks.fetchLessonById.mockResolvedValue({
      id: 'python-1-1',
      title: 'Python 1.1',
      type: 'python',
      tasks: [
        {
          id: 1,
          title: 'First task',
          starterCode: 'print("hi")',
        },
      ],
    })
    mocks.useSession.mockReturnValue({
      session: {
        lessonId: 'python-1-1',
        state: 'waiting',
        createdAt: 123,
        currentTaskId: 1,
      },
      loading: false,
      registerPresence: vi.fn(),
      joinSession: vi.fn(),
      writeStudentRun: vi.fn(),
      writeStudentCode: vi.fn(),
      writeStudentFiles: vi.fn(),
      writeStudentOutput: vi.fn(),
      writeStudentInteraction: vi.fn(),
      writeStudentPersonalSandbox: vi.fn(),
      setTaskId: vi.fn(),
      setTeacherLive: vi.fn(),
      updateTeacherLive: vi.fn(),
      removeStudent: vi.fn(),
    })
    mocks.useIdentity.mockReturnValue({
      identity: {
        anonymousId: 'student-1',
        displayName: 'Solo',
        lastSessionTimestamp: 456,
      },
      loaded: true,
      createIdentity: vi.fn(),
      updateTimestamp: vi.fn(),
      updateDisplayName: vi.fn(),
    })
  })

  it('loads solo mode when a waiting live session exists for the lesson', async () => {
    render(<StudentView lessonId="python-1-1" forceSolo />)

    await waitFor(() => {
      expect(screen.getByText(/Python 1\.1 SOLO/)).toBeInTheDocument()
    })
    expect(mocks.useSession).toHaveBeenCalledWith(null, { enabled: false })
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })

  it('lets solo students move to the next task before passing the current check', async () => {
    const user = userEvent.setup()

    render(
      <StudentView
        lessonId="python-1-1"
        forceSolo
        lesson={{
          id: 'python-1-1',
          title: 'Python 1.1',
          type: 'python',
          tasks: [
            {
              id: 1,
              title: 'Checked task',
              starterCode: 'print("try")',
              check: { type: 'output', operator: 'contains', value: 'done' },
            },
            {
              id: 2,
              title: 'Next task',
              starterCode: 'print("next")',
            },
          ],
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByLabelText('code')).toHaveValue('print("try")')
    })

    const nextButton = screen.getByRole('button', { name: 'Next' })
    expect(nextButton).toBeEnabled()
    expect(nextButton).not.toHaveClass('btn-next-success')

    await user.click(nextButton)

    await waitFor(() => {
      expect(screen.getByLabelText('code')).toHaveValue('print("next")')
    })
  })

  it('passes predefined Scratch blocks to the student workspace', async () => {
    const predefinedBlocks = [
      {
        id: 'move-50',
        type: 'motion_movesteps',
        inputs: { STEPS: 50 },
      },
    ]
    const prebuiltStacks = [
      {
        id: 'stack-1',
        label: 'Move',
        stack: { type: 'motion_movesteps' },
      },
    ]

    render(
      <StudentView
        lessonId="scratch-1-1"
        forceSolo
        lesson={{
          id: 'scratch-1-1',
          title: 'Scratch 1.1',
          type: 'scratch',
          tasks: [
            {
              id: 1,
              title: 'Move',
              starterBlocks: null,
              predefinedBlocks,
              prebuiltStacks,
            },
          ],
        }}
      />
    )

    await waitFor(() => {
      expect(mocks.scratchWorkspace).toHaveBeenCalled()
    })

    const latestProps = mocks.scratchWorkspace.mock.calls.at(-1)[0]
    expect(latestProps.predefinedBlocks).toEqual(predefinedBlocks)
    expect(latestProps.prebuiltStacks).toEqual(prebuiltStacks)
    expect(latestProps.respectStudentEditable).toBe(true)
  })

  it('clears a passed check banner when navigating from a solved task to the next task', async () => {
    const user = userEvent.setup()

    render(
      <StudentView
        lessonId="scratch-1-1"
        forceSolo
        lesson={{
          id: 'scratch-1-1',
          title: 'Scratch 1.1',
          type: 'scratch',
          tasks: [
            {
              id: 1,
              title: 'Turn the sprite',
              starterBlocks: null,
              check: { type: 'sprite_property_changed', property: 'direction', spriteName: 'Lion' },
            },
            {
              id: 2,
              title: 'Turn and go',
              starterBlocks: null,
              check: { type: 'sprite_property_changed', property: 'direction', spriteName: 'Lion' },
            },
          ],
        }}
      />
    )

    await waitFor(() => expect(mocks.scratchWorkspace).toHaveBeenCalled())

    // Simulate ScratchWorkspace reporting a passed check for task 1, the way it would
    // after the student runs code that satisfies the check.
    const firstProps = mocks.scratchWorkspace.mock.calls.at(-1)[0]
    firstProps.onCheckResult(true, {})

    await waitFor(() =>
      expect(screen.getByTestId('check-feedback')).toHaveAttribute('data-passed', 'true')
    )

    await user.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() => {
      const latestProps = mocks.scratchWorkspace.mock.calls.at(-1)[0]
      expect(latestProps.task.id).toBe(2)
    })

    // Task 2 has never been run — its check must show as not-yet-attempted, not a
    // stale "correct" banner carried over from task 1.
    expect(screen.queryByTestId('check-feedback')).not.toBeInTheDocument()
  })

  it('shows the saved workspace when viewing a previous task in another composed module', async () => {
    const user = userEvent.setup()
    mocks.useSession.mockReturnValue({
      session: {
        lessonId: 'composed-1',
        state: 'active',
        createdAt: 456,
        currentTaskId: 2,
        students: {},
      },
      loading: false,
      registerPresence: vi.fn(),
      joinSession: vi.fn(),
      writeStudentRun: vi.fn(),
      writeStudentCode: vi.fn(),
      writeStudentFiles: vi.fn(),
      writeStudentOutput: vi.fn(),
      writeStudentInteraction: vi.fn(),
      writeStudentPersonalSandbox: vi.fn(),
      setTaskId: vi.fn(),
      setTeacherLive: vi.fn(),
      updateTeacherLive: vi.fn(),
      removeStudent: vi.fn(),
    })
    localStorage.setItem(
      'headstart_composed-1_1_index.html_student-1',
      JSON.stringify({ content: '<h1>Saved HTML</h1>' })
    )

    render(
      <StudentView
        lessonId="composed-1"
        lesson={{
          id: 'composed-1',
          title: 'Composed',
          type: 'composed',
          tasks: [
            {
              id: 1,
              title: 'HTML task',
              moduleType: 'html',
              starterFiles: [
                { name: 'index.html', type: 'html', content: '<h1>Starter HTML</h1>' },
              ],
            },
            { id: 2, title: 'Python task', moduleType: 'python', starterCode: 'print("current")' },
          ],
        }}
      />
    )

    await waitFor(() => expect(screen.getByLabelText('code')).toHaveValue('print("current")'))
    await user.click(screen.getByRole('button', { name: 'HTML task' }))

    await waitFor(() =>
      expect(screen.getByTestId('html-files')).toHaveTextContent('<h1>Saved HTML</h1>')
    )
  })

  it('builds the HTML preview when teacher live switches composed modules', async () => {
    mocks.useSession.mockReturnValue({
      session: {
        lessonId: 'composed-live',
        state: 'active',
        createdAt: 456,
        currentTaskId: 1,
        students: {},
        teacherLive: {
          active: true,
          source: 'teacher',
          taskId: 2,
          updatedAt: 789,
          files: { 'index.html': '<h1>Teacher live</h1>' },
          activeFile: 'index.html',
        },
      },
      loading: false,
      registerPresence: vi.fn(),
      joinSession: vi.fn(),
      writeStudentRun: vi.fn(),
      writeStudentCode: vi.fn(),
      writeStudentFiles: vi.fn(),
      writeStudentOutput: vi.fn(),
      writeStudentInteraction: vi.fn(),
      writeStudentPersonalSandbox: vi.fn(),
      setTaskId: vi.fn(),
      setTeacherLive: vi.fn(),
      updateTeacherLive: vi.fn(),
      removeStudent: vi.fn(),
    })

    render(
      <StudentView
        lessonId="composed-live"
        lesson={{
          id: 'composed-live',
          title: 'Composed live',
          type: 'composed',
          tasks: [
            { id: 1, title: 'Python task', moduleType: 'python', starterCode: 'print("current")' },
            {
              id: 2,
              title: 'HTML task',
              moduleType: 'html',
              starterFiles: [{ name: 'index.html', type: 'html', content: '<h1>Starter</h1>' }],
            },
          ],
        }}
      />
    )

    await waitFor(() =>
      expect(screen.getByTestId('html-files')).toHaveTextContent('<h1>Teacher live</h1>')
    )
    expect(mocks.buildIframeSrc).toHaveBeenCalled()
  })

  describe('teacher-live-code support reference', () => {
    function mkSession(sessionOverrides = {}) {
      mocks.useSession.mockReturnValue({
        session: {
          lessonId: 'python-1-1',
          state: 'active',
          createdAt: 456,
          currentTaskId: 1,
          students: { 'student-1': {} },
          ...sessionOverrides,
        },
        loading: false,
        registerPresence: vi.fn(),
        joinSession: vi.fn(),
        writeStudentRun: vi.fn(),
        writeStudentCode: vi.fn(),
        writeStudentFiles: vi.fn(),
        writeStudentOutput: vi.fn(),
        writeStudentInteraction: vi.fn(),
        writeStudentPersonalSandbox: vi.fn(),
        recordSupportStageReveal: vi.fn(),
        setTaskId: vi.fn(),
        setTeacherLive: vi.fn(),
        updateTeacherLive: vi.fn(),
        removeStudent: vi.fn(),
      })
    }

    it('shows the reference when this student is targeted and the broadcast matches the task', async () => {
      mkSession({
        students: { 'student-1': { teacherLiveReferenceVisible: true } },
        teacherLiveReference: { active: true, taskId: 1, code: 'print("live")' },
      })

      render(<StudentView lessonId="python-1-1" />)

      expect(await screen.findByLabelText("Teacher's live code stage reference")).toHaveTextContent(
        'print("live")'
      )
    })

    it('shows the reference to everyone when the whole-class flag is on', async () => {
      mkSession({
        teacherLiveReferenceVisibleToAll: true,
        teacherLiveReference: { active: true, taskId: 1, code: 'print("all")' },
      })

      render(<StudentView lessonId="python-1-1" />)

      expect(await screen.findByLabelText("Teacher's live code stage reference")).toHaveTextContent(
        'print("all")'
      )
    })

    it('does not show a reference for a different task than the one being presented', async () => {
      mkSession({
        students: { 'student-1': { teacherLiveReferenceVisible: true } },
        teacherLiveReference: { active: true, taskId: 2, code: 'print("other task")' },
      })

      render(<StudentView lessonId="python-1-1" />)

      await waitFor(() => expect(screen.getByLabelText('code')).toHaveValue('print("hi")'))
      expect(screen.queryByLabelText("Teacher's live code stage reference")).toBeNull()
    })

    it('does not show a reference when neither the per-student nor whole-class flag is set', async () => {
      mkSession({
        teacherLiveReference: { active: true, taskId: 1, code: 'print("unrequested")' },
      })

      render(<StudentView lessonId="python-1-1" />)

      await waitFor(() => expect(screen.getByLabelText('code')).toHaveValue('print("hi")'))
      expect(screen.queryByLabelText("Teacher's live code stage reference")).toBeNull()
    })

    it('is suppressed by a concurrent full "Go Live" force takeover (teacherLive is a separate node)', async () => {
      mkSession({
        students: { 'student-1': { teacherLiveReferenceVisible: true } },
        teacherLiveReference: { active: true, taskId: 1, code: 'print("reference")' },
        teacherLive: { active: true, source: 'teacher', taskId: 1, code: 'print("forced")' },
      })

      render(<StudentView lessonId="python-1-1" />)

      await waitFor(() => expect(screen.getByLabelText('code')).toHaveValue('print("forced")'))
      expect(screen.queryByLabelText("Teacher's live code stage reference")).toBeNull()
    })
  })

  describe('teacher pane highlight/force', () => {
    function mkScratchSession(sessionOverrides = {}) {
      return {
        session: {
          lessonId: 'scratch-1-1',
          state: 'active',
          createdAt: 456,
          currentTaskId: 1,
          students: { 'student-1': {} },
          ...sessionOverrides,
        },
        loading: false,
        registerPresence: vi.fn(),
        joinSession: vi.fn(),
        writeStudentRun: vi.fn(),
        writeStudentCode: vi.fn(),
        writeStudentFiles: vi.fn(),
        writeStudentOutput: vi.fn(),
        writeStudentInteraction: vi.fn(),
        writeStudentPersonalSandbox: vi.fn(),
        writeStudentPresence: vi.fn(),
        setTaskId: vi.fn(),
        setTeacherLive: vi.fn(),
        updateTeacherLive: vi.fn(),
        removeStudent: vi.fn(),
      }
    }

    const scratchLesson = {
      id: 'scratch-1-1',
      title: 'Scratch 1.1',
      type: 'scratch',
      tasks: [{ id: 1, title: 'Move', starterBlocks: null }],
    }

    it('passes a per-student highlight command down to ScratchWorkspace as highlightedPanes', async () => {
      mocks.useSession.mockReturnValue(
        mkScratchSession({
          students: {
            'student-1': {
              teacherPaneCommand: { mode: 'highlight', panes: ['blocks'], pushedAt: 1 },
            },
          },
        })
      )

      render(<StudentView lessonId="scratch-1-1" lesson={scratchLesson} />)

      // Checks the FIRST render, not the last: the mocked ScratchWorkspace never reports
      // real visiblePanes back (it's a dumb prop-capturing stub), so LessonTaskContent's
      // ['blocks','stage'] default-visible guess looks, after a later render, exactly like
      // the student "already saw" a 'blocks' highlight — self-dismissing it client-side.
      // That's a test-only artifact of the stub, not a real dismissal; the first render is
      // what actually proves the session-to-prop wiring under test here.
      await waitFor(() => expect(mocks.scratchWorkspace).toHaveBeenCalled())
      const firstProps = mocks.scratchWorkspace.mock.calls[0][0]
      expect(firstProps.highlightedPanes).toEqual(['blocks'])
    })

    it('passes a whole-class force command down to ScratchWorkspace as forcedPane/forcedPaneToken', async () => {
      mocks.useSession.mockReturnValue(
        mkScratchSession({
          teacherClassPaneCommand: { mode: 'force', panes: ['stage'], pushedAt: 5 },
        })
      )

      render(<StudentView lessonId="scratch-1-1" lesson={scratchLesson} />)

      await waitFor(() => expect(mocks.scratchWorkspace).toHaveBeenCalled())
      const firstProps = mocks.scratchWorkspace.mock.calls[0][0]
      expect(firstProps.forcedPane).toBe('stage')
      expect(firstProps.forcedPaneToken).toBe(5)
    })

    it('prefers whichever of the per-student or whole-class command was pushed more recently', async () => {
      mocks.useSession.mockReturnValue(
        mkScratchSession({
          students: {
            'student-1': {
              teacherPaneCommand: { mode: 'highlight', panes: ['blocks'], pushedAt: 10 },
            },
          },
          teacherClassPaneCommand: { mode: 'force', panes: ['stage'], pushedAt: 5 },
        })
      )

      render(<StudentView lessonId="scratch-1-1" lesson={scratchLesson} />)

      await waitFor(() => expect(mocks.scratchWorkspace).toHaveBeenCalled())
      const firstProps = mocks.scratchWorkspace.mock.calls[0][0]
      expect(firstProps.highlightedPanes).toEqual(['blocks'])
      expect(firstProps.forcedPane).toBeNull()
    })
  })

  describe('fullscreen request', () => {
    function mkLiveSession(sessionOverrides = {}, hookOverrides = {}) {
      return {
        session: {
          lessonId: 'python-1-1',
          state: 'active',
          createdAt: 456,
          currentTaskId: 1,
          students: {},
          ...sessionOverrides,
        },
        loading: false,
        registerPresence: vi.fn(),
        joinSession: vi.fn(),
        writeStudentRun: vi.fn(),
        writeStudentCode: vi.fn(),
        writeStudentFiles: vi.fn(),
        writeStudentOutput: vi.fn(),
        writeStudentInteraction: vi.fn(),
        writeStudentPersonalSandbox: vi.fn(),
        writeStudentPresence: vi.fn(),
        setTaskId: vi.fn(),
        setTeacherLive: vi.fn(),
        updateTeacherLive: vi.fn(),
        removeStudent: vi.fn(),
        ...hookOverrides,
      }
    }

    afterEach(() => {
      delete document.documentElement.requestFullscreen
      delete document.exitFullscreen
    })

    it('shows a fullscreen modal prompt when the teacher requests it', async () => {
      mocks.useSession.mockReturnValue(mkLiveSession({ fullscreenRequestedAt: 999 }))
      render(<StudentView lessonId="python-1-1" />)
      await waitFor(() => {
        expect(screen.getByText('Your teacher would like you to go fullscreen')).toBeInTheDocument()
      })
    })

    it("calls requestFullscreen from the student's own click and dismisses the prompt", async () => {
      const user = userEvent.setup()
      const requestFullscreen = vi.fn().mockResolvedValue(undefined)
      document.documentElement.requestFullscreen = requestFullscreen
      mocks.useSession.mockReturnValue(mkLiveSession({ fullscreenRequestedAt: 999 }))
      render(<StudentView lessonId="python-1-1" />)

      const goFullscreenBtn = await screen.findByRole('button', { name: 'Go Fullscreen' })
      await user.click(goFullscreenBtn)

      expect(requestFullscreen).toHaveBeenCalledTimes(1)
      expect(
        screen.queryByText('Your teacher would like you to go fullscreen')
      ).not.toBeInTheDocument()
    })

    it('dismisses the prompt without requesting fullscreen when Not now is clicked', async () => {
      const user = userEvent.setup()
      const requestFullscreen = vi.fn().mockResolvedValue(undefined)
      document.documentElement.requestFullscreen = requestFullscreen
      mocks.useSession.mockReturnValue(mkLiveSession({ fullscreenRequestedAt: 999 }))
      render(<StudentView lessonId="python-1-1" />)

      const notNowBtn = await screen.findByRole('button', { name: 'Not now' })
      await user.click(notNowBtn)

      expect(requestFullscreen).not.toHaveBeenCalled()
      expect(
        screen.queryByText('Your teacher would like you to go fullscreen')
      ).not.toBeInTheDocument()
    })

    it('also shows the prompt for a per-student fullscreen request, not just the class-wide one', async () => {
      mocks.useSession.mockReturnValue(
        mkLiveSession({ students: { 'student-1': { fullscreenRequestedAt: 999 } } })
      )
      render(<StudentView lessonId="python-1-1" />)
      await waitFor(() => {
        expect(screen.getByText('Your teacher would like you to go fullscreen')).toBeInTheDocument()
      })
    })

    it('does not show the prompt for a fullscreen request targeted at a different student', async () => {
      mocks.useSession.mockReturnValue(
        mkLiveSession({ students: { 'someone-else': { fullscreenRequestedAt: 999 } } })
      )
      render(<StudentView lessonId="python-1-1" />)
      await waitFor(() => expect(screen.getByLabelText('code')).toBeInTheDocument())
      expect(
        screen.queryByText('Your teacher would like you to go fullscreen')
      ).not.toBeInTheDocument()
    })

    it('exits fullscreen automatically once the session ends', async () => {
      const exitFullscreen = vi.fn().mockResolvedValue(undefined)
      document.exitFullscreen = exitFullscreen
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        value: document.body,
      })

      mocks.useSession.mockReturnValue(mkLiveSession())
      const { rerender } = render(<StudentView lessonId="python-1-1" />)
      await waitFor(() => expect(screen.getByLabelText('code')).toBeInTheDocument())

      mocks.useSession.mockReturnValue(mkLiveSession({ state: 'ended' }))
      rerender(<StudentView lessonId="python-1-1" />)

      await waitFor(() => expect(exitFullscreen).toHaveBeenCalledTimes(1))

      Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null })
    })
  })

  describe('session ended screen', () => {
    // Mirrors the fullscreen describe block above: the phase machine only transitions
    // to 'ended' from 'lesson'/'sandbox' (see useStudentPhase.js), so a session that
    // starts already 'ended' resolves to 'choice' instead — mount live first, then
    // rerender with state 'ended' to trigger the real transition.
    function mkLiveSession(overrides = {}) {
      return {
        session: {
          lessonId: 'python-1-1',
          state: 'active',
          createdAt: 456,
          currentTaskId: 1,
          students: {},
          ...overrides,
        },
        loading: false,
        registerPresence: vi.fn(),
        joinSession: vi.fn(),
        writeStudentRun: vi.fn(),
        writeStudentCode: vi.fn(),
        writeStudentFiles: vi.fn(),
        writeStudentOutput: vi.fn(),
        writeStudentInteraction: vi.fn(),
        writeStudentPersonalSandbox: vi.fn(),
        writeStudentPresence: vi.fn(),
        setTaskId: vi.fn(),
        setTeacherLive: vi.fn(),
        updateTeacherLive: vi.fn(),
        removeStudent: vi.fn(),
      }
    }

    it('offers the linked solo challenge when the live session ends', async () => {
      mocks.findSoloCompanion.mockResolvedValue({
        id: 'python-1-1-solo',
        title: 'Python Challenge',
      })
      mocks.useSession.mockReturnValue(mkLiveSession())
      const user = userEvent.setup()
      const originalHash = window.location.hash
      const { rerender } = render(<StudentView lessonId="python-1-1" />)
      await waitFor(() => expect(screen.getByLabelText('code')).toBeInTheDocument())

      mocks.useSession.mockReturnValue(mkLiveSession({ state: 'ended' }))
      rerender(<StudentView lessonId="python-1-1" />)

      const challengeBtn = await screen.findByRole('button', { name: 'Try the Solo Challenge' })
      await user.click(challengeBtn)
      expect(window.location.hash).toBe('#/lesson/python-1-1-solo?solo=true')

      window.location.hash = originalHash
    })

    it('shows no solo challenge button when the lesson has no linked companion', async () => {
      mocks.useSession.mockReturnValue(mkLiveSession())
      const { rerender } = render(<StudentView lessonId="python-1-1" />)
      await waitFor(() => expect(screen.getByLabelText('code')).toBeInTheDocument())

      mocks.useSession.mockReturnValue(mkLiveSession({ state: 'ended' }))
      rerender(<StudentView lessonId="python-1-1" />)

      await screen.findByText('Session ended')
      expect(
        screen.queryByRole('button', { name: /Try the Solo Challenge/i })
      ).not.toBeInTheDocument()
    })

    it('offers Open Playground for the lesson type on the session ended screen', async () => {
      mocks.useSession.mockReturnValue(mkLiveSession())
      const user = userEvent.setup()
      const originalHash = window.location.hash
      const { rerender } = render(<StudentView lessonId="python-1-1" />)
      await waitFor(() => expect(screen.getByLabelText('code')).toBeInTheDocument())

      mocks.useSession.mockReturnValue(mkLiveSession({ state: 'ended' }))
      rerender(<StudentView lessonId="python-1-1" />)

      const playgroundBtn = await screen.findByRole('button', { name: 'Open Playground' })
      await user.click(playgroundBtn)
      expect(window.location.hash).toBe('#/playground/python')

      window.location.hash = originalHash
    })
  })

  describe('persistent Need Help control', () => {
    function mkLiveSession(sessionOverrides = {}, hookOverrides = {}) {
      return {
        session: {
          lessonId: 'python-1-1',
          state: 'active',
          createdAt: 456,
          currentTaskId: 1,
          students: {},
          ...sessionOverrides,
        },
        loading: false,
        registerPresence: vi.fn(),
        joinSession: vi.fn(),
        writeStudentRun: vi.fn(),
        writeStudentCode: vi.fn(),
        writeStudentFiles: vi.fn(),
        writeStudentOutput: vi.fn(),
        writeStudentInteraction: vi.fn(),
        writeStudentPersonalSandbox: vi.fn(),
        writeStudentPresence: vi.fn(),
        setTaskId: vi.fn(),
        setTeacherLive: vi.fn(),
        updateTeacherLive: vi.fn(),
        removeStudent: vi.fn(),
        requestHelp: vi.fn(),
        ...hookOverrides,
      }
    }

    it('is always available (not tied to a failed check) during a live lesson, and requests help for this student when clicked', async () => {
      const user = userEvent.setup()
      const requestHelp = vi.fn()
      mocks.useSession.mockReturnValue(mkLiveSession({}, { requestHelp }))
      render(<StudentView lessonId="python-1-1" />)
      await waitFor(() => expect(screen.getByLabelText('code')).toBeInTheDocument())

      const needHelpBtn = screen.getByRole('button', { name: /Need Help/i })
      await user.click(needHelpBtn)

      expect(requestHelp).toHaveBeenCalledWith('student-1')
    })

    it('shows a requested state and disables the button once the teacher has been notified', async () => {
      mocks.useSession.mockReturnValue(
        mkLiveSession({ students: { 'student-1': { needsHelp: true } } })
      )
      render(<StudentView lessonId="python-1-1" />)
      await waitFor(() => expect(screen.getByLabelText('code')).toBeInTheDocument())

      const needHelpBtn = screen.getByRole('button', { name: /Help requested/i })
      expect(needHelpBtn).toBeDisabled()
    })

    it('does not appear in solo mode (no teacher on the other end to help)', async () => {
      render(<StudentView lessonId="python-1-1" forceSolo />)
      await waitFor(() => expect(screen.getByLabelText('code')).toBeInTheDocument())

      expect(screen.queryByRole('button', { name: /Need Help/i })).not.toBeInTheDocument()
    })
  })

  describe('explainer pseudo-task (Scratch solo)', () => {
    const scratchLessonWithExplainers = {
      id: 'scratch-1-1',
      title: 'Scratch 1.1',
      type: 'scratch',
      tasks: [
        {
          id: 1,
          title: 'Move the cat',
          starterBlocks: null,
          explainer: 'Drag a move block onto the stage.',
        },
        { id: 2, title: 'Turn the cat', starterBlocks: null, explainer: 'Now add a turn block.' },
      ],
    }

    it('adds a pseudo-task to solo nav (debounced) after the explainer is manually collapsed, and removes it immediately on re-expand', async () => {
      const user = userEvent.setup()
      render(<StudentView lessonId="scratch-1-1" forceSolo lesson={scratchLessonWithExplainers} />)

      await waitFor(() => expect(mocks.scratchWorkspace).toHaveBeenCalled())
      expect(screen.getByText('Task 1 of 2')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Collapse Explainer' }))

      // The nav count only bumps to 3 after the debounce window fires.
      await waitFor(() => expect(screen.getByText('Task 2 of 3')).toBeInTheDocument(), {
        timeout: 2000,
      })

      await user.click(screen.getByRole('button', { name: 'Show Explainer' }))

      // Disappearance is not debounced.
      await waitFor(() => expect(screen.getByText('Task 1 of 2')).toBeInTheDocument())
    })

    it('opens a read-only explainer slide via Previous, and Next returns to the task', async () => {
      const user = userEvent.setup()
      render(<StudentView lessonId="scratch-1-1" forceSolo lesson={scratchLessonWithExplainers} />)

      await waitFor(() => expect(mocks.scratchWorkspace).toHaveBeenCalled())
      expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()

      await user.click(screen.getByRole('button', { name: 'Collapse Explainer' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled(), {
        timeout: 2000,
      })

      await user.click(screen.getByRole('button', { name: 'Previous' }))

      await waitFor(() => expect(screen.getByText('Information')).toBeInTheDocument())
      expect(screen.queryByText('Scratch')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()

      await user.click(screen.getByRole('button', { name: 'Next' }))

      await waitFor(() => expect(screen.getByText('Scratch')).toBeInTheDocument())
      expect(screen.queryByText('Information')).not.toBeInTheDocument()
    })

    it('does not add a pseudo-task for non-Scratch lesson types even when solo and collapsed', async () => {
      const user = userEvent.setup()
      render(
        <StudentView
          lessonId="python-1-1"
          forceSolo
          lesson={{
            id: 'python-1-1',
            title: 'Python 1.1',
            type: 'python',
            tasks: [
              {
                id: 1,
                title: 'Task one',
                starterCode: 'print("hi")',
                explainer: 'Read this first.',
              },
              { id: 2, title: 'Task two', starterCode: 'print("bye")', explainer: 'Then this.' },
            ],
          }}
        />
      )

      await waitFor(() => expect(screen.getByLabelText('code')).toHaveValue('print("hi")'))
      expect(screen.getByText('Task 1 of 2')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Collapse Explainer' }))

      // Wait out the (Scratch-only) debounce window, then confirm the count never bumped.
      await new Promise((resolve) => setTimeout(resolve, 500))
      expect(screen.getByText('Task 1 of 2')).toBeInTheDocument()
    })

    it('arriving at a new task with the explainer already collapsed auto-shows the explainer slide first', async () => {
      const user = userEvent.setup()
      render(<StudentView lessonId="scratch-1-1" forceSolo lesson={scratchLessonWithExplainers} />)

      await waitFor(() => expect(mocks.scratchWorkspace).toHaveBeenCalled())
      await user.click(screen.getByRole('button', { name: 'Collapse Explainer' }))

      // Manually collapsing mid-task does not itself open the slide — still on task 1's code.
      expect(screen.getByText('Scratch')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Next' }))

      // Task 2's explainer is still collapsed (the toggle carries across tasks), so arriving
      // there shows the slide automatically instead of dropping straight into the code.
      await waitFor(() => expect(screen.getByText('Information')).toBeInTheDocument())
      expect(screen.queryByText('Scratch')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Next' }))

      await waitFor(() => expect(screen.getByText('Scratch')).toBeInTheDocument())
      expect(screen.queryByText('Information')).not.toBeInTheDocument()
    })

    // Composed lessons carry a per-task module type (task.moduleType) rather than a
    // single lesson.type — the gate must read the effective, per-task type, not the
    // raw composed lesson.type (which is just 'composed').
    it('adds a pseudo-task for a composed lesson task whose module type is scratch', async () => {
      const user = userEvent.setup()
      render(
        <StudentView
          lessonId="composed-scratch-1"
          forceSolo
          lesson={{
            id: 'composed-scratch-1',
            title: 'Composed',
            type: 'composed',
            tasks: [
              {
                id: 1,
                title: 'Move the cat',
                moduleType: 'scratch',
                starterBlocks: null,
                explainer: 'Drag a move block.',
              },
              {
                id: 2,
                title: 'Turn the cat',
                moduleType: 'scratch',
                starterBlocks: null,
                explainer: 'Now turn.',
              },
            ],
          }}
        />
      )

      await waitFor(() => expect(mocks.scratchWorkspace).toHaveBeenCalled())
      expect(screen.getByText('Task 1 of 2')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Collapse Explainer' }))

      await waitFor(() => expect(screen.getByText('Task 2 of 3')).toBeInTheDocument(), {
        timeout: 2000,
      })
    })

    it('does not add a pseudo-task for a composed lesson task whose module type is not scratch', async () => {
      const user = userEvent.setup()
      render(
        <StudentView
          lessonId="composed-python-1"
          forceSolo
          lesson={{
            id: 'composed-python-1',
            title: 'Composed',
            type: 'composed',
            tasks: [
              {
                id: 1,
                title: 'Task one',
                moduleType: 'python',
                starterCode: 'print("hi")',
                explainer: 'Read this first.',
              },
            ],
          }}
        />
      )

      await waitFor(() => expect(screen.getByLabelText('code')).toHaveValue('print("hi")'))
      expect(screen.getByText('Task 1 of 1')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Collapse Explainer' }))

      await new Promise((resolve) => setTimeout(resolve, 500))
      expect(screen.getByText('Task 1 of 1')).toBeInTheDocument()
    })
  })

  describe('solo lesson completion screen', () => {
    // A dedicated lessonId (distinct from the "python-1-1" id reused throughout this
    // file) avoids cross-test localStorage bleed — saved code is keyed by lessonId +
    // taskId + student id, and other tests write real code under "python-1-1"/task 1.
    const twoTaskPythonLesson = {
      id: 'python-solo-complete-1',
      title: 'Python Solo Complete',
      type: 'python',
      tasks: [
        { id: 1, title: 'First task', starterCode: 'print("one")' },
        { id: 2, title: 'Second task', starterCode: 'print("two")' },
      ],
    }

    it('shows a completion screen with a working Open Playground link after Next off the last task', async () => {
      const user = userEvent.setup()
      const originalHash = window.location.hash
      render(
        <StudentView lessonId="python-solo-complete-1" forceSolo lesson={twoTaskPythonLesson} />
      )

      await waitFor(() => expect(screen.getByLabelText('code')).toHaveValue('print("one")'))
      await user.click(screen.getByRole('button', { name: 'Next' }))
      await waitFor(() => expect(screen.getByLabelText('code')).toHaveValue('print("two")'))
      // Reaching the last real task keeps the real count in the label (Next becomes
      // reachable past it, but the completion screen isn't "counted" until you're on it).
      expect(screen.getByText('Task 2 of 2')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Next' }))

      expect(await screen.findByText('Lesson complete!')).toBeInTheDocument()
      expect(screen.getByText('Task 3 of 3')).toBeInTheDocument()

      const playgroundBtn = screen.getByRole('button', { name: 'Open Playground' })
      await user.click(playgroundBtn)
      expect(window.location.hash).toBe('#/playground/python')

      window.location.hash = originalHash
    })

    it('returns to the last task when Previous is clicked from the completion screen', async () => {
      const user = userEvent.setup()
      render(
        <StudentView lessonId="python-solo-complete-1" forceSolo lesson={twoTaskPythonLesson} />
      )

      await waitFor(() => expect(screen.getByLabelText('code')).toHaveValue('print("one")'))
      await user.click(screen.getByRole('button', { name: 'Next' }))
      await user.click(screen.getByRole('button', { name: 'Next' }))
      await screen.findByText('Lesson complete!')

      await user.click(screen.getByRole('button', { name: 'Previous' }))

      await waitFor(() => expect(screen.getByLabelText('code')).toHaveValue('print("two")'))
      expect(screen.queryByText('Lesson complete!')).not.toBeInTheDocument()
    })

    it('resolves Open Playground from the last code task, not a trailing non-code task, on a composed lesson', async () => {
      const user = userEvent.setup()
      render(
        <StudentView
          lessonId="composed-solo-complete-1"
          forceSolo
          lesson={{
            id: 'composed-solo-complete-1',
            title: 'Composed Solo Complete',
            type: 'composed',
            tasks: [
              { id: 1, title: 'Scratch task', moduleType: 'scratch', starterBlocks: null },
              { id: 2, title: 'Python task', moduleType: 'python', starterCode: 'print("hi")' },
              { id: 3, title: 'Recap', taskType: 'information' },
            ],
          }}
        />
      )

      await waitFor(() => expect(mocks.scratchWorkspace).toHaveBeenCalled())
      await user.click(screen.getByRole('button', { name: 'Next' }))
      await waitFor(() => expect(screen.getByLabelText('code')).toHaveValue('print("hi")'))
      await user.click(screen.getByRole('button', { name: 'Next' }))
      await waitFor(() => expect(screen.getByText('Recap')).toBeInTheDocument())

      await user.click(screen.getByRole('button', { name: 'Next' }))

      expect(await screen.findByText('Lesson complete!')).toBeInTheDocument()
      // The lesson's last real task (Recap) has no module of its own — the button
      // must fall back to the last *code* task (Python), not disappear or point at
      // whatever the raw composed lesson's meaningless top-level `.type` resolves to.
      const playgroundBtn = screen.getByRole('button', { name: 'Open Playground' })
      const originalHash = window.location.hash
      await user.click(playgroundBtn)
      expect(window.location.hash).toBe('#/playground/python')
      window.location.hash = originalHash
    })

    it('shows no Open Playground link for a lesson type without a playground', async () => {
      const user = userEvent.setup()
      render(
        <StudentView
          lessonId="filesystem-1-1"
          forceSolo
          lesson={{
            id: 'filesystem-1-1',
            title: 'Filesystem 1.1',
            type: 'filesystem',
            tasks: [{ id: 1, title: 'Only task' }],
          }}
        />
      )

      await waitFor(() => expect(screen.getByText('Filesystem')).toBeInTheDocument())
      await user.click(screen.getByRole('button', { name: 'Next' }))

      expect(await screen.findByText('Lesson complete!')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Open Playground' })).not.toBeInTheDocument()
    })

    it('shows no solo challenge link when the lesson has no linked companion', async () => {
      const user = userEvent.setup()
      render(
        <StudentView lessonId="python-solo-complete-1" forceSolo lesson={twoTaskPythonLesson} />
      )

      await waitFor(() => expect(screen.getByLabelText('code')).toHaveValue('print("one")'))
      await user.click(screen.getByRole('button', { name: 'Next' }))
      await user.click(screen.getByRole('button', { name: 'Next' }))

      expect(await screen.findByText('Lesson complete!')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /Try the Solo Challenge/i })
      ).not.toBeInTheDocument()
    })

    it('offers a linked solo challenge and navigates straight into it in solo mode', async () => {
      mocks.findSoloCompanion.mockResolvedValue({
        id: 'python-solo-complete-1-solo',
        title: 'Python Challenge',
      })
      const user = userEvent.setup()
      const originalHash = window.location.hash
      render(
        <StudentView lessonId="python-solo-complete-1" forceSolo lesson={twoTaskPythonLesson} />
      )

      await waitFor(() => expect(screen.getByLabelText('code')).toHaveValue('print("one")'))
      await user.click(screen.getByRole('button', { name: 'Next' }))
      await user.click(screen.getByRole('button', { name: 'Next' }))
      await screen.findByText('Lesson complete!')

      const challengeBtn = await screen.findByRole('button', { name: 'Try the Solo Challenge' })
      await user.click(challengeBtn)
      expect(window.location.hash).toBe('#/lesson/python-solo-complete-1-solo?solo=true')

      window.location.hash = originalHash
    })

    it('goes back to the first task when "Go Through the Lesson Again" is clicked', async () => {
      const user = userEvent.setup()
      render(
        <StudentView lessonId="python-solo-complete-1" forceSolo lesson={twoTaskPythonLesson} />
      )

      await waitFor(() => expect(screen.getByLabelText('code')).toHaveValue('print("one")'))
      await user.click(screen.getByRole('button', { name: 'Next' }))
      await user.click(screen.getByRole('button', { name: 'Next' }))
      await screen.findByText('Lesson complete!')

      await user.click(screen.getByRole('button', { name: 'Go Through the Lesson Again' }))

      await waitFor(() => expect(screen.getByLabelText('code')).toHaveValue('print("one")'))
      expect(screen.queryByText('Lesson complete!')).not.toBeInTheDocument()
    })
  })

  describe('python execution across task navigation', () => {
    afterEach(() => {
      runPython.mockReset()
      stopPython.mockReset()
    })

    it('stops a still-running python execution when the student moves to another task', async () => {
      const user = userEvent.setup()
      let resolveRun
      runPython.mockImplementation((code, { onOutput }) => {
        onOutput('task one output\n')
        return new Promise((resolve) => {
          resolveRun = resolve
        })
      })
      // Mirrors stopPython(): terminating the worker resolves the pending run as 'stopped'.
      stopPython.mockImplementation(() => resolveRun?.({ status: 'stopped' }))

      render(
        <StudentView
          lessonId="python-solo-nav-stop-1"
          forceSolo
          lesson={{
            id: 'python-solo-nav-stop-1',
            title: 'Python Solo Nav Stop',
            type: 'python',
            tasks: [
              { id: 1, title: 'First task', starterCode: 'print("one")' },
              { id: 2, title: 'Second task', starterCode: 'print("two")' },
            ],
          }}
        />
      )

      await waitFor(() => expect(screen.getByLabelText('code')).toHaveValue('print("one")'))
      await user.click(screen.getByRole('button', { name: 'Run' }))
      // The workspace's Run button becomes a Stop button while execution is in flight.
      await waitFor(() => expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument())
      await waitFor(() => expect(screen.getByText(/task one output/)).toBeInTheDocument())

      await user.click(screen.getByRole('button', { name: 'Next' }))

      expect(stopPython).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(screen.getByLabelText('code')).toHaveValue('print("two")'))
      // Run must be usable again on the new task, not stuck showing Stop as "still running".
      await waitFor(() => expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument())
      // The first task's buffered output must not bleed into the task navigated to.
      expect(screen.queryByText(/task one output/)).not.toBeInTheDocument()
    })
  })

  describe('turtle execution', () => {
    afterEach(() => {
      runPython.mockReset()
      stopPython.mockReset()
    })

    // Regression test: handleRun's python-vs-html branch in useStudentCodeState.js
    // originally didn't include 'turtle', so Run fell through to the HTML iframe
    // branch and crashed on mod.runtime.buildPreviewSrc (turtle has none — it runs
    // through the shared Pyodide worker like python, not an iframe).
    it('runs a turtle task through the Pyodide worker without falling into the HTML iframe branch', async () => {
      const user = userEvent.setup()
      runPython.mockImplementation(() =>
        Promise.resolve({
          status: 'success',
          variables: {},
          turtle: {
            state: { x: 0, y: 0, heading: 0, penDown: true, color: 'black' },
            commands: [{ type: 'line', x1: 0, y1: 0, x2: 100, y2: 0, color: 'black' }],
            calls: [{ name: 'forward', args: [100] }],
          },
        })
      )

      render(
        <StudentView
          lessonId="turtle-solo-1"
          forceSolo
          lesson={{
            id: 'turtle-solo-1',
            title: 'Turtle Solo',
            type: 'turtle',
            tasks: [{ id: 1, title: 'Draw a line', starterCode: 'turtle.forward(100)' }],
          }}
        />
      )

      await waitFor(() => expect(screen.getByLabelText('code')).toHaveValue('turtle.forward(100)'))
      await user.click(screen.getByRole('button', { name: 'Run' }))

      await waitFor(() => expect(runPython).toHaveBeenCalledTimes(1))
      // The bug threw synchronously inside handleRun before this point was ever reached.
      await waitFor(() => expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument())
    })

    it('stops a still-running turtle execution without an unhandled rejection', async () => {
      const user = userEvent.setup()
      let resolveRun
      runPython.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveRun = resolve
          })
      )
      stopPython.mockImplementation(() => resolveRun?.({ status: 'stopped', variables: {} }))

      render(
        <StudentView
          lessonId="turtle-solo-stop-1"
          forceSolo
          lesson={{
            id: 'turtle-solo-stop-1',
            title: 'Turtle Solo Stop',
            type: 'turtle',
            tasks: [{ id: 1, title: 'Draw a line', starterCode: 'turtle.forward(100)' }],
          }}
        />
      )

      await waitFor(() => expect(screen.getByLabelText('code')).toHaveValue('turtle.forward(100)'))
      await user.click(screen.getByRole('button', { name: 'Run' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument())

      await user.click(screen.getByRole('button', { name: 'Stop' }))

      expect(stopPython).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument())
    })

    it('evaluates code checks alongside turtle checks after a run', async () => {
      const user = userEvent.setup()
      runPython.mockImplementation(() =>
        Promise.resolve({
          status: 'success',
          variables: {},
          turtle: {
            state: { x: 100, y: 0, heading: 0, penDown: true, color: 'black', visible: true },
            commands: [{ type: 'line', x1: 0, y1: 0, x2: 100, y2: 0, color: 'black' }],
            calls: [{ name: 'forward', args: [100] }],
          },
        })
      )

      render(
        <StudentView
          lessonId="turtle-code-check-1"
          forceSolo
          lesson={{
            id: 'turtle-code-check-1',
            title: 'Turtle Code Check',
            type: 'turtle',
            tasks: [
              {
                id: 1,
                title: 'Use a loop',
                starterCode: 'turtle.forward(100)',
                check: [
                  { type: 'turtle_segment_count', operator: 'greater_than_or_equal', value: '1' },
                  { type: 'code', operator: 'contains', value: 'range(', hint: 'Use a for loop' },
                ],
              },
            ],
          }}
        />
      )

      await waitFor(() => expect(screen.getByLabelText('code')).toHaveValue('turtle.forward(100)'))
      await user.click(screen.getByRole('button', { name: 'Run' }))

      // The drawing passes, but the code has no loop — so the code check fails the task.
      await waitFor(() =>
        expect(screen.getByTestId('check-feedback')).toHaveAttribute(
          'data-suggestion',
          'Use a for loop'
        )
      )
      expect(screen.getByTestId('check-feedback')).toHaveAttribute('data-passed', 'false')
    })
  })

  describe('arcade code checks', () => {
    const arcadeLesson = (starterCode) => ({
      id: `arcade-code-check-${starterCode.length}`,
      title: 'Arcade Code Check',
      type: 'arcade',
      tasks: [
        {
          id: 1,
          title: 'Start the game',
          starterCode,
          check: [
            { type: 'code', operator: 'contains', value: 'game.run()', hint: 'Call game.run()' },
          ],
        },
      ],
    })

    it('passes the task when Run game is pressed with code that satisfies the checks', async () => {
      const user = userEvent.setup()
      const lesson = arcadeLesson('from headstart_arcade import game\ngame.run()\n')
      render(<StudentView lessonId={lesson.id} forceSolo lesson={lesson} />)

      await waitFor(() =>
        expect(screen.getByLabelText('code')).toHaveValue(lesson.tasks[0].starterCode)
      )
      await user.click(screen.getByRole('button', { name: 'Run game' }))

      await waitFor(() =>
        expect(screen.getByTestId('check-feedback')).toHaveAttribute('data-passed', 'true')
      )
    })

    it('shows the failing code check hint when the code does not satisfy it', async () => {
      const user = userEvent.setup()
      const lesson = arcadeLesson('from headstart_arcade import game\n')
      render(<StudentView lessonId={lesson.id} forceSolo lesson={lesson} />)

      await waitFor(() =>
        expect(screen.getByLabelText('code')).toHaveValue(lesson.tasks[0].starterCode)
      )
      await user.click(screen.getByRole('button', { name: 'Run game' }))

      await waitFor(() =>
        expect(screen.getByTestId('check-feedback')).toHaveAttribute(
          'data-suggestion',
          'Call game.run()'
        )
      )
      expect(screen.getByTestId('check-feedback')).toHaveAttribute('data-passed', 'false')
    })
  })

  describe('live output mirror for a watching teacher', () => {
    afterEach(() => {
      runPython.mockReset()
      stopPython.mockReset()
    })

    function mkWatchedSession(activeStudentView, hookOverrides = {}) {
      return {
        session: {
          lessonId: 'python-1-1',
          state: 'active',
          createdAt: 456,
          currentTaskId: 1,
          students: {},
          activeStudentView,
        },
        loading: false,
        registerPresence: vi.fn(),
        joinSession: vi.fn(),
        writeStudentRun: vi.fn(),
        writeStudentCode: vi.fn(),
        writeStudentFiles: vi.fn(),
        writeStudentOutput: vi.fn(),
        writeStudentInputState: vi.fn(),
        writeStudentInteraction: vi.fn(),
        writeStudentPersonalSandbox: vi.fn(),
        writeStudentPresence: vi.fn(),
        setTaskId: vi.fn(),
        setTeacherLive: vi.fn(),
        updateTeacherLive: vi.fn(),
        removeStudent: vi.fn(),
        ...hookOverrides,
      }
    }

    it('clears the last run up front and bundles the input() echo with the prompt clearing', async () => {
      const user = userEvent.setup()
      const writeStudentInputState = vi.fn()
      mocks.useSession.mockReturnValue(mkWatchedSession('student-1', { writeStudentInputState }))
      runPython.mockImplementation((code, { onOutput, onInputRequired }) => {
        onOutput('What is your name? ')
        onInputRequired('What is your name? ')
        return new Promise(() => {})
      })

      render(<StudentView lessonId="python-1-1" />)
      await waitFor(() => expect(screen.getByLabelText('code')).toBeInTheDocument())
      await user.click(screen.getByRole('button', { name: 'Run' }))

      await waitFor(() =>
        expect(writeStudentInputState).toHaveBeenCalledWith('student-1', {
          prompt: 'What is your name? ',
          value: '',
          output: 'What is your name? ',
        })
      )
      expect(writeStudentInputState).toHaveBeenCalledWith('student-1', {
        prompt: null,
        value: '',
        output: '',
      })

      await user.click(await screen.findByRole('button', { name: 'submit-input' }))
      expect(writeStudentInputState).toHaveBeenLastCalledWith('student-1', {
        prompt: null,
        value: '',
        output: 'What is your name? Sam\n',
      })
    })

    it('starts mirroring output when the teacher opens the modal mid-run', async () => {
      const user = userEvent.setup()
      let emit
      runPython.mockImplementation((code, { onOutput }) => {
        emit = onOutput
        return new Promise(() => {})
      })
      const writeStudentOutput = vi.fn()
      mocks.useSession.mockReturnValue(mkWatchedSession(null, { writeStudentOutput }))

      const { rerender } = render(<StudentView lessonId="python-1-1" />)
      await waitFor(() => expect(screen.getByLabelText('code')).toBeInTheDocument())
      await user.click(screen.getByRole('button', { name: 'Run' }))
      await waitFor(() => expect(emit).toBeTypeOf('function'))
      emit('before watching\n')
      expect(writeStudentOutput).not.toHaveBeenCalled()

      mocks.useSession.mockReturnValue(mkWatchedSession('student-1', { writeStudentOutput }))
      rerender(<StudentView lessonId="python-1-1" />)
      emit('after watching\n')

      await waitFor(() =>
        expect(writeStudentOutput).toHaveBeenLastCalledWith(
          'student-1',
          'before watching\nafter watching\n'
        )
      )
    })

    it('delivers the tail of a quick burst of output instead of dropping it', async () => {
      const user = userEvent.setup()
      const writeStudentOutput = vi.fn()
      mocks.useSession.mockReturnValue(mkWatchedSession('student-1', { writeStudentOutput }))
      runPython.mockImplementation((code, { onOutput }) => {
        onOutput('one\n')
        onOutput('two\n')
        onOutput('three\n')
        return new Promise(() => {})
      })

      render(<StudentView lessonId="python-1-1" />)
      await waitFor(() => expect(screen.getByLabelText('code')).toBeInTheDocument())
      await user.click(screen.getByRole('button', { name: 'Run' }))

      await waitFor(() =>
        expect(writeStudentOutput).toHaveBeenLastCalledWith('student-1', 'one\ntwo\nthree\n')
      )
    })
  })

  describe('teacher answer edits', () => {
    const matchLesson = {
      id: 'python-1-1',
      title: 'Python 1.1',
      type: 'python',
      tasks: [
        {
          id: 1,
          title: 'Match it',
          taskType: 'quiz',
          quizType: 'match',
          pairs: [
            { id: 'p1', prompt: 'print', answer: 'shows text' },
            { id: 'p2', prompt: 'input', answer: 'asks' },
          ],
        },
      ],
    }

    function mkSession(studentData, hookOverrides = {}) {
      return {
        session: {
          lessonId: 'python-1-1',
          state: 'active',
          createdAt: 456,
          currentTaskId: 1,
          students: { 'student-1': { displayName: 'Solo', ...studentData } },
        },
        loading: false,
        registerPresence: vi.fn(),
        joinSession: vi.fn(),
        writeStudentRun: vi.fn(),
        writeStudentCode: vi.fn(),
        writeStudentFiles: vi.fn(),
        writeStudentOutput: vi.fn(),
        writeStudentAnswer: vi.fn(),
        writeStudentInteraction: vi.fn(),
        writeStudentPersonalSandbox: vi.fn(),
        writeStudentPresence: vi.fn(),
        logAttempt: vi.fn(),
        clearTeacherAnswerEdit: vi.fn(),
        setTaskId: vi.fn(),
        setTeacherLive: vi.fn(),
        updateTeacherLive: vi.fn(),
        removeStudent: vi.fn(),
        ...hookOverrides,
      }
    }

    it('applies a completed teacher edit as a normal pass, logged as teacher assisted', async () => {
      const hooks = mkSession({
        teacherAnswerEdit: {
          answer: '{"p1":"p1","p2":"p2"}',
          codeArrangeSlots: null,
          passed: true,
          taskId: 1,
          at: 111,
        },
      })
      mocks.useSession.mockReturnValue(hooks)

      const { rerender } = render(<StudentView lessonId="python-1-1" lesson={matchLesson} />)

      await waitFor(() =>
        expect(hooks.writeStudentRun).toHaveBeenCalledWith('student-1', {
          answer: '{"p1":"p1","p2":"p2"}',
          status: 'submitted',
          checkPassed: true,
        })
      )
      expect(hooks.logAttempt).toHaveBeenCalledWith(
        'student-1',
        1,
        expect.objectContaining({ passed: true, teacherAssisted: true })
      )
      expect(screen.getByTestId('teacher-answer-notice')).toHaveTextContent(
        'Your teacher updated your answer'
      )
      // Applying the teacher's own edit must not count as the student superseding it.
      expect(hooks.clearTeacherAnswerEdit).not.toHaveBeenCalled()

      rerender(<StudentView lessonId="python-1-1" lesson={matchLesson} />)
      expect(hooks.writeStudentRun).toHaveBeenCalledTimes(1)
    })

    it('ignores a teacher edit made for a different task', async () => {
      const hooks = mkSession({
        teacherAnswerEdit: { answer: '{"p1":"p1"}', passed: null, taskId: 9, at: 222 },
      })
      mocks.useSession.mockReturnValue(hooks)
      render(<StudentView lessonId="python-1-1" lesson={matchLesson} />)
      await waitFor(() => expect(screen.getByText('Quiz')).toBeInTheDocument())
      expect(hooks.writeStudentRun).not.toHaveBeenCalled()
      expect(screen.queryByTestId('teacher-answer-notice')).not.toBeInTheDocument()
    })
  })

  describe('teacher remote run', () => {
    afterEach(() => {
      runPython.mockReset()
    })

    function mkRunSession(studentData, hookOverrides = {}) {
      return {
        session: {
          lessonId: 'python-1-1',
          state: 'active',
          createdAt: 456,
          currentTaskId: 1,
          students: { 'student-1': { displayName: 'Solo', ...studentData } },
        },
        loading: false,
        registerPresence: vi.fn(),
        joinSession: vi.fn(),
        writeStudentRun: vi.fn(),
        writeStudentCode: vi.fn(),
        writeStudentFiles: vi.fn(),
        writeStudentOutput: vi.fn(),
        writeStudentInteraction: vi.fn(),
        writeStudentPersonalSandbox: vi.fn(),
        writeStudentPresence: vi.fn(),
        clearRemoteRun: vi.fn(),
        setTaskId: vi.fn(),
        setTeacherLive: vi.fn(),
        updateTeacherLive: vi.fn(),
        removeStudent: vi.fn(),
        ...hookOverrides,
      }
    }

    it("runs the student's own code on their device when the teacher presses Run", async () => {
      runPython.mockImplementation((code, { onOutput }) => {
        onOutput('hi\n')
        return Promise.resolve({ status: 'success' })
      })
      const hooks = mkRunSession({ remoteRunPushedAt: 777, remoteRunTaskId: 1 })
      mocks.useSession.mockReturnValue(hooks)

      render(<StudentView lessonId="python-1-1" />)

      await waitFor(() => expect(runPython).toHaveBeenCalledTimes(1))
      expect(runPython.mock.calls[0][0]).toBe('print("hi")')
      expect(hooks.clearRemoteRun).toHaveBeenCalledWith('student-1')
    })

    it('consumes but ignores a Run request made for a different task', async () => {
      const hooks = mkRunSession({ remoteRunPushedAt: 888, remoteRunTaskId: 5 })
      mocks.useSession.mockReturnValue(hooks)

      render(<StudentView lessonId="python-1-1" />)

      await waitFor(() => expect(hooks.clearRemoteRun).toHaveBeenCalledWith('student-1'))
      expect(runPython).not.toHaveBeenCalled()
    })
  })
})
