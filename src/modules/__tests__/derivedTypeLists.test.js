import { describe, expect, it } from 'vitest'
import { defineModule } from '../defineModule.js'
import {
  CARRY_THROUGH_FIELDS,
  MODULE_TYPES,
  getModuleDefinition,
  getModuleLabel,
  getModuleTypesWhere,
  getModuleTypesWithCapability,
} from '../definitions.js'
import pythonDefinition from '../python/definition.js'
import { PLAYGROUND_LESSON_TYPES } from '../../shared/composedLesson'
import { TEACHER_LIVE_REFERENCE_TYPES } from '../../app/studentLiveDisplay'
import { buildStageOptions, deriveTaskContext } from '../../shared/taskUtils'
import { getCodeBlockOptions, getInlineCodeOptions } from '../../shared/markdown/editorOptions'
import { getCodeLanguageLabel } from '../../shared/codeLanguages'
import { readRepoFile } from './helpers/sourceLiterals'

// Plan 1.2: module-type lists and label/icon maps that used to be hand-maintained in core
// files are now derived from each module's definition.js (`meta` + `capabilities`). These
// tests pin the derived values to what the hand-written lists contained (plus the drift
// fixes), so a definition edit that changes classroom behaviour is a visible test change.

const sorted = (list) => [...list].sort()

describe('derived module-type lists', () => {
  it('PLAYGROUND_LESSON_TYPES comes from meta.playground', () => {
    expect(sorted(PLAYGROUND_LESSON_TYPES)).toEqual(
      sorted(['python', 'arcade', 'electronics', 'scratch'])
    )
  })

  it('side-explainer types come from capabilities.sideExplainer', () => {
    expect(sorted(getModuleTypesWithCapability('sideExplainer'))).toEqual(
      sorted(['python', 'arcade', 'turtle', 'html', 'scratch', 'electronics'])
    )
  })

  it('module-panes types come from capabilities.modulePanes', () => {
    expect(sorted(getModuleTypesWithCapability('modulePanes'))).toEqual(
      sorted(['electronics', 'python', 'arcade', 'turtle', 'html'])
    )
  })

  it('TEACHER_LIVE_REFERENCE_TYPES comes from capabilities.teacherLiveReference', () => {
    expect(sorted(TEACHER_LIVE_REFERENCE_TYPES)).toEqual(
      sorted(['python', 'html', 'arcade', 'turtle', 'electronics', 'filesystem'])
    )
  })

  it('teacher sandbox code-string types come from capabilities.sandboxState', () => {
    expect(
      sorted(getModuleTypesWhere((definition) => definition.capabilities.sandboxState === 'code'))
    ).toEqual(sorted(['python', 'arcade', 'electronics', 'turtle']))
    expect(
      Object.fromEntries(
        MODULE_TYPES.map((type) => [type, getModuleDefinition(type).capabilities.sandboxState])
      )
    ).toEqual({
      python: 'code',
      arcade: 'code',
      turtle: 'code',
      scratch: 'blocks',
      html: 'files',
      filesystem: 'fs',
      desktop: 'desktop',
      electronics: 'code',
    })
  })

  it('unified-stage types come from capabilities.unifiedStages', () => {
    expect(sorted(getModuleTypesWithCapability('unifiedStages'))).toEqual(
      sorted(['python', 'html', 'arcade', 'turtle', 'electronics', 'scratch'])
    )
  })

  it('CARRY_THROUGH_FIELDS lists each distinct carryThroughField in the historical order', () => {
    expect(CARRY_THROUGH_FIELDS).toEqual([
      'carryCodeFrom',
      'carryBlocksFrom',
      'carryFsFrom',
      'carryDesktopFrom',
      'carryCircuitFrom',
    ])
  })
})

