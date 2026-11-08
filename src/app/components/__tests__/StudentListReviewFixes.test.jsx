// Code-review fixes on the compact tutor student list (feature/student-list-compact): the
// Finished filter never strands the tutor or hides help, help beats offline, rename saves once
// and Escape cancels, the rename box sits outside the row's button, the help clock and "I'm on
// it" survive a momentary empty list, and the hover preview follows the row on scroll.
import React from 'react'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import StudentGrid from '../StudentGrid'

vi.mock('../../../shared/TopicLibraryView', () => ({
  TopicLibraryDialog: () => <div data-testid="topic-library" />,
}))
vi.mock('../StudentModal', () => ({
  default: ({ student }) => <div data-testid="student-modal">{student.displayName}</div>,
}))

const LESSON = {
  type: 'python',
  tasks: [
    { id: 1, title: 'Task 1', check: { type: 'output_contains', value: 'hello' } },
    { id: 2, title: 'Read this', taskType: 'information' },
  ],
}
const SESSION = { state: 'active', currentTaskId: 1 }

const st = (id, name, extra = {}) => ({
  anonymousId: id,
  displayName: name,
  online: true,
  ...extra,
})
const done = (id, name, extra = {}) =>
  st(id, name, { lastRunStatus: 'success', checkPassed: true, ...extra })

function mkProps(overrides = {}) {
  return {
    students: [],
    lesson: LESSON,
    lessonId: 'L1',
    session: SESSION,
    onRename: vi.fn(),
    onRemove: vi.fn(),
    onGoLive: vi.fn(),
    onStopLive: vi.fn(),
    collapsed: false,
    onToggle: vi.fn(),
    ...overrides,
  }
}

const rowOf = (name) =>
  screen.getAllByTestId('student-row').find((row) => row.dataset.studentName === name)
const rowNames = () => screen.queryAllByTestId('student-row').map((row) => row.dataset.studentName)

afterEach(() => vi.restoreAllMocks())

describe('review fix: the Finished filter', () => {
  it('shows everyone again when nobody is finished any more', async () => {
    const user = userEvent.setup()
    const props = mkProps({ students: [done('1', 'Ann'), st('2', 'Ben')] })
    const { rerender } = render(<StudentGrid {...props} />)
    await user.click(within(screen.getByTestId('finished-filter')).getByRole('button'))
    expect(rowNames()).toEqual(['Ann'])
    // The class moves on: checkPassed is cleared, so the filter line (and Show all) goes.
    rerender(<StudentGrid {...props} students={[st('1', 'Ann'), st('2', 'Ben')]} />)
    expect(screen.queryByTestId('finished-filter')).toBeNull()
    expect(rowNames()).toEqual(['Ann', 'Ben'])
  })

  it('never hides a student asking for help', async () => {
    const user = userEvent.setup()
    const students = [done('1', 'Ann'), st('2', 'Ben', { needsHelp: true }), st('3', 'Cat')]
    render(<StudentGrid {...mkProps({ students })} />)
    await user.click(within(screen.getByTestId('finished-filter')).getByRole('button'))
    expect(rowNames()).toEqual(['Ben', 'Ann'])
  })
})

describe('review fix: help beats offline', () => {
  it('puts an offline student who asked for help in the amber rows on top', () => {
    const students = [st('1', 'Zoe'), st('2', 'Amy', { online: false, needsHelp: true })]
    render(<StudentGrid {...mkProps({ students })} />)
    expect(screen.getByTestId('help-count')).toHaveTextContent('1 needs help')
    expect(rowNames()).toEqual(['Amy', 'Zoe'])
    expect(rowOf('Amy').dataset.status).toBe('help')
  })
})

