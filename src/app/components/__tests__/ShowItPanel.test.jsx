import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import ShowItPanel from '../ShowItPanel'
import { defaultShowItView } from '../../../shared/showIt'

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

  it('shows a code task build read-only, with the code behind Show code', () => {
    const students = {
      s1: { displayName: 'Jamie Smith', currentCode: 'print("hi")', currentOutput: 'hi' },
    }
    render(<ShowItPanel session={session(2, ['s1'], students)} lesson={LESSON} presentation />)
    expect(screen.queryByTestId('code-editor')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show code' }))
    expect(screen.getByTestId('code-editor')).toHaveValue('print("hi")')
    expect(screen.getByRole('heading', { name: 'Build 1' })).toBeInTheDocument()
    expect(screen.queryByText(/Jamie/)).not.toBeInTheDocument()
  })

  it('shows a realistic run record with its output open and no run status', async () => {
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
    expect(screen.queryByTestId('code-editor')).not.toBeInTheDocument()
    const panel = screen.getByTestId('output-panel')
    await waitFor(() => expect(panel.querySelector('pre').textContent).toContain('hello world'))
    // Display mode: no pass/fail status on a shown build.
    expect(screen.queryByText('Ran OK')).not.toBeInTheDocument()
    expect(screen.queryByText('Error')).not.toBeInTheDocument()
  })

  it('shows nothing when the shown task is not found', () => {
    const { container } = render(
      <ShowItPanel session={session(99, ['s1'], { s1: {} })} lesson={LESSON} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  describe('marks hidden on shown builds', () => {
    const MARKED = [
      { bits: '1010', note: 'a wrong answer' },
      { bits: '0101', note: 'the right answer' },
    ]

    it.each(MARKED)('an activity build with $note carries no hint, tick or Correct', ({ bits }) => {
      const students = { s1: { currentAnswer: answer(bits) } }
      const { container } = render(
        <ShowItPanel session={session(1, ['s1'], students)} lesson={LESSON} />
      )
      expect(screen.getByTestId('binary-activity')).toBeInTheDocument()
      expect(container.querySelector('.act-hint')).toBeNull()
      expect(container.querySelector('.act-result')).toBeNull()
      expect(container.querySelector('.act-correct-tick')).toBeNull()
      expect(screen.queryByText(/Correct|Not yet|Bonus|too small|too big/i)).not.toBeInTheDocument()
      expect(screen.queryByTestId('round-progress')).not.toBeInTheDocument()
      expect(screen.queryByTestId('tutor-item-picker')).not.toBeInTheDocument()
    })

    it('a code build with a failed check shows no status or check result', () => {
      const lesson = {
        type: 'python',
        tasks: [{ id: 2, title: 'Say hello', check: { type: 'output_contains', value: 'x' } }],
      }
      const students = {
        s1: {
          currentCode: 'print(1)',
          currentOutput: '1',
          lastRunStatus: 'error',
          checkPassed: false,
        },
      }
      render(<ShowItPanel session={session(2, ['s1'], students)} lesson={lesson} />)
      expect(screen.queryByText('Error')).not.toBeInTheDocument()
      expect(screen.queryByText('Ran OK')).not.toBeInTheDocument()
    })
  })

  describe('one at a time', () => {
    const students = {
      s1: { currentAnswer: answer('0001') },
      s2: { currentAnswer: answer('0010') },
      s3: { currentAnswer: answer('0100') },
    }
    const withView = (extra) => ({
      ...session(1, ['s1', 's2', 's3'], students),
      showIt: { studentIds: ['s1', 's2', 's3'], taskId: '1', startedAt: 1, ...extra },
    })

    it('shows every build side by side by default for a small view', () => {
      expect(defaultShowItView(BINARY)).toBe('side')
      render(<ShowItPanel session={withView({})} lesson={LESSON} />)
      expect(screen.getAllByTestId('show-it-tile')).toHaveLength(3)
    })

    it('shows only the chosen build, full width, when the tutor chose one at a time', () => {
      render(<ShowItPanel session={withView({ view: 'single', index: 1 })} lesson={LESSON} />)
      const tiles = screen.getAllByTestId('show-it-tile')
      expect(tiles).toHaveLength(1)
      expect(within(tiles[0]).getByRole('heading', { name: 'Build 2' })).toBeInTheDocument()
      expect(
        screen.getByTestId('show-it-panel').querySelector('[data-view="single"]')
      ).not.toBeNull()
    })

    it('has no controls for students, and the tutor controls write the view and the build', () => {
      const onSetView = vi.fn()
      const { rerender } = render(
        <ShowItPanel session={withView({ view: 'single', index: 1 })} lesson={LESSON} />
      )
      expect(screen.queryByRole('button', { name: 'Next build' })).not.toBeInTheDocument()
      rerender(
        <ShowItPanel
          session={withView({ view: 'single', index: 1 })}
          lesson={LESSON}
          onSetView={onSetView}
        />
      )
      expect(screen.getByText('Build 2 of 3')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Next build' }))
      expect(onSetView).toHaveBeenLastCalledWith('single', 2)
      fireEvent.click(screen.getByRole('button', { name: 'Previous build' }))
      expect(onSetView).toHaveBeenLastCalledWith('single', 0)
      fireEvent.click(screen.getByRole('button', { name: 'Side by side' }))
      expect(onSetView).toHaveBeenLastCalledWith('side', 1)
    })

    it('disables the arrow at either end', () => {
      render(
        <ShowItPanel
          session={withView({ view: 'single', index: 0 })}
          lesson={LESSON}
          onSetView={vi.fn()}
        />
      )
      expect(screen.getByRole('button', { name: 'Previous build' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Next build' })).toBeEnabled()
    })
  })

  describe('activity views fit the tile', () => {
    it('renders every column of an 8-bit row, and the tile CSS lets the row shrink to fit', () => {
      const wide = { ...BINARY, bits: 8, items: [{ id: 'a', target: 200 }] }
      const students = { s1: { currentAnswer: answer('11001000') } }
      render(
        <ShowItPanel
          session={session(1, ['s1'], students)}
          lesson={{ type: 'python', tasks: [wide] }}
        />
      )
      const row = screen.getByTestId('show-it-tile').querySelector('[data-bit-row="answer"]')
      expect(within(row).getAllByRole('switch')).toHaveLength(8)
      const css = readFileSync('src/index.css', 'utf8')
      const rule = css.slice(css.indexOf('.show-it-tile .act-bits {'))
      expect(rule.slice(0, rule.indexOf('}'))).toMatch(/minmax\(0, 1fr\)/)
      expect(rule.slice(0, rule.indexOf('}'))).toMatch(/overflow-x: visible/)
    })
  })

  describe('result first', () => {
    const run = (type, task, student, props = {}) =>
      render(
        <ShowItPanel
          session={session(2, ['s1'], { s1: student })}
          lesson={{ type, tasks: [{ id: 2, title: 'Build', ...task }] }}
          {...props}
        />
      )

    it('Python shows the output, code hidden, and no toggle for students', async () => {
      run(
        'python',
        {},
        { currentCode: 'print(1)', currentOutput: 'one two', lastRunStatus: 'success' }
      )
      await waitFor(() => expect(screen.getByTestId('show-it-result')).toHaveTextContent('one two'))
      expect(screen.queryByTestId('code-editor')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /code/i })).not.toBeInTheDocument()
    })

    it('Python Stage shows the drawing big and no code until Show code', () => {
      const stageResult = { commands: [{ type: 'circle', x: 0, y: 0, r: 5 }], truncated: false }
      const { container } = run(
        'python',
        {},
        { currentCode: 'draw()', currentStageResult: stageResult, lastRunStatus: 'success' },
        { presentation: true }
      )
      expect(container.querySelector('canvas')).not.toBeNull()
      expect(screen.queryByTestId('code-editor')).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Show code' }))
      expect(screen.getByTestId('code-editor')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Hide code' }))
      expect(screen.queryByTestId('code-editor')).not.toBeInTheDocument()
    })

    it('a build that has not run shows a friendly empty state', () => {
      run('python', {}, { currentCode: 'print(1)' })
      expect(screen.getByText("Build 1 hasn't run their code yet.")).toBeInTheDocument()
    })

    it('Turtle shows the drawing with no code editor until Show code', () => {
      const { container } = run(
        'turtle',
        {},
        {
          currentCode: 'forward(50)',
          currentTurtleResult: { commands: [], state: {} },
          lastRunStatus: 'success',
        },
        { presentation: true }
      )
      expect(container.querySelector('canvas[role="img"]')).not.toBeNull()
      expect(screen.queryByTestId('code-editor')).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Show code' }))
      expect(container.querySelector('canvas[role="img"]')).not.toBeNull()
    })

    it('HTML shows the rendered page and no editor until Show code', () => {
      const { container } = run(
        'html',
        { entryFile: 'index.html' },
        { currentFiles: { 'index,html': '<h1>Hi</h1>' } },
        { presentation: true }
      )
      expect(container.querySelector('iframe')).not.toBeNull()
      expect(screen.queryByTestId('code-editor')).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Show code' }))
      expect(screen.getByTestId('code-editor')).toBeInTheDocument()
    })

    it('an activity build has no code toggle', () => {
      render(
        <ShowItPanel
          session={session(1, ['s1'], { s1: { currentAnswer: answer('0101') } })}
          lesson={LESSON}
          presentation
        />
      )
      expect(screen.queryByRole('button', { name: 'Show code' })).not.toBeInTheDocument()
    })
  })
})