describe('stage options from definitions', () => {
  it.each([
    ['python', { completeCode: 'x' }, 'Starter', 'Complete'],
    ['arcade', { completeCode: 'x' }, 'Starter', 'Complete'],
    ['turtle', { completeCode: 'x' }, 'Starter', 'Complete'],
    ['scratch', { completeBlocks: {} }, 'Starter', 'Complete'],
    ['filesystem', { completeFs: {} }, 'Starter', 'Complete'],
    ['desktop', { completeDesktop: {} }, 'Starter', 'Complete'],
    ['electronics', { completeCircuit: {} }, 'Starter board', 'Complete board'],
    ['html', { completeFiles: [{ name: 'index.html' }] }, 'Starter', 'Complete'],
  ])('%s offers a legacy Complete option from its completeField', (type, fields, s, c) => {
    expect(buildStageOptions({ id: 1, ...fields }, type)).toEqual([
      { value: 'starter', label: s },
      { value: 'complete', label: c },
    ])
    expect(buildStageOptions({ id: 1 }, type)).toEqual([{ value: 'starter', label: s }])
  })

  it('an empty completeFiles array is not a Complete (HTML)', () => {
    expect(buildStageOptions({ id: 1, completeFiles: [] }, 'html')).toEqual([
      { value: 'starter', label: 'Starter' },
    ])
  })

  it('unified stages apply only to unifiedStages modules', () => {
    const task = { id: 1, codeStages: [{ label: 'Go', role: 'starter', code: '' }] }
    expect(buildStageOptions(task, 'python')).toEqual([{ value: 'stage_0', label: 'Go' }])
    expect(buildStageOptions(task, 'filesystem')[0]).toEqual({
      value: 'starter',
      label: 'Starter',
    })
  })

  it('unknown types fall back to the generic labels', () => {
    expect(buildStageOptions({ id: 1, completeCode: 'x' }, 'composed')).toEqual([
      { value: 'starter', label: 'Starter' },
    ])
  })
})

describe('deriveTaskContext', () => {
  it('returns moduleType and an isDesktop flag', () => {
    const context = deriveTaskContext({ type: 'desktop' }, { id: 1 }, null)
    expect(context.moduleType).toBe('desktop')
    expect(context.isDesktop).toBe(true)
    expect(context.isFilesystem).toBe(false)
  })

  it.each(MODULE_TYPES)('sets exactly one module flag for %s', (type) => {
    const context = deriveTaskContext({ type }, { id: 1 }, null)
    expect(context.moduleType).toBe(type)
    const moduleFlags = Object.entries(context).filter(
      ([key, value]) =>
        value === true && !['isQuiz', 'isInformation', 'isSessionSandbox'].includes(key)
    )
    expect(moduleFlags).toHaveLength(1)
  })

  it('returns a null moduleType for a composed or missing lesson', () => {
    expect(deriveTaskContext({ type: 'composed' }, null, null).moduleType).toBeNull()
    expect(deriveTaskContext(null, null, null).moduleType).toBeNull()
  })
})

