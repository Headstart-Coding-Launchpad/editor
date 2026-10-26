// @vitest-environment node
// Image Lab's picture library (load_image()): the names, the files in public/image-lab, the
// size rules and the shrinking.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_IMAGE_SIZE,
  IMAGE_BYTES,
  IMAGE_LIBRARY,
  IMAGE_NAMES,
  IMAGE_SIZES,
  closestImageName,
  findImage,
  imageNamesInCode,
  imageUrl,
  readImageRequest,
  resizeImageBytes,
  rgbBytesToHex,
} from '../imageLibrary.js'

const FOLDER = join(process.cwd(), 'public', 'image-lab')

describe('the picture library', () => {
  it('has about 25 pictures with unique, Python-friendly names', () => {
    expect(IMAGE_LIBRARY.length).toBeGreaterThanOrEqual(20)
    expect(IMAGE_LIBRARY.length).toBeLessThanOrEqual(30)
    expect(new Set(IMAGE_NAMES).size).toBe(IMAGE_NAMES.length)
    for (const name of IMAGE_NAMES) expect(name).toMatch(/^[a-z][a-z_]*$/)
  })

  it('matches public/image-lab: one 64 × 64 RGB file per name, and the manifest', () => {
    const manifest = JSON.parse(readFileSync(join(FOLDER, 'manifest.json'), 'utf8'))
    expect(manifest.size).toBe(64)
    expect(manifest.images.map((image) => image.name)).toEqual(IMAGE_NAMES)
    for (const image of manifest.images) {
      const ours = findImage(image.name)
      expect(ours.crisp).toBe(image.crisp)
      expect(ours.kind).toBe(image.kind)
      // Only CC0 or public-domain pictures, each with where it came from.
      expect(image.licence).toMatch(/^(CC0|Public domain)$/)
      expect(image.source).toBeTruthy()
      expect(image.author).toBeTruthy()
      expect(statSync(join(FOLDER, `${image.name}.rgb`)).size).toBe(IMAGE_BYTES)
    }
    const files = readdirSync(FOLDER).filter((file) => file.endsWith('.rgb'))
    expect(files.sort()).toEqual(IMAGE_NAMES.map((name) => `${name}.rgb`).sort())
  })

  it('has the green screen in pure #00ff00 and the pixel fox in exactly #ff8800', () => {
    const corner = rgbBytesToHex(readFileSync(join(FOLDER, 'astronaut_green.rgb')).subarray(0, 3))
    expect(corner).toBe('00ff00')
    const fox = rgbBytesToHex(readFileSync(join(FOLDER, 'pixel_fox.rgb')))
    expect(fox).toContain('ff8800')
  })

  it('finds names in any case, with spaces or dashes', () => {
    expect(findImage('fox').name).toBe('fox')
    expect(findImage(' Eiffel Tower ').name).toBe('eiffel_tower')
    expect(findImage('pixel-fox').name).toBe('pixel_fox')
    expect(findImage('cat')).toBeNull()
    expect(imageUrl('Pixel Fox', '/editor/')).toBe('/editor/image-lab/pixel_fox.rgb')
    expect(imageUrl('fox')).toBe('/image-lab/fox.rgb')
  })

  it('suggests a close name', () => {
    expect(closestImageName('foxx')).toBe('fox')
    expect(closestImageName('astronaut')).toBe('astronaut_green')
    expect(closestImageName('stawberries')).toBe('strawberries')
    expect(closestImageName('zebra')).toBeNull()
  })
})

describe('imageNamesInCode (what the worker fetches before a run)', () => {
  it('finds every library name written as text in a program that loads pictures', () => {
    const code = [
      'from stage import *',
      'fox = load_image("fox")',
      "names = ['moon', 'Beach', 'not a picture']",
      'grid(fox, width=32)',
    ].join('\n')
    expect(imageNamesInCode(code).sort()).toEqual(['beach', 'fox', 'moon'])
  })

  it('fetches nothing for a program that never calls load_image()', () => {
    expect(imageNamesInCode('print("fox")')).toEqual([])
    expect(imageNamesInCode('')).toEqual([])
    expect(imageNamesInCode(null)).toEqual([])
  })
})

