import { buildCapabilities } from './capabilities.mjs'
import { MODULE_TYPES } from '../src/modules/definitions.js'
import { ACTIVITY_IDS } from '../src/activities/registry.pure.js'
import { checkRegistry } from '../src/modules/checks.js'

describe('lessons capabilities', () => {
  const capabilities = buildCapabilities()

  it('lists every registered module, activity and check type', () => {
    expect(capabilities.modules.map((m) => m.type)).toEqual([...MODULE_TYPES])
    expect(capabilities.activities.map((a) => a.id)).toEqual([...ACTIVITY_IDS])
    expect(capabilities.checkTypes.map((c) => c.type)).toEqual(
      checkRegistry.list().map((c) => c.type)
    )
  })

  it('attributes check types to the module that owns them', () => {
    const filesystem = capabilities.modules.find((m) => m.type === 'filesystem')
    expect(filesystem.checkTypes).toContain('fs_path')
    const python = capabilities.modules.find((m) => m.type === 'python')
    expect(python.checkTypes).not.toContain('fs_path')
  })

  it('lists inherited input_* check types on the modules that record input', () => {
    const desktop = capabilities.modules.find((m) => m.type === 'desktop')
    expect(desktop.checkTypes).toEqual(
      expect.arrayContaining(['window_state', 'input_gesture', 'input_shortcut', 'input_modifier'])
    )
    const python = capabilities.modules.find((m) => m.type === 'python')
    expect(python.checkTypes).not.toContain('input_gesture')
    expect(capabilities.checkTypes.find((c) => c.type === 'input_gesture').owner).toBe('input')
  })

  it('tells agents how to author each activity and where to ask for more', () => {
    const binary = capabilities.activities.find((a) => a.id === 'binary')
    expect(binary).toMatchObject({
      yamlType: 'binary',
      taskShape: { taskType: 'activity', activityType: 'binary' },
    })
    expect(binary).not.toHaveProperty('hostModules')
    expect(capabilities.activities.find((a) => a.id === 'code_arrange')).toMatchObject({
      yamlType: 'code_arrange',
      taskShape: { taskType: 'code_arrange' },
      hostModules: ['python', 'html'],
    })
    expect(capabilities.requests).toMatch(/authoring-requests/)
  })

  it('is plain JSON', () => {
    expect(JSON.parse(JSON.stringify(capabilities))).toEqual(capabilities)
  })
})
