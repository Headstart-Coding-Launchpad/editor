import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ActivityLayout, { ActChip, ActSegmented, ActStepper } from '../ui/ActivityLayout.jsx'
import { countControls } from '../../test/countControls.js'

describe('ActivityLayout', () => {
  it('renders every slot', () => {
    render(
      <ActivityLayout
        progress={<p>progress</p>}
        stageTop={<p>top</p>}
        stage={<p>picture</p>}
        result={<p>result</p>}
        action={{ main: { label: 'Train', onClick: () => {} }, link: { label: 'Start again' } }}
        tip="a tip"
        controls={<p>dials</p>}
      />
    )
    for (const text of ['progress', 'top', 'picture', 'result', 'dials', 'a tip']) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Train' })).toHaveClass('act-btn--main')
    expect(screen.getByRole('button', { name: 'Start again' })).toHaveClass('act-link')
    expect(screen.getByTestId('act-layout-result')).toHaveAttribute('aria-live', 'polite')
  })

  it('fires the main action and honours disabled', () => {
    const onClick = vi.fn()
    const { rerender } = render(
      <ActivityLayout action={{ main: { label: 'Go', onClick } }} stage={<p>s</p>} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    rerender(<ActivityLayout action={{ main: { label: 'Go', onClick, disabled: true } }} />)
    expect(screen.getByRole('button', { name: 'Go' })).toBeDisabled()
  })

  it('opens and closes a fold, and leaves out an unrevealed one', () => {
    render(
      <ActivityLayout
        stage={<p>s</p>}
        folds={[
          { id: 'a', title: 'Fold A', summary: 'one', children: <button>inside</button> },
          { id: 'b', title: 'Fold B', revealed: false, children: <p>no</p> },
        ]}
      />
    )
    const head = screen.getByRole('button', { name: /Fold A/ })
    expect(head).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('inside')).not.toBeInTheDocument()
    expect(screen.queryByText('Fold B')).not.toBeInTheDocument()
    fireEvent.click(head)
    expect(head).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('inside')).toBeInTheDocument()
    fireEvent.click(head)
    expect(screen.queryByText('inside')).not.toBeInTheDocument()
  })

  it('can be controlled from outside (openFolds + onFoldToggle)', () => {
    const onFoldToggle = vi.fn()
    render(
      <ActivityLayout
        folds={[{ id: 'a', title: 'Fold A', children: <p>body</p> }]}
        openFolds={{ a: true }}
        onFoldToggle={onFoldToggle}
      />
    )
    expect(screen.getByText('body')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Fold A/ }))
    expect(onFoldToggle).toHaveBeenCalledWith('a', false)
  })

  it('toggles are aria-pressed / radios, apart from action buttons', () => {
    const onChip = vi.fn()
    const onSeg = vi.fn()
    render(
      <>
        <ActChip pressed onClick={onChip}>
          has fur
        </ActChip>
        <ActChip pressed={false}>can fly</ActChip>
        <ActSegmented
          label="View"
          value="a"
          options={[
            { value: 'a', label: 'Map' },
            { value: 'b', label: 'More' },
          ]}
          onChange={onSeg}
        />
      </>
    )
    expect(screen.getByRole('button', { name: /has fur/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'can fly' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: /has fur/ }))
    expect(onChip).toHaveBeenCalled()
    expect(screen.getByRole('radio', { name: /Map/ })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('radio', { name: 'More' }))
    expect(onSeg).toHaveBeenCalledWith('b')
  })

  it('a stepper stays in its range, and counts as one control', () => {
    const onChange = vi.fn()
    const { container } = render(
      <ActStepper name="layers" value={1} min={1} max={2} onChange={onChange} />
    )
    expect(screen.getByRole('button', { name: 'Fewer layers' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'More layers' }))
    expect(onChange).toHaveBeenCalledWith(2)
    expect(countControls(container)).toBe(1)
  })
})
