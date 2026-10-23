import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { countCurrentTaskDone } from '../classProgress'
import ClassProgressStrip from '../../app/components/ClassProgressStrip'

const session = {
  students: {
    a: { displayName: 'Ada', checkPassed: true },
    b: { displayName: 'Ben', checkOverridePassed: true },
    c: { displayName: 'Cy' },
    'teacher-presenter': { checkPassed: true },
  },
}

describe('countCurrentTaskDone', () => {
  it('counts passed and tutor-passed students, not the presenter', () => {
    expect(countCurrentTaskDone(session)).toEqual({ done: 2, total: 3 })
    expect(countCurrentTaskDone(null)).toEqual({ done: 0, total: 0 })
  })
})

describe('ClassProgressStrip', () => {
  it('shows the task title and counts, never names', () => {
    render(<ClassProgressStrip session={session} task={{ id: 1, title: 'Draw a star' }} />)
    expect(screen.getByText('Draw a star')).toBeInTheDocument()
    expect(screen.getByText('2 of 3 done')).toBeInTheDocument()
    expect(screen.queryByText(/Ada|Ben|Cy/)).not.toBeInTheDocument()
  })

  it('hides with no students or on an information task', () => {
    const { container, rerender } = render(
      <ClassProgressStrip session={{ students: {} }} task={{ id: 1, title: 'T' }} />
    )
    expect(container).toBeEmptyDOMElement()
    rerender(<ClassProgressStrip session={session} task={{ id: 1, taskType: 'information' }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
