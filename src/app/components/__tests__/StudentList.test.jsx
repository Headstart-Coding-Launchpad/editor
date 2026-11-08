// The compact tutor student list (StudentGrid + StudentListRow; sketch v2 OK'd 8 Nov): one slim
// row per student, help first and offline last, a plain status word, the header's summary and
// same-output lines, the Finished filter, the row that opens in place with a More fold, and
// every action the old card had still reachable.
import React from 'react'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import StudentGrid from '../StudentGrid'

vi.mock('../../../shared/TopicLibraryView', () => ({
  TopicLibraryDialog: () => <div data-testid="topic-library" />,
}))
vi.mock('../StudentModal', () => ({
  default: ({ student, onClose }) => (
    <div data-testid="student-modal">
      <span data-testid="modal-name">{student.displayName}</span>
      <button onClick={onClose}>Close modal</button>
    </div>
  ),
}))

const LESSON = {
  type: 'python',
  tasks: [
    { id: 1, title: 'Task 1', check: { type: 'output_contains', value: 'hello' } },
    { id: 2, title: 'Task 2' },
  ],
}
const SESSION = { state: 'active', currentTaskId: 1 }
const hint = (failStreak) => ({ text: 'Check line 3', source: 'check', failStreak, taskId: '1' })

function st(id, name, extra = {}) {
  return { anonymousId: id, displayName: name, online: true, ...extra }
}

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
const rowNames = () => screen.getAllByTestId('student-row').map((row) => row.dataset.studentName)
const statusOf = (name) => within(rowOf(name)).getByTestId('row-status').textContent

afterEach(() => vi.restoreAllMocks())

