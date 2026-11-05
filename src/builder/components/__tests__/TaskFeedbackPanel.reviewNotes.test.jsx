import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import TaskFeedbackPanel from '../TaskFeedbackPanel'

describe('TaskFeedbackPanel preview notes', () => {
  it('lists the task’s preview notes read-only, in the order given, with status and tag', async () => {
    const user = userEvent.setup()
    render(
      <TaskFeedbackPanel
        reviewNotes={[
          { id: 'b', text: 'Swap 2 and 3', status: 'new', tag: null, createdAt: 2000 },
          {
            id: 'a',
            text: 'Hint gives the answer away',
            status: 'picked_up',
            tag: 'wrong',
            createdAt: 1000,
            lessonVersion: 7,
          },
        ]}
      />
    )
    await user.click(screen.getByRole('button', { name: /Preview notes \(2\)/ }))
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Swap 2 and 3')
    expect(items[0]).toHaveTextContent('New')
    expect(items[1]).toHaveTextContent('Picked up')
    expect(items[1]).toHaveTextContent('Wrong')
    expect(items[1]).toHaveTextContent('v7')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByText(/Teacher Feedback/)).not.toBeInTheDocument()
  })

  it('renders nothing with no feedback and no notes', () => {
    const { container } = render(<TaskFeedbackPanel />)
    expect(container).toBeEmptyDOMElement()
  })
})
