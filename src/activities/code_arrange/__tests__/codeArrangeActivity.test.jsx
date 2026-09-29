import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TaskEditor from '../../../builder/components/TaskEditor'
import { getTaskFormat } from '../../registry.pure.js'
import { getModuleHostedActivityUi } from '../../registry.js'
import { convertToCodeArrange } from '../codeArrangeBuilder.js'
import definition, { hostModuleFor } from '../definition.js'
import {
  HTML_CODE_ARRANGE_TASK,
  PYTHON_CODE_ARRANGE_TASK,
} from '../../../test/fixtures/legacyActivityTasks.js'

vi.mock('../../../shared/useLessonStorageAssets', () => ({
  useLessonStorageAssets: () => ({ storageAssets: [], loading: false, error: null }),
}))

vi.mock('../../../shared/useTypeAssets', () => ({
  useTypeAssets: () => ({ typeStorageAssets: [], loading: false, error: null }),
}))

// code_arrange on the activity contract (plan 4.9): hosted by the python / html module, so the
// classroom renders its ModuleWorkspace inside the module pipeline. The stored shapes are pinned
// by the Phase 0 characterisation tests; these cover the definition and registry wiring.

describe('code_arrange activity', () => {
  it('exposes the module-hosted surfaces through the UI registry', () => {
    const ui = getModuleHostedActivityUi(PYTHON_CODE_ARRANGE_TASK)
    expect(ui.id).toBe('code_arrange')
    for (const view of ['StudentView', 'ModuleWorkspace', 'TeacherLiveView', 'BuilderEditor']) {
      expect(typeof ui[view], view).toBe('function')
    }
    expect(getModuleHostedActivityUi({ taskType: 'quiz' })).toBeNull()
    expect(getModuleHostedActivityUi({ id: 1, starterCode: '' })).toBeNull()
    expect(getTaskFormat(HTML_CODE_ARRANGE_TASK)).toBe('code_arrange')
  })

  it('reports slot progress without correctness and summarises it for the card', () => {
    const state = { S1: 'S1d1', L2: ' ' }
    expect(definition.getProgress(PYTHON_CODE_ARRANGE_TASK, state)).toEqual({
      kind: 'code_arrange',
      filled: 1,
      total: 2,
      correct: null,
    })
    expect(definition.summarize(PYTHON_CODE_ARRANGE_TASK, state).text).toBe('1/2 slots filled')
    expect(definition.getProgress({ ...PYTHON_CODE_ARRANGE_TASK, lines: [] }, {})).toBeNull()
  })

  it('grades the authored arrangement and prints nothing of its own', () => {
    const solution = definition.solutionState(HTML_CODE_ARRANGE_TASK)
    expect(solution).toEqual({ L1: 'L1', L2: 'L2' })
    expect(definition.grade(HTML_CODE_ARRANGE_TASK, solution).passed).toBe(true)
    expect(definition.grade(HTML_CODE_ARRANGE_TASK, { L1: 'D1', L2: 'L2' }).passed).toBe(false)
    expect(definition.printHtml(HTML_CODE_ARRANGE_TASK, {})).toBe('')
  })

  it('validates with the shared legacy rules, using the host module type', () => {
    expect(definition.validateTask(PYTHON_CODE_ARRANGE_TASK, { n: 8 }).errors).toEqual([])
    expect(
      definition.validateTask({ ...PYTHON_CODE_ARRANGE_TASK, moduleType: undefined }, { n: 8 })
        .errors
    ).toContain('Task 8 is a code-arrange task but must use the Python or HTML module')
    expect(
      definition.validateTask(
        { ...PYTHON_CODE_ARRANGE_TASK, moduleType: undefined },
        { n: 8, moduleType: 'python' }
      ).errors
    ).toEqual([])
  })

  it('renders on a host module, falling back to python', () => {
    expect(hostModuleFor('html')).toBe('html')
    expect(hostModuleFor('python')).toBe('python')
    expect(hostModuleFor('scratch')).toBe('python')
    expect(hostModuleFor(undefined)).toBe('python')
  })

  it('converts a task into the Arrange format keeping an HTML host module', () => {
    const converted = convertToCodeArrange({
      id: 3,
      title: 'Page',
      moduleType: 'html',
      codeStages: [{ role: 'starter' }],
      carryCodeFrom: 1,
    })
    expect(converted).toMatchObject({
      id: 3,
      taskType: 'code_arrange',
      moduleType: 'html',
      entryFile: 'index.html',
      starterFiles: [{ name: 'index.html', type: 'html', content: '' }],
      check: null,
    })
    expect(converted).not.toHaveProperty('codeStages')
    expect(converted).not.toHaveProperty('carryCodeFrom')
    expect(convertToCodeArrange({ id: 4, moduleType: 'turtle' }).moduleType).toBe('python')
  })
})

describe('Builder task format grid', () => {
  const task = { id: 1, title: 'A task', moduleType: 'python', starterCode: 'print(1)' }

  it('offers Arrange in a composed lesson', () => {
    const lesson = { id: 'l', title: 'L', type: 'composed', tasks: [task] }
    render(<TaskEditor task={task} lesson={lesson} onUpdate={vi.fn()} composedLesson={lesson} />)
    expect(screen.getByRole('button', { name: /Arrange/ })).toBeInTheDocument()
  })

  it('does not offer Arrange outside a composed lesson', () => {
    const lesson = { id: 'l', title: 'L', type: 'python', tasks: [task] }
    render(<TaskEditor task={task} lesson={lesson} onUpdate={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Information/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Arrange/ })).toBeNull()
  })
})
