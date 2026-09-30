import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import SoloNav from '../SoloNav'

const flatTasks = [{ id: 't1' }, { id: 't2' }, { id: 't3' }]

function nav(props = {}) {
  return (
    <SoloNav
      flatTasks={flatTasks}
      currentIndex={0}
      cs={{ checkPassed: false }}
      canNavigateNextSolo
      onNavigate={() => {}}
      {...props}
    />
  )
}

const nextButton = () => screen.getByRole('button', { name: 'Next' })

describe('SoloNav Next button motion', () => {
  it('has no success look or spin before the check passes', () => {
    render(nav())
    expect(nextButton()).not.toHaveClass('btn-next-success')
    expect(nextButton()).not.toHaveClass('motion-spin-once')
  })

  it('spins once when the student watches the task pass, keeping a static success look', () => {
    const { rerender } = render(nav())
    rerender(nav({ cs: { checkPassed: true } }))
    expect(nextButton()).toHaveClass('btn-next-success')
    expect(nextButton()).toHaveClass('motion-spin-once')
  })

  it('does not spin when arriving at a task that is already passed', () => {
    render(nav({ cs: { checkPassed: true } }))
    expect(nextButton()).toHaveClass('btn-next-success')
    expect(nextButton()).not.toHaveClass('motion-spin-once')
  })

  it('does not spin when moving on to another already-passed task', () => {
    const { rerender } = render(nav())
    rerender(nav({ cs: { checkPassed: true } }))
    rerender(nav({ currentIndex: 1, cs: { checkPassed: true } }))
    expect(nextButton()).toHaveClass('btn-next-success')
    expect(nextButton()).not.toHaveClass('motion-spin-once')
  })

  it('remounts the button to replay the spin on a second watched pass', () => {
    const { rerender } = render(nav())
    rerender(nav({ cs: { checkPassed: true } }))
    const first = nextButton()
    rerender(nav({ cs: { checkPassed: false } }))
    rerender(nav({ cs: { checkPassed: true } }))
    expect(nextButton()).not.toBe(first)
    expect(nextButton()).toHaveClass('motion-spin-once')
  })
})
