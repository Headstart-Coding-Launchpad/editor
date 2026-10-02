import React, { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import BadgeHintsField from '../BadgeHintsField'
import { patternBadgesFor, toggleBadgeHint } from '../../../badgeHints'
import { getHintableBadges, getRuleBackedBadges } from '../../../../badges/registry'
import { normalizeTasksForExport } from '../../../lessonUtils'
import { validateLessonCore } from '../../../../shared/lessonValidation.js'
import { lessonToYamlText, parseYamlLesson } from '../../../../../cli/yaml-converter.mjs'

const baseTask = {
  id: 1,
  title: 'Fix it',
  taskActivity: 'Code Task, Copy the Code',
  starterCode: 'x = 1',
  check: { type: 'code_contains', value: 'x' },
}

// A stand-in for TaskEditor's state: the field's onChange replaces the task's badgeHints, and an
// empty value removes the key (TaskEditor's setBadgeHints).
function Harness({ initial, onTask }) {
  const [task, setTask] = useState(initial)
  return (
    <BadgeHintsField
      task={task}
      onChange={(badgeHints) => {
        const { badgeHints: _old, ...rest } = task
        const next = badgeHints ? { ...rest, badgeHints } : rest
        setTask(next)
        onTask(next)
      }}
    />
  )
}

describe('BadgeHintsField', () => {
  it('offers only the ids lesson validation accepts', () => {
    render(<BadgeHintsField task={baseTask} onChange={vi.fn()} />)
    const suggest = screen.getByRole('group', { name: 'Also suggest' })
    const suppress = screen.getByRole('group', { name: 'Never suggest' })
    expect(within(suggest).getAllByRole('button')).toHaveLength(getHintableBadges().length)
    expect(within(suppress).getAllByRole('button')).toHaveLength(getRuleBackedBadges().length)
    expect(within(suggest).queryByRole('button', { name: /Code Fixer/ })).not.toBeInTheDocument()
    expect(within(suppress).queryByRole('button', { name: /Great Question/ })).toBeNull()
  })

  it("shows which badges the task's activity pattern triggers", () => {
    const { rerender } = render(<BadgeHintsField task={baseTask} onChange={vi.fn()} />)
    expect(screen.getByTestId('badge-hints-pattern')).toHaveTextContent('📋 Code Builder')
    rerender(
      <BadgeHintsField task={{ ...baseTask, taskActivity: 'Code Task' }} onChange={vi.fn()} />
    )
    expect(screen.getByTestId('badge-hints-pattern')).toHaveTextContent('no pattern badge')
    expect(patternBadgesFor({ taskActivity: 'Code Task, Debug Code Task' })).toEqual(['bug_hunter'])
    expect(patternBadgesFor({ taskType: 'code_arrange' })).toEqual(['code_arranger'])
  })

  it('edits suggest and suppress, and round-trips through export, validation and YAML', async () => {
    const user = userEvent.setup()
    const onTask = vi.fn()
    render(<Harness initial={baseTask} onTask={onTask} />)
    const suggest = screen.getByRole('group', { name: 'Also suggest' })
    const suppress = screen.getByRole('group', { name: 'Never suggest' })
    await user.click(within(suggest).getByRole('button', { name: /Bug Hunter/ }))
    await user.click(within(suppress).getByRole('button', { name: /Code Fixer/ }))
    expect(within(suggest).getByRole('button', { name: /Bug Hunter/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    const task = onTask.mock.lastCall[0]
    expect(task.badgeHints).toEqual({ suggest: ['bug_hunter'], suppress: ['code_fixer'] })

    const lesson = {
      id: 'hints',
      type: 'python',
      title: 'Hints',
      tasks: normalizeTasksForExport([task]),
    }
    expect(lesson.tasks[0].badgeHints).toEqual(task.badgeHints)
    expect(validateLessonCore(lesson).errors).toEqual([])
    const parsed = parseYamlLesson(lessonToYamlText(lesson))
    expect(parsed.tasks[0].badgeHints).toEqual(task.badgeHints)

    // Clearing both lists removes the key.
    await user.click(within(suggest).getByRole('button', { name: /Bug Hunter/ }))
    await user.click(within(suppress).getByRole('button', { name: /Code Fixer/ }))
    expect(onTask.mock.lastCall[0]).not.toHaveProperty('badgeHints')
  })
})

describe('toggleBadgeHint', () => {
  it('keeps a badge in one list at most', () => {
    const hints = toggleBadgeHint({ suggest: ['bug_hunter'] }, 'suppress', 'bug_hunter')
    expect(hints).toEqual({ suppress: ['bug_hunter'] })
    expect(toggleBadgeHint(hints, 'suppress', 'bug_hunter')).toBeUndefined()
  })
})
