import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TopBar from '../TopBar'

vi.mock('../../../shared/useIsMobile', () => ({
  useIsMobile: () => false,
}))

describe('TopBar', () => {
  it('renders the lesson title', () => {
    render(<TopBar lessonTitle="Intro to Python" />)
    expect(screen.getByText('Intro to Python')).toBeInTheDocument()
  })

  it('renders the lesson level when provided', () => {
    render(<TopBar lessonTitle="Lesson" lessonLevel="Level 2" />)
    expect(screen.getByText('Level 2')).toBeInTheDocument()
  })

  it('does not render level element when lessonLevel is absent', () => {
    render(<TopBar lessonTitle="Lesson" />)
    expect(screen.queryByText('Level 2')).not.toBeInTheDocument()
  })

  it('shows the SOLO badge when isSolo is true', () => {
    render(<TopBar lessonTitle="Lesson" isSolo={true} />)
    expect(screen.getByText('SOLO')).toBeInTheDocument()
  })

  it('shows the LIVE badge when isSolo is false', () => {
    render(<TopBar lessonTitle="Lesson" isSolo={false} />)
    expect(screen.getByText('LIVE')).toBeInTheDocument()
  })

  it('shows neither SOLO nor LIVE badge when isSolo is undefined', () => {
    render(<TopBar lessonTitle="Lesson" />)
    expect(screen.queryByText('SOLO')).not.toBeInTheDocument()
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument()
  })

  it('shows the SANDBOX badge when isSandbox is true', () => {
    render(<TopBar lessonTitle="Lesson" isSandbox={true} />)
    expect(screen.getByText('SANDBOX')).toBeInTheDocument()
  })

  it('does not show SOLO or LIVE badge when isSandbox is true', () => {
    render(<TopBar lessonTitle="Lesson" isSandbox={true} isSolo={true} />)
    expect(screen.queryByText('SOLO')).not.toBeInTheDocument()
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument()
  })

  it('renders displayName in live mode', () => {
    render(<TopBar lessonTitle="Lesson" displayName="Jamie" isSolo={false} />)
    expect(screen.getByText('Jamie')).toBeInTheDocument()
  })

  it('does not render displayName in solo mode', () => {
    render(<TopBar lessonTitle="Lesson" displayName="Jamie" isSolo={true} />)
    expect(screen.queryByText('Jamie')).not.toBeInTheDocument()
  })

  it('renders right-slot content', () => {
    render(<TopBar lessonTitle="Lesson" right={<span>Extra</span>} />)
    expect(screen.getByText('Extra')).toBeInTheDocument()
  })

  it('renders the Headstart branding on non-mobile', () => {
    render(<TopBar lessonTitle="Lesson" />)
    expect(screen.getByText('Headstart Coding - LaunchPad')).toBeInTheDocument()
  })

  it('singleRow keeps one fixed-height row and shows the name as a chip', () => {
    render(
      <TopBar
        lessonTitle="Lesson"
        displayName="Jamie"
        isSolo={false}
        right={<button type="button">Help</button>}
        singleRow
      />
    )
    const bar = screen.getByRole('banner')
    expect(bar.style.flexWrap).toBe('nowrap')
    expect(bar.style.height).toBe('52px')
    const chip = screen.getByTestId('top-bar-name')
    expect(chip).toHaveTextContent('Jamie')
    expect(chip).toHaveAttribute('title', 'Jamie')
    expect(chip.parentElement.style.flexWrap).toBe('nowrap')
  })
})
