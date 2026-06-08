import { describe, it, expect } from 'vitest'
import {
  flattenTasks,
  filterTasksByMode,
  getEstimatedMinutes,
  getTotalEstimatedMinutes,
  formatEstimatedMinutes,
  findTaskById,
  findGroupForTask,
  getProgressItems,
  updateTaskInTasks,
  updateSubtaskTitles,
  deriveTaskContext,
  buildStageOptions,
} from '../taskUtils.js'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const task1 = { id: 't1', title: 'Task 1' }
const task2 = { id: 't2', title: 'Task 2' }
const sub1  = { id: 's1', title: 'Group A - 1' }
const sub2  = { id: 's2', title: 'Group A - 2' }
const group = { id: 'g1', type: 'group', title: 'Group A', subtasks: [sub1, sub2] }

// ─── flattenTasks ─────────────────────────────────────────────────────────────

describe('flattenTasks', () => {
  it('returns empty array for null input', () => {
    expect(flattenTasks(null)).toEqual([])
  })

  it('returns empty array for empty array', () => {
    expect(flattenTasks([])).toEqual([])
  })

  it('returns standalone tasks unchanged', () => {
    expect(flattenTasks([task1, task2])).toEqual([task1, task2])
  })

  it('expands group to its subtasks', () => {
    expect(flattenTasks([group])).toEqual([sub1, sub2])
  })

  it('mixes standalone tasks and groups in order', () => {
    expect(flattenTasks([task1, group, task2])).toEqual([task1, sub1, sub2, task2])
  })

  it('handles group with no subtasks property', () => {
    const emptyGroup = { id: 'gx', type: 'group', title: 'Empty' }
    expect(flattenTasks([emptyGroup])).toEqual([])
  })

  it('returns a new array reference', () => {
    const input = [task1]
    const result = flattenTasks(input)
    expect(result).not.toBe(input)
  })
})

describe('estimated task duration helpers', () => {
  it('normalizes positive duration values and ignores missing or invalid values', () => {
    expect(getEstimatedMinutes({ estimatedMinutes: '12' })).toBe(12)
    expect(getEstimatedMinutes({ estimatedMinutes: 2.6 })).toBeNull()
    expect(getEstimatedMinutes({ estimatedMinutes: 0 })).toBeNull()
    expect(getEstimatedMinutes({ estimatedMinutes: 'nope' })).toBeNull()
  })

  it('totals estimates across standalone tasks and grouped subtasks', () => {
    const timedGroup = {
      ...group,
      subtasks: [{ ...sub1, estimatedMinutes: 4 }, { ...sub2, estimatedMinutes: 6 }],
    }
    expect(getTotalEstimatedMinutes([{ ...task1, estimatedMinutes: 5 }, timedGroup, task2])).toBe(15)
  })

  it('formats minute totals for the builder', () => {
    expect(formatEstimatedMinutes(0)).toBe('No estimate')
    expect(formatEstimatedMinutes(15)).toBe('15 min')
    expect(formatEstimatedMinutes(60)).toBe('1 hr')
    expect(formatEstimatedMinutes(75)).toBe('1 hr 15 min')
  })
})

// ─── findTaskById ─────────────────────────────────────────────────────────────

describe('findTaskById', () => {
  it('returns null when tasks is empty', () => {
    expect(findTaskById([], 't1')).toBeNull()
  })

  it('finds a standalone task', () => {
    expect(findTaskById([task1, task2], 't1')).toBe(task1)
  })

  it('finds a subtask inside a group', () => {
    expect(findTaskById([group], 's2')).toBe(sub2)
  })

  it('returns null for an unknown id', () => {
    expect(findTaskById([task1, group], 'zzz')).toBeNull()
  })
})

// ─── findGroupForTask ─────────────────────────────────────────────────────────

describe('findGroupForTask', () => {
  it('returns null when tasks is null', () => {
    expect(findGroupForTask(null, 's1')).toBeNull()
  })

  it('returns null for a standalone task', () => {
    expect(findGroupForTask([task1], 't1')).toBeNull()
  })

  it('returns the group containing the subtask', () => {
    expect(findGroupForTask([task1, group], 's1')).toBe(group)
  })

  it('returns null when id is not in any group', () => {
    expect(findGroupForTask([group], 'zzz')).toBeNull()
  })
})

// ─── getProgressItems ─────────────────────────────────────────────────────────