describe('module labels', () => {
  const table = (surface) =>
    Object.fromEntries(MODULE_TYPES.map((type) => [type, getModuleLabel(type, surface)]))

  it('meta.label is the default on every surface', () => {
    expect(table()).toEqual({
      python: 'Python',
      arcade: 'Arcade Kit',
      turtle: 'Python Turtle',
      scratch: 'Scratch',
      html: 'HTML',
      filesystem: 'Filesystem',
      desktop: 'Desktop',
      electronics: 'Electronics',
    })
  })

  it('keeps the historical per-surface wording', () => {
    expect(table('lessonIntro')).toMatchObject({ html: 'Web Dev', filesystem: 'Filesystem' })
    expect(table('builderMeta')).toMatchObject({ html: 'Web', filesystem: 'Files & Folders' })
    expect(table('print')).toMatchObject({ html: 'Web (HTML/CSS/JS)', turtle: 'Python Turtle' })
    expect(table('stageReference')).toEqual({
      python: 'Python',
      arcade: 'Python',
      turtle: 'Python',
      scratch: 'Scratch',
      html: 'HTML',
      filesystem: 'Filesystem',
      desktop: 'Desktop',
      electronics: 'Electronics',
    })
  })

  it('returns null for unregistered types so callers keep their own fallback', () => {
    expect(getModuleLabel('composed', 'print')).toBeNull()
    expect(getModuleLabel(undefined)).toBeNull()
  })

  it('Builder module picker icons, labels and hints come from meta', () => {
    const picker = Object.fromEntries(
      MODULE_TYPES.map((type) => {
        const { icon, shortLabel, pickerHint } = getModuleDefinition(type).meta
        return [type, `${icon} ${shortLabel} | ${pickerHint}`]
      })
    )
    expect(picker).toEqual({
      python: '🐍 Python | Workspace',
      arcade: '🕹️ Arcade Kit | Workspace · Experimental',
      turtle: '🐢 Turtle | Workspace',
      scratch: '🧩 Scratch | Workspace',
      html: '🌐 HTML | Workspace',
      filesystem: '🗂️ Filesystem | File manager',
      desktop: '🖥️ Desktop | Windowed desktop',
      electronics: '⚡ Electronics | Workspace',
    })
  })

  it('meta.language names the code language, or null for non-code modules', () => {
    expect(
      Object.fromEntries(
        MODULE_TYPES.map((type) => [type, getModuleDefinition(type).meta.language])
      )
    ).toEqual({
      python: 'python',
      arcade: 'python',
      turtle: 'python',
      scratch: null,
      html: 'html',
      filesystem: null,
      desktop: null,
      electronics: 'python',
    })
  })

  it('code-language labels are shared by CopyCodePanel and the explainer menu', () => {
    expect(getCodeLanguageLabel('python')).toBe('Python')
    expect(getCodeLanguageLabel('javascript')).toBe('JavaScript')
    expect(getCodeLanguageLabel('unknown')).toBe('Code')
  })
})

describe('explainer editor options', () => {
  const blockLabels = (type) => getCodeBlockOptions(type).map((option) => option.label)

  it('keeps the historical code-block menus', () => {
    expect(blockLabels('python')).toEqual(['Python'])
    expect(blockLabels('html')).toEqual(['HTML', 'CSS', 'JavaScript'])
    expect(blockLabels('scratch')).toEqual(['Scratch', 'HTML', 'CSS', 'JavaScript'])
    expect(blockLabels('filesystem')).toEqual(['Code block'])
    expect(blockLabels('desktop')).toEqual(['Code block'])
    expect(blockLabels('composed')).toEqual(['Code block'])
  })

  it('offers Python code blocks for the Python-based modules (drift fix)', () => {
    for (const type of ['arcade', 'turtle', 'electronics']) {
      expect(getCodeBlockOptions(type)).toEqual([{ label: 'Python', action: 'code-block:python' }])
    }
  })

  it('falls back to the definition inline languages when none are passed', () => {
    expect(getInlineCodeOptions('html', []).map((option) => option.label)).toEqual([
      'HTML',
      'JS',
      'CSS',
    ])
    expect(getInlineCodeOptions('filesystem', [])).toEqual([])
  })
})

