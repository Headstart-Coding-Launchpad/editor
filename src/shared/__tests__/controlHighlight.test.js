import { afterEach, describe, expect, it } from 'vitest'
import {
  buildControlHighlightCommand,
  claimTaskHighlight,
  describeHighlightTargets,
  glowingKeyOnCard,
  highlightTargetName,
  highlightTargetSelector,
  highlightTargetText,
  listHighlightTargets,
  moduleHasHighlightTargets,
  pickLiveControlHighlight,
  resetTaskHighlightMemory,
  resolveHighlightTarget,
  touchHighlightGroups,
  validateTaskHighlight,
} from '../controlHighlight.js'
import { PYTHON_KEY_ROW } from '../../modules/python/keyRow.js'
import { locateHighlight, revealPanesFor, visibleRect } from '../useControlHighlight.js'

describe('control highlight targets', () => {
  it('lists Run/Stop for code modules and nothing for filesystem/desktop', () => {
    expect(
      listHighlightTargets('python')
        .map((t) => t.id)
        .slice(0, 2)
    ).toEqual(['run', 'stop'])
    expect(listHighlightTargets('turtle').map((t) => t.id)).toEqual(['run', 'stop'])
    expect(listHighlightTargets('html').map((t) => t.id)).toEqual(['run'])
    expect(moduleHasHighlightTargets('filesystem')).toBe(false)
    expect(moduleHasHighlightTargets('desktop')).toBe(false)
    expect(moduleHasHighlightTargets(null)).toBe(false)
  })

  it('expands Scratch block categories into one target each', () => {
    const ids = listHighlightTargets('scratch').map((t) => t.id)
    expect(ids.slice(0, 4)).toEqual(['green_flag', 'stop', 'costumes_tab', 'sounds_tab'])
    expect(ids).toContain('category:Motion')
    expect(ids).toContain('category:My Blocks')
    const motion = listHighlightTargets('scratch').find((t) => t.id === 'category:Motion')
    expect(motion).toMatchObject({ label: 'Motion', group: 'Block category', pane: 'blocks' })
    expect(motion.revealKey).toBe('category')
  })

  it('expands the Python key row into one target per key (request #126)', () => {
    const keys = listHighlightTargets('python').filter((t) => t.group === 'Keys')
    expect(keys.map((t) => t.id)).toEqual(expect.arrayContaining(['key::', 'key:(', 'key:)']))
    expect(keys.find((t) => t.id === 'key:(')).toMatchObject({ label: '(', revealKey: 'key' })
    expect(highlightTargetSelector('key:"')).toBe('[data-highlight-target~="key:\\""]')
  })

  it('names every key in words for a screen reader, never a bare symbol', () => {
    const keys = listHighlightTargets('python').filter((t) => t.group === 'Keys')
    expect(keys.map((t) => t.option)).toEqual(PYTHON_KEY_ROW.map((k) => k.symbol))
    const text = (id) => highlightTargetText(resolveHighlightTarget('python', id))
    expect(text('key:(')).toBe('open bracket key')
    expect(text('key::')).toBe('colon key')
    expect(text('key:"')).toBe('quote key')
    expect(text('key:.')).toBe('full stop key')
    expect(text('key:Tab')).toBe('indent key')
    for (const key of keys) {
      expect(highlightTargetText(key)).toMatch(/^[a-z ]+ key$/)
    }
    expect(text('run')).toBe('Run button')
    expect(highlightTargetText(resolveHighlightTarget('scratch', 'category:Motion'))).toBe(
      'Motion (block category)'
    )
  })

  it('groups the touch-only keys for the Builder', () => {
    const groups = touchHighlightGroups('python')
    expect(groups.map((g) => g.label)).toEqual(['Keys'])
    expect(groups[0].targets.map((t) => t.option)).toEqual(PYTHON_KEY_ROW.map((k) => k.symbol))
    expect(touchHighlightGroups('scratch')).toEqual([])
  })

  it.each([
    ['python', 'key:(', 'key:('],
    ['python', 'KEY:(', 'key:('],
    ['python', 'key::', 'key::'],
    ['python', { target: 'key: #' }, 'key:#'],
    ['scratch', 'green_flag', 'green_flag'],
    ['scratch', 'GREEN_FLAG', 'green_flag'],
    ['scratch', 'run', 'green_flag'],
    ['scratch', { target: 'stop' }, 'stop'],
    ['scratch', 'category:motion', 'category:Motion'],
    ['scratch', 'category: my blocks', 'category:My Blocks'],
    ['python', 'run', 'run'],
    ['turtle', ' stop ', 'stop'],
    ['electronics', 'run', 'run'],
    ['arcade', 'stop', 'stop'],
  ])('resolves %s %j to %s', (type, value, id) => {
    expect(resolveHighlightTarget(type, value)?.id).toBe(id)
  })

  it.each([
    ['scratch', 'category'],
    ['scratch', 'category:Pen'],
    ['scratch', 'green_flag:Motion'],
    ['python', 'green_flag'],
    ['python', 'key'],
    ['python', 'key:a'],
    ['turtle', 'key:('],
    ['html', 'stop'],
    ['filesystem', 'run'],
    ['python', ''],
    ['python', 42],
    ['python', null],
  ])('does not resolve %s %j', (type, value) => {
    expect(resolveHighlightTarget(type, value)).toBeNull()
  })

  it('reads the target name from a string or { target }', () => {
    expect(highlightTargetName('run')).toBe('run')
    expect(highlightTargetName({ target: ' stop ' })).toBe('stop')
    expect(highlightTargetName({})).toBeNull()
  })

  it('describes what an author can write', () => {
    expect(describeHighlightTargets('scratch')).toMatch(/^green_flag, stop, costumes_tab/)
    expect(describeHighlightTargets('scratch')).toContain('category:<Motion|')
    // The key row is described, not listed, and says to quote it.
    expect(describeHighlightTargets('python')).toBe(
      'run, stop, "key:<symbol>" (in quotes, e.g. "key:(")'
    )
  })
})

