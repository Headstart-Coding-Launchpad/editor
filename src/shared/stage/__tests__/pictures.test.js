// @vitest-environment node
// Image Lab's Stage helpers: colours read back for red()/green()/blue(), snapshot(), and the
// Python side of the stage module (rgb, load_image, tuples as colours).
import { describe, expect, it } from 'vitest'
import { createStageRecorder } from '../commands.js'
import {
  DEFAULT_SNAPSHOT_SIZE,
  readSnapshotRequest,
  snapshotColours,
  snapshotHex,
  stageColourValue,
} from '../pictures.js'
import { STAGE_MODULE_PY } from '../stagePy.js'

describe('stageColourValue (red(), green(), blue() for any Stage colour)', () => {
  it('turns names, short hex and PICO-8 names into #rrggbb', () => {
    expect(stageColourValue('red', ['orange'])).toEqual({ value: '#ffa500' })
    expect(stageColourValue('green', ['#0F0'])).toEqual({ value: '#00ff00' })
    expect(stageColourValue('blue', ['dark blue'])).toEqual({ value: '#1d2b53' })
    expect(stageColourValue('red', [], { c: 'navy' })).toEqual({ value: '#000080' })
  })

  it('explains what is not a colour, in plain words', () => {
    expect(stageColourValue('red', ['blu']).error).toEqual({
      kind: 'ValueError',
      message: "red(): 'blu' isn't a colour I know. Try '#ff8800', 'orange' or rgb(255, 136, 0)",
    })
    expect(stageColourValue('green', [5]).error).toEqual({
      kind: 'TypeError',
      message: "green(): give it a colour, like '#ff8800', 'orange' or rgb(255, 136, 0), not 5",
    })
    expect(stageColourValue('blue', ['transparent']).error.message).toBe(
      "blue(): 'transparent' is see-through, so it has no red, green or blue to read"
    )
    expect(stageColourValue('red', []).error.message).toBe(
      "red() reads one colour, like red('#ff8800')"
    )
  })
})

describe('snapshot()', () => {
  it('reads size=, 32 by default, from 1 to 100', () => {
    expect(readSnapshotRequest([], {})).toEqual({ size: DEFAULT_SNAPSHOT_SIZE })
    expect(readSnapshotRequest([], { size: 64 })).toEqual({ size: 64 })
    expect(readSnapshotRequest([8])).toEqual({ size: 8 })
    expect(readSnapshotRequest([], { size: 0 }).error).toEqual({
      kind: 'ValueError',
      message:
        'snapshot(): size is how many squares along each side, a whole number from 1 to 100, like snapshot(size=32), not 0',
    })
    expect(readSnapshotRequest([], { size: 'big' }).error.kind).toBe('TypeError')
    expect(readSnapshotRequest([], { width: 32 }).error.message).toBe(
      'snapshot() has no width= — it understands size='
    )
  })

  it('gives size × size colours, row by row, white where nothing is drawn', () => {
    const pixels = snapshotColours([], 32)
    expect(pixels).toHaveLength(32 * 32)
    expect(new Set(pixels)).toEqual(new Set(['#ffffff']))
    expect(snapshotHex([], 8)).toHaveLength(8 * 8 * 6)
  })

  it("keeps a shape's colour exactly where it is drawn", () => {
    const recorder = createStageRecorder()
    recorder.call('background', ['navy'])
    // The left half red (x 0–200), the right half still navy.
    recorder.call('rect', [200, 400, 'red'], { x: 100, y: 200 })
    const pixels = snapshotColours(recorder.commands, 4)
    expect(pixels).toEqual(
      [
        ['#ff0000', '#ff0000', '#000080', '#000080'],
        ['#ff0000', '#ff0000', '#000080', '#000080'],
        ['#ff0000', '#ff0000', '#000080', '#000080'],
        ['#ff0000', '#ff0000', '#000080', '#000080'],
      ].flat()
    )
  })

  it('gives back a picture drawn with grid() at its own size unchanged', () => {
    const picture = Array.from({ length: 32 * 32 }, (_, i) => (i % 3 ? '#ff8800' : '#123456'))
    const recorder = createStageRecorder()
    expect(recorder.call('grid', [picture], { width: 32 })).toBe('')
    expect(snapshotColours(recorder.commands, 32)).toEqual(picture)
  })
})

describe('the stage module (Python side)', () => {
  it('exports the Image Lab calls', () => {
    expect(STAGE_MODULE_PY).toContain(
      "__all__ += ['rgb', 'red', 'green', 'blue', 'load_image', 'snapshot']"
    )
    for (const name of ['rgb', 'red', 'green', 'blue', 'load_image', 'snapshot']) {
      expect(STAGE_MODULE_PY).toContain(`def ${name}(*args, **kwargs):`)
    }
    expect(STAGE_MODULE_PY).toContain('_js.__hsStageImage(')
    expect(STAGE_MODULE_PY).toContain('_js.__hsStageSnapshot(')
    expect(STAGE_MODULE_PY).toContain('_js.__hsStageColour(')
  })

  it('keeps rgb() numbers within 0-255, rounded', () => {
    expect(STAGE_MODULE_PY).toContain('return int(max(0, min(255, value)) + 0.5)')
  })

  it('turns (r, g, b) tuples into colours for every drawing call, after the original module', () => {
    expect(STAGE_MODULE_PY.indexOf('_hs_draw_plain = _draw')).toBeGreaterThan(
      STAGE_MODULE_PY.indexOf('def hue(')
    )
    expect(STAGE_MODULE_PY).toContain('args, kwargs = _hs_colour_values(name, args, kwargs)')
  })
})
