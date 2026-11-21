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

  it('replays the spin on a second watched pass without remounting, so focus stays', () => {
    const { rerender } = render(nav())
    rerender(nav({ cs: { checkPassed: true } }))
    const first = nextButton()
    first.focus()
    rerender(nav({ cs: { checkPassed: false } }))
    expect(nextButton()).not.toHaveClass('motion-spin-once')
    rerender(nav({ cs: { checkPassed: true } }))
    expect(nextButton()).toBe(first)
    expect(nextButton()).toHaveClass('motion-spin-once')
    expect(document.activeElement).toBe(first)
  })
})

// Calm screens (21 Nov 2026): under about 900px wide the top bar's count is the short "5/11",
// leaving room for the task title and the dots window.
describe('SoloNav count label width', () => {
  const at = (width, fn) => {
    const saved = window.innerWidth
    window.innerWidth = width
    try {
      fn()
    } finally {
      window.innerWidth = saved
    }
  }
  const eleven = Array.from({ length: 11 }, (_, i) => ({ id: `t${i + 1}` }))

  it('reads "5/11" at a 768px viewport', () => {
    at(768, () => render(nav({ compact: true, flatTasks: eleven, currentIndex: 4 })))
    expect(screen.getByText('5/11')).toBeInTheDocument()
  })

  it('still reads "Task 5 of 11" at 1024px wide', () => {
    at(1024, () => render(nav({ compact: true, flatTasks: eleven, currentIndex: 4 })))
    expect(screen.getByText('Task 5 of 11')).toBeInTheDocument()
  })
})
