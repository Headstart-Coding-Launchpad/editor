import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CheckEditor from '../CheckEditor.jsx'

// CheckEditor is a controlled component: it calls `onChange(next)` but does not
// hold its own displayed state, so the harness needs to feed the updated
// `checks` back in (matching how the real Builder page re-renders it) for
// interactions to be reflected in the DOM across multiple steps.
function renderCheckEditor(initialChecks) {
  const calls = []
  function Harness() {
    const [checks, setChecks] = useState(initialChecks)
    return (
      <CheckEditor
        checks={checks}
        onChange={next => {
          calls.push(next)
          setChecks(next ?? [])
        }}
      />
    )
  }
  render(<Harness />)
  return calls
}

describe('electronics CheckEditor — generic code checks', () => {
  it('lets an author switch the Subject to Code and produces a { type: "code", operator, value } check', () => {
    const calls = renderCheckEditor([{ type: 'circuit_no_short' }])

    const [subjectSelect] = screen.getAllByRole('combobox')
    fireEvent.change(subjectSelect, { target: { value: 'code' } })

    // Switching subject alone should already default to the "contains" operator.
    expect(calls.at(-1)).toEqual([{ type: 'code', operator: 'contains', value: '' }])

    const valueField = screen.getByPlaceholderText(/String that must be present/)
    fireEvent.change(valueField, { target: { value: 'led.on()' } })

    expect(calls.at(-1)).toEqual([{ type: 'code', operator: 'contains', value: 'led.on()' }])
  })

  it('supports switching to other code operators, including matches_regex with flags', () => {
    const calls = renderCheckEditor([{ type: 'code', operator: 'contains', value: 'Pin(' }])

    const [, , operatorSelect] = screen.getAllByRole('combobox')
    fireEvent.change(operatorSelect, { target: { value: 'matches_regex' } })

    expect(calls.at(-1)).toEqual([{ type: 'code', operator: 'matches_regex', value: 'Pin(' }])

    const flagsField = screen.getByPlaceholderText(/Regex flags/)
    fireEvent.change(flagsField, { target: { value: 'i' } })

    expect(calls.at(-1)).toEqual([{ type: 'code', operator: 'matches_regex', value: 'Pin(', flags: 'i' }])
  })

  it('recognizes the legacy code_contains alias type and shows it as the Code subject with the right value prefilled', () => {
    renderCheckEditor([{ type: 'code_contains', value: 'led.on()' }])

    const [subjectSelect, , operatorSelect] = screen.getAllByRole('combobox')
    expect(subjectSelect.value).toBe('code')
    expect(operatorSelect.value).toBe('contains')
    expect(screen.getByDisplayValue('led.on()')).toBeInTheDocument()
  })

  it('preserves an existing hint when switching the Subject to Code', () => {
    const calls = renderCheckEditor([{ type: 'circuit_no_short', hint: 'Keep it safe.' }])

    const [subjectSelect] = screen.getAllByRole('combobox')
    fireEvent.change(subjectSelect, { target: { value: 'code' } })

    expect(calls.at(-1)).toEqual([{ type: 'code', operator: 'contains', value: '', hint: 'Keep it safe.' }])
  })
})
