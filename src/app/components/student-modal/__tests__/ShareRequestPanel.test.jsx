import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ShareRequestPanel from '../ShareRequestPanel'

vi.mock('../../SharedWorkspacePreview', () => ({
  default: ({ snapshot }) => <div data-testid="preview">{snapshot?.code}</div>,
}))

const LESSON = { type: 'python', tasks: [{ id: 3, title: 'Loops' }] }

const SNAPSHOT = {
  lessonType: 'python',
  taskId: 3,
  code: 'print("shared")',
  files: {},
  output: '',
  runStatus: null,
  capturedAt: 1,
}

function mkProps(overrides = {}, studentOverrides = {}) {
  return {
    student: {
      anonymousId: 'stu-1',
      displayName: 'Jamie',
      shareRequestedAt: 1700000000000,
      shareRequestOrigin: 'student',
      ...studentOverrides,
    },
    lesson: LESSON,
    onReadPendingShare: vi.fn(() => Promise.resolve(SNAPSHOT)),
    onApprove: vi.fn(() => Promise.resolve()),
    onDecline: vi.fn(() => Promise.resolve()),
    ...overrides,
  }
}

describe('ShareRequestPanel', () => {
  it('renders nothing when there is no pending request', () => {
    const { container } = render(
      <ShareRequestPanel {...mkProps({}, { shareRequestedAt: null })} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('fetches and previews the pending snapshot', async () => {
    const props = mkProps()
    render(<ShareRequestPanel {...props} />)

    expect(props.onReadPendingShare).toHaveBeenCalledWith('stu-1')
    expect(await screen.findByTestId('preview')).toHaveTextContent('print("shared")')
    expect(screen.getByText('Loops')).toBeInTheDocument()
  })

  it('says the preview is a frozen snapshot, not live work', async () => {
    render(<ShareRequestPanel {...mkProps()} />)
    expect(await screen.findByTestId('preview')).toBeInTheDocument()
    expect(screen.getByText(/frozen snapshot/i)).toBeInTheDocument()
    expect(screen.getByText(/not\s+their live work/i)).toBeInTheDocument()
  })

  it('approves with the student and resolved task', async () => {
    const props = mkProps()
    render(<ShareRequestPanel {...props} />)
    await screen.findByTestId('preview')

    await userEvent.click(screen.getByRole('button', { name: /approve/i }))

    await waitFor(() => expect(props.onApprove).toHaveBeenCalled())
    const [id, meta] = props.onApprove.mock.calls[0]
    expect(id).toBe('stu-1')
    expect(meta.task).toMatchObject({ id: 3, title: 'Loops' })
  })

  it('declines without sending anything else', async () => {
    const props = mkProps()
    render(<ShareRequestPanel {...props} />)
    await screen.findByTestId('preview')

    await userEvent.click(screen.getByRole('button', { name: /decline/i }))

    await waitFor(() => expect(props.onDecline).toHaveBeenCalledWith('stu-1'))
    expect(props.onApprove).not.toHaveBeenCalled()
  })

  it('cannot approve before the snapshot has loaded', async () => {
    let resolveRead
    const props = mkProps({
      onReadPendingShare: vi.fn(() => new Promise((r) => (resolveRead = r))),
    })
    render(<ShareRequestPanel {...props} />)

    expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled()
    resolveRead(SNAPSHOT)
    await screen.findByTestId('preview')
    expect(screen.getByRole('button', { name: /approve/i })).toBeEnabled()
  })

  it('reports a withdrawn share instead of offering to approve it', async () => {
    const props = mkProps({ onReadPendingShare: vi.fn(() => Promise.resolve(null)) })
    render(<ShareRequestPanel {...props} />)

    expect(await screen.findByText(/no longer available/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled()
  })

  it('surfaces an approval failure rather than silently doing nothing', async () => {
    const props = mkProps({
      onApprove: vi.fn(() => Promise.reject(new Error('That share is no longer available.'))),
    })
    render(<ShareRequestPanel {...props} />)
    await screen.findByTestId('preview')

    await userEvent.click(screen.getByRole('button', { name: /approve/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/no longer available/i)
  })

  it('labels a teacher-initiated share differently from a student request', async () => {
    render(<ShareRequestPanel {...mkProps({}, { shareRequestOrigin: 'teacher' })} />)
    expect(await screen.findByText(/ready to share with the class/i)).toBeInTheDocument()
  })

  it('shows a waiting state while the student device prepares a snapshot', () => {
    render(
      <ShareRequestPanel
        {...mkProps({ awaitingSnapshot: true }, { shareRequestedAt: null })}
      />
    )
    expect(screen.getByText(/asking jamie's device/i)).toBeInTheDocument()
  })
})
