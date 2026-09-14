import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { loadBlocklyModules, setSpriteContext, spriteDropdownLabel } from '../scratch'

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
