import { render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ShowItPanel from '../ShowItPanel'

vi.mock('../../../shared/firebase', () => ({ db: {}, auth: {}, firestore: {} }))
vi.mock('../../../shared/markdown', () => ({
  MarkdownRenderer: ({ content }) => <div>{content}</div>,
  InlineMarkdown: ({ content }) => <span>{content}</span>,
}))
vi.mock('../../../shared/CodeEditor', () => ({
  CodeEditor: ({ value }) => <textarea data-testid="code-editor" readOnly value={value ?? ''} />,
}))

const BINARY = {
  id: 1,
  title: 'Make numbers',
  taskType: 'activity',
  activityType: 'binary',
  mode: 'make_number',
  bits: 4,
  items: [{ id: 'a', target: 5 }],
}
const CODE = { id: 2, title: 'Say hello' }
const LESSON = { type: 'python', tasks: [BINARY, CODE] }
const answer = (bits) => JSON.stringify({ v: 1, items: { a: { bits, carries: '' } } })

function session(taskId, ids, students) {
  return {
    state: 'active',
    currentTaskId: taskId,
    showIt: { studentIds: ids, taskId: String(taskId), startedAt: 1 },
    students,
  }
}

describe('ShowItPanel', () => {
  it('renders nothing when nothing is being shown', () => {
    const { container } = render(
      <ShowItPanel session={{ state: 'active', currentTaskId: 1 }} lesson={LESSON} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows each picked activity build as Build 1/2 and never a name or id', () => {
    const students = {
      'secret-id-1': { displayName: 'Jamie Smith', currentAnswer: answer('0101') },
      'secret-id-2': { displayName: 'Priya Patel', currentAnswer: answer('0010') },
      'secret-id-3': { displayName: 'Not Shown', currentAnswer: answer('1111') },
    }
    const { container } = render(
      <ShowItPanel session={session(1, ['secret-id-1', 'secret-id-2'], students)} lesson={LESSON} />
    )
    const tiles = screen.getAllByTestId('show-it-tile')
    expect(tiles).toHaveLength(2)
    expect(within(tiles[0]).getByRole('heading', { name: 'Build 1' })).toBeInTheDocument()
    expect(within(tiles[1]).getByRole('heading', { name: 'Build 2' })).toBeInTheDocument()
    for (const hidden of ['Jamie', 'Priya', 'Not Shown', 'secret-id']) {
      expect(container.textContent).not.toContain(hidden)
      expect(container.innerHTML).not.toContain(hidden)
    }
  })

  it('shows a code task build read-only', () => {
    const students = {
      s1: { displayName: 'Jamie Smith', currentCode: 'print("hi")', currentOutput: 'hi' },
    }
    render(<ShowItPanel session={session(2, ['s1'], students)} lesson={LESSON} />)
    expect(screen.getByTestId('code-editor')).toHaveValue('print("hi")')
    expect(screen.getByRole('heading', { name: 'Build 1' })).toBeInTheDocument()
    expect(screen.queryByText(/Jamie/)).not.toBeInTheDocument()
  })

  it('shows a realistic run record with its output open and the run status', async () => {
    const students = {
      s1: {
        displayName: 'Jamie Smith',
        currentCode: 'print("hello world")',
        currentOutput: 'hello world',
        lastRunStatus: 'success',
        lastRunAt: 1700000000000,
        checkPassed: true,
      },
    }
    render(<ShowItPanel session={session(2, ['s1'], students)} lesson={LESSON} />)
    const panel = screen.getByTestId('output-panel')
    await waitFor(() => expect(panel.querySelector('pre').textContent).toContain('hello world'))
    expect(screen.getByText('Ran OK')).toBeInTheDocument()
    expect(screen.queryByText('Not run yet')).not.toBeInTheDocument()
  })

  it('shows nothing when the shown task is not found', () => {
    const { container } = render(
      <ShowItPanel session={session(99, ['s1'], { s1: {} })} lesson={LESSON} />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