describe('getProgressItems', () => {
  it('returns empty array for null input', () => {
    expect(getProgressItems(null)).toEqual([])
  })

  it('maps standalone tasks to progress items with single taskId', () => {
    const [item] = getProgressItems([task1])
    expect(item).toEqual({ type: 'task', id: 't1', title: 'Task 1', taskIds: ['t1'] })
  })

  it('maps group to progress item with all subtask ids', () => {
    const [item] = getProgressItems([group])
    expect(item).toEqual({ type: 'group', id: 'g1', title: 'Group A', taskIds: ['s1', 's2'] })
  })

  it('handles group with no subtasks gracefully', () => {
    const emptyGroup = { id: 'gx', type: 'group', title: 'Empty' }
    const [item] = getProgressItems([emptyGroup])
    expect(item.taskIds).toEqual([])
  })
})

// ─── updateTaskInTasks ────────────────────────────────────────────────────────

describe('updateTaskInTasks', () => {
  it('replaces a standalone task by id', () => {
    const updated = { id: 't1', title: 'Updated Task 1' }
    const result = updateTaskInTasks([task1, task2], updated)
    expect(result[0]).toBe(updated)
    expect(result[1]).toBe(task2)
  })

  it('replaces a subtask inside a group', () => {
    const updatedSub = { id: 's1', title: 'New Sub 1' }
    const result = updateTaskInTasks([group], updatedSub)
    expect(result[0].subtasks[0]).toBe(updatedSub)
    expect(result[0].subtasks[1]).toBe(sub2)
  })

  it('leaves unrelated items untouched', () => {
    const updated = { id: 't2', title: 'Updated 2' }
    const result = updateTaskInTasks([task1, task2], updated)
    expect(result[0]).toBe(task1)
  })

  it('returns a new array reference (immutability)', () => {
    const input = [task1]
    const result = updateTaskInTasks(input, { id: 't1', title: 'New' })
    expect(result).not.toBe(input)
  })

  it('returns a new group object when a subtask is updated', () => {
    const updatedSub = { id: 's1', title: 'New Sub 1' }
    const result = updateTaskInTasks([group], updatedSub)
    expect(result[0]).not.toBe(group)
  })
})

// ─── updateSubtaskTitles ──────────────────────────────────────────────────────

describe('updateSubtaskTitles', () => {
  it('returns empty array for null input', () => {
    expect(updateSubtaskTitles(null)).toEqual([])
  })

  it('leaves standalone tasks unchanged', () => {
    const result = updateSubtaskTitles([task1, task2])
    expect(result[0]).toBe(task1)
    expect(result[1]).toBe(task2)
  })

  it('renames subtasks to "GroupTitle - N" format', () => {
    const groupWithWrongTitles = {
      id: 'g2', type: 'group', title: 'My Group',
      subtasks: [
        { id: 'x1', title: 'Wrong' },
        { id: 'x2', title: 'Also Wrong' },
      ],
    }
    const [result] = updateSubtaskTitles([groupWithWrongTitles])
    expect(result.subtasks[0].title).toBe('My Group - 1')
    expect(result.subtasks[1].title).toBe('My Group - 2')
  })

  it('preserves subtask objects whose title is already correct', () => {
    const alreadyCorrect = {
      id: 'g3', type: 'group', title: 'Group A',
      subtasks: [
        { id: 's1', title: 'Group A - 1' },
        { id: 's2', title: 'Group A - 2' },
      ],
    }
    const [result] = updateSubtaskTitles([alreadyCorrect])
    expect(result).toBe(alreadyCorrect)
    expect(result.subtasks[0]).toBe(alreadyCorrect.subtasks[0])
  })

  it('keeps original subtask title when group has no title', () => {
    const untitledGroup = {
      id: 'g4', type: 'group', title: '',
      subtasks: [{ id: 'y1', title: 'Keep Me' }],
    }
    const [result] = updateSubtaskTitles([untitledGroup])
    expect(result.subtasks[0].title).toBe('Keep Me')
  })

  it('leaves subtasks with _customTitle unchanged', () => {
    const g = {
      id: 'g5', type: 'group', title: 'Task',
      subtasks: [{ id: 'c1', title: 'My Custom Name', _customTitle: true }],
    }
    const [result] = updateSubtaskTitles([g])
    expect(result.subtasks[0].title).toBe('My Custom Name')
    expect(result.subtasks[0]).toBe(g.subtasks[0])
  })

  it('numbers default subtasks skipping custom ones', () => {
    const g = {
      id: 'g6', type: 'group', title: 'Task',
      subtasks: [
        { id: 'd1', title: 'Task - 1' },
        { id: 'd2', title: 'My Name', _customTitle: true },
        { id: 'd3', title: 'Task - 2' },
      ],
    }
    const [result] = updateSubtaskTitles([g])
    expect(result.subtasks[0].title).toBe('Task - 1')
    expect(result.subtasks[1].title).toBe('My Name')
    expect(result.subtasks[2].title).toBe('Task - 2')
  })

  it('renumbers default subtasks correctly after a group rename', () => {
    const g = {
      id: 'g7', type: 'group', title: 'NewName',
      subtasks: [
        { id: 'e1', title: 'OldName - 1' },
        { id: 'e2', title: 'Custom', _customTitle: true },
        { id: 'e3', title: 'OldName - 2' },
      ],
    }
    const [result] = updateSubtaskTitles([g])
    expect(result.subtasks[0].title).toBe('NewName - 1')
    expect(result.subtasks[1].title).toBe('Custom')
    expect(result.subtasks[2].title).toBe('NewName - 2')
  })
})

