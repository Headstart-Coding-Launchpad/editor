import { beforeEach, describe, expect, it } from 'vitest'
import {
  isReloadResume,
  markReloadResume,
  RELOAD_RESUME_KEY,
  RESUME_MAX_AGE_MS,
} from '../pythonReload'
import { selectPythonTaskCode } from '../studentTaskContent'
import {
  studentHealthBanner,
  studentHealthChip,
  studentHealthProblem,
} from '../../shared/studentHealth'

describe('the "Python fell asleep" reload note (R3)', () => {
  beforeEach(() => localStorage.clear())

  it('matches only the same lesson and task, for a short while', () => {
    markReloadResume('loops', 3, 1000)
    expect(isReloadResume('loops', 4, 1000 + 5000)).toBe(false)
    expect(isReloadResume('other', 3, 1000 + 5000)).toBe(false)
    expect(isReloadResume('loops', '3', 1000 + 5000)).toBe(true)
  })

  // Second review (10 Nov): a late second load of the same task (a slow lesson fetch, a
  // StrictMode double load, a re-render reload) must still bring the own code back.
  it('holds for every load of the same task until it expires', () => {
    markReloadResume('loops', 3, 1000)
    expect(isReloadResume('loops', 3, 2000)).toBe(true)
    expect(isReloadResume('loops', 3, 2000 + 5000)).toBe(true)
    expect(isReloadResume('loops', 3, 1000 + RESUME_MAX_AGE_MS - 1)).toBe(true)
    expect(isReloadResume('loops', 3, 1000 + RESUME_MAX_AGE_MS + 1)).toBe(false)
    expect(localStorage.getItem(RELOAD_RESUME_KEY)).toBeNull()
  })

  it('is used up once the student moves to another task after it was used', () => {
    markReloadResume('loops', 3, 1000)
    // A load of another task before this one (the page's first task, then the class's) leaves it.
    expect(isReloadResume('loops', 1, 1500)).toBe(false)
    expect(isReloadResume('loops', 3, 2000)).toBe(true)
    // Moving on, then back, starts as a live lesson normally does.
    expect(isReloadResume('loops', 4, 3000)).toBe(false)
    expect(localStorage.getItem(RELOAD_RESUME_KEY)).toBeNull()
    expect(isReloadResume('loops', 3, 4000)).toBe(false)
  })

  it('is ignored and removed once it is stale', () => {
    markReloadResume('loops', 3, 1000)
    expect(isReloadResume('loops', 3, 1000 + RESUME_MAX_AGE_MS + 1)).toBe(false)
    expect(localStorage.getItem(RELOAD_RESUME_KEY)).toBeNull()
  })

  it('lets a live lesson restore the own save, which it otherwise skips', () => {
    const task = { id: 3, starterCode: 'starter' }
    const args = {
      tasks: [task],
      task,
      taskId: 3,
      phase: 'lesson',
      readSavedCode: () => ({ code: 'mine' }),
    }
    expect(selectPythonTaskCode(args)).toBe('starter')
    expect(selectPythonTaskCode({ ...args, restoreOwn: true })).toBe('mine')
  })
})

describe('student health for the tutor (R3)', () => {
  it('shows a problem only for an online student', () => {
    expect(studentHealthProblem({ online: true, health: 'python_stuck' })).toBe('python_stuck')
    expect(studentHealthProblem({ online: true, health: 'screen_error' })).toBe('screen_error')
    expect(studentHealthProblem({ online: true, health: 'ok' })).toBeNull()
    expect(studentHealthProblem({ online: false, health: 'python_stuck' })).toBeNull()
    expect(studentHealthProblem({ online: true, health: 'nonsense' })).toBeNull()
  })

  it('names the chips and the banner', () => {
    expect(studentHealthChip('python_stuck')).toMatchObject({ icon: '🐍', label: 'Python stuck' })
    expect(studentHealthChip('screen_error')).toMatchObject({ icon: '🛠️', label: 'Screen error' })
    expect(studentHealthChip(null)).toBeNull()
    expect(studentHealthBanner('python_stuck', 'Mia')).toContain(
      "Mia's Python stuck: ask them to tap Reload"
    )
    expect(studentHealthChip('python_stuck').title).toBe('Python stuck: ask them to tap Reload')
    expect(studentHealthBanner('python_stuck', 'Mia')).not.toMatch(/safe/)
    expect(studentHealthBanner(null, 'Mia')).toBeNull()
  })
})