describe('validateTaskHighlight', () => {
  const run = (task, ctx) => {
    const errors = []
    const warnings = []
    validateTaskHighlight(task, { n: 1, isModuleTask: true, ...ctx }, errors, warnings)
    return { errors, warnings }
  }

  it('accepts a known target', () => {
    expect(run({ highlight: 'run' }, { moduleType: 'python' }).errors).toEqual([])
    expect(run({ highlight: 'key:(' }, { moduleType: 'python' }).errors).toEqual([])
    expect(run({ highlight: { target: 'category:Looks' } }, { moduleType: 'scratch' })).toEqual({
      errors: [],
      warnings: [],
    })
  })

  it('rejects an unknown target, naming the module and the choices', () => {
    const { errors } = run({ highlight: 'green_flag' }, { moduleType: 'python' })
    expect(errors[0]).toMatch(/Task 1 highlight "green_flag" is not a python control/)
    expect(errors[0]).toContain('run, stop, "key:<symbol>"')
    expect(errors[0]).not.toContain('%')
  })

  it('tells the author to quote a key target', () => {
    const unknown = run({ highlight: 'key:a' }, { moduleType: 'python' }).errors[0]
    expect(unknown).toMatch(/"key:a" is not a key on the python key row/)
    expect(unknown).toContain('highlight: "key:("')
    // `highlight: key: (` (unquoted, with a space) is YAML for { key: "(" }.
    expect(run({ highlight: { key: '(' } }, { moduleType: 'python' }).errors[0]).toBe(
      'Task 1 highlight must be one target in quotes, e.g. highlight: "key:("'
    )
  })

  it('warns that a key target only shows on touch screens', () => {
    expect(run({ highlight: 'key:(' }, { moduleType: 'python' }).warnings).toEqual([
      'Task 1 highlight key:( only shows on touch screens (iPad); keyboard screens have no key row',
    ])
    expect(run({ highlight: 'run' }, { moduleType: 'python' }).warnings).toEqual([])
  })

  it('rejects highlight where there are no controls', () => {
    expect(run({ highlight: 'run' }, { moduleType: 'filesystem' }).errors[0]).toMatch(
      /not supported in filesystem/
    )
    expect(
      run({ highlight: 'run' }, { moduleType: 'python', isModuleTask: false }).errors[0]
    ).toMatch(/only supported on code tasks/)
  })

  it('rejects a malformed value', () => {
    expect(run({ highlight: { at: 'run' } }, { moduleType: 'python' }).errors[0]).toMatch(
      /must be a target name/
    )
  })

  it('warns when a highlighted Scratch tab is hidden', () => {
    expect(run({ highlight: 'costumes_tab' }, { moduleType: 'scratch' }).warnings[0]).toMatch(
      /showCostumesTab/
    )
    expect(
      run({ highlight: 'sounds_tab', showSoundsTab: true }, { moduleType: 'scratch' }).warnings
    ).toEqual([])
  })
})

