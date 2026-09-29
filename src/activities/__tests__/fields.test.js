import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { getActivityDefinitions } from '../registry.pure.js'
import { fieldsForMode } from '../../shared/fieldSpec.js'

// Activity `fields` declarations (defineActivity) are what `lessons capabilities` tells lesson
// agents. These tests keep them honest against validateTask and the authoring docs.

const definitions = getActivityDefinitions()

function errorsOf(def, task) {
  const result = def.validateTask(task, { n: 1, moduleType: task.moduleType })
  return Array.isArray(result) ? result : (result?.errors ?? [])
}

// Declared required (the docs say so and the Builder always sets them) but validateTask doesn't
// check them yet. Remove an entry when its validation lands.
const NOT_YET_VALIDATED = new Set([
  'quiz_multiple_choice.options[].id',
  'quiz_match.pairs[].id',
  'quiz_fill_blank.blanks[].id',
  'quiz_fill_blank.distractors[].text',
])

function baseTask(def) {
  return def.defaultTask({ id: 1, title: 'Task', explainer: 'Question?' })
}

describe('activity field declarations', () => {
  it('every activity declares its fields', () => {
    for (const def of definitions) expect(def.fields, def.id).not.toBeNull()
  })

  it.each(definitions.map((def) => [def.id, def]))(
    '%s: the default task is valid, and each required field is required',
    (_id, def) => {
      const base = baseTask(def)
      expect(errorsOf(def, base)).toEqual([])
      const mode = def.fields.modeField ? base[def.fields.modeField] : null
      const specs = mode ? fieldsForMode(def.fields.task, mode) : def.fields.task

      for (const spec of specs.filter((s) => s.required)) {
        const task = structuredClone(base)
        delete task[spec.name]
        expect(errorsOf(def, task), `${def.id}.${spec.name}`).not.toEqual([])
      }

      for (const list of specs.filter((s) => s.itemFields && Array.isArray(base[s.name]))) {
        for (const spec of list.itemFields.filter((s) => s.required)) {
          const task = structuredClone(base)
          const where = `${def.id}.${list.name}[].${spec.name}`
          if (NOT_YET_VALIDATED.has(where)) continue
          if (!task[list.name][0] || !(spec.name in task[list.name][0])) continue
          delete task[list.name][0][spec.name]
          expect(errorsOf(def, task), where).not.toEqual([])
        }
      }
    }
  )

  it('modes come from the mode field declared on the task', () => {
    const keyboard = definitions.find((def) => def.id === 'keyboard')
    expect(keyboard.fields.modes).toEqual(['type_text', 'find_key', 'symbols', 'shortcuts'])
    const findKeyItems = fieldsForMode(keyboard.fields.task, 'find_key').find(
      (spec) => spec.name === 'items'
    )
    expect(findKeyItems.itemFields.map((spec) => spec.name)).toContain('key')
    expect(findKeyItems.itemFields.map((spec) => spec.name)).not.toContain('text')
  })
})

// The first "| Field | Required | Notes |" table on an activity's authoring page lists its
// task-level fields; it must match the declaration (besides `type`, the YAML task type).
const DOC_ROOT = path.resolve(__dirname, '../../../docs/authoring/activities')

function docTaskFields(id) {
  const file = path.join(DOC_ROOT, `${id}.md`)
  if (!fs.existsSync(file)) return null
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  const start = lines.findIndex((line) => /^\|\s*Field\s*\|\s*Required\s*\|/.test(line))
  if (start < 0) return null
  const names = []
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith('|')) break
    const cell = line.split('|')[1]
    for (const [, name] of cell.matchAll(/`([^`]+)`/g)) names.push(name)
  }
  return names.filter((name) => name !== 'type').sort()
}

describe('activity docs match the field declarations', () => {
  const documented = definitions
    .map((def) => [def.id, def, docTaskFields(def.id)])
    .filter(([, , names]) => names)

  it('covers the activities with a task-fields table', () => {
    expect(documented.map(([id]) => id)).toEqual(
      expect.arrayContaining(['binary', 'keyboard', 'mouse'])
    )
  })

  it.each(documented)(
    '%s task-fields table lists exactly the declared task fields',
    (_id, def, names) => {
      expect(names).toEqual(def.fields.task.map((spec) => spec.name).sort())
    }
  )
})
