import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  getGalleryActivityDefinitions,
  getQuizActivityDefinitions,
  getTaskFormat,
  yamlTypeForActivityTask,
} from '../registry.pure.js'
import { getActivityUi } from '../registry.js'
import { buildPrintHtml } from '../../builder/printLesson.js'
import { convertTaskToActivity, commonTaskFields } from '../../builder/taskFormat.js'
import TaskList from '../../builder/components/TaskList.jsx'
import binary from '../binary/definition.js'
import keyboard from '../keyboard/definition.js'
import mouse from '../mouse/definition.js'

describe('registry helpers for the Builder (plan 2.4)', () => {
  it('splits quizzes (picker) from activities (gallery)', () => {
    expect(getQuizActivityDefinitions().map((d) => d.legacy.quizType)).toEqual([
      'multiple_choice',
      'match',
      'fill_blank',
      'short_answer',
      'confidence',
      'poll',
    ])
    expect(getGalleryActivityDefinitions().map((d) => d.id)).toEqual([
      'binary',
      'keyboard',
      'mouse',
    ])
  })

  it('every activity has a BuilderEditor, and every quiz converts itself', () => {
    for (const definition of [
      ...getQuizActivityDefinitions(),
      ...getGalleryActivityDefinitions(),
    ]) {
      expect(typeof getActivityUi(definition.id).BuilderEditor).toBe('function')
    }
    for (const definition of getQuizActivityDefinitions()) {
      expect(typeof getActivityUi(definition.id).builderConvert).toBe('function')
    }
  })

  it('classifies stored tasks into Builder formats', () => {
    expect(getTaskFormat({ id: 1 })).toBe('code')
    expect(getTaskFormat({ taskType: 'information' })).toBe('information')
    expect(getTaskFormat({ taskType: 'draft' })).toBe('draft')
    expect(getTaskFormat({ taskType: 'quiz' })).toBe('quiz')
    expect(getTaskFormat({ taskType: 'quiz', quizType: 'nope' })).toBe('activity')
    expect(getTaskFormat({ taskType: 'code_arrange' })).toBe('code_arrange')
    expect(getTaskFormat({ taskType: 'activity', activityType: 'binary' })).toBe('activity')
    expect(getTaskFormat({ taskType: 'activity', activityType: 'morse' })).toBe('activity')
  })

  it('names the YAML shorthand only for known, non-quiz activities', () => {
    expect(yamlTypeForActivityTask({ taskType: 'activity', activityType: 'mouse' })).toBe('mouse')
    expect(yamlTypeForActivityTask({ taskType: 'activity', activityType: 'morse' })).toBeNull()
    expect(yamlTypeForActivityTask({ taskType: 'quiz', quizType: 'match' })).toBeNull()
  })

  it('converts a task to an activity from its defaultTask, keeping the common fields', () => {
    const task = {
      id: 3,
      title: 'T',
      intent: 'why',
      priority: 'optional',
      starterCode: 'x',
      options: [],
    }
    const next = convertTaskToActivity(task, keyboard)
    expect(next).toMatchObject({
      id: 3,
      title: 'T',
      intent: 'why',
      priority: 'optional',
      taskType: 'activity',
      activityType: 'keyboard',
    })
    expect(next.starterCode).toBeUndefined()
    expect(next.options).toBeUndefined()
    expect(next.description).toBeUndefined()
    expect(commonTaskFields({ id: 1, title: 'a', mode: 'x' })).toEqual({ id: 1, title: 'a' })
  })
})

describe('printing activity tasks', () => {
  const lesson = {
    id: 'print',
    title: 'Print',
    type: 'python',
    tasks: [
      {
        ...binary.defaultTask({ id: 1, title: 'Bits' }),
        description: 'Toggle the bits.',
        bits: 4,
        items: [{ id: 'a', target: 5 }],
      },
      {
        ...keyboard.defaultTask({ id: 2, title: 'Keys' }),
        mode: 'shortcuts',
        items: [{ id: 'a', combo: 'Ctrl+C', prompt: 'Copy a word' }],
      },
      mouse.defaultTask({ id: 3, title: 'Mouse' }),
    ],
  }
  const html = buildPrintHtml(lesson)

  it('names each activity, prints its description and its items', () => {
    expect(html).toContain('<span class="badge">Binary</span>')
    expect(html).toContain('<span class="badge">Keyboard skills</span>')
    expect(html).toContain('<span class="badge">Mouse skills</span>')
    expect(html).toContain('Toggle the bits.')
    expect(html).toContain('Make 5 with 4 bits <em>(answer: 0101)</em>')
    expect(html).toContain('<code>Ctrl+C</code> — Copy a word')
    expect(html).toContain('<li>Click the star</li>')
    expect(html).toContain('<li>Drag the star to the box</li>')
  })
})

describe('TaskList icons', () => {
  it('uses the registry icon and label for activities and quizzes', () => {
    const tasks = [
      binary.defaultTask({ id: 1, title: 'Bits' }),
      { id: 2, title: 'Pick', taskType: 'quiz', quizType: 'match' },
      { id: 3, title: 'Code' },
    ]
    render(
      <TaskList
        tasks={tasks}
        selectedTaskId={null}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onAddGroup={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onReorder={vi.fn()}
      />
    )
    expect(screen.getByTitle('Binary activity')).toHaveTextContent('🔢')
    expect(screen.getByTitle('Match quiz')).toBeInTheDocument()
    expect(screen.getByTitle('code task')).toBeInTheDocument()
  })
})
