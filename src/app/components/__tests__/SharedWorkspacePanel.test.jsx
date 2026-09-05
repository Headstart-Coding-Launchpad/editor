import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import SharedWorkspacePanel from '../SharedWorkspacePanel'

const SHARES = {
  s1: { sharerId: 'stu-1', sharerName: 'Jamie', taskTitle: 'Loops', taskId: 2, sharedAt: 200 },
  s2: { sharerId: 'stu-2', sharerName: 'Sam', taskTitle: 'Lists', taskId: 5, sharedAt: 300 },
}

function mkProps(overrides = {}) {
  return {
    sharedWorkspaces: SHARES,
    viewerId: 'stu-9',
    onOpen: vi.fn(),
    ...overrides,
  }
}

describe('SharedWorkspacePanel', () => {
  it('renders nothing when nothing has been shared', () => {
    const { container } = render(<SharedWorkspacePanel {...mkProps({ sharedWorkspaces: {} })} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a count of shared workspaces', () => {
    render(<SharedWorkspacePanel {...mkProps()} />)
    expect(screen.getByRole('button', { name: /shared work \(2\)/i })).toBeInTheDocument()
  })

  it('does not fire a backlog of toasts for shares that predate joining', () => {
    render(<SharedWorkspacePanel {...mkProps()} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('announces a share that arrives after mount', () => {
    const { rerender } = render(<SharedWorkspacePanel {...mkProps()} />)
    rerender(
      <SharedWorkspacePanel
        {...mkProps({
          sharedWorkspaces: {
            ...SHARES,
            s3: { sharerId: 'stu-3', sharerName: 'Alex', taskTitle: 'Dicts', sharedAt: 400 },
          },
        })}
      />
    )
    expect(screen.getByRole('status')).toHaveTextContent(/Alex shared their work on Dicts/i)
  })

  it('never announces a student their own share', () => {
    const { rerender } = render(<SharedWorkspacePanel {...mkProps({ viewerId: 'stu-3' })} />)
    rerender(
      <SharedWorkspacePanel
        {...mkProps({
          viewerId: 'stu-3',
          sharedWorkspaces: {
            ...SHARES,
            s3: { sharerId: 'stu-3', sharerName: 'Alex', taskTitle: 'Dicts', sharedAt: 400 },
          },
        })}
      />
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('lists entries newest first, each tagged with its task', async () => {
    render(<SharedWorkspacePanel {...mkProps()} />)
    await userEvent.click(screen.getByRole('button', { name: /shared work/i }))

    const rows = screen.getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('Sam')
    expect(rows[0]).toHaveTextContent('Lists')
    expect(rows[1]).toHaveTextContent('Jamie')
    expect(rows[1]).toHaveTextContent('Loops')
  })

  it('marks the viewer own entry', async () => {
    render(<SharedWorkspacePanel {...mkProps({ viewerId: 'stu-1' })} />)
    await userEvent.click(screen.getByRole('button', { name: /shared work/i }))
    expect(screen.getByText(/Jamie \(you\)/)).toBeInTheDocument()
  })

  it('opens a share by its entry', async () => {
    const props = mkProps()
    render(<SharedWorkspacePanel {...props} />)
    await userEvent.click(screen.getByRole('button', { name: /shared work/i }))
    await userEvent.click(screen.getAllByRole('button', { name: 'Open' })[0])

    expect(props.onOpen).toHaveBeenCalledWith(expect.objectContaining({ shareId: 's2' }))
  })

  it('dismissing the toast does not open anything', async () => {
    const props = mkProps()
    const { rerender } = render(<SharedWorkspacePanel {...props} />)
    rerender(
      <SharedWorkspacePanel
        {...props}
        sharedWorkspaces={{
          ...SHARES,
          s3: { sharerId: 'stu-3', sharerName: 'Alex', sharedAt: 400 },
        }}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /not now/i }))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(props.onOpen).not.toHaveBeenCalled()
  })

  it('reassures the student their own work is untouched', async () => {
    render(<SharedWorkspacePanel {...mkProps()} />)
    await userEvent.click(screen.getByRole('button', { name: /shared work/i }))
    expect(screen.getByText(/your own work stays exactly as you left it/i)).toBeInTheDocument()
  })
})
