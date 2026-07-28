import { describe, expect, it } from 'vitest'
import { ARCADE_COLOURS, ARCADE_PALETTE, createArcadeDesign, createArcadeMap, createArcadeSprite, designForCodeTab, generatedArcadeAssets, generatedArcadeTilemaps, mapToPythonSnippet, normaliseArcadeColour, resizeArcadeMap, resizeArcadeSprite, updateDesignForCodeTab, updateMapCell } from '../design.js'

describe('Arcade design model', () => {
  it('normalises pixel sprites and generates a portable image asset', () => {
    const sprite = createArcadeSprite([], { name: 'hero', width: 2, height: 2 })
    sprite.frames[0][0] = '#ff0000'
    const assets = generatedArcadeAssets({ sprites: [sprite] })
    expect(assets[0].name).toBe('hero.png')
    expect(assets[0].url).toMatch(/^data:image\/svg\+xml,/)
  })

  it('keeps designs independent for starter, stage, and complete code tabs', () => {
    const task = { arcadeDesign: { sprites: [{ name: 'starter.png' }] }, codeStages: [{}] }
    const stage = createArcadeDesign({ sprites: [{ name: 'stage.png' }] })
    const updated = updateDesignForCodeTab(task, 'stage_0', stage)
    expect(designForCodeTab(updated, 'starter').sprites[0].name).toBe('starter.png')
    expect(designForCodeTab(updated, 'stage_0').sprites[0].name).toBe('stage.png')
  })

  it('edits map cells and exposes a compact tilemap file to Python', () => {
    const map = createArcadeMap([], { name: 'level one', columns: 2, rows: 2, tiles: { '#': { asset: 'wall.png', properties: { solid: true, hazard: true } } }, objects: [{ type: 'coin', x: 16, y: 8 }] })
    const updated = updateMapCell(map, 1, 0, '#')
    expect(updated.rows[0]).toBe('.#')
    const snippet = mapToPythonSnippet(updated)
    expect(snippet).toBe('from headstart_arcade import TileMap\nlevel_one = TileMap("level-one.tilemap")')
    const tilemap = generatedArcadeTilemaps({ maps: [updated] })[0]
    expect(tilemap.name).toBe('level-one.tilemap')
    expect(tilemap.data.properties['#'].hazard).toBe(true)
    expect(tilemap.data.objects[0].type).toBe('coin')
  })

  it('creates a practical 16 by 12 map instead of a one-column grid', () => {
    const map = createArcadeMap()
    expect(map.rows).toHaveLength(12)
    expect(map.rows[0]).toHaveLength(16)
  })

  it('uses a fixed 16-colour palette and drops colours outside it', () => {
    expect(ARCADE_PALETTE).toHaveLength(16)
    expect(normaliseArcadeColour('red')).toBe(ARCADE_COLOURS.red)
    expect(normaliseArcadeColour('#ff004d')).toBe(ARCADE_COLOURS.red)
    expect(normaliseArcadeColour('#123456')).toBeNull()
  })

  it('resizes sprites and maps while preserving the top-left content', () => {
    const sprite = createArcadeSprite([], { width: 2, height: 2 })
    sprite.frames[0] = ['red', 'blue', 'green', 'yellow']
    const enlargedSprite = resizeArcadeSprite(sprite, 4, 4)
    expect(enlargedSprite.width).toBe(4)
    expect(enlargedSprite.frames[0][0]).toBe(ARCADE_COLOURS.red)
    expect(enlargedSprite.frames[0][1]).toBe(ARCADE_COLOURS.blue)
    expect(enlargedSprite.frames[0][4]).toBe(ARCADE_COLOURS.green)
    expect(enlargedSprite.frames[0][15]).toBeNull()

    const map = createArcadeMap([], { columns: 2, rows: ['AB', 'CD'] })
    const enlargedMap = resizeArcadeMap(map, 3, 3)
    expect(enlargedMap.rows).toEqual(['AB.', 'CD.', '...'])
    expect(resizeArcadeMap(enlargedMap, 1, 1).rows).toEqual(['A'])
  })

  it('keeps an intentionally blank 16 by 16 sprite at its selected size', () => {
    const design = createArcadeDesign({ sprites: [{ name: 'blank.png', width: 16, height: 16, frames: [Array(256).fill(null)] }] })

    expect(design.sprites[0].width).toBe(16)
    expect(design.sprites[0].height).toBe(16)
    expect(design.sprites[0].frames[0]).toHaveLength(256)
    expect(design.sprites[0].frames[0]).toStrictEqual(Array(256).fill(null))
  })
})