// ─── filterTasksByMode ────────────────────────────────────────────────────────

describe('filterTasksByMode', () => {
  const both = { id: 1, title: 'Both' }
  const liveOnly = { id: 2, title: 'Live', taskMode: 'live' }
  const soloOnly = { id: 3, title: 'Solo', taskMode: 'solo' }
  const explicit = { id: 4, title: 'Explicit Both', taskMode: 'both' }

  it('returns all tasks when mode is null', () => {
    const tasks = [both, liveOnly, soloOnly]
    expect(filterTasksByMode(tasks, null)).toBe(tasks)
  })

  it('returns empty array for null tasks', () => {
    expect(filterTasksByMode(null, 'live')).toEqual([])
  })

  it('includes tasks with no taskMode in both modes', () => {
    expect(filterTasksByMode([both], 'live')).toEqual([both])
    expect(filterTasksByMode([both], 'solo')).toEqual([both])
  })

  it('includes tasks with taskMode "both" in both modes', () => {
    expect(filterTasksByMode([explicit], 'live')).toEqual([explicit])
    expect(filterTasksByMode([explicit], 'solo')).toEqual([explicit])
  })

  it('includes live-only tasks in live mode only', () => {
    expect(filterTasksByMode([liveOnly], 'live')).toEqual([liveOnly])
    expect(filterTasksByMode([liveOnly], 'solo')).toEqual([])
  })

  it('includes solo-only tasks in solo mode only', () => {
    expect(filterTasksByMode([soloOnly], 'solo')).toEqual([soloOnly])
    expect(filterTasksByMode([soloOnly], 'live')).toEqual([])
  })

  it('filters a mixed task list correctly for live mode', () => {
    const result = filterTasksByMode([both, liveOnly, soloOnly], 'live')
    expect(result.map(t => t.id)).toEqual([1, 2])
  })

  it('filters a mixed task list correctly for solo mode', () => {
    const result = filterTasksByMode([both, liveOnly, soloOnly], 'solo')
    expect(result.map(t => t.id)).toEqual([1, 3])
  })

  it('keeps group when some subtasks pass the filter', () => {
    const g = { id: 'g1', type: 'group', title: 'G', subtasks: [both, liveOnly, soloOnly] }
    const [result] = filterTasksByMode([g], 'live')
    expect(result.subtasks.map(t => t.id)).toEqual([1, 2])
  })

  it('drops a group when all its subtasks are filtered out', () => {
    const g = { id: 'g1', type: 'group', title: 'G', subtasks: [soloOnly] }
    expect(filterTasksByMode([g], 'live')).toEqual([])
  })

  it('returns a new group object when subtasks are filtered', () => {
    const g = { id: 'g1', type: 'group', title: 'G', subtasks: [both, liveOnly] }
    const [result] = filterTasksByMode([g], 'live')
    expect(result).not.toBe(g)
  })
})

// ─── deriveTaskContext ────────────────────────────────────────────────────────

