import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TaskOptionsSection from '../TaskOptionsSection'

// Only the "Highlight a control" field is under test; the heavier siblings are stubbed.
vi.mock('../TaskEditorFields', () => ({
  Field: ({ label, children }) => (
    <div>
      <span>{label}</span>
      {children}
    </div>
  ),
  CarryThroughPicker: () => null,
}))
vi.mock('../CheckEditors', () => ({ CheckListEditor: () => null }))
vi.mock('../TestsEditor', () => ({ default: () => null }))
vi.mock('../SideQuestsEditor', () => ({ default: () => null }))
vi.mock('../CrossLessonCarryField', () => ({ default: () => null }))
vi.mock('../InspectorField', () => ({ default: () => null }))
vi.mock('../../../../modules/registry', () => ({ getLessonModule: () => null }))

function open(task) {
  render(
    <TaskOptionsSection
      task={{ id: 1, title: 'T', taskType: 'code', ...task }}
      lesson={{ id: 'l', type: 'python', tasks: [] }}
      onUpdate={vi.fn()}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: /Task options/ }))
  return screen.getByRole('combobox', { name: 'Highlight a control' })
}

describe('TaskOptionsSection highlight select: Python keys (request #126)', () => {
  it('groups the keys under "Keys (touch screens)", apart from Run and Stop', () => {
    const select = open({})
    const group = within(select).getByRole('group', { name: 'Keys (touch screens)' })
    expect(within(group).getByRole('option', { name: '(' })).toHaveValue('key:(')
    expect(within(group).queryByRole('option', { name: 'Run button' })).toBeNull()
    expect(within(select).getByRole('option', { name: 'Run button' })).toBeInTheDocument()
  })

  it('notes that a key target only shows on touch screens', () => {
    open({ highlight: 'key:(' })
    expect(screen.getByTestId('highlight-touch-note')).toHaveTextContent(/touch screens \(iPad\)/)
  })

  it('has no touch note for Run', () => {
    open({ highlight: 'run' })
    expect(screen.queryByTestId('highlight-touch-note')).toBeNull()
  })
})
