import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import {
  ACTIVITY_IDS,
  activityIdForYamlType,
  allowsStudentBroadcast,
  getActivityDefinition,
  getActivityDefinitions,
  getModuleHostedActivity,
  getTaskActivity,
  isHostedActivityTask,
} from '../registry.pure.js'
import { getActivityId, isActivityTask, UNKNOWN_ACTIVITY_ID } from '../resolve.js'
import { defineActivity } from '../defineActivity.js'

// Contract tests every activity must pass. A new activity only needs its folder and one import
// line in registry.pure.js; these tests fail if either is missing or the contract is broken.

const activitiesDir = path.resolve(__dirname, '..')
const root = path.resolve(activitiesDir, '../..')

const definitionFolders = readdirSync(activitiesDir, { withFileTypes: true })
  .filter(
    (entry) => entry.isDirectory() && entry.name !== '__tests__' && !entry.name.startsWith('_')
  )
  .filter((entry) => existsSync(path.join(activitiesDir, entry.name, 'definition.js')))
  .map((entry) => entry.name)

describe('activity registry', () => {
  it('registers every activity folder that has a definition.js', () => {
    for (const folder of definitionFolders) {
      expect(
        getActivityDefinition(folder),
        `${folder} is not imported in registry.pure.js`
      ).not.toBeNull()
    }
  })

  it('keeps the unknown fallback out of the author-facing list', () => {
    expect(ACTIVITY_IDS).not.toContain(UNKNOWN_ACTIVITY_ID)
    expect(getActivityDefinitions().map((a) => a.id)).toEqual([...ACTIVITY_IDS])
  })

  it('maps YAML type shorthands to activity ids', () => {
    expect(activityIdForYamlType('binary')).toBe('binary')
    expect(activityIdForYamlType('nope')).toBeNull()
  })
})

