// The zoo world (Mouse and Keyboard Lesson 3, drag): four enclosures, nine animals and twelve spots,
// each spot taking only its enclosure's kind. The data is copied from Lesson Gen's
// public/station/zoo/parts.json (the art's layout), as phase-1 is in station.js; worlds.test.js checks
// the two still match. Kept as plain data so the CLI (Node, no JSON imports) can validate tasks.
import { worldFromPack } from './pack.js'

export const PACK = {
  spots: [
    { id: 'ice-1', x: 0.11, y: 0.139, w: 0.16, h: 0.256, cells: [2, 2], accepts: ['ice'] },
    { id: 'ice-2', x: 0.2775, y: 0.267, w: 0.08, h: 0.128, cells: [1, 1], accepts: ['ice'] },
    { id: 'ice-3', x: 0.365, y: 0.267, w: 0.08, h: 0.128, cells: [1, 1], accepts: ['ice'] },
    { id: 'grass-1', x: 0.5544, y: 0.142, w: 0.16, h: 0.256, cells: [2, 2], accepts: ['grass'] },
    { id: 'grass-2', x: 0.7219, y: 0.27, w: 0.08, h: 0.128, cells: [1, 1], accepts: ['grass'] },
    { id: 'grass-3', x: 0.8094, y: 0.27, w: 0.08, h: 0.128, cells: [1, 1], accepts: ['grass'] },
    { id: 'jungle-1', x: 0.1444, y: 0.739, w: 0.08, h: 0.128, cells: [1, 1], accepts: ['jungle'] },
    { id: 'jungle-2', x: 0.2319, y: 0.739, w: 0.08, h: 0.128, cells: [1, 1], accepts: ['jungle'] },
    { id: 'jungle-3', x: 0.3194, y: 0.739, w: 0.08, h: 0.128, cells: [1, 1], accepts: ['jungle'] },
    { id: 'water-1', x: 0.5606, y: 0.611, w: 0.16, h: 0.256, cells: [2, 2], accepts: ['water'] },
    { id: 'water-2', x: 0.7281, y: 0.739, w: 0.08, h: 0.128, cells: [1, 1], accepts: ['water'] },
    { id: 'water-3', x: 0.8156, y: 0.739, w: 0.08, h: 0.128, cells: [1, 1], accepts: ['water'] },
  ],
  parts: [
    { file: 'ice-penguin.png', kind: 'ice', cells: [1, 1], canHang: false },
    { file: 'ice-polar-bear.png', kind: 'ice', cells: [2, 2], canHang: false },
    { file: 'grass-lion.png', kind: 'grass', cells: [1, 1], canHang: false },
    { file: 'grass-giraffe.png', kind: 'grass', cells: [2, 2], canHang: false },
    { file: 'grass-zebra.png', kind: 'grass', cells: [1, 1], canHang: false },
    { file: 'jungle-monkey.png', kind: 'jungle', cells: [1, 1], canHang: false },
    { file: 'jungle-parrot.png', kind: 'jungle', cells: [1, 1], canHang: false },
    { file: 'water-duck.png', kind: 'water', cells: [1, 1], canHang: false },
    { file: 'water-hippo.png', kind: 'water', cells: [2, 2], canHang: false },
  ],
  enclosures: [
    { kind: 'ice', box: { x: 106, y: 53, w: 677, h: 444 } },
    { kind: 'grass', box: { x: 818, y: 31, w: 674, h: 469 } },
    { kind: 'jungle', box: { x: 79, y: 522, w: 712, h: 447 } },
    { kind: 'water', box: { x: 812, y: 500, w: 707, h: 469 } },
  ],
}

export default worldFromPack('zoo', 'Zoo', PACK, {
  lesson: 3,
  enclosureLabels: { ice: 'Ice and pool', grass: 'Grassland', jungle: 'Jungle', water: 'Pond' },
})
