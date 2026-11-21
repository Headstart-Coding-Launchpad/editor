import React from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import TaskProgressDots from '../TaskProgressDots'

let touchDevice = false
vi.mock('../../../shared/useIsTouchDevice', () => ({
  useIsTouchDevice: () => touchDevice,
}))

// The component measures its dots row synchronously via getBoundingClientRect
// (not ResizeObserver — see the comment in TaskProgressDots.jsx for why an async
// measurement is unsafe here). jsdom always reports 0 for layout geometry, so we
// stub it to report a controlled width for the duration of each test.
function stubRowWidth(width) {
  const original = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = function () {
    return { width, height: 32, top: 0, left: 0, right: width, bottom: 32, x: 0, y: 0, toJSON() {} }
  }
  return () => {
    HTMLElement.prototype.getBoundingClientRect = original
  }
}

// Renders with a wrapper width comfortably wide enough to fit every dot, so
// the dot buttons (not the "x/y" counter) are what's asserted against below.
function renderWide(ui) {
  const restore = stubRowWidth(2000)
  const utils = render(ui)
  return { ...utils, restore }
}

let activeRestore
afterEach(() => {
  activeRestore?.()
  activeRestore = undefined
  touchDevice = false
})

// A fuller layout stub for the scrolling row: the row is `width` wide (or its snapped
// maxWidth), each dot sits at padding + index * step inside it, and scrollLeft is a real,
// settable number. jsdom reports 0 for all of these on its own.
function stubScrollLayout(width, { step = 30, pad = 3, count = 12 } = {}) {
  const proto = HTMLElement.prototype
  const saved = {
    rect: proto.getBoundingClientRect,
    clientWidth: Object.getOwnPropertyDescriptor(proto, 'clientWidth'),
    scrollWidth: Object.getOwnPropertyDescriptor(proto, 'scrollWidth'),
    scrollLeft: Object.getOwnPropertyDescriptor(Element.prototype, 'scrollLeft'),
  }
  const scroll = new WeakMap()
  const isRow = (el) => el.getAttribute?.('title') === 'Task progress'
  const rowWidth = (el) => parseFloat(el.style.maxWidth) || width
  proto.getBoundingClientRect = function () {
    let left = 0
    let w = width
    if (this.tagName === 'BUTTON' && this.parentElement && isRow(this.parentElement)) {
      const index = Array.from(this.parentElement.children).indexOf(this)
      left = pad + index * step - (scroll.get(this.parentElement) ?? 0)
      w = step
    } else if (isRow(this)) {
      w = rowWidth(this)
    }
    return {
      width: w,
      height: 32,
      top: 0,
      left,
      right: left + w,
      bottom: 32,
      x: left,
      y: 0,
      toJSON() {},
    }
  }
  Object.defineProperty(proto, 'clientWidth', {
    configurable: true,
    get() {
      return isRow(this) ? rowWidth(this) : 0
    },
  })
  Object.defineProperty(proto, 'scrollWidth', {
    configurable: true,
    get() {
      return isRow(this) ? count * step - (step - 26) + pad * 2 : 0
    },
  })
  Object.defineProperty(Element.prototype, 'scrollLeft', {
    configurable: true,
    get() {
      return scroll.get(this) ?? 0
    },
    set(value) {
      scroll.set(this, value)
    },
  })
  return () => {
    proto.getBoundingClientRect = saved.rect
    for (const [key, target] of [
      ['clientWidth', proto],
      ['scrollWidth', proto],
      ['scrollLeft', Element.prototype],
    ]) {
      if (saved[key]) Object.defineProperty(target, key, saved[key])
      else delete target[key]
    }
  }
}

// Three simple standalone tasks used across most tests
const THREE_TASKS = [
  { id: 1, title: 'Task One', type: 'task' },
  { id: 2, title: 'Task Two', type: 'task' },
  { id: 3, title: 'Task Three', type: 'task' },
]