describe('deriveTaskContext', () => {
  it('identifies python lessons', () => {
    const ctx = deriveTaskContext({ type: 'python' }, {})
    expect(ctx).toMatchObject({ isPython: true, isScratch: false, isFilesystem: false, isHtml: false })
  })

  it('identifies scratch lessons', () => {
    const ctx = deriveTaskContext({ type: 'scratch' }, {})
    expect(ctx).toMatchObject({ isPython: false, isScratch: true, isFilesystem: false, isHtml: false })
  })

  it('identifies filesystem lessons', () => {
    const ctx = deriveTaskContext({ type: 'filesystem' }, {})
    expect(ctx).toMatchObject({ isPython: false, isScratch: false, isFilesystem: true, isHtml: false })
  })

  it('treats html (and unknown) lesson types as isHtml', () => {
    const ctx = deriveTaskContext({ type: 'html' }, {})
    expect(ctx).toMatchObject({ isPython: false, isScratch: false, isFilesystem: false, isHtml: true })
  })

  it('identifies quiz task type', () => {
    const ctx = deriveTaskContext({ type: 'python' }, { taskType: 'quiz' })
    expect(ctx).toMatchObject({ isQuiz: true, isInformation: false })
  })

  it('identifies information task type', () => {
    const ctx = deriveTaskContext({ type: 'python' }, { taskType: 'information' })
    expect(ctx).toMatchObject({ isQuiz: false, isInformation: true })
  })

  it('returns false for both quiz flags when task has no taskType', () => {
    const ctx = deriveTaskContext({ type: 'python' }, { taskType: 'code' })
    expect(ctx).toMatchObject({ isQuiz: false, isInformation: false })
  })

  it('handles null lesson and task gracefully', () => {
    const ctx = deriveTaskContext(null, null)
    expect(ctx).toEqual({ isPython: false, isScratch: false, isFilesystem: false, isHtml: true, isQuiz: false, isInformation: false })
  })
})

// ─── buildStageOptions ────────────────────────────────────────────────────────

describe('buildStageOptions', () => {
  it('returns [starter] when task has no stages and no complete', () => {
    const opts = buildStageOptions({ codeStages: [] }, 'python')
    expect(opts).toEqual([{ value: 'starter', label: 'Starter code' }])
  })

  it('uses scratch labels for scratch lessons', () => {
    const opts = buildStageOptions({ completeBlocks: 'x' }, 'scratch')
    expect(opts[0].label).toBe('Starter blocks')
    expect(opts[opts.length - 1].label).toBe('Complete blocks')
  })

  it('uses filesystem labels for filesystem lessons', () => {
    const opts = buildStageOptions({ completeFs: {} }, 'filesystem')
    expect(opts[0].label).toBe('Starter folders')
    expect(opts[opts.length - 1].label).toBe('Complete folders')
  })

  it('uses code labels for python lessons', () => {
    const opts = buildStageOptions({ completeCode: 'x' }, 'python')
    expect(opts[0].label).toBe('Starter code')
    expect(opts[opts.length - 1].label).toBe('Complete code')
  })

  it('includes intermediate stages with custom labels', () => {
    const task = { codeStages: [{ label: 'My Stage' }, {}] }
    const opts = buildStageOptions(task, 'python')
    expect(opts[1]).toEqual({ value: 'stage_0', label: 'My Stage' })
    expect(opts[2]).toEqual({ value: 'stage_1', label: 'Stage 2' })
  })

  it('falls back to "Stage N" when stage has no label', () => {
    const opts = buildStageOptions({ codeStages: [{}] }, 'python')
    expect(opts[1].label).toBe('Stage 1')
  })

  it('does not append complete option when task has no complete content', () => {
    const opts = buildStageOptions({ completeCode: '' }, 'python')
    expect(opts.every(o => o.value !== 'complete')).toBe(true)
  })

  it('appends complete option when html task has completeFiles', () => {
    const task = { completeFiles: [{ name: 'index.html', content: '' }] }
    const opts = buildStageOptions(task, 'html')
    expect(opts[opts.length - 1]).toEqual({ value: 'complete', label: 'Complete code' })
  })

  it('returns only [starter] for quiz tasks regardless of other fields', () => {
    const task = { taskType: 'quiz', completeCode: 'x', codeStages: [{}] }
    const opts = buildStageOptions(task, 'python')
    expect(opts).toEqual([{ value: 'starter', label: 'Starter code' }])
  })

  it('handles null task gracefully', () => {
    const opts = buildStageOptions(null, 'python')
    expect(opts).toEqual([{ value: 'starter', label: 'Starter code' }])
  })
})
