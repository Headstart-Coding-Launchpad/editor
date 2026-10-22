// The presentation window's student node never reaches the tutor's list or session reports.
import { describe, expect, it } from 'vitest'
import { TEACHER_PRESENTER_ID, withoutPresenter } from '../presenter.js'

describe('withoutPresenter', () => {
  it('drops the presentation window from students', () => {
    const session = {
      state: 'active',
      students: { s1: { displayName: 'Ava' }, [TEACHER_PRESENTER_ID]: { currentAnswer: 'x' } },
    }
    const out = withoutPresenter(session)
    expect(Object.keys(out.students)).toEqual(['s1'])
    expect(out.state).toBe('active')
    expect(session.students[TEACHER_PRESENTER_ID]).toBeDefined()
  })

  it('leaves a session without it untouched', () => {
    const session = { students: { s1: {} } }
    expect(withoutPresenter(session)).toBe(session)
    expect(withoutPresenter(null)).toBe(null)
  })
})