describe('TaskProgressDots', () => {
  describe('dot count', () => {
    it('renders the correct number of dots for standalone tasks', () => {
      activeRestore = renderWide(
        <TaskProgressDots tasks={THREE_TASKS} currentTaskId={1} onDotClick={vi.fn()} />
      ).restore
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(3)
    })

    it('renders one dot per group (not per subtask)', () => {
      const tasks = [
        {
          id: 'g1',
          type: 'group',
          title: 'Group A',
          subtasks: [
            { id: 1, title: 'Group A - 1', type: 'task' },
            { id: 2, title: 'Group A - 2', type: 'task' },
          ],
        },
        { id: 3, title: 'Solo Task', type: 'task' },
      ]
      activeRestore = renderWide(
        <TaskProgressDots tasks={tasks} currentTaskId={1} onDotClick={vi.fn()} />
      ).restore
      expect(screen.getAllByRole('button')).toHaveLength(2)
    })

    it('renders nothing (no buttons) when tasks is empty', () => {
      activeRestore = renderWide(
        <TaskProgressDots tasks={[]} currentTaskId={null} onDotClick={vi.fn()} />
      ).restore
      expect(screen.queryAllByRole('button')).toHaveLength(0)
    })
  })

  describe('current task highlight', () => {
    it('shows the task number on the current dot (not a checkmark)', () => {
      activeRestore = renderWide(
        <TaskProgressDots tasks={THREE_TASKS} currentTaskId={2} onDotClick={vi.fn()} />
      ).restore
      // The current task shows its 1-based index (2), not a checkmark
      const buttons = screen.getAllByRole('button')
      // Button at index 1 (0-based) is task 2
      expect(buttons[1]).toHaveTextContent('2')
    })

    it('shows a checkmark on past task dots', () => {
      activeRestore = renderWide(
        <TaskProgressDots tasks={THREE_TASKS} currentTaskId={3} onDotClick={vi.fn()} />
      ).restore
      const buttons = screen.getAllByRole('button')
      // Tasks 1 and 2 are past — both should show ✓
      expect(buttons[0]).toHaveTextContent('✓')
      expect(buttons[1]).toHaveTextContent('✓')
    })

    it('shows the index number on future task dots', () => {
      activeRestore = renderWide(
        <TaskProgressDots tasks={THREE_TASKS} currentTaskId={1} onDotClick={vi.fn()} />
      ).restore
      const buttons = screen.getAllByRole('button')
      // Task 3 is in the future — shows index 3
      expect(buttons[2]).toHaveTextContent('3')
    })
  })

  describe('past task dots are clickable', () => {
    it('calls onDotClick with the task id when a past dot is clicked', async () => {
      const user = userEvent.setup()
      const onDotClick = vi.fn()
      activeRestore = renderWide(
        <TaskProgressDots tasks={THREE_TASKS} currentTaskId={3} onDotClick={onDotClick} />
      ).restore
      const buttons = screen.getAllByRole('button')
      // First button is task id 1 (past)
      await user.click(buttons[0])
      expect(onDotClick).toHaveBeenCalledWith(1)
    })

    it('calls onDotClick with the correct id when each past dot is clicked', async () => {
      const user = userEvent.setup()
      const onDotClick = vi.fn()
      activeRestore = renderWide(
        <TaskProgressDots tasks={THREE_TASKS} currentTaskId={3} onDotClick={onDotClick} />
      ).restore
      const buttons = screen.getAllByRole('button')
      await user.click(buttons[1])
      expect(onDotClick).toHaveBeenCalledWith(2)
    })
  })

  describe('future/locked task dots are not clickable', () => {
    it('future dots are disabled when isSolo is false', () => {
      activeRestore = renderWide(
        <TaskProgressDots
          tasks={THREE_TASKS}
          currentTaskId={1}
          isSolo={false}
          onDotClick={vi.fn()}
        />
      ).restore
      const buttons = screen.getAllByRole('button')
      // Task 3 is future and should be disabled
      expect(buttons[2]).toBeDisabled()
    })

    it('does not call onDotClick when a disabled future dot is clicked', async () => {
      const user = userEvent.setup()
      const onDotClick = vi.fn()
      activeRestore = renderWide(
        <TaskProgressDots
          tasks={THREE_TASKS}
          currentTaskId={1}
          isSolo={false}
          onDotClick={onDotClick}
        />
      ).restore
      const buttons = screen.getAllByRole('button')
      // Click the last (future/disabled) button
      await user.click(buttons[2])
      expect(onDotClick).not.toHaveBeenCalled()
    })

    it('future dots are enabled in solo mode by default', () => {
      activeRestore = renderWide(
        <TaskProgressDots
          tasks={THREE_TASKS}
          currentTaskId={1}
          isSolo={true}
          onDotClick={vi.fn()}
        />
      ).restore
      const buttons = screen.getAllByRole('button')
      // In solo mode, future dots are clickable (not disabled)
      expect(buttons[2]).not.toBeDisabled()
    })

    it('uses canSelectTask to determine whether a solo future dot is clickable', async () => {
      const user = userEvent.setup()
      const onDotClick = vi.fn()
      // canSelectTask returns false for task 3
      const canSelectTask = (taskId) => taskId !== 3
      activeRestore = renderWide(
        <TaskProgressDots
          tasks={THREE_TASKS}
          currentTaskId={1}
          isSolo={true}
          canSelectTask={canSelectTask}
          onDotClick={onDotClick}
        />
      ).restore
      const buttons = screen.getAllByRole('button')
      expect(buttons[2]).toBeDisabled()
      await user.click(buttons[2])
      expect(onDotClick).not.toHaveBeenCalled()
    })
  })

  describe('title / aria-label', () => {
    it('sets aria-label on each dot to the task title', () => {
      activeRestore = renderWide(
        <TaskProgressDots tasks={THREE_TASKS} currentTaskId={1} onDotClick={vi.fn()} />
      ).restore
      expect(screen.getByRole('button', { name: 'Task One' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Task Two' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Task Three' })).toBeInTheDocument()
    })
  })

  describe('compact counter view', () => {
    it('renders a text counter instead of dots when the measured width is narrower than the dots need', () => {
      // 3 dots need 3*38-6 = 108px; 60px is not enough room
      activeRestore = stubRowWidth(60)
      render(<TaskProgressDots tasks={THREE_TASKS} currentTaskId={2} onDotClick={vi.fn()} />)
      expect(screen.queryAllByRole('button')).toHaveLength(0)
      expect(screen.getByTitle('Task progress')).toBeInTheDocument()
    })

    it('collapsing to the counter drops the dots from layout (does not just hide them)', () => {
      // Regression test: an earlier implementation kept the dots mounted with
      // visibility:hidden, which still claims their full flex-basis and never
      // lets a sibling (the lesson title) reclaim that space.
      activeRestore = stubRowWidth(60)
      render(<TaskProgressDots tasks={THREE_TASKS} currentTaskId={2} onDotClick={vi.fn()} />)
      expect(document.querySelectorAll('button')).toHaveLength(0)
    })

    it('switches back to dots after a window resize if there is now enough room', () => {
      const restoreNarrow = stubRowWidth(60)
      render(<TaskProgressDots tasks={THREE_TASKS} currentTaskId={2} onDotClick={vi.fn()} />)
      expect(screen.queryAllByRole('button')).toHaveLength(0)

      restoreNarrow()
      activeRestore = stubRowWidth(2000)
      act(() => window.dispatchEvent(new Event('resize')))

      expect(screen.getAllByRole('button')).toHaveLength(3)
    })

    it('re-collapses to the counter after a window resize if there is no longer enough room', () => {
      const restoreWide = stubRowWidth(2000)
      render(<TaskProgressDots tasks={THREE_TASKS} currentTaskId={2} onDotClick={vi.fn()} />)
      expect(screen.getAllByRole('button')).toHaveLength(3)

      restoreWide()
      activeRestore = stubRowWidth(60)
      act(() => window.dispatchEvent(new Event('resize')))

      expect(screen.queryAllByRole('button')).toHaveLength(0)
      expect(screen.getByTitle('Task progress')).toBeInTheDocument()
    })
  })

  describe('compact (the student top bar)', () => {
    const TWELVE = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      title: `Task ${i + 1}`,
      type: 'task',
    }))

    it('shows every dot when they fit', () => {
      activeRestore = stubRowWidth(2000)
      render(<TaskProgressDots compact tasks={TWELVE} currentTaskId={11} onDotClick={vi.fn()} />)
      expect(screen.getAllByRole('button')).toHaveLength(12)
      expect(screen.getByTitle('Task progress')).toHaveAttribute('data-mode', 'fits')
    })

    it('scrolls sideways instead of wrapping when only some dots fit', () => {
      // 12 compact dots need 12*30-4+6 = 362px; 200px holds more than 5 dots' worth.
      activeRestore = stubRowWidth(200)
      render(<TaskProgressDots compact tasks={TWELVE} currentTaskId={11} onDotClick={vi.fn()} />)
      const row = screen.getByTitle('Task progress')
      expect(row).toHaveAttribute('data-mode', 'scroll')
      expect(row.style.overflowX).toBe('auto')
      expect(screen.getAllByRole('button')).toHaveLength(12)
    })

    it('falls back to the counter when there is no useful room', () => {
      activeRestore = stubRowWidth(60)
      render(<TaskProgressDots compact tasks={TWELVE} currentTaskId={11} onDotClick={vi.fn()} />)
      expect(screen.queryAllByRole('button')).toHaveLength(0)
      expect(screen.getByTitle('Task progress')).toHaveTextContent('11/12')
    })

    // 12 compact dots, step 30 (26px dot + 4px gap). A 200px row holds 6 whole dots, so it is
    // narrowed to 6*30-4+6 = 182px and can scroll 362-182 = 180px.
    it('narrows the scrolling row to whole dots so none is cut in half', () => {
      activeRestore = stubScrollLayout(200)
      render(<TaskProgressDots compact tasks={TWELVE} currentTaskId={1} onDotClick={vi.fn()} />)
      expect(screen.getByTitle('Task progress').style.maxWidth).toBe('182px')
    })

    it('starts at the beginning on task 1 (not scrolled to the end) and fades the right edge', () => {
      activeRestore = stubScrollLayout(200)
      render(<TaskProgressDots compact tasks={TWELVE} currentTaskId={1} onDotClick={vi.fn()} />)
      const row = screen.getByTitle('Task progress')
      expect(row.scrollLeft).toBe(0)
      expect(row).toHaveAttribute('data-fade-right', 'true')
      expect(row).not.toHaveAttribute('data-fade-left')
    })

    it('scrolls a late current task into view, by whole dots, and fades the left edge', () => {
      activeRestore = stubScrollLayout(200)
      render(<TaskProgressDots compact tasks={TWELVE} currentTaskId={11} onDotClick={vi.fn()} />)
      const row = screen.getByTitle('Task progress')
      expect(row.scrollLeft).toBe(180)
      expect(row).toHaveAttribute('data-fade-left', 'true')
      expect(row).not.toHaveAttribute('data-fade-right')
    })

    it('follows the current task when it changes', () => {
      activeRestore = stubScrollLayout(200)
      const { rerender } = render(
        <TaskProgressDots compact tasks={TWELVE} currentTaskId={1} onDotClick={vi.fn()} />
      )
      const row = screen.getByTitle('Task progress')
      expect(row.scrollLeft).toBe(0)
      rerender(<TaskProgressDots compact tasks={TWELVE} currentTaskId={6} onDotClick={vi.fn()} />)
      // Dot 6 sits at 150px; centring it in 182px and rounding to whole dots gives 60px.
      expect(row.scrollLeft).toBe(60)
      expect(row.scrollLeft % 30).toBe(0)
    })

    it('keeps the dot being viewed in view in solo mode', () => {
      activeRestore = stubScrollLayout(200)
      render(
        <TaskProgressDots
          compact
          isSolo
          tasks={TWELVE}
          currentTaskId={11}
          viewingTaskId={1}
          onDotClick={vi.fn()}
        />
      )
      expect(screen.getByTitle('Task progress').scrollLeft).toBe(0)
    })

    // Calm screens (21 Nov 2026): under about 900px wide the top bar shows a window of 5 whole
    // dots centred on the current one, with a tappable "+N" chip on each side that hides dots.
    describe('at a 768px viewport (tablet portrait)', () => {
      const ELEVEN = TWELVE.slice(0, 11)
      let savedWidth
      const at768 = () => {
        savedWidth = window.innerWidth
        window.innerWidth = 768
        touchDevice = true
        activeRestore = stubRowWidth(400)
      }
      afterEach(() => {
        if (savedWidth) window.innerWidth = savedWidth
      })
      const dotLabels = () =>
        screen
          .getAllByRole('button')
          .filter((b) => !b.classList.contains('task-dots-chip'))
          .map((b) => b.getAttribute('aria-label'))

      it('shows 5 whole dots centred on the current one, with +N chips for the rest', () => {
        at768()
        render(
          <TaskProgressDots
            compact
            windowed
            tasks={ELEVEN}
            currentTaskId={5}
            onDotClick={vi.fn()}
          />
        )
        const row = screen.getByTitle('Task progress')
        expect(row).toHaveAttribute('data-mode', 'window')
        expect(row.style.overflowX).not.toBe('auto')
        expect(row.style.maskImage ?? '').toBe('')
        expect(dotLabels()).toEqual(['Task 3', 'Task 4', 'Task 5', 'Task 6', 'Task 7'])
        expect(screen.getByRole('button', { name: /2 earlier tasks/ })).toHaveTextContent('+2')
        expect(screen.getByRole('button', { name: /4 later tasks/ })).toHaveTextContent('+4')
      })

      it('only puts a chip on a side that has hidden dots', () => {
        at768()
        render(
          <TaskProgressDots
            compact
            windowed
            tasks={ELEVEN}
            currentTaskId={1}
            onDotClick={vi.fn()}
          />
        )
        expect(dotLabels()).toEqual(['Task 1', 'Task 2', 'Task 3', 'Task 4', 'Task 5'])
        expect(screen.queryByRole('button', { name: /earlier tasks/ })).toBeNull()
        expect(screen.getByRole('button', { name: /6 later tasks/ })).toBeInTheDocument()
      })

      it('a chip pages the window without changing the task', async () => {
        at768()
        const onDotClick = vi.fn()
        render(
          <TaskProgressDots
            compact
            windowed
            tasks={ELEVEN}
            currentTaskId={5}
            onDotClick={onDotClick}
          />
        )
        await userEvent.click(screen.getByRole('button', { name: /4 later tasks/ }))
        expect(dotLabels()).toEqual(['Task 7', 'Task 8', 'Task 9', 'Task 10', 'Task 11'])
        expect(screen.getByRole('button', { name: /6 earlier tasks/ })).toBeInTheDocument()
        expect(onDotClick).not.toHaveBeenCalled()
        await userEvent.click(screen.getByRole('button', { name: /6 earlier tasks/ }))
        expect(dotLabels()).toEqual(['Task 2', 'Task 3', 'Task 4', 'Task 5', 'Task 6'])
      })

      it('shows every dot when they all fit, and nothing changes at 1024 wide', () => {
        at768()
        activeRestore()
        activeRestore = stubRowWidth(2000)
        render(
          <TaskProgressDots
            compact
            windowed
            tasks={ELEVEN}
            currentTaskId={5}
            onDotClick={vi.fn()}
          />
        )
        expect(screen.getByTitle('Task progress')).toHaveAttribute('data-mode', 'fits')
      })

      // Touch dots: step 40 (34 + 6), chips 2 x (44 + 6), padding 6: room for N dots is
      // floor((width - 100) / 40), from 3 to 5.
      it('fits a 4-dot window in a realistic 260px row and a 3-dot one in 220px', () => {
        at768()
        activeRestore()
        activeRestore = stubRowWidth(260)
        const { unmount } = render(
          <TaskProgressDots
            compact
            windowed
            tasks={ELEVEN}
            currentTaskId={5}
            onDotClick={vi.fn()}
          />
        )
        expect(screen.getByTitle('Task progress')).toHaveAttribute('data-mode', 'window')
        expect(dotLabels()).toEqual(['Task 3', 'Task 4', 'Task 5', 'Task 6'])
        unmount()
        activeRestore()
        activeRestore = stubRowWidth(300)
        render(
          <TaskProgressDots
            compact
            windowed
            tasks={ELEVEN}
            currentTaskId={5}
            onDotClick={vi.fn()}
          />
        )
        expect(dotLabels()).toHaveLength(5)
      })

      it('the presentation window and tutors keep the old row (no windowed prop)', () => {
        at768()
        activeRestore()
        activeRestore = stubRowWidth(260)
        render(<TaskProgressDots compact tasks={ELEVEN} currentTaskId={5} onDotClick={vi.fn()} />)
        expect(screen.getByTitle('Task progress')).toHaveAttribute('data-mode', 'scroll')
        expect(document.querySelector('.task-dots-chip')).toBeNull()
      })

      it('keeps keyboard focus on a chip after paging, even when the clicked one goes', async () => {
        at768()
        render(
          <TaskProgressDots
            compact
            windowed
            tasks={ELEVEN}
            currentTaskId={5}
            onDotClick={vi.fn()}
          />
        )
        await userEvent.click(screen.getByRole('button', { name: /4 later tasks/ }))
        // The window reached the end, so the "later" chip is gone; focus moves to the other one.
        expect(screen.queryByRole('button', { name: /later tasks/ })).toBeNull()
        expect(document.activeElement).toBe(screen.getByRole('button', { name: /6 earlier tasks/ }))
      })

      it('re-centres the window when the task count changes after paging', async () => {
        at768()
        const { rerender } = render(
          <TaskProgressDots
            compact
            windowed
            tasks={ELEVEN}
            currentTaskId={5}
            onDotClick={vi.fn()}
          />
        )
        await userEvent.click(screen.getByRole('button', { name: /4 later tasks/ }))
        rerender(
          <TaskProgressDots
            compact
            windowed
            tasks={TWELVE}
            currentTaskId={5}
            onDotClick={vi.fn()}
          />
        )
        expect(dotLabels()).toEqual(['Task 3', 'Task 4', 'Task 5', 'Task 6', 'Task 7'])
      })
    })

    it('uses bigger, finger-sized dots on a touch device', () => {
      touchDevice = true
      activeRestore = stubRowWidth(2000)
      render(<TaskProgressDots compact tasks={TWELVE} currentTaskId={1} onDotClick={vi.fn()} />)
      const dot = screen.getAllByRole('button')[0]
      expect(dot.style.width).toBe('34px')
      expect(dot.style.height).toBe('34px')
    })
  })
})
