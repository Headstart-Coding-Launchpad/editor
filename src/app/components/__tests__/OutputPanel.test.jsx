import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import OutputPanel from '../OutputPanel'

describe('OutputPanel input prompt focus', () => {
  it('focuses the input when a non-collapsible output panel shows a prompt', () => {
    render(
      <OutputPanel output="Name?" inputPrompt="Name?" onInputSubmit={vi.fn()} collapsible={false} />
    )

    expect(screen.getByPlaceholderText('Type your input…')).toHaveFocus()
  })

  it('focuses the input when an expanded collapsible output panel shows a prompt', async () => {
    const user = userEvent.setup()

    render(
      <OutputPanel
        output="Name?"
        inputPrompt="Name?"
        onInputSubmit={vi.fn()}
        collapsible
        defaultCollapsed
      />
    )

    await user.click(screen.getByText('Output'))

    expect(screen.getByPlaceholderText('Type your input…')).toHaveFocus()
  })

  it('submits the typed value when the submit button is tapped, not just on Enter', async () => {
    const user = userEvent.setup()
    const onInputSubmit = vi.fn()

    render(
      <OutputPanel output="Name?" inputPrompt="Name?" onInputSubmit={onInputSubmit} collapsible={false} />
    )

    await user.type(screen.getByPlaceholderText('Type your input…'), 'Jamie')
    await user.click(screen.getByRole('button', { name: 'Submit input' }))

    expect(onInputSubmit).toHaveBeenCalledWith('Jamie')
  })

  it('still submits on Enter (the button supplements it, does not replace it)', async () => {
    const user = userEvent.setup()
    const onInputSubmit = vi.fn()

    render(
      <OutputPanel output="Name?" inputPrompt="Name?" onInputSubmit={onInputSubmit} collapsible={false} />
    )

    await user.type(screen.getByPlaceholderText('Type your input…'), 'Jamie{Enter}')

    expect(onInputSubmit).toHaveBeenCalledWith('Jamie')
  })

  it('calls onInputChange with each keystroke, alongside local state', async () => {
    const user = userEvent.setup()
    const onInputChange = vi.fn()

    render(
      <OutputPanel
        output="Name?"
        inputPrompt="Name?"
        onInputSubmit={vi.fn()}
        onInputChange={onInputChange}
        collapsible={false}
      />
    )

    await user.type(screen.getByPlaceholderText('Type your input…'), 'Jo')

    expect(onInputChange).toHaveBeenCalledWith('J')
    expect(onInputChange).toHaveBeenLastCalledWith('Jo')
  })

  describe('inputReadOnly mirror mode', () => {
    it('shows the mirrored value as plain text, not an editable input', () => {
      render(
        <OutputPanel
          output="Name?"
          inputPrompt="Name?"
          inputReadOnly
          mirroredInputValue="Jam"
          collapsible={false}
        />
      )

      expect(screen.getByText('Jam')).toBeInTheDocument()
      expect(screen.queryByPlaceholderText('Type your input…')).not.toBeInTheDocument()
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })

    it('updates as the mirrored value changes across renders', () => {
      const { rerender } = render(
        <OutputPanel
          output="Name?"
          inputPrompt="Name?"
          inputReadOnly
          mirroredInputValue="Ja"
          collapsible={false}
        />
      )
      expect(screen.getByText('Ja')).toBeInTheDocument()

      rerender(
        <OutputPanel
          output="Name?"
          inputPrompt="Name?"
          inputReadOnly
          mirroredInputValue="Jamie"
          collapsible={false}
        />
      )
      expect(screen.getByText('Jamie')).toBeInTheDocument()
    })
  })

  it('can stay closed while running and only open when output arrives', async () => {
    const { rerender } = render(
      <OutputPanel title="Console" running={false} openOnRun={false} openOnOutput />
    )

    rerender(<OutputPanel title="Console" running openOnRun={false} openOnOutput />)
    expect(screen.getByText('Show')).toBeInTheDocument()

    rerender(
      <OutputPanel
        title="Console"
        running
        openOnRun={false}
        openOnOutput
        output="Hello from the game\n"
      />
    )
    await waitFor(() => expect(screen.getByText('Hide')).toBeInTheDocument())
  })
})
