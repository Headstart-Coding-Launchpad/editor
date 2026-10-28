import { describe, expect, it } from 'vitest'
import {
  accuracy,
  flattenNet,
  initNet,
  makeDataset,
  makeRng,
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
