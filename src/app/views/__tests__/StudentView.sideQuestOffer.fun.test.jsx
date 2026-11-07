import { render, screen, waitFor, act, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StudentView from '../StudentView'
import { SIDE_QUEST_OFFER_TIMING } from '../../hooks/useSideQuestOffer'

// The Fun moment for the bonus quest card (sketch option C, 2026-11-06): a student's check
// passes on a task with side quests; once the pass banner has gone (or at its cap) and they stop
// typing, a calm card slides in: "Nice! You finished. Want a bonus quest?" with "Try it: <title>".
// Tapping it opens the quest. "Not now" closes it for good on that task. A reload of a passed
// task, or a task with no quests, never shows it. Real StudentView → Python StudentWorkspace;
// only Firebase hooks and Pyodide are mocked.

const mocks = vi.hoisted(() => ({ session: null, identity: null, runPython: null }))

vi.mock('../../../modules/python/pyodide', () => ({
  initPyodide: vi.fn(() => Promise.resolve()),
  isPyodideReady: () => true,
  runPython: (...args) => mocks.runPython(...args),
  stopPython: vi.fn(),
  provideInput: vi.fn(),
  updateGpioInputs: vi.fn(),
  getStopCount: () => 0,
  isPythonRunning: () => false,
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

const QUEST_LESSON = {
  id: 'bonus-quest',
  title: 'Bonus',
  type: 'python',
  tasks: [
    {
      id: 1,
      title: 'Say hi',
      starterCode: 'print("hi")',
      check: { type: 'output', operator: 'contains', value: 'hi' },
      sideQuests: [{ title: 'Make it spin', kind: 'challenge', explainer: 'Spin it!' }],
    },
  ],
}

const NO_QUEST_LESSON = {
  ...QUEST_LESSON,
  id: 'no-bonus-quest',
  tasks: [{ ...QUEST_LESSON.tasks[0], sideQuests: undefined }],
}

function renderLesson(lesson, props = {}) {
  mocks.identity = {
    identity: { anonymousId: 'student-1', displayName: 'Sam', lastSessionTimestamp: 456 },
    loaded: true,
    createIdentity: vi.fn(),
    updateTimestamp: vi.fn(),
    updateDisplayName: vi.fn(),
  }
  mocks.session = makeSession(lesson.id)
  const user = userEvent.setup()
  const view = render(<StudentView lessonId={lesson.id} lesson={lesson} {...props} />)
  return { user, view, session: mocks.session }
}

const wait = (ms) => act(() => new Promise((resolve) => setTimeout(resolve, ms)))
const offerCard = () => screen.queryByRole('region', { name: 'Bonus quest' })
const tryIt = () => screen.queryByRole('button', { name: /Try it: .*Make it spin/ })

async function runAndPass(user) {
  // Past the arrival grace, so this pass is one the student watched, not a restore.
  await wait(SIDE_QUEST_OFFER_TIMING.arrivalGraceMs + 50)
  await user.click(await screen.findByRole('button', { name: 'Run' }))
  // The pass strip appears once the check passes.
  await screen.findByRole('region', { name: 'Side-quests' })
}

const saved = { ...SIDE_QUEST_OFFER_TIMING }

describe('bonus quest card (sketch option C)', { timeout: 20000 }, () => {
  beforeEach(() => {
    localStorage.clear()
    Object.assign(SIDE_QUEST_OFFER_TIMING, {
      arrivalGraceMs: 300,
      passBannerCapMs: 600,
      idleMs: 100,
      recheckMs: 50,
    })
    mocks.runPython = vi.fn((code, { onOutput }) => {
      onOutput?.('hi\n')
      return Promise.resolve({ status: 'success' })
    })
  })
  afterEach(() => {
    Object.assign(SIDE_QUEST_OFFER_TIMING, saved)
  })

  it('appears after the pass has had its moment; Try it opens the quest', async () => {
    const { user, session } = renderLesson(QUEST_LESSON)
    await runAndPass(user)
    // Not straight away: the green pass shows first. Python has the calm code screen, where the
    // pass sits docked beside the task (never covering anything, never timing out), so the card
    // waits only for the student to stop typing (idleMs), not for that note to go. (A floating
    // pass popup still holds it back: useSideQuestOffer.test.js, passBannerUp.)
    expect(offerCard()).toBeNull()
    expect(screen.getByText('Correct!')).toBeInTheDocument()
    expect(screen.getByTestId('task-hint')).toHaveAttribute('data-tone', 'pass')

    await waitFor(() => expect(offerCard()).not.toBeNull())
    // The pass stays in view (and its links usable) beside the card.
    expect(within(screen.getByTestId('task-hint')).getByText('Correct!')).toBeInTheDocument()
    expect(offerCard()).toHaveTextContent('Nice! You finished. Want a bonus quest?')
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument()
    // Kid words only.
    expect(offerCard().textContent).not.toMatch(/side-quest|unchecked|debug|predict/i)

    await user.click(tryIt())
    await screen.findByText('Spin it!')
    expect(offerCard()).toBeNull()
    // Live: opening logs openedAt for the tutor, exactly as the strip button does.
    expect(session.recordSideQuestOpened).toHaveBeenCalledWith('student-1', 1, 0)
  })

  it('Not now hides it, and it does not come back on that task', async () => {
    const { user } = renderLesson(QUEST_LESSON)
    await runAndPass(user)
    await waitFor(() => expect(offerCard()).not.toBeNull())

    await user.click(screen.getByRole('button', { name: 'Not now' }))
    expect(offerCard()).toBeNull()
    // The quiet strip stays so the quest can still be found.
    expect(screen.getByRole('region', { name: 'Side-quests' })).toBeInTheDocument()

    // Run (and pass) again: still no card.
    await user.click(await screen.findByRole('button', { name: 'Run' }))
    await wait(SIDE_QUEST_OFFER_TIMING.passBannerCapMs + SIDE_QUEST_OFFER_TIMING.idleMs + 300)
    expect(offerCard()).toBeNull()
  })

  it('does not come back after a reload of a task where it was offered', async () => {
    const { user, view } = renderLesson(QUEST_LESSON)
    await runAndPass(user)
    await waitFor(() => expect(offerCard()).not.toBeNull())
    view.unmount()
    cleanup()

    // Reload: the student runs and passes again, but the card was already offered on this task.
    const again = renderLesson(QUEST_LESSON)
    await runAndPass(again.user)
    await wait(SIDE_QUEST_OFFER_TIMING.passBannerCapMs + SIDE_QUEST_OFFER_TIMING.idleMs + 400)
    expect(offerCard()).toBeNull()
  })

  it('solo students get it too, with no tutor writes', async () => {
    const { user, session } = renderLesson(QUEST_LESSON, { forceSolo: true })
    await runAndPass(user)
    await waitFor(() => expect(offerCard()).not.toBeNull())
    await user.click(tryIt())
    await screen.findByText('Spin it!')
    expect(session.recordSideQuestOpened).not.toHaveBeenCalled()
    expect(session.writeSideQuestOpen).not.toHaveBeenCalled()
  })

  it('does not appear on a task with no quests', async () => {
    const { user } = renderLesson(NO_QUEST_LESSON)
    await wait(SIDE_QUEST_OFFER_TIMING.arrivalGraceMs + 50)
    await user.click(await screen.findByRole('button', { name: 'Run' }))
    await waitFor(() => expect(mocks.runPython).toHaveBeenCalled())
    await wait(SIDE_QUEST_OFFER_TIMING.passBannerCapMs + SIDE_QUEST_OFFER_TIMING.idleMs + 300)
    expect(offerCard()).toBeNull()
    expect(screen.queryByText(/bonus quest/i)).toBeNull()
  })
})
