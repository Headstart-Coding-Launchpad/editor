import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CheckValueEditor } from '../CheckEditors'

describe('CheckValueEditor insertion actions', () => {
  it('uses current output as the output check value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <CheckValueEditor
        check={{ type: 'output_equals', value: '' }}
        subject="output"
        operator="equals"
        output="Hello classroom"
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Use output' }))

    expect(onChange).toHaveBeenCalledWith({ type: 'output_equals', value: 'Hello classroom' })
  })

  it('uses current code as the code check value without writing to the clipboard', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const clipboardWrite = vi.fn()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWrite },
    })

    render(
      <CheckValueEditor
        check={{ type: 'code_equals', value: '' }}
        subject="code"
        operator="equals"
        code={'print("Hello")'}
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Use code' }))

    expect(onChange).toHaveBeenCalledWith({ type: 'code_equals', value: 'print("Hello")' })
    expect(clipboardWrite).not.toHaveBeenCalled()
  })
})
