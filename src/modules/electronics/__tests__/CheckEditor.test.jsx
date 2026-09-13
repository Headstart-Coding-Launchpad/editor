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
        onChange={(next) => {
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

    expect(calls.at(-1)).toEqual([
      { type: 'code', operator: 'matches_regex', value: 'Pin(', flags: 'i' },
    ])
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

    expect(calls.at(-1)).toEqual([
      { type: 'code', operator: 'contains', value: '', hint: 'Keep it safe.' },
    ])
  })
})

describe('electronics CheckEditor — pin options for newer component types', () => {
  it("offers a sensor's real pins (positive/signal/negative) instead of falling back to a/b", () => {
    renderCheckEditor([
      {
        type: 'circuit_path_exists',
        from: { type: 'sensor', pin: 'signal' },
        to: { type: 'motor', pin: 'positive' },
      },
    ])

    const pinSelect = screen.getByDisplayValue('signal')
    const optionValues = Array.from(pinSelect.querySelectorAll('option')).map((o) => o.value)
    expect(optionValues).toEqual(['positive', 'signal', 'negative'])
  })

  it('defaults to the real first pin (not "a") when switching an endpoint to a newer component type', () => {
    const calls = renderCheckEditor([
      {
        type: 'circuit_path_exists',
        from: { type: 'battery', pin: 'positive' },
        to: { type: 'motor', pin: 'positive' },
      },
    ])

    const typeSelects = screen
      .getAllByRole('combobox')
      .filter((el) => Array.from(el.options).some((o) => o.value === 'sensor'))
    fireEvent.change(typeSelects[0], { target: { value: 'sensor' } })

    expect(calls.at(-1)[0].from).toEqual({ type: 'sensor', pin: 'positive' })
  })

  it('includes transistor as a selectable control type, matching controlAffectsComponentPower in circuit.js', () => {
    renderCheckEditor([
      {
        type: 'circuit_control_affects_power',
        control: { type: 'slide_switch' },
        component: { type: 'motor' },
      },
    ])

    const controlTypeSelect = screen
      .getAllByRole('combobox')
      .find((el) => Array.from(el.options).some((o) => o.value === 'transistor'))
    expect(controlTypeSelect).toBeDefined()
  })
})
