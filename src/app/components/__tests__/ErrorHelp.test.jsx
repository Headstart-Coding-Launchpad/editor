import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ErrorHelp from '../ErrorHelp'
import OutputPanel from '../OutputPanel'

describe('ErrorHelp', () => {
  it('says what went wrong and opens the ladder one rung at a time, fix last', () => {
    render(
      <ErrorHelp output="Line 1: SyntaxError: invalid syntax" code={'for i in range 4:\n  x'} />
    )
    expect(screen.getByTestId('error-help')).toHaveTextContent('range needs brackets')
    expect(screen.queryByTestId('error-help-rung-0')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Give me a clue' }))
    expect(screen.getByTestId('error-help-rung-0')).toHaveTextContent('Where to look')
    fireEvent.click(screen.getByRole('button', { name: 'Another clue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Another clue' }))
    expect(screen.queryByTestId('error-help-rung-3')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show me the fix' }))
    expect(screen.getByTestId('error-help-rung-3')).toHaveTextContent('range(4)')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders nothing for an error it has no help for', () => {
    const { container } = render(<ErrorHelp output="Line 1: OSError: odd" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows in the output panel only when asked, on a crashed run', () => {
    const props = {
      output: "Line 2: NameError: name 'x' is not defined",
      runStatus: 'error',
      collapsible: false,
    }
    const { rerender } = render(<OutputPanel {...props} />)
    expect(screen.queryByTestId('error-help')).not.toBeInTheDocument()
    rerender(<OutputPanel {...props} errorHelp />)
    expect(screen.getByTestId('error-help')).toHaveTextContent("Python doesn't know the name x")
    rerender(<OutputPanel {...props} errorHelp runStatus="success" />)
    expect(screen.queryByTestId('error-help')).not.toBeInTheDocument()
  })
})
