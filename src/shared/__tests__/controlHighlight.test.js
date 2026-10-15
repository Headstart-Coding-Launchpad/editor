import { afterEach, describe, expect, it } from 'vitest'
import {
  buildControlHighlightCommand,
  claimTaskHighlight,
  describeHighlightTargets,
  highlightTargetName,
  highlightTargetSelector,
  listHighlightTargets,
  moduleHasHighlightTargets,
  pickLiveControlHighlight,
  resetTaskHighlightMemory,
  resolveHighlightTarget,
  validateTaskHighlight,
} from '../controlHighlight.js'
import { locateHighlight, revealPanesFor, visibleRect } from '../useControlHighlight.js'

describe('control highlight targets', () => {
  it('lists Run/Stop for code modules and nothing for filesystem/desktop', () => {
    expect(listHighlightTargets('python').map((t) => t.id)).toEqual(['run', 'stop'])
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

  it.each([
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
    expect(run({ highlight: { target: 'category:Looks' } }, { moduleType: 'scratch' })).toEqual({
      errors: [],
      warnings: [],
    })
  })

  it('rejects an unknown target, naming the module and the choices', () => {
    const { errors } = run({ highlight: 'green_flag' }, { moduleType: 'python' })
    expect(errors[0]).toMatch(/Task 1 highlight "green_flag" is not a python control/)
    expect(errors[0]).toContain('run, stop')
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
