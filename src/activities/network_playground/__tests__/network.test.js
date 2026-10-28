import { describe, expect, it } from 'vitest'
import {
  accuracy,
  flattenNet,
  initNet,
  makeDataset,
  makeRng,
  makeTestDots,
  netFromFlat,
  predict,
  trainEpoch,
  weightCount,
} from '../network.js'

function train(layers, dataset, seed, epochs) {
  const dots = makeDataset(dataset)
  const net = initNet(layers, seed)
  const rng = makeRng(5)
  for (let i = 0; i < epochs; i += 1) trainEpoch(net, dots, rng)
  return accuracy(net, dots)
}

describe('datasets', () => {
  it('are the same every time, in range, two balanced classes', () => {
    for (const name of ['two_blobs', 'circle', 'spiral']) {
      const a = makeDataset(name)
      expect(makeDataset(name)).toEqual(a)
      expect(a.length).toBe(160)
      expect(a.filter((d) => d.label === 1).length).toBe(80)
      expect(a.every((d) => Math.abs(d.x) <= 1 && Math.abs(d.y) <= 1)).toBe(true)
    }
    expect(makeDataset('circle')).not.toEqual(makeDataset('spiral'))
  })
})

describe('the network', () => {
  it('answers between 0 and 1', () => {
    const net = initNet([3], 1)
    const p = predict(net, 0.2, -0.4)
    expect(p).toBeGreaterThan(0)
    expect(p).toBeLessThan(1)
  })

  it('a [3] net learns two_blobs above 90% quickly', () => {
    expect(train([3], 'two_blobs', 1, 60)).toBeGreaterThan(0.9)
  })

  it('one hidden neuron cannot learn the circle, four can', () => {
    expect(train([1], 'circle', 1, 300)).toBeLessThan(0.8)
    expect(train([4], 'circle', 1, 300)).toBeGreaterThan(0.9)
  })

  it('the spiral beats one layer but two layers can crack it', () => {
    expect(train([6], 'spiral', 1, 400)).toBeLessThan(0.9)
    expect(train([6, 6], 'spiral', 2, 400)).toBeGreaterThan(0.9)
  })

  it('the same seed trains to the same network', () => {
    expect(train([3], 'circle', 4, 20)).toBe(train([3], 'circle', 4, 20))
  })

  it('flattens to a short list and rebuilds a network from it', () => {
    const dots = makeDataset('circle')
    const net = initNet([4, 3], 7)
    const flat = flattenNet(net)
    expect(flat.length).toBe(weightCount([4, 3]))
    expect(flat.length).toBeLessThan(120)
    const again = netFromFlat([4, 3], flat)
    expect(Math.abs(accuracy(again, dots) - accuracy(net, dots))).toBeLessThan(0.1)
    expect(netFromFlat([4], flat)).toBeNull()
    expect(netFromFlat([4, 3], null)).toBeNull()
  })
})

describe('student-picked inputs, zero layers and new dots', () => {
  it('gives the network one input node per picked input', () => {
    const net = initNet([2], 1, ['x', 'y', 'x2', 'y2'])
    expect(net.sizes).toEqual([4, 2, 1])
    expect(net.inputs).toEqual(['x', 'y', 'x2', 'y2'])
    expect(weightCount([2], 4)).toBe(4 * 2 + 2 + 2 + 1)
    expect(weightCount([2])).toBe(weightCount([2], 2))
  })

  it('rebuilds a net with its inputs from the flat list, and refuses a mismatch', () => {
    const net = initNet([], 3, ['x2', 'y2'])
    const flat = flattenNet(net)
    expect(flat.length).toBe(weightCount([], 2))
    const again = netFromFlat([], flat, ['x2', 'y2'])
    expect(again.inputs).toEqual(['x2', 'y2'])
    expect(netFromFlat([], flat, ['x', 'y', 'x2'])).toBeNull()
  })

  it('makes 80 fresh dots from the same pattern, different from the training dots', () => {
    for (const name of ['two_blobs', 'circle', 'spiral']) {
      const test = makeTestDots(name)
      expect(test).toHaveLength(80)
      expect(test).toEqual(makeTestDots(name))
      expect(test).not.toEqual(makeDataset(name).slice(0, 80))
      expect(test.filter((d) => d.label === 1)).toHaveLength(40)
    }
  })

  it('cannot solve the circle from x and y with no hidden layer', () => {
    const dots = makeDataset('circle')
    const net = initNet([], 1, ['x', 'y'])
    const rng = makeRng(5)
    for (let i = 0; i < 300; i += 1) trainEpoch(net, dots, rng)
    expect(accuracy(net, dots)).toBeLessThan(0.7)
  })

  it('solves the circle from x2 and y2 with no hidden layer, on new dots too', () => {
    const dots = makeDataset('circle')
    for (const seed of [1, 2, 3]) {
      const net = initNet([], seed, ['x2', 'y2'])
      const rng = makeRng(5)
      for (let i = 0; i < 300; i += 1) trainEpoch(net, dots, rng)
      expect(accuracy(net, dots)).toBeGreaterThanOrEqual(0.9)
      expect(accuracy(net, makeTestDots('circle'))).toBeGreaterThanOrEqual(0.9)
    }
  })
})
