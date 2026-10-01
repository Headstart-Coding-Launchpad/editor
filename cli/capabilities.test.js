import { buildCapabilities } from './capabilities.mjs'
import { MODULE_TYPES, getModuleDefinitions } from '../src/modules/definitions.js'
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
    expect(python.checkTypes).toContain('code_structure')
    const html = capabilities.modules.find((m) => m.type === 'html')
    expect(html.checkTypes).not.toContain('code_structure')
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
    expect(capabilities.requestsHowTo).toMatch(/authoring-requests/)
  })

  it('lists activity modes, fields per mode and authored-content paths', () => {
    const keyboard = capabilities.activities.find((a) => a.id === 'keyboard')
    expect(keyboard.modeField).toBe('mode')
    expect(keyboard.modes).toEqual(['type_text', 'find_key', 'symbols', 'shortcuts', 'edit_text'])
    expect(keyboard.fields.find((f) => f.name === 'mode')).toMatchObject({ required: true })
    const findKeyItems = keyboard.fieldsByMode.find_key.find((f) => f.name === 'items')
    expect(findKeyItems.itemFields.map((f) => f.name)).toEqual(
      expect.arrayContaining(['id', 'key', 'prompt'])
    )
    expect(findKeyItems.itemFields.map((f) => f.name)).not.toContain('text')
    expect(keyboard.authoredFields).toEqual(expect.arrayContaining(['items[].text', 'items[].key']))
    expect(keyboard.authoredFields).not.toContain('mode')

    const mouse = capabilities.activities.find((a) => a.id === 'mouse')
    expect(mouse.modes).toEqual([])
    expect(mouse).not.toHaveProperty('fieldsByMode')
    expect(mouse.fields.map((f) => f.name)).toEqual(['touch', 'targets', 'items'])
  })

  it("lists each module's own task fields, including its complete and carry fields", () => {
    for (const module of capabilities.modules) {
      const names = module.fields.map((f) => f.name)
      const definition = getModuleDefinitions().find((d) => d.type === module.type)
      expect(names, module.type).toEqual(
        expect.arrayContaining([
          definition.completeField,
          definition.carryThroughField,
          'codeStages',
        ])
      )
      expect(module.authoredFields, module.type).toContain(definition.completeField)
      expect(module.authoredFields, module.type).not.toContain(definition.carryThroughField)
    }
    const html = capabilities.modules.find((m) => m.type === 'html')
    expect(html.fields.find((f) => f.name === 'starterFiles')).toMatchObject({ required: true })
  })

  it('lists the common task fields and the non-module task types', () => {
    expect(Object.keys(capabilities.taskFields)).toEqual(['common', 'information', 'group'])
    expect(capabilities.taskFields.common.authoredFields).toEqual(
      expect.arrayContaining(['title', 'explainer', 'check'])
    )
    expect(capabilities.taskFields.common.authoredFields).not.toContain('estimatedMinutes')
    expect(capabilities.taskFields.information.authoredFields).toContain('explainer')
  })

  it('lists authoring requests from the folder, or the ones passed in', () => {
    expect(capabilities.requests.length).toBeGreaterThan(0)
    expect(capabilities.requests[0]).toEqual(
      expect.objectContaining({ file: expect.any(String), title: expect.any(String) })
    )
    const request = { file: 'x.md', title: 'X', kind: 'bug', status: 'open' }
    expect(buildCapabilities({ requests: [request] }).requests).toEqual([request])
  })

  it('lists the taskActivity patterns and the badges lessons can tune', () => {
    expect(capabilities.taskActivity.formats.map((f) => f.name)).toEqual([
      'Information',
      'Quiz',
      'Code Task',
      'Arrange Task',
      'Activity',
    ])
    expect(capabilities.taskActivity.patterns).toEqual(
      expect.arrayContaining([
        {
          id: 'debug_code_task',
          name: 'Debug Code Task',
          formats: ['code_task'],
          aliases: expect.any(Array),
        },
        { id: 'quiz_what_is_the_error', name: 'What Is the Error?', formats: ['quiz'] },
      ])
    )
    expect(capabilities.badges.badges.find((b) => b.id === 'bug_hunter')).toMatchObject({
      emoji: '🐛',
      patterns: ['debug_code_task'],
      badgeHints: ['suggest', 'suppress'],
      autoAwardable: true,
    })
    expect(capabilities.badges.badges.find((b) => b.id === 'helpful_coder')).toMatchObject({
      tutorOnly: true,
      badgeHints: [],
    })
    expect(capabilities.badges.badgeOptions.quizMasterThreshold).toMatchObject({ default: 0.8 })
  })

  it('is plain JSON', () => {
    expect(JSON.parse(JSON.stringify(capabilities))).toEqual(capabilities)
  })
})
