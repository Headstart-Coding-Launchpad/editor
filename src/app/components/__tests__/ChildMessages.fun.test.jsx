import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../modules/registry', () => ({
  getLessonModule: vi.fn(),
}))

vi.mock('../../../shared/useElementSize', () => ({
  useElementSize: vi.fn(),
}))

import { getLessonModule } from '../../../modules/registry'
import { useElementSize } from '../../../shared/useElementSize'
import LessonTaskContent from '../LessonTaskContent'
import OfflineBanner from '../OfflineBanner'

// Fun moments (deep review 2026-11-10, R2 and R7; sketches OK'd by Ryan 10 Nov):
// R2: the code pane hits a render error. Only that pane turns into a calm "Something went
// wrong." card with one Try again button; the task card stays. Try again mounts the pane again
// and the child's code is still there.
// R7: the class connection drops. A slim banner says the work is saved on this device; when
// the connection comes back it says Back online, then goes away by itself.

const mocks = vi.hoisted(() => ({ crashesLeft: 0 }))

function CrashyWorkspace({ cs }) {
  if (mocks.crashesLeft > 0) {
    mocks.crashesLeft -= 1
    throw new Error('workspace blew up')
  }
  return <pre data-testid="child-code">{cs.code}</pre>
}

const PYTHON_MODULE = {
  type: 'python',
  StudentWorkspace: CrashyWorkspace,
  getLayoutStyles: () => ({}),
}

describe('R2 crash fallback (Fun moment)', () => {
  beforeEach(() => {
    useElementSize.mockReturnValue([{ current: null }, { width: 0, height: 0 }])
    getLessonModule.mockReturnValue(PYTHON_MODULE)
    localStorage.clear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('keeps the task card, shows one Try again in the broken pane, and Try again brings the code back', async () => {
    // React renders twice after a throw before giving up, so the pane crashes on both tries.
    mocks.crashesLeft = 2
    const user = userEvent.setup()
    render(
      <LessonTaskContent
        lesson={{ type: 'python' }}
        task={{ id: 3, title: 'Repeat with a loop', explainer: 'Make the robot say hello 3 times.' }}
        cs={{ inPersonalSandbox: false, code: 'for i in range(3):\n    print("Hello!")' }}
        currentTaskId={3}
        isSandbox={false}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isMobile={false}
        isQuizTask={false}
        isAutoEvaluatedQuiz={false}
        isInformationTask={false}
        isTeacherEditing={false}
      />
    )

    const fallback = screen.getByTestId('render-error-fallback')
    expect(fallback).toHaveTextContent('Something went wrong.')
    expect(fallback).toHaveTextContent('Tap to try again. Your code is safe 💾')
    // The task card stays on screen beside it.
    expect(screen.getByTestId('task-instructions')).toHaveTextContent(
      'Make the robot say hello 3 times.'
    )
    expect(screen.getByTestId('task-workspace')).toContainElement(fallback)
    expect(screen.queryByTestId('child-code')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Try again 🔄' }))

    expect(screen.queryByTestId('render-error-fallback')).toBeNull()
    expect(screen.getByTestId('child-code')).toHaveTextContent('print("Hello!")')
  })
})

describe('R7 offline banner (Fun moment)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows only when the connection is lost, says Back online, then clears itself', () => {
    const { rerender } = render(<OfflineBanner connected={null} />)
    expect(screen.queryByTestId('offline-banner')).toBeNull()

    rerender(<OfflineBanner connected />)
    expect(screen.queryByTestId('offline-banner')).toBeNull()

    rerender(<OfflineBanner connected={false} />)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByTestId('offline-banner')).toHaveTextContent(
      "📡 You're offline. Keep coding: your work is saved on this device and sends itself when you're back."
    )
    // Nothing to tap.
    expect(screen.queryByRole('button')).toBeNull()

    rerender(<OfflineBanner connected />)
    expect(screen.getByTestId('offline-banner')).toHaveTextContent('Back online ✅')
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(screen.queryByTestId('offline-banner')).toBeNull()
  })

  it('never shows for a blip shorter than the grace time', () => {
    const { rerender } = render(<OfflineBanner connected />)
    rerender(<OfflineBanner connected={false} />)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    rerender(<OfflineBanner connected />)
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.queryByTestId('offline-banner')).toBeNull()
  })

  it('waits longer on a first connection, but still tells a child who never got online', () => {
    // .info/connected reports false before the first connect; a slow first connect is not
    // "offline", a page that never connects is.
    render(<OfflineBanner connected={false} />)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.queryByTestId('offline-banner')).toBeNull()
    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(screen.getByTestId('offline-banner')).toHaveTextContent("You're offline.")
  })
})
