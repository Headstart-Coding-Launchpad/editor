// The toy shop world (Mouse and Keyboard Lesson 4, scroll): eight toys in catalogue order (the
// rainbow castle, the best one, last) and ten window spots. The data is copied from Lesson Gen's
// public/station/toyshop/parts.json (the art's layout), as phase-1 is in station.js; worlds.test.js checks
// the two still match. Kept as plain data so the CLI (Node, no JSON imports) can validate tasks.
import { worldFromPack } from './pack.js'

export const PACK = {
  spots: [
    { id: 'shelf-1', x: 0.2256, y: 0.224, w: 0.08, h: 0.128, cells: [1, 1], accepts: ['toy'] },
    { id: 'shelf-2', x: 0.3194, y: 0.224, w: 0.08, h: 0.128, cells: [1, 1], accepts: ['toy'] },
    { id: 'shelf-3', x: 0.4131, y: 0.224, w: 0.08, h: 0.128, cells: [1, 1], accepts: ['toy'] },
    { id: 'shelf-4', x: 0.5069, y: 0.224, w: 0.08, h: 0.128, cells: [1, 1], accepts: ['toy'] },
    { id: 'shelf-5', x: 0.6006, y: 0.224, w: 0.08, h: 0.128, cells: [1, 1], accepts: ['toy'] },
    { id: 'shelf-6', x: 0.6944, y: 0.224, w: 0.08, h: 0.128, cells: [1, 1], accepts: ['toy'] },
    { id: 'floor-1', x: 0.2319, y: 0.61, w: 0.08, h: 0.128, cells: [1, 1], accepts: ['toy'] },
    { id: 'floor-2', x: 0.3306, y: 0.482, w: 0.16, h: 0.256, cells: [2, 2], accepts: ['toy'] },
    { id: 'floor-3', x: 0.5094, y: 0.482, w: 0.16, h: 0.256, cells: [2, 2], accepts: ['toy'] },
    { id: 'floor-4', x: 0.6881, y: 0.61, w: 0.08, h: 0.128, cells: [1, 1], accepts: ['toy'] },
  ],
  parts: [
    {
      file: 'toy-teddy-bear.png',
      kind: 'toy',
      cells: [1, 1],
      canHang: false,
      catalogueOrder: 1,
      best: false,
    },
    {
      file: 'toy-robot.png',
      kind: 'toy',
      cells: [1, 1],
      canHang: false,
      catalogueOrder: 2,
      best: false,
    },
    {
      file: 'toy-kite.png',
      kind: 'toy',
      cells: [1, 1],
      canHang: false,
      catalogueOrder: 3,
      best: false,
    },
    {
      file: 'toy-yo-yo.png',
      kind: 'toy',
      cells: [1, 1],
      canHang: false,
      catalogueOrder: 4,
      best: false,
    },
    {
      file: 'toy-car.png',
      kind: 'toy',
      cells: [1, 1],
      canHang: false,
      catalogueOrder: 5,
      best: false,
    },
    {
      file: 'toy-spinning-top.png',
      kind: 'toy',
      cells: [1, 1],
      canHang: false,
      catalogueOrder: 6,
      best: false,
    },
    {
      file: 'toy-rocket.png',
      kind: 'toy',
      cells: [2, 2],
      canHang: false,
      catalogueOrder: 7,
      best: false,
    },
    {
      file: 'toy-rainbow-castle.png',
      kind: 'toy',
      cells: [2, 2],
      canHang: false,
      catalogueOrder: 8,
      best: true,
    },
  ],
}

export default worldFromPack('toyshop', 'Toy shop', PACK, {
  lesson: 4,
})