describe('compact student list: one plain status per row', () => {
  it('says Stuck with the fail count, Failed, Error, Finished, Away and Offline', () => {
    const students = [
      st('a', 'Ava', { lastRunStatus: 'success', checkPassed: true }),
      st('b', 'Ben', { lastRunStatus: 'success', checkPassed: false, studentHint: hint(1) }),
      st('c', 'Cat', { lastRunStatus: 'error', lastRunError: 'NameError: x', lastRunAt: 5 }),
      st('d', 'Dev', { windowFocused: false }),
      st('e', 'Eve', { online: false }),
      st('g', 'Gus', { lastRunStatus: 'success', checkPassed: false, studentHint: hint(4) }),
    ]
    render(<StudentGrid {...mkProps({ students })} />)
    expect(statusOf('Ava')).toMatch(/Finished/)
    expect(statusOf('Ben')).toMatch(/Failed/)
    expect(statusOf('Cat')).toMatch(/Error/)
    expect(statusOf('Dev')).toMatch(/Away/)
    expect(statusOf('Eve')).toMatch(/Offline/)
    expect(statusOf('Gus')).toMatch(/Stuck ✗4/)
  })

  it('says Stuck ⚠3 after the same error three runs in a row', () => {
    const crash = (at) =>
      st('c', 'Cat', { lastRunStatus: 'error', lastRunError: 'NameError: x', lastRunAt: at })
    const { rerender } = render(<StudentGrid {...mkProps({ students: [crash(1)] })} />)
    expect(statusOf('Cat')).toMatch(/Error/)
    rerender(<StudentGrid {...mkProps({ students: [crash(2)] })} />)
    rerender(<StudentGrid {...mkProps({ students: [crash(3)] })} />)
    expect(statusOf('Cat')).toMatch(/Stuck ⚠3/)
  })

  it('lets Needs help beat Stuck, with I’m on it on the row', () => {
    const students = [st('g', 'Gus', { needsHelp: true, studentHint: hint(5), checkPassed: false })]
    render(<StudentGrid {...mkProps({ students })} />)
    expect(statusOf('Gus')).toMatch(/Needs help/)
    expect(within(rowOf('Gus')).getByRole('button', { name: /I’m on it|I'm on it/ })).toBeVisible()
    expect(screen.getByTestId('help-count')).toHaveTextContent('1 needs help')
  })
})

describe('compact student list: order', () => {
  const base = [st('1', 'Zoe'), st('2', 'Amy', { online: false }), st('3', 'Bob'), st('4', 'Cal')]

  it('puts help first and offline last', () => {
    const students = base.map((s) => (s.anonymousId === '4' ? { ...s, needsHelp: true } : s))
    render(<StudentGrid {...mkProps({ students })} />)
    expect(rowNames()).toEqual(['Cal', 'Bob', 'Zoe', 'Amy'])
  })

  it('does not move rows on a run or keystroke, only when a state changes', () => {
    const props = mkProps({ students: base })
    const { rerender } = render(<StudentGrid {...props} />)
    expect(rowNames()).toEqual(['Bob', 'Cal', 'Zoe', 'Amy'])
    const busy = base.map((s) => ({ ...s, lastActivityAt: 99, currentCode: 'print(1)' }))
    rerender(<StudentGrid {...props} students={[...busy].reverse()} />)
    expect(rowNames()).toEqual(['Bob', 'Cal', 'Zoe', 'Amy'])
    const help = busy.map((s) => (s.anonymousId === '1' ? { ...s, needsHelp: true } : s))
    rerender(<StudentGrid {...props} students={help} />)
    expect(rowNames()).toEqual(['Zoe', 'Bob', 'Cal', 'Amy'])
  })

  it('keeps the open row where it is until it is closed', () => {
    const props = mkProps({ students: base })
    const { rerender } = render(<StudentGrid {...props} />)
    fireEvent.click(within(rowOf('Cal')).getByTestId('row-main'))
    expect(within(rowOf('Cal')).getByTestId('row-open')).toBeInTheDocument()
    const helped = base.map((s) => (s.anonymousId === '4' ? { ...s, needsHelp: true } : s))
    rerender(<StudentGrid {...props} students={helped} />)
    expect(rowNames()).toEqual(['Bob', 'Cal', 'Zoe', 'Amy'])
    fireEvent.click(within(rowOf('Cal')).getByTestId('row-main'))
    expect(rowNames()).toEqual(['Cal', 'Bob', 'Zoe', 'Amy'])
  })
})

describe('compact student list: header', () => {
  it('counts states in one plain line and names a shared output', () => {
    const out = (id, name, text, extra) =>
      st(id, name, { lastRunStatus: 'success', currentOutput: text, ...extra })
    const students = [
      out('1', 'Ann', 'hello', { checkPassed: true }),
      out('2', 'Ben', 'hello', { checkPassed: true }),
      out('3', 'Cat', 'hello', { checkPassed: true }),
      out('4', 'Dan', 'hi', { checkPassed: false }),
      st('5', 'Eve', { online: false }),
    ]
    render(<StudentGrid {...mkProps({ students })} />)
    const summary = screen.getByTestId('student-list-summary')
    expect(summary).toHaveTextContent('3 finished')
    expect(summary).toHaveTextContent('1 failed')
    expect(summary).toHaveTextContent('1 offline')
    expect(screen.getByTestId('same-output')).toHaveTextContent('3 show the same output: hello')
  })

  it('filters to Finished and back, and never says stretch', async () => {
    const user = userEvent.setup()
    const students = [
      st('1', 'Ann', { lastRunStatus: 'success', checkPassed: true }),
      st('2', 'Ben', { lastRunStatus: 'success', checkPassed: false }),
      st('3', 'Cat', { lastRunStatus: 'success', checkPassed: true }),
    ]
    render(<StudentGrid {...mkProps({ students })} />)
    const filter = screen.getByTestId('finished-filter')
    expect(filter).toHaveTextContent('Finished (2)')
    await user.click(within(filter).getByRole('button', { name: 'Show' }))
    expect(rowNames()).toEqual(['Ann', 'Cat'])
    await user.click(within(filter).getByRole('button', { name: 'Show all' }))
    expect(rowNames()).toEqual(['Ann', 'Ben', 'Cat'])
    expect(screen.getByTestId('student-grid').textContent).not.toMatch(/stretch/i)
  })
})

describe('compact student list: a row opens in place', () => {
  it('shows where they are and their output, Thumbs up / Open, and More with everything else', async () => {
    const user = userEvent.setup()
    const onThumbsUpStudent = vi.fn()
    const students = [
      st('g', 'Gus', {
        lastRunStatus: 'error',
        lastRunError: "NameError: name 'scor' is not defined",
        lastRunAt: Date.now(),
        pasteLog: { 1: { count: 2, chars: 300, lastAt: Date.now() } },
        visiblePanes: ['instructions', 'code'],
      }),
    ]
    const props = mkProps({ students, onThumbsUpStudent })
    render(<StudentGrid {...props} />)
    await user.click(within(rowOf('Gus')).getByTestId('row-main'))
    const open = within(rowOf('Gus')).getByTestId('row-open')
    expect(open).toHaveTextContent('Task 1 of 2')
    expect(open).toHaveTextContent("NameError: name 'scor' is not defined")
    await user.click(within(open).getByRole('button', { name: /Thumbs up/ }))
    expect(onThumbsUpStudent).toHaveBeenCalledWith('g')
    // Pasted code sits in More, so More carries the amber dot.
    const more = within(open).getByRole('button', { name: /More/ })
    expect(within(more).getByTestId('more-dot')).toBeInTheDocument()
    expect(screen.queryByTestId('row-more')).not.toBeInTheDocument()
    await user.click(more)
    const fold = screen.getByTestId('row-more')
    expect(within(fold).getByLabelText(/Pasted ×2/)).toBeInTheDocument()
    expect(within(fold).getByLabelText(/Can see: Info \+ Code/)).toBeInTheDocument()
    await user.click(within(open).getByRole('button', { name: 'Open Gus' }))
    expect(props.onGoLive).toHaveBeenCalledWith('g')
    expect(screen.getByTestId('modal-name')).toHaveTextContent('Gus')
  })

  it('shows Thumbs up and Open on hover, with the last output', () => {
    const students = [st('b', 'Ben', { lastRunStatus: 'success', currentOutput: 'hello world' })]
    render(<StudentGrid {...mkProps({ students, onThumbsUpStudent: vi.fn() })} />)
    fireEvent.mouseEnter(rowOf('Ben'))
    expect(screen.getByRole('button', { name: 'Send Ben a thumbs up' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Ben' })).toBeInTheDocument()
    expect(screen.getByTestId('row-tooltip')).toHaveTextContent('hello world')
  })
})

describe('compact student list: nothing a tutor could do is lost', () => {
  async function openMenu(user, name) {
    await user.click(within(rowOf(name)).getByRole('button', { name: `Actions for ${name}` }))
    return screen.getByRole('menu')
  }

  it('groups every row action under the app’s own labels', async () => {
    const user = userEvent.setup()
    const handlers = {
      onThumbsUpStudent: vi.fn(),
      onDecideBadge: vi.fn(),
      onSendHint: vi.fn(),
      onSendMessage: vi.fn(),
      onNudgeStudent: vi.fn(),
      onRequestFullscreenStudent: vi.fn(),
      onOpenRoster: vi.fn(),
    }
    const students = [st('d', 'Dev', { windowFocused: false })]
    const props = mkProps({
      students,
      ...handlers,
      rosterStatus: { unmatchedIds: ['d'] },
    })
    render(<StudentGrid {...props} />)
    let menu = await openMenu(user, 'Dev')
    for (const group of ['Encourage', 'Help this student', 'Their screen', 'Edit']) {
      expect(within(menu).getByText(group)).toBeInTheDocument()
    }
    for (const label of [
      'Thumbs up',
      'Award badge',
      'Send hint',
      'Message',
      'Nudge',
      'Ask to go fullscreen',
      'Open student',
      'Rename student',
      'Match them to the class list',
      'Remove student',
    ]) {
      expect(within(menu).getByRole('menuitem', { name: new RegExp(label) })).toBeInTheDocument()
    }

    await user.click(within(menu).getByRole('menuitem', { name: /Nudge/ }))
    expect(handlers.onNudgeStudent).toHaveBeenCalledWith('d')
    menu = await openMenu(user, 'Dev')
    await user.click(within(menu).getByRole('menuitem', { name: /Ask to go fullscreen/ }))
    expect(handlers.onRequestFullscreenStudent).toHaveBeenCalledWith('d')
    menu = await openMenu(user, 'Dev')
    await user.click(within(menu).getByRole('menuitem', { name: /Match them/ }))
    expect(handlers.onOpenRoster).toHaveBeenCalled()

    // Send hint uses the student window's own compose box and handler.
    menu = await openMenu(user, 'Dev')
    await user.click(within(menu).getByRole('menuitem', { name: /Send hint/ }))
    await user.type(screen.getByRole('textbox'), 'Look at line 3')
    await user.click(screen.getByRole('button', { name: 'Send hint' }))
    expect(handlers.onSendHint).toHaveBeenCalledWith('d', 'Look at line 3', 1)

    menu = await openMenu(user, 'Dev')
    await user.click(within(menu).getByRole('menuitem', { name: /Message/ }))
    await user.type(screen.getByRole('textbox'), 'Well done')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(handlers.onSendMessage).toHaveBeenCalledWith('d', 'Well done')

    menu = await openMenu(user, 'Dev')
    await user.click(within(menu).getByRole('menuitem', { name: /Award badge/ }))
    expect(screen.getByRole('dialog', { name: /Award badge · Dev/ })).toBeInTheDocument()
  })

  it('renames in place and removes only after a confirm', async () => {
    const user = userEvent.setup()
    const props = mkProps({ students: [st('d', 'Dev')] })
    render(<StudentGrid {...props} />)
    await user.click(within(rowOf('Dev')).getByRole('button', { name: 'Actions for Dev' }))
    await user.click(screen.getByRole('menuitem', { name: /Rename student/ }))
    const input = screen.getByRole('textbox', { name: 'Rename Dev' })
    await user.clear(input)
    await user.type(input, 'Devon{Enter}')
    expect(props.onRename).toHaveBeenCalledWith('d', 'Devon')

    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    for (let i = 0; i < 2; i++) {
      await user.click(within(rowOf('Dev')).getByRole('button', { name: 'Actions for Dev' }))
      await user.click(screen.getByRole('menuitem', { name: /Remove student/ }))
    }
    expect(confirm).toHaveBeenCalledWith('Remove Dev from the session?')
    expect(props.onRemove).toHaveBeenCalledTimes(1)
    expect(props.onRemove).toHaveBeenCalledWith('d')
  })

  it('keeps share Review, select mode, Fullscreen All and the header ⋯ menu', async () => {
    const user = userEvent.setup()
    const props = mkProps({
      students: [st('a', 'Ann', { shareRequestedAt: 5 }), st('b', 'Ben')],
      onReadPendingShare: vi.fn(),
      onDeclineShare: vi.fn(),
      onRequestFullscreenAll: vi.fn(),
      onDecideBadge: vi.fn(),
      onNudgeAway: vi.fn(),
    })
    render(<StudentGrid {...props} />)
    expect(screen.getByText('⛶ Fullscreen All')).toBeInTheDocument()
    await user.click(
      within(screen.getByTestId('share-request-banner')).getByRole('button', { name: 'Review' })
    )
    expect(screen.getByTestId('modal-name')).toHaveTextContent('Ann')
    await user.click(screen.getByRole('button', { name: 'Close modal' }))
    await user.click(screen.getByRole('button', { name: 'More class actions' }))
    expect(screen.getByText(/Nudge Away/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '☑ Select' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Ben' }))
    expect(screen.getByText('1 selected')).toBeInTheDocument()
  })

  it('opens the side-quest from the menu, only when they are on one', async () => {
    const user = userEvent.setup()
    const students = [
      st('a', 'Ann', { checkPassed: true, lastRunStatus: 'success', sideQuestOpen: 0 }),
      st('b', 'Ben'),
    ]
    // The activity model reads the session's own student records, as TeacherView passes them.
    const session = {
      ...SESSION,
      students: Object.fromEntries(students.map((s) => [s.anonymousId, s])),
    }
    render(<StudentGrid {...mkProps({ students, session })} />)
    expect(within(rowOf('Ann')).getByTestId('row-note')).toHaveTextContent('on side-quest')
    await user.click(within(rowOf('Ben')).getByRole('button', { name: 'Actions for Ben' }))
    expect(screen.queryByRole('menuitem', { name: /See their side-quest/ })).toBeNull()
    await user.click(within(rowOf('Ann')).getByRole('button', { name: 'Actions for Ann' }))
    await act(async () => screen.getByRole('menuitem', { name: /See their side-quest/ }).click())
    expect(screen.getByTestId('modal-name')).toHaveTextContent('Ann')
  })
})
