import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import {
  costumeDropdownLabel,
  loadBlocklyModules,
  setCostumeContext,
  setSpriteContext,
  setWorkspaceBlocklyContext,
  spriteDropdownLabel,
} from '../scratch'

// Sprite target dropdowns (go to, glide, touching, distance to, create clone of) show
// a thumbnail beside the sprite name in the menu, while the block keeps the plain name.

const SPRITE_DROPDOWNS = [
  ['motion_goto', 'TO'],
  ['motion_glideto', 'TO'],
  ['sensing_touchingobject', 'TOUCHINGOBJECTMENU'],
  ['sensing_distanceto', 'DISTANCETOMENU'],
  ['control_create_clone_of', 'CLONE_OPTION'],
]

describe('spriteDropdownLabel', () => {
  it('returns the plain name when the sprite has no thumbnail', () => {
    expect(spriteDropdownLabel({ id: 's1', name: 'Cat' })).toBe('Cat')
  })

  it('returns a titled element with the thumbnail and the name', () => {
    const label = spriteDropdownLabel({ id: 's1', name: 'Cat', thumbUrl: 'cat.png' })
    expect(label).toBeInstanceOf(HTMLElement)
    expect(label.title).toBe('Cat')
    expect(label.querySelector('img').getAttribute('src')).toBe('cat.png')
    expect(label.textContent).toBe('Cat')
  })
})

describe('sprite target dropdowns', () => {
  let Blockly
  let workspace

  beforeAll(async () => {
    ;({ Blockly } = await loadBlocklyModules())
  })

  afterEach(() => {
    workspace?.dispose()
    setSpriteContext([])
  })

  it.each(SPRITE_DROPDOWNS)('%s lists sprites with previews but shows the name', (type, field) => {
    setSpriteContext([
      { id: 's1', name: 'Cat', thumbUrl: 'cat.png' },
      { id: 's2', name: 'Dog' },
    ])
    workspace = new Blockly.Workspace()
    const block = workspace.newBlock(type)
    const dropdown = block.getField(field)
    // Uses the thumbnail-on-block subclass, still a normal dropdown underneath.
    expect(dropdown).toBeInstanceOf(Blockly.FieldDropdown)
    expect(dropdown.constructor).not.toBe(Blockly.FieldDropdown)

    const options = dropdown.getOptions(false)
    const cat = options.find(([, value]) => value === 's1')
    const dog = options.find(([, value]) => value === 's2')
    expect(cat[0]).toBeInstanceOf(HTMLElement)
    expect(cat[0].querySelector('img')).not.toBeNull()
    expect(dog[0]).toBe('Dog')

    dropdown.setValue('s1')
    expect(dropdown.getText()).toBe('Cat')
  })
})

describe('switch costume dropdown', () => {
  let Blockly
  let workspace

  beforeAll(async () => {
    ;({ Blockly } = await loadBlocklyModules())
  })

  afterEach(() => {
    workspace?.dispose()
    setCostumeContext([])
  })

  it('labels image costumes with the thumbnail and the name', () => {
    const label = costumeDropdownLabel({ name: 'walk', imageUrl: 'walk.png' })
    expect(label).toBeInstanceOf(HTMLElement)
    expect(label.title).toBe('walk')
    expect(label.querySelector('img').getAttribute('src')).toBe('walk.png')
    expect(label.textContent).toBe('walk')
  })

  it('falls back to emoji and name, or the plain name', () => {
    expect(costumeDropdownLabel({ name: 'happy', emoji: '😀' })).toBe('😀 happy')
    expect(costumeDropdownLabel({ name: 'plain' })).toBe('plain')
  })

  it('shows the costume name on the block, not just the picture', () => {
    setCostumeContext([
      { name: 'walk', imageUrl: 'walk.png' },
      { name: 'jump', imageUrl: 'jump.png' },
    ])
    workspace = new Blockly.Workspace()
    const dropdown = workspace.newBlock('looks_switchcostumeto').getField('COSTUME')
    expect(dropdown.constructor).not.toBe(Blockly.FieldDropdown)
    dropdown.setValue('jump')
    expect(dropdown.getText()).toBe('jump')
  })
})

// Two Scratch editors can be mounted at once (the leaving panel of a task slide transition
// alongside the new task). Each workspace's menus must list its own costumes and sprites,
// whichever editor last wrote the shared fallback context.
describe('per-workspace dropdown context', () => {
  let Blockly
  const workspaces = []

  beforeAll(async () => {
    ;({ Blockly } = await loadBlocklyModules())
  })

  afterEach(() => {
    workspaces.splice(0).forEach((ws) => ws.dispose())
    setCostumeContext([])
    setSpriteContext([])
  })

  function workspaceWith(ctx) {
    const ws = new Blockly.Workspace()
    workspaces.push(ws)
    setWorkspaceBlocklyContext(ws, () => ctx)
    return ws
  }

  const optionValues = (field) => field.getOptions(false).map(([, value]) => value)

  it('lists each workspace its own costumes regardless of the global context', () => {
    const task17 = workspaceWith({ costumes: [{ name: 'cat-a' }, { name: 'cat-b' }] })
    const task18 = workspaceWith({ costumes: [{ name: 'dog-a' }, { name: 'dog-b' }] })
    // The leaving editor wrote the fallback last.
    setCostumeContext([{ name: 'cat-a' }, { name: 'cat-b' }])

    const field17 = task17.newBlock('looks_switchcostumeto').getField('COSTUME')
    const field18 = task18.newBlock('looks_switchcostumeto').getField('COSTUME')
    expect(optionValues(field17)).toEqual(['cat-a', 'cat-b'])
    expect(optionValues(field18)).toEqual(['dog-a', 'dog-b'])
  })

  it("defaults a new block to its own workspace's first costume, not the fallback's", () => {
    // Blockly picks the initial value in the field constructor, before the field is
    // attached to a block — so it would otherwise come from the stale fallback context.
    setCostumeContext([{ name: 'walk1' }, { name: 'walk2' }])
    const frog = workspaceWith({ costumes: [{ name: 'sit' }, { name: 'jump' }] })
    const field = frog.newBlock('looks_switchcostumeto').getField('COSTUME')
    expect(field.getValue()).toBe('sit')
    expect(field.getText()).toBe('sit')
    // Saved values validate against this workspace's costumes too.
    field.setValue('jump')
    expect(field.getValue()).toBe('jump')
  })

  it('lists each workspace its own sprites', () => {
    const a = workspaceWith({ sprites: [{ id: 'cat', name: 'Cat' }] })
    const b = workspaceWith({ sprites: [{ id: 'dog', name: 'Dog' }] })
    setSpriteContext([{ id: 'cat', name: 'Cat' }])

    expect(optionValues(a.newBlock('motion_goto').getField('TO'))).toContain('cat')
    const bOptions = optionValues(b.newBlock('motion_goto').getField('TO'))
    expect(bOptions).toContain('dog')
    expect(bOptions).not.toContain('cat')
  })

  it('falls back to the global context for unregistered workspaces', () => {
    setCostumeContext([{ name: 'fallback' }])
    const ws = new Blockly.Workspace()
    workspaces.push(ws)
    expect(optionValues(ws.newBlock('looks_switchcostumeto').getField('COSTUME'))).toEqual([
      'fallback',
    ])
  })
})
