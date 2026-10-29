import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LiveInkProvider from '../LiveInkProvider'
import { TUTOR_POINTER_IDLE_MS, TUTOR_RIPPLE_MS } from '../tutorPane'

// Behaviour test for the tutor pointer layer: the tutor's mouse in the Presentation window
// shows up on a student's screen at the same fractional spot of the same pane, even though the
// student's pane is a different size. A tiny in-memory "database" stands in for RTDB.

function makeChannel() {
  let value = null
  const listeners = new Set()
  const emit = () => listeners.forEach((fn) => fn(value))
  return {
    subscribe(fn) {
      listeners.add(fn)
      fn(value)
      return () => listeners.delete(fn)
    },
    createWriter() {
      let clicks = 0
      return {
        armDisconnectCleanup() {},
        clearAll() {},
        dispose() {},
        hidePointer() {},
        moveTutorPointer({ pane, rx, ry }) {
          value = { ...value, tutorPointer: { pane, rx, ry, t: Date.now() } }
          emit()
        },
        hideTutorPointer() {
          value = { ...value, tutorPointer: null }
          emit()
        },
        tutorClick({ pane, rx, ry }) {
          clicks += 1
          value = { ...value, tutorClick: { pane, rx, ry, n: clicks, t: Date.now() } }
          emit()
        },
      }
    },
  }
}

function rectOf(left, top, width, height) {
  return () => ({ left, top, width, height, right: left + width, bottom: top + height })
}

function Screen({ channel, role, box }) {
  return (
    <LiveInkProvider
      lessonId="lesson-1"
      role={role}
      subscribe={channel.subscribe}
      createWriter={channel.createWriter}
    >
      <div
        data-tp-pane="page"
        data-testid={`${role}-page`}
        ref={(el) => {
          if (el) el.getBoundingClientRect = rectOf(...box)
        }}
      >
        <span data-testid={`${role}-inner`}>editor</span>
      </div>
    </LiveInkProvider>
  )
}

describe('tutor pointer layer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function renderBoth() {
    const channel = makeChannel()
    // Both use the pane id "page"; in real life they are two browsers. The student's pane
    // comes first in the document so the layer's lookup lands on it. Student page: 500x250 at
    // (100,50); tutor page: 1000x500 at (0,0).
    render(
      <>
        <Screen channel={channel} role="student" box={[100, 50, 500, 250]} />
        <Screen channel={channel} role="teacher" box={[0, 0, 1000, 500]} />
      </>
    )
    return channel
  }

  it('shows the tutor mouse on the student pane at the same fractional spot', () => {
    renderBoth()
    expect(screen.queryByTestId('tutor-pointer-dot')).toBeNull()
    act(() => {
      fireEvent.mouseMove(screen.getByTestId('teacher-inner'), { clientX: 250, clientY: 100 })
    })
    const dot = screen.getByTestId('tutor-pointer-dot')
    // 250/1000 = 0.25 across, 100/500 = 0.2 down → 100 + 0.25*500, 50 + 0.2*250.
    expect(dot.style.left).toBe('225px')
    expect(dot.style.top).toBe('100px')
  })

  it('ripples on the student screen when the tutor clicks, again for a repeat click', () => {
    renderBoth()
    act(() => {
      fireEvent.mouseMove(screen.getByTestId('teacher-inner'), { clientX: 500, clientY: 250 })
    })
    expect(screen.queryByTestId('tutor-click-ripple')).toBeNull()
    act(() => {
      fireEvent.mouseDown(screen.getByTestId('teacher-inner'), { clientX: 500, clientY: 250 })
    })
    // The first click value is the baseline a late joiner sees; the second is a real new click.
    act(() => {
      fireEvent.mouseDown(screen.getByTestId('teacher-inner'), { clientX: 500, clientY: 250 })
    })
    const ripple = screen.getByTestId('tutor-click-ripple')
    expect(ripple.style.left).toBe('350px')
    expect(ripple.style.top).toBe('175px')
    act(() => {
      vi.advanceTimersByTime(TUTOR_RIPPLE_MS + 10)
    })
    expect(screen.queryByTestId('tutor-click-ripple')).toBeNull()
  })

  it('removes the dot when the tutor mouse leaves or goes idle', () => {
    renderBoth()
    act(() => {
      fireEvent.mouseMove(screen.getByTestId('teacher-inner'), { clientX: 10, clientY: 10 })
    })
    expect(screen.getByTestId('tutor-pointer-dot')).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(TUTOR_POINTER_IDLE_MS + 10)
    })
    expect(screen.queryByTestId('tutor-pointer-dot')).toBeNull()
    act(() => {
      fireEvent.mouseMove(screen.getByTestId('teacher-inner'), { clientX: 20, clientY: 20 })
    })
    expect(screen.getByTestId('tutor-pointer-dot')).toBeTruthy()
    act(() => {
      fireEvent.mouseOut(screen.getByTestId('teacher-inner'), { relatedTarget: null })
    })
    expect(screen.queryByTestId('tutor-pointer-dot')).toBeNull()
  })

  it('draws nothing for a pane the student screen does not have', () => {
    const channel = makeChannel()
    render(<Screen channel={channel} role="student" box={[0, 0, 500, 250]} />)
    act(() => {
      channel.createWriter().moveTutorPointer({ pane: 'editor', rx: 0.5, ry: 0.5 })
    })
    expect(screen.queryByTestId('tutor-pointer-dot')).toBeNull()
  })
})
