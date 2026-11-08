import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StudentView from '../StudentView'

const mocks = vi.hoisted(() => ({
  fetchLessonById: vi.fn(),
  findSoloCompanion: vi.fn(),
  useSession: vi.fn(),
  useIdentity: vi.fn(),
  scratchWorkspace: vi.fn(),
  buildIframeSrc: vi.fn(() => 'blob:preview'),
  playCompleteChime: vi.fn(),
}))

vi.mock('../../nudgeAlert', async (importOriginal) => ({
  ...(await importOriginal()),
  playCompleteChime: (...args) => mocks.playCompleteChime(...args),
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

vi.mock('../../hooks/usePeerHelp', async () => {
  const { peerHelpModuleMock } = await import('../../hooks/__tests__/peerHelpMock.js')
  return peerHelpModuleMock
})
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
  getStopCount: () => 0,
  isPythonRunning: () => false,
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

// A stand-in for the explainer card: its title folds the content away (the accordion), and it
// reports that to LessonTaskContent as the real panel does.
vi.mock('../../components/ExplainerPanel', async () => {
  const { useEffect, useState } = await import('react')
  return {
    default: function ExplainerPanelStub({ title, content, collapsible, onCollapsedChange }) {
      const [collapsed, setCollapsed] = useState(false)
      useEffect(() => {
        if (collapsible) onCollapsedChange?.(collapsed)
      }, [collapsible, collapsed, onCollapsedChange])
      return (
        <div>
          {collapsible ? (
            <button
              type="button"
              aria-label={`Explainer: ${title}`}
              onClick={() => setCollapsed((c) => !c)}
            >
              {title}
            </button>
          ) : null}
          {!collapsed && <div data-testid="explainer-stub-content">{content}</div>}
        </div>
      )
    },
  }
})

vi.mock('../../components/TaskSlideTransition', () => ({
  default: ({ children }) => <>{children}</>,
  useIsLeavingTaskSlide: () => false,
}))

vi.mock('../../components/LoadingScreen', () => ({
  default: ({ message }) => <div>{message}</div>,
}))

vi.mock('../../components/NameEntry', () => ({
  default: ({ onSubmit }) => (
    <div>
      Name entry
      <button type="button" onClick={() => onSubmit('Me')}>
        submit-name
      </button>
    </div>
  ),
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

vi.setConfig({ testTimeout: 30_000 })

// The presentation window's bar (calm teacher view, sketch v2, 8 Nov 2026).

const lesson = {
  id: 'python-1-1',
  title: 'Harness Lesson: Tutor View Review',
  type: 'python',
  tasks: [
    { id: 1, title: 'One', starterCode: '' },
    { id: 2, title: 'Two', starterCode: '' },
    { id: 3, title: 'Bonus', starterCode: '', priority: 'optional' },
    { id: 4, title: 'Four', starterCode: '' },
  ],
}

function endedCountdown() {
  const now = Date.now()
  return { startedAt: now - 120_000, endsAt: now - 1000, durationMs: 119_000 }
}

function presenterSession(sessionOverrides = {}) {
  return {
    session: {
      lessonId: 'python-1-1',
      state: 'active',
      createdAt: 456,
      currentTaskId: 2,
      students: {},
      ...sessionOverrides,
    },
    loading: false,
    serverTimeOffset: 0,
    registerPresence: vi.fn(),
    joinSession: vi.fn(),
    writeStudentRun: vi.fn(),
    writeStudentCode: vi.fn(),
    writeStudentFiles: vi.fn(),
    writeStudentOutput: vi.fn(),
    writeStudentInteraction: vi.fn(),
    writeStudentPersonalSandbox: vi.fn(),
    writeStudentPresence: vi.fn(),
    setTaskId: vi.fn(async () => {}),
    setTeacherLive: vi.fn(),
    updateTeacherLive: vi.fn(),
    removeStudent: vi.fn(),
    addClassCountdownTime: vi.fn(async () => {}),
    clearClassCountdown: vi.fn(async () => {}),
  }
}

async function renderPresenter(hook) {
  mocks.useSession.mockReturnValue(hook)
  render(<StudentView lessonId="python-1-1" teacherPresentation />)
  await screen.findByRole('button', { name: 'Next' }, { timeout: 15_000 })
}

describe('Presentation window bar', () => {
  beforeEach(() => {
    mocks.fetchLessonById.mockResolvedValue(lesson)
    mocks.findSoloCompanion.mockReset().mockResolvedValue(null)
    mocks.useIdentity.mockReturnValue({
      identity: null,
      loaded: true,
      createIdentity: vi.fn(),
      updateTimestamp: vi.fn(),
      updateDisplayName: vi.fn(),
    })
  })

  it('shows Time’s up with +1 min, Clear and Next task when the countdown ends', async () => {
    const hook = presenterSession({ classCountdown: endedCountdown() })
    await renderPresenter(hook)
    const strip = await screen.findByTestId('countdown-ended-strip')
    expect(strip).toHaveTextContent('Time’s up')
    expect(hook.setTaskId).not.toHaveBeenCalled()
    expect(hook.clearClassCountdown).not.toHaveBeenCalled()

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Next task →' })))
    expect(hook.setTaskId).toHaveBeenCalledWith(3)
    expect(hook.clearClassCountdown).toHaveBeenCalled()
  })

  it('Clear keeps the class here and +1 min adds a minute', async () => {
    const hook = presenterSession({ classCountdown: endedCountdown() })
    await renderPresenter(hook)
    await act(async () =>
      fireEvent.click(await screen.findByRole('button', { name: 'Clear: stay here' }))
    )
    expect(hook.clearClassCountdown).toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '+1 min' })))
    expect(hook.addClassCountdownTime).toHaveBeenCalledWith(60_000)
    expect(hook.setTaskId).not.toHaveBeenCalled()
  })

  it('has no countdown controls while no countdown has ended (it cannot start one)', async () => {
    await renderPresenter(presenterSession())
    expect(screen.queryByTestId('countdown-ended-strip')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /countdown/i })).not.toBeInTheDocument()
  })

  it('Next jumps past optional tasks while Skip optional tasks is on', async () => {
    const hook = presenterSession({ skipOptionalTasks: true })
    await renderPresenter(hook)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Next' })))
    expect(hook.setTaskId).toHaveBeenCalledWith(4)
  })

  it('Next steps onto an optional task while skipping is off', async () => {
    const hook = presenterSession()
    await renderPresenter(hook)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Next' })))
    expect(hook.setTaskId).toHaveBeenCalledWith(3)
  })

  it('says Next skips optional tasks in the Time’s up strip', async () => {
    await renderPresenter(
      presenterSession({ skipOptionalTasks: true, classCountdown: endedCountdown() })
    )
    expect(await screen.findByTestId('countdown-ended-strip')).toHaveTextContent(
      'Task 2 of 3 · Next skips 1 optional'
    )
  })

  it('has no Explainer / Both / Code layout switch and no Presentation tag', async () => {
    await renderPresenter(presenterSession())
    expect(screen.queryByRole('group', { name: 'Presentation layout' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Both' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Explainer' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Go Live/ })).toBeInTheDocument()
  })

  it('keeps the drawing tools behind a Draw button on the bar', async () => {
    await renderPresenter(presenterSession())
    expect(screen.getByRole('button', { name: /Draw/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('toolbar', { name: 'Presentation annotations' })).toBeNull()
  })
})
