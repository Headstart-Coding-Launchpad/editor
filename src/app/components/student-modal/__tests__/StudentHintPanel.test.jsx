import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import StudentHintPanel from '../StudentHintPanel'

const session = { state: 'active', currentTaskId: 1 }
const hint = { text: 'Use **quotes**', source: 'check', failStreak: 3, taskId: '1', at: 1 }
const offer = { kind: 'support', stageIndex: 1, label: 'Loop', taskId: '1', at: 1 }

function renderPanel(student, props = {}) {
  return render(
    <StudentHintPanel
      student={{ anonymousId: 's1', displayName: 'Amy', ...student }}
      session={session}
      {...props}
    />
  )
}

describe('StudentHintPanel', () => {
  it('shows the hint the student sees, their fail streak and an unopened offer', () => {
    renderPanel({ studentHint: hint, hintOffer: offer })
    const panel = screen.getByTestId('student-hint-panel')
    expect(panel).toHaveTextContent('Amy sees')
    expect(panel).toHaveTextContent('Use quotes')
    expect(panel).toHaveTextContent('Failed 3 times in a row')
    expect(panel).toHaveTextContent('Offered “Loop” as a hint — not opened yet')
  })

  it('marks the teacher override hint as theirs', () => {
    renderPanel({
      studentHint: { ...hint, source: 'override', failStreak: 1 },
      checkOverridePushedAt: 5,
      checkOverridePassed: false,
    })
    const panel = screen.getByTestId('student-hint-panel')
    expect(panel).toHaveTextContent('Your hint to Amy')
    expect(panel).toHaveTextContent('your hint')
    expect(panel).not.toHaveTextContent('in a row')
  })

  it('renders nothing with no hint, after a pass, on another task or in a sandbox', () => {
    const { container, rerender } = renderPanel({})
    expect(container).toBeEmptyDOMElement()
    rerender(
      <StudentHintPanel student={{ studentHint: hint, checkPassed: true }} session={session} />
    )
    expect(container).toBeEmptyDOMElement()
    rerender(
      <StudentHintPanel student={{ studentHint: { ...hint, taskId: '2' } }} session={session} />
    )
    expect(container).toBeEmptyDOMElement()
    rerender(
      <StudentHintPanel student={{ studentHint: hint }} session={session} isSessionSandbox />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
