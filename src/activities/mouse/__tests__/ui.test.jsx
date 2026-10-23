import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MouseStudentView } from '../ui.jsx'
import mouse from '../definition.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'

const TARGETS = [
  { id: 'star', label: 'star', emoji: '⭐', x: 0.3, y: 0.5, size: 'large' },
  { id: 'box', label: 'box', emoji: '📦', x: 0.7, y: 0.5, size: 'large' },
]

function taskWith(items, extra = {}) {
  return {
    id: 1,
    taskType: 'activity',
    activityType: 'mouse',
    touch: 'equivalent',
    targets: TARGETS,
    items,
    ...extra,
  }
}

function renderMouse(task, options = {}) {
  return renderActivityUi(MouseStudentView, {
    task,
    initialState: mouse.initialState(task),
    ...options,
  })
}

const target = (name) => screen.getByRole('button', { name })
const originalElementFromPoint = document.elementFromPoint
const originalElementsFromPoint = document.elementsFromPoint

afterEach(() => {
  document.elementFromPoint = originalElementFromPoint
  document.elementsFromPoint = originalElementsFromPoint
})

describe('Mouse UI', () => {
  it('completes a click item, shows the done moment, then the finish card (no Check button)', async () => {
    const task = taskWith([{ id: 'a', action: 'click', target: 'star' }])
    const { state, onSubmit } = renderMouse(task)
    expect(screen.getByTestId('mouse-instruction')).toHaveTextContent('Click the star')
    expect(screen.queryByRole('button', { name: 'Check my work' })).not.toBeInTheDocument()
    fireEvent.click(target('star'), { detail: 1 })
    expect(state().items.a).toEqual({ via: 'click' })
    expect(screen.getByTestId('mouse-instruction')).toHaveTextContent('Got it!')
    await waitFor(() => expect(screen.getByTestId('round-finished')).toBeInTheDocument(), {
      timeout: 3000,
    })
    // Marked as you go: the host auto-submits the passing change, the view never does.
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('tells the student when they clicked the wrong target', () => {
    const task = taskWith([{ id: 'a', action: 'click', target: 'star' }])
    const { state } = renderMouse(task)
    fireEvent.click(target('box'), { detail: 1 })
    expect(screen.getByText('That was the box. Find the star.')).toBeInTheDocument()
    expect(state().items.a).toEqual({})
  })

  it('treats the first click of a double-click as part of it', () => {
    const task = taskWith([{ id: 'a', action: 'double_click', target: 'star' }])
    const { state } = renderMouse(task)
    fireEvent.click(target('star'), { detail: 1 })
    expect(state().items.a).toEqual({})
    fireEvent.click(target('star'), { detail: 2 })
    fireEvent.doubleClick(target('star'), { detail: 2 })
    expect(state().items.a).toEqual({ via: 'double_click' })
  })

  it('records a wrong gesture with a hint, and prevents the native context menu', () => {
    const task = taskWith([{ id: 'a', action: 'double_click', target: 'star' }])
    const { state } = renderMouse(task)
    const notCancelled = fireEvent.contextMenu(target('star'))
    expect(notCancelled).toBe(false)
    expect(state().items.a).toEqual({ via: 'right_click' })
    expect(screen.getByText(/That was a right click. Double-click the star./)).toBeInTheDocument()
  })

  it('drags a target onto another with Pointer Events', () => {
    const task = taskWith([{ id: 'a', action: 'drag', target: 'star', to: 'box' }])
    const { state } = renderMouse(task)
    const box = target('box')
    document.elementFromPoint = () => box
    fireEvent.pointerDown(target('star'), {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 10,
      clientY: 10,
    })
    fireEvent.pointerMove(target('star'), {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 60,
      clientY: 12,
    })
    fireEvent.pointerUp(target('star'), {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 200,
      clientY: 12,
    })
    expect(state().items.a).toEqual({ via: 'drag' })
  })

  it('finds the drop target under the dragged target (touch drag)', () => {
    const task = taskWith([{ id: 'a', action: 'drag', target: 'star', to: 'box' }])
    const { state } = renderMouse(task, { device: { touch: true } })
    const star = target('star')
    const box = target('box')
    // The dragged target is on top at the drop point; the drop target is the one beneath it.
    document.elementsFromPoint = () => [star.firstChild, star, box, document.body]
    const touch = { pointerId: 3, pointerType: 'touch' }
    fireEvent.pointerDown(star, { ...touch, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(star, { ...touch, clientX: 80, clientY: 10 })
    fireEvent.pointerUp(star, { ...touch, clientX: 200, clientY: 10 })
    expect(state().items.a.via).toMatch(/drag/)
    expect(mouse.grade(task, state()).passed).toBe(true)
  })

  it('records a touch-only device in the state as soon as it opens', () => {
    const task = taskWith([{ id: 'a', action: 'click', target: 'star' }])
    const { state } = renderMouse(task, { device: { touch: true } })
    expect(state().device.touch).toBe(true)
  })

  it('does not count a keyboard activation as a click', () => {
    const task = taskWith([{ id: 'a', action: 'click', target: 'star' }])
    const { state } = renderMouse(task)
    fireEvent.keyDown(target('star'), { key: 'Enter' })
    fireEvent.click(target('star'), { detail: 0 })
    expect(state().items.a).toEqual({})
    expect(screen.getByText(/not the keyboard/)).toBeInTheDocument()
  })

  it('switches to touch words, records the device and skips hover items on touch', () => {
    const task = taskWith([
      { id: 'a', action: 'hover', target: 'box' },
      { id: 'b', action: 'click', target: 'star' },
    ])
    const { state } = renderMouse(task, { device: { touch: true } })
    expect(screen.getByTestId('mouse-instruction')).toHaveTextContent('Tap the star')
    fireEvent.pointerDown(target('star'), {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 5,
      clientY: 5,
    })
    fireEvent.pointerUp(target('star'), {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 5,
      clientY: 5,
    })
    fireEvent.click(target('star'), { detail: 1 })
    expect(state().device.touch).toBe(true)
    expect(state().items.b).toEqual({ via: 'tap' })
    expect(mouse.grade(task, state()).passed).toBe(true)
  })

  it('blocks touch devices when the task says so', () => {
    const task = taskWith([{ id: 'a', action: 'click', target: 'star' }], { touch: 'block' })
    renderMouse(task, { device: { touch: true } })
    expect(screen.getByTestId('mouse-blocked')).toBeInTheDocument()
    expect(screen.queryByTestId('mouse-stage')).not.toBeInTheDocument()
  })

  it('ignores the click the browser sends after a drag completes an item', () => {
    const task = taskWith([
      { id: 'a', action: 'drag', target: 'star', to: 'box' },
      { id: 'b', action: 'click', target: 'star' },
    ])
    const { state } = renderMouse(task)
    const box = target('box')
    document.elementFromPoint = () => box
    const star = target('star')
    fireEvent.pointerDown(star, { pointerId: 1, pointerType: 'mouse', clientX: 10, clientY: 10 })
    fireEvent.pointerMove(star, { pointerId: 1, pointerType: 'mouse', clientX: 60, clientY: 12 })
    fireEvent.pointerUp(star, { pointerId: 1, pointerType: 'mouse', clientX: 200, clientY: 12 })
    fireEvent.click(star, { detail: 1 })
    expect(state().items.a).toEqual({ via: 'drag' })
    expect(state().items.b).toEqual({})
    expect(screen.queryByText(/That was the/)).not.toBeInTheDocument()
  })

  it('does not count resting on the target as the answer to a click item', async () => {
    const task = taskWith([{ id: 'a', action: 'click', target: 'star' }])
    const { state } = renderMouse(task)
    fireEvent.pointerEnter(target('star'), { pointerType: 'mouse' })
    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(state().items.a).toEqual({})
    expect(screen.queryByText(/hover/i)).not.toBeInTheDocument()
    fireEvent.click(target('star'), { detail: 1 })
    expect(state().items.a).toEqual({ via: 'click' })
  })

  it('completes a hover after the dwell time without leaving the target', async () => {
    const task = taskWith([{ id: 'a', action: 'hover', target: 'box' }])
    const { state } = renderMouse(task)
    fireEvent.pointerEnter(target('box'), { pointerType: 'mouse' })
    await waitFor(() => expect(state().items.a).toEqual({ via: 'hover' }), { timeout: 2000 })
  })
})

describe('Mouse UI: core and bonus rounds', () => {
  const items = [
    { id: 'a', action: 'click', target: 'star' },
    { id: 'b', action: 'click', target: 'box' },
  ]

  it('shows round progress, then a bonus moment once the core is done', async () => {
    const task = taskWith(items, { coreItems: 1 })
    const { state } = renderMouse(task)
    expect(screen.getByText('0 of 1 done')).toBeInTheDocument()
    fireEvent.click(target('star'), { detail: 1 })
    expect(screen.getByText('Done! ⭐ Bonus round')).toBeInTheDocument()
    expect(mouse.grade(task, state()).passed).toBe(true)
    // Gestures during the done moment are ignored, then the bonus item appears, labelled Bonus.
    await waitFor(
      () => expect(screen.getByTestId('mouse-instruction')).toHaveTextContent('Click the box'),
      {
        timeout: 3000,
      }
    )
    expect(screen.getByText('Bonus')).toBeInTheDocument()
  })

  it('Play again clears the items on this device without submitting', async () => {
    const task = taskWith(items, { coreItems: 1 })
    const { state, onSubmit } = renderMouse(task, { initialState: mouse.solutionState(task) })
    expect(screen.getByText('You did it! 2 done')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(state().items).toEqual({})
    expect(screen.getByTestId('mouse-instruction')).toHaveTextContent('Click the star')
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