describe.each(getActivityDefinitions().map((a) => [a.id, a]))('activity %s', (id, activity) => {
  const task = { id: 1, title: 'Example', ...activity.defaultTask({ id: 1, title: 'Example' }) }

  it('resolves its default task back to itself', () => {
    expect(getTaskActivity(task)?.id).toBe(id)
  })

  it('produces a default task that passes its own validation', () => {
    expect(activity.validateTask(task, { n: 1 }).errors).toEqual([])
  })

  it('round-trips its initial state through serialize/deserialize', () => {
    const state = activity.initialState(task)
    expect(activity.deserialize(activity.serialize(state), task)).toEqual(state)
    // A free-text answer (short answer) accepts any string, so nothing is malformed for it.
    if (id !== 'quiz_short_answer') expect(activity.deserialize('{not json', task)).toEqual(state)
    expect(activity.deserialize('', task)).toEqual(state)
  })

  it('round-trips its solution state', () => {
    if (!activity.solutionState) return
    const solution = activity.solutionState(task)
    expect(activity.deserialize(activity.serialize(solution), task)).toEqual(solution)
  })

  it('keeps serialised state small enough for the live answer field', () => {
    const solution = activity.solutionState?.(task) ?? activity.initialState(task)
    expect(activity.serialize(solution).length).toBeLessThan(2048)
  })

  it('grades its solution as passed and its initial state as not passed', () => {
    if (!activity.isGraded(task) || !activity.solutionState) return
    expect(activity.grade(task, activity.solutionState(task)).passed).toBe(true)
    expect(activity.grade(task, activity.initialState(task)).passed).toBe(false)
  })

  it('keeps definition.js free of JSX and UI imports', () => {
    const source = readFileSync(path.join(activitiesDir, id, 'definition.js'), 'utf8')
    expect(source).not.toMatch(/from ['"][^'"]+\.jsx['"]/)
    expect(source).not.toMatch(/from ['"]react['"]/)
  })
})

describe('resolve', () => {
  it('maps legacy and new task shapes to activity ids', () => {
    expect(getActivityId({ taskType: 'quiz' })).toBe('quiz_multiple_choice')
    expect(getActivityId({ taskType: 'quiz', quizType: 'match' })).toBe('quiz_match')
    expect(getActivityId({ taskType: 'code_arrange' })).toBe('code_arrange')
    expect(getActivityId({ taskType: 'activity', activityType: 'binary' })).toBe('binary')
    expect(getActivityId({ taskType: 'activity' })).toBe(UNKNOWN_ACTIVITY_ID)
    expect(getActivityId({ taskType: 'information' })).toBeNull()
    expect(getActivityId({})).toBeNull()
    expect(isActivityTask({ taskType: 'activity', activityType: 'binary' })).toBe(true)
  })

  it('falls back safely for an activity this bundle does not know', () => {
    const activity = getTaskActivity({ taskType: 'activity', activityType: 'teleport' })
    expect(activity.id).toBe(UNKNOWN_ACTIVITY_ID)
    expect(activity.isGraded()).toBe(false)
    expect(activity.validateTask({ activityType: 'teleport' }, { n: 2 }).errors[0]).toMatch(
      /Task 2: unknown activityType "teleport"/
    )
  })

  it('claims legacy quiz and code_arrange tasks', () => {
    expect(getTaskActivity({ taskType: 'quiz', quizType: 'match' })?.id).toBe('quiz_match')
    expect(getTaskActivity({ taskType: 'quiz' })?.id).toBe('quiz_multiple_choice')
    expect(getTaskActivity({ taskType: 'quiz', quizType: 'poll' })?.id).toBe(UNKNOWN_ACTIVITY_ID)
    expect(getTaskActivity({ taskType: 'code_arrange' })?.id).toBe('code_arrange')
    expect(getTaskActivity({ taskType: 'information' })).toBeNull()
  })

  // code_arrange is the one activity hosted by workspace modules (plan 4.9): its program runs
  // through the python / html module, so it keeps the legacy storage, live channel and report
  // shape instead of the activity defaults, and is not an ActivityHost task.
  it('keeps code_arrange on its stored shape, hosted by the python and html modules', () => {
    const activity = getActivityDefinition('code_arrange')
    const task = { taskType: 'code_arrange', moduleType: 'python' }
    expect(activity.legacy).toEqual({ taskType: 'code_arrange' })
    expect(activity.hostModules).toEqual(['python', 'html'])
    expect(activity.storage).toEqual({ persist: true, filename: '__code_arrange_slots__' })
    expect(activity.liveChannel).toBe('codeArrangeSlots')
    expect(activity.report.typeFields(task)).toEqual({ taskType: 'code' })
    expect(getModuleHostedActivity(task)?.id).toBe('code_arrange')
    expect(isHostedActivityTask(task)).toBe(false)
    expect(getModuleHostedActivity({ taskType: 'quiz' })).toBeNull()
    expect(allowsStudentBroadcast(task)).toBe(true)
    expect(activity.availableIn({ type: 'composed' })).toBe(true)
    expect(activity.availableIn({ type: 'python' })).toBe(false)
    expect(activityIdForYamlType('code_arrange')).toBeNull()
  })

  it('reads and writes the code_arrange slot map exactly as stored', () => {
    const activity = getActivityDefinition('code_arrange')
    expect(activity.serialize({ S1: 'S1d1', L2: 'L2' })).toBe('{"S1":"S1d1","L2":"L2"}')
    expect(activity.deserialize('{"S1":"S1"}')).toEqual({ S1: 'S1' })
    // The RTDB mirror (currentCodeArrangeSlots) is already an object.
    expect(activity.deserialize({ S1: 'S1' })).toEqual({ S1: 'S1' })
    for (const bad of ['null', '[1]', '"x"', '{nope', undefined, null]) {
      expect(activity.deserialize(bad)).toEqual({})
    }
  })

  it('keeps each legacy quiz sub-type on its stored shape', () => {
    for (const quizType of [
      'multiple_choice',
      'match',
      'fill_blank',
      'short_answer',
      'confidence',
    ]) {
      const activity = getActivityDefinition(`quiz_${quizType}`)
      expect(activity.legacy).toEqual({ taskType: 'quiz', quizType })
      expect(activity.report.typeFields({})).toEqual({ taskType: 'quiz', quizType })
      expect(activity.storage).toEqual({ persist: true, filename: '__activity_state__' })
      expect(activity.liveChannel).toBe('answer')
      expect(activityIdForYamlType('quiz')).toBeNull()
    }
  })
})

describe('defineActivity', () => {
  const minimal = {
    id: 'demo',
    label: 'Demo',
    category: 'computing',
    defaultTask: () => ({}),
    validateTask: () => ({ errors: [], warnings: [] }),
    initialState: () => ({}),
    grade: () => ({ passed: true }),
  }

  it('fills defaults matching the existing storage and live formats', () => {
    const activity = defineActivity(minimal)
    expect(activity.storage).toEqual({ persist: true, filename: '__activity_state__' })
    expect(activity.liveChannel).toBe('answer')
    expect(activity.report.typeFields()).toEqual({ taskType: 'activity', activityType: 'demo' })
  })

  it('rejects malformed definitions', () => {
    expect(() => defineActivity({ ...minimal, id: 'Bad Id' })).toThrow(/lowercase identifier/)
    expect(() => defineActivity({ ...minimal, category: 'games' })).toThrow(/category/)
    expect(() => defineActivity({ ...minimal, grade: undefined })).toThrow(/"grade"/)
    expect(() => defineActivity({ ...minimal, completion: 'later' })).toThrow(/completion/)
  })
})

describe('Node ESM', () => {
  it('loads the pure registry in a real Node process', () => {
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', "await import('./src/activities/registry.pure.js')"],
      { cwd: root, encoding: 'utf8' }
    )
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
  })
})