describe('readImageRequest (load_image(name, size=32))', () => {
  it('reads the name and the size, 32 by default', () => {
    expect(readImageRequest(['fox'])).toMatchObject({ name: 'fox', size: DEFAULT_IMAGE_SIZE })
    expect(readImageRequest(['Fox'], { size: 64 })).toMatchObject({ name: 'fox', size: 64 })
    expect(readImageRequest([], { name: 'moon', size: 8 })).toMatchObject({ name: 'moon', size: 8 })
    expect(readImageRequest(['moon', 16])).toMatchObject({ size: 16 })
    expect(IMAGE_SIZES).toEqual([8, 16, 32, 64])
  })

  it('explains an unknown name, suggesting a close one or listing them all', () => {
    expect(readImageRequest(['foxx']).error).toEqual({
      kind: 'ValueError',
      message: "load_image(): there's no picture called 'foxx' — did you mean 'fox'?",
    })
    const { error } = readImageRequest(['zebra'])
    expect(error.kind).toBe('ValueError')
    expect(error.message).toMatch(
      /^load_image\(\): there's no picture called 'zebra'\. Pictures you can load: fox, tiger/
    )
    expect(error.message).toContain('astronaut_green')
  })

  it('explains a missing or wrong name and a wrong size in plain words', () => {
    expect(readImageRequest([]).error.message).toBe(
      'load_image() needs the name of a picture, like load_image("fox")'
    )
    expect(readImageRequest([5]).error).toEqual({
      kind: 'TypeError',
      message:
        'load_image(): the name should be a picture\'s name in quotes, like load_image("fox"), not 5',
    })
    expect(readImageRequest(['fox'], { size: 50 }).error).toEqual({
      kind: 'ValueError',
      message:
        'load_image(): size can be 8, 16, 32 or 64 (squares along each side), like load_image("fox", size=64), not 50',
    })
    expect(readImageRequest(['fox'], { size: '64' }).error.kind).toBe('TypeError')
    expect(readImageRequest(['fox'], { width: 32 }).error.message).toBe(
      'load_image() has no width= — it understands name= and size='
    )
    expect(readImageRequest(['fox', 32, 1]).error.kind).toBe('TypeError')
  })
})

describe('resizeImageBytes and rgbBytesToHex', () => {
  // A 4 × 4 picture: four 2 × 2 blocks.
  const block = (rgb) => rgb
  const picture = new Uint8Array(
    [
      [block([255, 0, 0]), block([0, 0, 0]), block([0, 0, 255]), block([0, 0, 255])],
      [block([255, 0, 0]), block([255, 0, 0]), block([0, 0, 255]), block([0, 0, 255])],
      [block([0, 255, 0]), block([0, 255, 0]), block([10, 10, 10]), block([10, 10, 10])],
      [block([0, 255, 0]), block([0, 255, 0]), block([10, 10, 10]), block([11, 11, 11])],
    ].flat(2)
  )

  it('averages each block of a photo (rounded)', () => {
    const half = resizeImageBytes(picture, 2, { from: 4 })
    expect(rgbBytesToHex(half)).toBe(
      ['bf0000', '0000ff', '00ff00', '0a0a0a'].join('') // 765 / 4 = 191.25 → 191 (bf)
    )
  })

  it('takes one pixel from each block of pixel art, so its colours stay exact', () => {
    const half = resizeImageBytes(picture, 2, { from: 4, crisp: true })
    expect(rgbBytesToHex(half)).toBe(['ff0000', '0000ff', '00ff00', '0a0a0a'].join(''))
  })

  it('returns the stored picture at its own size', () => {
    expect(resizeImageBytes(picture, 4, { from: 4 })).toBe(picture)
  })

  it('makes every library size from a stored picture', () => {
    const stored = readFileSync(join(FOLDER, 'fox.rgb'))
    for (const size of IMAGE_SIZES) {
      const hex = rgbBytesToHex(resizeImageBytes(new Uint8Array(stored), size))
      expect(hex).toHaveLength(size * size * 6)
      expect(hex).toMatch(/^[0-9a-f]+$/)
    }
  })
})