describe('review fix: rename', () => {
  async function startRename(user) {
    await user.click(within(rowOf('Dev')).getByRole('button', { name: 'Actions for Dev' }))
    await user.click(screen.getByRole('menuitem', { name: /Rename student/ }))
    return screen.getByRole('textbox', { name: 'Rename Dev' })
  }

  it('saves exactly once on Enter, even when the box then loses focus', async () => {
    const user = userEvent.setup()
    const props = mkProps({ students: [st('d', 'Dev')] })
    render(<StudentGrid {...props} />)
    const input = await startRename(user)
    fireEvent.change(input, { target: { value: 'Devon' } })
    act(() => {
      fireEvent.submit(input.closest('form'))
      fireEvent.blur(input)
    })
    expect(props.onRename).toHaveBeenCalledTimes(1)
    expect(props.onRename).toHaveBeenCalledWith('d', 'Devon')
  })

  it('cancels on Escape without saving, even when the box then loses focus', async () => {
    const user = userEvent.setup()
    const props = mkProps({ students: [st('d', 'Dev')] })
    render(<StudentGrid {...props} />)
    const input = await startRename(user)
    fireEvent.change(input, { target: { value: 'Nope' } })
    act(() => {
      fireEvent.keyDown(input, { key: 'Escape' })
      fireEvent.blur(input)
    })
    expect(props.onRename).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox', { name: 'Rename Dev' })).toBeNull()
    // Opening rename again starts from the real name.
    expect((await startRename(user)).value).toBe('Dev')
  })

  it('saves on blur', async () => {
    const user = userEvent.setup()
    const props = mkProps({ students: [st('d', 'Dev')] })
    render(<StudentGrid {...props} />)
    const input = await startRename(user)
    fireEvent.change(input, { target: { value: 'Devi' } })
    act(() => fireEvent.blur(input))
    expect(props.onRename).toHaveBeenCalledTimes(1)
    expect(props.onRename).toHaveBeenCalledWith('d', 'Devi')
  })

  it('keeps the rename box outside the row button, so clicking it never opens the row', async () => {
    const user = userEvent.setup()
    render(<StudentGrid {...mkProps({ students: [st('d', 'Dev')] })} />)
    const input = await startRename(user)
    expect(input.closest('[role="button"]')).toBeNull()
    await user.click(input)
    expect(within(rowOf('Dev')).queryByTestId('row-open')).toBeNull()
  })
})

describe('review fix: a momentary empty list', () => {
  it('keeps the help clock and I’m on it when the students briefly vanish', async () => {
    const user = userEvent.setup()
    const students = [st('1', 'Zoe'), st('2', 'Bob'), st('3', 'Max', { needsHelp: true })]
    const props = mkProps({ students })
    const { rerender } = render(<StudentGrid {...props} />)
    expect(rowNames()).toEqual(['Max', 'Bob', 'Zoe'])
    await user.click(within(rowOf('Max')).getByRole('button', { name: /on it/ }))
    expect(rowNames()).toEqual(['Bob', 'Max', 'Zoe'])
    rerender(<StudentGrid {...props} students={[]} />)
    rerender(<StudentGrid {...props} students={students} />)
    expect(rowNames()).toEqual(['Bob', 'Max', 'Zoe'])
    expect(within(rowOf('Max')).queryByRole('button', { name: /on it/ })).toBeNull()
  })
})

describe('review fix: output on the current task only', () => {
  it('leaves offline students out of the same-output line', () => {
    const out = (id, name, extra) =>
      st(id, name, { lastRunStatus: 'success', currentOutput: 'hello', ...extra })
    const students = [out('1', 'Ann'), out('2', 'Ben'), out('3', 'Cat', { online: false })]
    render(<StudentGrid {...mkProps({ students })} />)
    expect(screen.queryByTestId('same-output')).toBeNull()
  })

  it('shows no output stub or same-output line on an information task', () => {
    const out = (id, name) => st(id, name, { lastRunStatus: 'success', currentOutput: 'hello' })
    const students = [out('1', 'Ann'), out('2', 'Ben'), out('3', 'Cat')]
    render(<StudentGrid {...mkProps({ students, session: { ...SESSION, currentTaskId: 2 } })} />)
    expect(screen.queryByTestId('same-output')).toBeNull()
    expect(rowOf('Ann').textContent).not.toMatch(/hello/)
  })
})

describe('review fix: the hover preview follows the row', () => {
  it('moves when the list scrolls', () => {
    const students = [st('b', 'Ben', { lastRunStatus: 'success', currentOutput: 'hello world' })]
    render(<StudentGrid {...mkProps({ students })} />)
    const row = rowOf('Ben')
    let top = 100
    vi.spyOn(row, 'getBoundingClientRect').mockImplementation(() => ({
      top,
      bottom: top + 28,
      left: 10,
      right: 300,
      width: 290,
      height: 28,
    }))
    fireEvent.mouseEnter(row)
    const tip = screen.getByTestId('row-tooltip')
    expect(tip.style.top).toBe('130px')
    top = 40
    act(() => {
      fireEvent.scroll(window)
    })
    expect(screen.getByTestId('row-tooltip').style.top).toBe('70px')
  })
})