describe('live commands', () => {
  it('builds { target, taskId, pushedAt }', () => {
    expect(buildControlHighlightCommand('run', 3, 1000)).toEqual({
      target: 'run',
      taskId: 3,
      pushedAt: 1000,
    })
  })

  it('picks whichever of the student and class commands was pushed last', () => {
    const student = { target: 'run', pushedAt: 10 }
    const klass = { target: 'stop', pushedAt: 20 }
    expect(pickLiveControlHighlight(student, klass)).toBe(klass)
    expect(pickLiveControlHighlight({ ...student, pushedAt: 30 }, klass).target).toBe('run')
    expect(pickLiveControlHighlight(null, klass)).toBe(klass)
    expect(pickLiveControlHighlight(student, { target: 'stop' })).toBe(student)
    expect(pickLiveControlHighlight(null, null)).toBeNull()
  })
  it("gives the tutor card the key that is glowing, for the highlight's 20 s only", () => {
    const cmd = (target, pushedAt, taskId = 2) => ({ target, taskId, pushedAt })
    expect(glowingKeyOnCard(cmd('key:(', 1000), null, { taskId: 2, now: 5000 })).toEqual({
      key: '(',
      endsAt: 21000,
    })
    expect(glowingKeyOnCard(null, cmd('key::', 1000), { taskId: 2, now: 5000 }).key).toBe(':')
    expect(glowingKeyOnCard(cmd('key:(', 1000), null, { now: 21000 })).toBeNull()
    expect(glowingKeyOnCard(cmd('run', 1000), null, { now: 5000 })).toBeNull()
    expect(glowingKeyOnCard(cmd('key:(', 1000), null, { taskId: 3, now: 5000 })).toBeNull()
    // A newer class Run highlight replaces the student's key.
    expect(glowingKeyOnCard(cmd('key:(', 1000), cmd('run', 2000), { now: 5000 })).toBeNull()
    expect(glowingKeyOnCard(null, null)).toBeNull()
  })
})

describe('task highlight memory', () => {
  afterEach(() => resetTaskHighlightMemory())

  it('claims each task once per student', () => {
    expect(claimTaskHighlight('L', 1, 'a')).toBe(true)
    expect(claimTaskHighlight('L', 1, 'a')).toBe(false)
    expect(claimTaskHighlight('L', 1, 'b')).toBe(true)
    expect(claimTaskHighlight('L', 2, 'a')).toBe(true)
  })
})

describe('finding the control on screen', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  function place(el, rect) {
    el.getBoundingClientRect = () => ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
    })
  }

  it('matches space-separated data-highlight-target values', () => {
    document.body.innerHTML = '<button data-highlight-target="run stop">Run</button>'
    expect(document.querySelector(highlightTargetSelector('stop'))).not.toBeNull()
    expect(document.querySelector(highlightTargetSelector('sto'))).toBeNull()
  })

  it('rings the shown control, else a reveal control, else nothing', () => {
    document.body.innerHTML = `
      <button id="flag" data-highlight-target="green_flag">Flag</button>
      <div id="rail" data-highlight-reveal="green_flag stop">Stage</div>`
    const flag = document.getElementById('flag')
    const rail = document.getElementById('rail')
    const target = resolveHighlightTarget('scratch', 'green_flag')
    place(flag, { left: 10, top: 10, width: 30, height: 20 })
    place(rail, { left: 100, top: 10, width: 20, height: 200 })
    expect(locateHighlight(document, target)).toMatchObject({ kind: 'target', el: flag })
    place(flag, { left: 0, top: 0, width: 0, height: 0 })
    expect(locateHighlight(document, target)).toMatchObject({ kind: 'reveal', el: rail })
    place(rail, { left: 0, top: 0, width: 0, height: 0 })
    expect(locateHighlight(document, target)).toBeNull()
  })

  it('finds a Scratch category by its palette heading text', () => {
    document.body.innerHTML = `
      <svg><g class="blocklyFlyoutLabel"><text>Motion</text></g>
      <g class="blocklyFlyoutLabel" id="looks"><text>Looks</text></g></svg>`
    const looks = document.getElementById('looks')
    place(looks, { left: 5, top: 50, width: 60, height: 16 })
    place(document.querySelector('svg'), { left: 0, top: 0, width: 200, height: 400 })
    const located = locateHighlight(document, resolveHighlightTarget('scratch', 'category:looks'))
    expect(located?.el).toBe(looks)
  })

  it('treats a control clipped out of its scrolling parent as hidden', () => {
    document.body.innerHTML = `
      <svg id="flyout"><g class="blocklyFlyoutLabel" id="ops"><text>Operators</text></g></svg>`
    place(document.getElementById('flyout'), { left: 0, top: 0, width: 200, height: 300 })
    const ops = document.getElementById('ops')
    place(ops, { left: 5, top: 500, width: 60, height: 16 })
    expect(visibleRect(ops)).toBeNull()
  })

  it('points at the module pane, plus the code tab when no control is on screen', () => {
    document.body.innerHTML = '<button data-highlight-target="green_flag">Flag</button>'
    const target = resolveHighlightTarget('scratch', 'green_flag')
    expect(revealPanesFor(document, target)).toEqual(['stage', 'code'])
    place(document.querySelector('button'), { left: 0, top: 0, width: 10, height: 10 })
    expect(revealPanesFor(document, target)).toEqual(['stage'])
    expect(revealPanesFor(document, resolveHighlightTarget('python', 'run'))).toBeNull()
  })
})