describe('consumers read the derived values (no hand-written lists left)', () => {
  it.each([
    ['src/shared/composedLesson.js', 'definition.meta.playground'],
    ['src/app/components/LessonTaskContent.jsx', "getModuleTypesWithCapability('sideExplainer')"],
    ['src/app/components/LessonTaskContent.jsx', "getModuleTypesWithCapability('modulePanes')"],
    ['src/app/studentLiveDisplay.js', "getModuleTypesWithCapability('teacherLiveReference')"],
    ['src/app/views/TeacherView.jsx', "capabilities.sandboxState === 'code'"],
    ['src/shared/taskUtils.js', 'capabilities.unifiedStages'],
    ['src/shared/taskUtils.js', 'definition?.completeField'],
    ['src/builder/lessonUtils.js', 'CARRY_THROUGH_FIELDS'],
    // Both validators get the carry-through rule from the shared core.
    ['src/shared/lessonValidation.js', 'CARRY_THROUGH_FIELDS'],
    ['cli/validate.mjs', 'validateLessonCore'],
    ['src/app/components/InformationTask.jsx', "getModuleLabel(type, 'lessonIntro')"],
    ['src/builder/components/LessonMetaPanel.jsx', "getModuleLabel(type, 'builderMeta')"],
    ['src/builder/printLesson.js', "getModuleLabel(type, 'print')"],
    ['src/app/components/SupportStagePanel.jsx', "getModuleLabel(lessonType, 'stageReference')"],
    ['src/app/views/PlaygroundView.jsx', 'getModuleLabel(type)'],
    ['src/builder/components/TaskEditor.jsx', 'getModuleDefinition(moduleType).meta'],
    ['src/builder/App.jsx', 'getModuleLabel(type)'],
    ['src/shared/markdown/editorOptions.js', 'explainerCodeBlockLanguages'],
    ['src/app/components/CopyCodePanel.jsx', 'getCodeLanguageLabel(language)'],
  ])('%s uses %s', (file, snippet) => {
    expect(readRepoFile(file)).toContain(snippet)
  })

  it('the old literal lists are gone', () => {
    expect(readRepoFile('src/app/views/TeacherView.jsx')).not.toMatch(/CODE_STRING_TYPES = \[/)
    expect(readRepoFile('src/shared/taskUtils.js')).not.toContain('STAGE_OPTION_METADATA')
    expect(readRepoFile('src/builder/printLesson.js')).not.toContain('TYPE_LABELS')
    expect(readRepoFile('cli/validate.mjs')).not.toMatch(/'carryCircuitFrom'/)
  })
})

describe('defineModule meta/capabilities validation', () => {
  const valid = () => ({
    ...pythonDefinition,
    meta: { ...pythonDefinition.meta },
    capabilities: { ...pythonDefinition.capabilities },
  })

  it.each(['shortLabel', 'icon', 'pickerHint'])('requires meta.%s', (key) => {
    const def = valid()
    delete def.meta[key]
    expect(() => defineModule(def)).toThrow(new RegExp(`meta\\.${key}`))
  })

  it('requires meta.playground and a known meta.language', () => {
    const noPlayground = valid()
    delete noPlayground.meta.playground
    expect(() => defineModule(noPlayground)).toThrow(/meta\.playground/)
    const badLanguage = valid()
    badLanguage.meta.language = 'rust'
    expect(() => defineModule(badLanguage)).toThrow(/meta\.language/)
  })

  it('rejects an unknown surfaceLabels surface', () => {
    const def = valid()
    def.meta.surfaceLabels = { landing: 'Py' }
    expect(() => defineModule(def)).toThrow(/surfaceLabels/)
  })

  it('requires the capabilities object and each capability', () => {
    const noCapabilities = valid()
    delete noCapabilities.capabilities
    expect(() => defineModule(noCapabilities)).toThrow(/capabilities/)
    const noFlag = valid()
    delete noFlag.capabilities.sideExplainer
    expect(() => defineModule(noFlag)).toThrow(/capabilities\.sideExplainer/)
    const badState = valid()
    badState.capabilities.sandboxState = 'text'
    expect(() => defineModule(badState)).toThrow(/sandboxState/)
  })

  it('requires completeField and explainerCodeBlockLanguages', () => {
    const noComplete = valid()
    delete noComplete.completeField
    expect(() => defineModule(noComplete)).toThrow(/completeField/)
    const noBlocks = valid()
    delete noBlocks.explainerCodeBlockLanguages
    expect(() => defineModule(noBlocks)).toThrow(/explainerCodeBlockLanguages/)
  })
})
