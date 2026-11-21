import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

// Calm screens (21 Nov 2026): in the top bar both "Task 5 of 11" and "5/11" render; index.css
// shows the short one under 900px wide only while the dots are windowed or scrolling, so a short
// lesson whose dots all fit keeps the words.
describe('SoloNav count label', () => {
  const eleven = Array.from({ length: 11 }, (_, i) => ({ id: `t${i + 1}` }))

  it('renders both forms in the top bar', () => {
    render(nav({ compact: true, flatTasks: eleven, currentIndex: 4 }))
    expect(screen.getByText('Task 5 of 11')).toHaveClass('solo-nav__long')
    expect(screen.getByText('5/11')).toHaveClass('solo-nav__short')
  })

  it('the bottom nav keeps only the words', () => {
    render(nav({ flatTasks: eleven, currentIndex: 4 }))
    expect(screen.queryByText('5/11')).toBeNull()
  })

  it('index.css switches to the short form from the dots measured mode, under 900px', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
    const media = css.slice(css.indexOf('.solo-nav__short {'))
    expect(media).toMatch(/@media \(max-width: 899px\)/)
    expect(media).toMatch(/:has\(\[title='Task progress'\]\[data-mode='window'\]/)
    expect(css).not.toMatch(/data-mode='fits'\][^{]*solo-nav__short/)
  })
})
