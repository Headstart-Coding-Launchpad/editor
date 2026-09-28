import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ActivityHost, { ActivityView } from '../ActivityHost.jsx'
import binary from '../binary/definition.js'
import keyboard from '../keyboard/definition.js'
import { getActivityUi, getTaskActivityUi } from '../registry.js'
import { ACTIVITY_IDS } from '../registry.pure.js'

vi.mock('../../shared/markdown', () => ({
  MarkdownRenderer: ({ content }) => <div data-testid="activity-markdown">{content}</div>,
}))

const BINARY = {
  id: 2,
  title: 'Make 5',
  description: 'Turn bits **on** to make the number.',
  taskType: 'activity',
  activityType: 'binary',
  mode: 'make_number',
  bits: 4,
  items: [{ id: 'a', target: 5 }],
}
const KEYBOARD = { id: 3, title: 'Type', ...keyboard.defaultTask({ id: 3, title: 'Type' }) }
const MOUSE = { id: 4, title: 'Mouse', taskType: 'activity', activityType: 'mouse', ...{} }

function activityFor(task, state, extra = {}) {
  return {
    task,
    state,
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    readSavedState: vi.fn(() => null),
    ...extra,
  }
}

const originalMatchMedia = window.matchMedia

function useTouchOnlyDevice() {
  window.matchMedia = (query) => ({
    matches: query === '(any-pointer: coarse)',
    addEventListener() {},
    removeEventListener() {},
  })
}

afterEach(() => {
  window.matchMedia = originalMatchMedia
})

describe('activity UI registry', () => {
  it('has a StudentView for every author-facing activity', () => {
    for (const id of ACTIVITY_IDS) {
      expect(typeof getActivityUi(id)?.StudentView, id).toBe('function')
    }
  })

  it('merges the pure definition with its UI', () => {
    const ui = getTaskActivityUi(BINARY)
    expect(ui.id).toBe('binary')
    expect(ui.grade).toBe(binary.grade)
    expect(getTaskActivityUi({ id: 1, title: 'Code' })).toBeNull()
  })
})

describe('ActivityHost', () => {
  it('renders the student task editable with its title and instructions', () => {
    const activity = activityFor(BINARY, binary.initialState(BINARY))
    render(<ActivityHost task={BINARY} activity={activity} />)
    expect(screen.getByRole('heading', { name: 'Make 5' })).toBeInTheDocument()
    expect(screen.getByTestId('activity-markdown')).toHaveTextContent('Turn bits **on**')
    fireEvent.click(screen.getByRole('switch', { name: 'Bits 1 column' }))
    expect(activity.onChange).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Check answers' }))
    expect(activity.onSubmit).toHaveBeenCalledTimes(1)
  })

  it("renders a teacher's broadcast read-only from teacherLive.answer", () => {
    const activity = activityFor(BINARY, binary.initialState(BINARY))
    const answer = JSON.stringify({ v: 1, items: { a: { bits: '0101', carries: '' } } })
    render(<ActivityHost task={BINARY} activity={activity} broadcastAnswer={answer} />)
    const four = screen.getByRole('switch', { name: 'Bits 4 column' })
    expect(four).toHaveAttribute('aria-checked', 'true')
    expect(four).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Check answers' })).not.toBeInTheDocument()
  })

  it('shows the initial state while a broadcast has not sent an answer yet', () => {
    const activity = activityFor(BINARY, null)
    render(<ActivityHost task={BINARY} activity={activity} broadcastAnswer={null} />)
    expect(screen.getByRole('switch', { name: 'Bits 4 column' })).toHaveAttribute(
      'aria-checked',
      'false'
    )
  })

  it("reviews an earlier task's saved state read-only", () => {
    const saved = { v: 1, items: { a: { bits: '0100', carries: '' } } }
    const activity = activityFor({ id: 99 }, null, { readSavedState: vi.fn(() => saved) })
    render(<ActivityHost task={BINARY} activity={activity} reviewing />)
    expect(activity.readSavedState).toHaveBeenCalledWith(BINARY)
    expect(screen.getByRole('switch', { name: 'Bits 4 column' })).toBeDisabled()
  })

  it("shows a friendly notice for an activity this version doesn't know", () => {
    const task = { id: 5, title: 'Hologram', taskType: 'activity', activityType: 'hologram' }
    render(<ActivityHost task={task} activity={activityFor(task, null)} />)
    expect(screen.getByTestId('activity-unavailable')).toHaveTextContent(
      "This activity isn't available in this version"
    )
  })

  it('offers the on-screen keyboard on a touch-only device, with an "I have a keyboard" override', () => {
    useTouchOnlyDevice()
    render(
      <ActivityHost task={KEYBOARD} activity={activityFor(KEYBOARD, keyboard.initialState(KEYBOARD))} />
    )
    expect(screen.getByTestId('activity-virtual-keyboard')).toBeInTheDocument()
    expect(screen.getByTestId('on-screen-keyboard')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'I have a keyboard' }))
    expect(screen.queryByTestId('activity-virtual-keyboard')).not.toBeInTheDocument()
    expect(screen.queryByTestId('on-screen-keyboard')).not.toBeInTheDocument()
  })

  it('explains touch equivalents when a mouse activity runs without a fine pointer', () => {
    useTouchOnlyDevice()
    const task = { ...MOUSE, ...getActivityUi('mouse').defaultTask({ id: 4, title: 'Mouse' }) }
    render(<ActivityHost task={task} activity={activityFor(task, getActivityUi('mouse').initialState(task))} />)
    expect(screen.getByTestId('activity-touch')).toBeInTheDocument()
    expect(screen.getByTestId('mouse-instruction')).toHaveTextContent('Tap the star')
  })

  it('shows no device notices on read-only views', () => {
    useTouchOnlyDevice()
    render(<ActivityView task={KEYBOARD} state={keyboard.initialState(KEYBOARD)} readOnly teacher />)
    expect(screen.queryByTestId('activity-virtual-keyboard')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check my work' })).not.toBeInTheDocument()
  })
})
