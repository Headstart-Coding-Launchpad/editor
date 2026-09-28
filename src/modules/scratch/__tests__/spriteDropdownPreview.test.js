import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import {
  costumeDropdownLabel,
  loadBlocklyModules,
  setCostumeContext,
  setSpriteContext,
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
