import React from 'react'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import NameEntry from '../NameEntry'

function renderEntry(overrides = {}) {
  const props = {
    lessonTitle: 'My Lesson',
    existingNames: [],
    onSubmit: vi.fn(),
    onGoSolo: null,
    waitingForSession: false,
    ...overrides,
  }
  render(<NameEntry {...props} />)
  return props
}

function typeAndSubmit(name) {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: name } })
  fireEvent.click(screen.getByRole('button', { name: /Join/ }))
}

describe('NameEntry', () => {
  it('renders the lesson title', () => {
    renderEntry({ lessonTitle: 'Intro to Python' })
    expect(screen.getByRole('heading', { name: 'Intro to Python' })).toBeInTheDocument()
  })

  it('submits the typed name when it is unique', () => {
    const props = renderEntry()
    typeAndSubmit('Jamie')
    expect(props.onSubmit).toHaveBeenCalledWith('Jamie')
  })

  it('trims whitespace before submitting', () => {
    const props = renderEntry()
    typeAndSubmit('  Alex  ')
    expect(props.onSubmit).toHaveBeenCalledWith('Alex')
  })

  it('does not submit when the input is blank', () => {
    const props = renderEntry()
    fireEvent.click(screen.getByRole('button', { name: /Join/ }))
    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it('shows a confirmation step when the name is already taken', () => {
    renderEntry({ existingNames: ['Jamie'] })
    typeAndSubmit('Jamie')
    expect(screen.getByText(/The name/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Join as Jamie-2/ })).toBeInTheDocument()
  })

  it('submits the suffix name from the confirmation step', () => {
    const props = renderEntry({ existingNames: ['Jamie'] })
    typeAndSubmit('Jamie')
    fireEvent.click(screen.getByRole('button', { name: /Join as Jamie-2/ }))
    expect(props.onSubmit).toHaveBeenCalledWith('Jamie-2')
  })

  it('returns to the name form when "Choose a different name" is clicked', () => {
    renderEntry({ existingNames: ['Jamie'] })
    typeAndSubmit('Jamie')
    fireEvent.click(screen.getByRole('button', { name: /Choose a different name/ }))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('picks the next available suffix when multiple suffixed names are taken', () => {
    const props = renderEntry({ existingNames: ['Jamie', 'Jamie-2'] })
    typeAndSubmit('Jamie')
    fireEvent.click(screen.getByRole('button', { name: /Join as Jamie-3/ }))
    expect(props.onSubmit).toHaveBeenCalledWith('Jamie-3')
  })

  it('shows "Work Solo instead" link when onGoSolo is provided', () => {
    renderEntry({ onGoSolo: vi.fn() })
    expect(screen.getByRole('button', { name: 'Work Solo instead' })).toBeInTheDocument()
  })

  it('calls onGoSolo when the solo link is clicked', () => {
    const props = renderEntry({ onGoSolo: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: 'Work Solo instead' }))
    expect(props.onGoSolo).toHaveBeenCalledOnce()
  })

  it('does not show solo link when onGoSolo is null', () => {
    renderEntry({ onGoSolo: null })
    expect(screen.queryByRole('button', { name: 'Work Solo instead' })).not.toBeInTheDocument()
  })

  it('shows "Join Waiting Room" label when waitingForSession is true', () => {
    renderEntry({ waitingForSession: true })
    expect(screen.getByRole('button', { name: 'Join Waiting Room' })).toBeInTheDocument()
  })

  it('shows the waiting room note when waitingForSession is true', () => {
    renderEntry({ waitingForSession: true })
    expect(screen.getByText(/put you in the waiting room/)).toBeInTheDocument()
  })

  it('shows a join-error banner when joinError is set', () => {
    renderEntry({
      joinError: "Couldn't connect to the class session. Check your connection and try again.",
    })
    expect(screen.getByText(/Couldn't connect to the class session/)).toBeInTheDocument()
  })

  it('does not show a join-error banner by default', () => {
    renderEntry()
    expect(screen.queryByText(/Couldn't connect/)).not.toBeInTheDocument()
  })

  it('lets the student click Join again after a join error (name input is preserved)', () => {
    const props = renderEntry({ joinError: 'Something went wrong.' })
    typeAndSubmit('Jamie')
    expect(props.onSubmit).toHaveBeenCalledWith('Jamie')
  })

  describe('sharing the typed name with the teacher', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    function type(value) {
      fireEvent.change(screen.getByRole('textbox'), { target: { value } })
    }

    it('throttles typedName writes to one per 750ms, trimmed, with the last value landing', () => {
      vi.useFakeTimers()
      const onNameTyping = vi.fn()
      renderEntry({ onNameTyping })

      type('J')
      expect(onNameTyping).toHaveBeenCalledTimes(1)
      expect(onNameTyping).toHaveBeenLastCalledWith('J')

      type('Ja')
      type('Jam')
      type('Jamie  ')
      expect(onNameTyping).toHaveBeenCalledTimes(1)

      act(() => {
        vi.advanceTimersByTime(749)
      })
      expect(onNameTyping).toHaveBeenCalledTimes(1)
      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(onNameTyping).toHaveBeenCalledTimes(2)
      expect(onNameTyping).toHaveBeenLastCalledWith('Jamie')
    })

    it('shares an empty string when the box is cleared, and skips unchanged values', () => {
      vi.useFakeTimers()
      const onNameTyping = vi.fn()
      renderEntry({ onNameTyping })

      type('Al')
      act(() => {
        vi.advanceTimersByTime(800)
      })
      type('Al ') // trims to the same value, so no write
      act(() => {
        vi.advanceTimersByTime(800)
      })
      expect(onNameTyping).toHaveBeenCalledTimes(1)

      type('')
      expect(onNameTyping).toHaveBeenLastCalledWith('')
    })

    it('drops a pending typedName write once the student presses Join', () => {
      vi.useFakeTimers()
      const onNameTyping = vi.fn()
      const props = renderEntry({ onNameTyping })

      type('J')
      type('Jo')
      fireEvent.click(screen.getByRole('button', { name: /Join/ }))
      expect(props.onSubmit).toHaveBeenCalledWith('Jo')
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(onNameTyping).toHaveBeenCalledTimes(1)
      expect(onNameTyping).toHaveBeenLastCalledWith('J')
    })
  })
})
