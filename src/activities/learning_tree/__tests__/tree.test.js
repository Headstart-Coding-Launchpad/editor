// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  bestSplit,
  buildTree,
  classify,
  entropy,
  informationGain,
  majorityLabel,
  nodeCount,
  scoreTree,
  treeDepth,
} from '../tree.js'

// Rows: f = [has_fur, can_fly, lives_in_water], l = 0 pet / 1 wild.
const ex = (f, l) => ({ f, l })
const PETS = [ex([1, 0, 0], 0), ex([1, 0, 0], 0), ex([1, 0, 0], 0)]
const WILD = [ex([0, 1, 0], 1), ex([0, 0, 1], 1), ex([0, 1, 0], 1)]

describe('entropy', () => {
  it('is 0 for empty and pure sets, 1 for an even split', () => {
    expect(entropy([])).toBe(0)
    expect(entropy([0, 0])).toBe(0)
    expect(entropy([5, 0])).toBe(0)
    expect(entropy([2, 2])).toBeCloseTo(1)
  })
  it('is about 0.918 for a 2 to 1 split', () => {
    expect(entropy([2, 1])).toBeCloseTo(0.9183, 3)
  })
})

describe('majorityLabel', () => {
  it('picks the biggest count and breaks ties towards the first label', () => {
    expect(majorityLabel([1, 3])).toBe(1)
    expect(majorityLabel([2, 2])).toBe(0)
    expect(majorityLabel([0, 0, 0], 2)).toBe(2)
  })
})

describe('informationGain and bestSplit', () => {
  const data = [...PETS, ...WILD]
  it('gives a perfect question a gain of 1 bit', () => {
    expect(informationGain(data, 0, 2)).toBeCloseTo(1)
  })
  it('gives a useless question no gain', () => {
    const same = [ex([1], 0), ex([1], 1)]
    expect(informationGain(same, 0, 2)).toBe(0)
    expect(informationGain([], 0, 2)).toBe(0)
  })
  it('picks the best feature, the lowest index on a tie, and null when nothing helps', () => {
    expect(bestSplit(data, [1, 0, 2], 2).feature).toBe(0)
    const tie = [ex([1, 1], 0), ex([0, 0], 1)]
    expect(bestSplit(tie, [0, 1], 2).feature).toBe(0)
    expect(bestSplit([ex([1], 0), ex([1], 1)], [0], 2)).toBeNull()
    expect(bestSplit([], [0], 2)).toBeNull()
  })
})

describe('buildTree', () => {
  it('is one leaf for no examples, answering the first label', () => {
    const tree = buildTree([], 3, 2, 3)
    expect(tree).toMatchObject({ leaf: true, label: 0, n: 0 })
    expect(treeDepth(tree)).toBe(0)
  })
  it('is one leaf when every example has the same label', () => {
    const tree = buildTree(PETS, 3, 2, 3)
    expect(tree.leaf).toBe(true)
    expect(tree.label).toBe(0)
  })
  it('asks the best question first and sorts the examples', () => {
    const tree = buildTree([...PETS, ...WILD], 3, 2, 3)
    expect(tree.leaf).toBe(false)
    expect(tree.feature).toBe(0)
    expect(tree.yes).toMatchObject({ leaf: true, label: 0, n: 3 })
    expect(tree.no).toMatchObject({ leaf: true, label: 1, n: 3 })
    expect(treeDepth(tree)).toBe(1)
    expect(nodeCount(tree)).toBe(3)
  })
  it('grows a second question to cope with a tricky example', () => {
    // Furry things are pets except a wolf that can also fly (made up); water things are wild
    // except a goldfish. Fur vs not is not enough on its own.
    const data = [
      ex([1, 0, 0], 0),
      ex([1, 0, 0], 0),
      ex([1, 1, 0], 1),
      ex([0, 0, 1], 1),
      ex([0, 0, 0], 1),
    ]
    const tree = buildTree(data, 3, 2, 3)
    expect(treeDepth(tree)).toBe(2)
    expect(classify(tree, [1, 1, 0])).toBe(1)
    expect(classify(tree, [1, 0, 0])).toBe(0)
  })
  it('puts the majority in a leaf no question can split', () => {
    const same = [ex([1], 0), ex([1], 0), ex([1], 1)]
    const tree = buildTree(same, 1, 2, 3)
    expect(tree.leaf).toBe(true)
    expect(tree.label).toBe(0)
  })
  it('stops at maxDepth', () => {
    const data = [
      ex([1, 0, 0], 0),
      ex([1, 0, 0], 0),
      ex([1, 1, 0], 1),
      ex([0, 0, 1], 1),
      ex([0, 0, 0], 1),
    ]
    expect(treeDepth(buildTree(data, 3, 2, 5))).toBe(2)
    const capped = buildTree(data, 3, 2, 1)
    expect(treeDepth(capped)).toBe(1)
    // Cut off, the furry leaf holds the majority of its examples (pets, 2 to 1).
    expect(capped.yes.label).toBe(0)
    expect(buildTree(data, 3, 2, 0).leaf).toBe(true)
  })
  it('cannot split when no single question gains anything (the XOR limit of ID3)', () => {
    const xor = [ex([0, 0], 0), ex([1, 1], 0), ex([0, 1], 1), ex([1, 0], 1)]
    expect(buildTree(xor, 2, 2, 5).leaf).toBe(true)
  })
  it('gives an empty branch the parent majority', () => {
    const data = [ex([1, 0], 0), ex([1, 1], 1), ex([1, 1], 1)]
    const tree = buildTree(data, 2, 2, 3)
    expect(classify(tree, [0, 1])).toBe(1)
  })
  it('does not change the examples it is given', () => {
    const data = [...PETS, ...WILD]
    const copy = JSON.stringify(data)
    buildTree(data, 3, 2, 3)
    expect(JSON.stringify(data)).toBe(copy)
  })
  it('handles three labels', () => {
    const data = [ex([1, 0], 0), ex([0, 1], 1), ex([0, 0], 2), ex([0, 0], 2)]
    const tree = buildTree(data, 2, 3, 3)
    expect(classify(tree, [1, 0])).toBe(0)
    expect(classify(tree, [0, 1])).toBe(1)
    expect(classify(tree, [0, 0])).toBe(2)
  })
})

describe('scoreTree', () => {
  it('counts the rows the tree gets right', () => {
    const tree = buildTree([...PETS, ...WILD], 3, 2, 3)
    const score = scoreTree(tree, [ex([1, 0, 0], 0), ex([0, 1, 0], 1), ex([0, 0, 1], 0)])
    expect(score.correct).toBe(2)
    expect(score.total).toBe(3)
    expect(score.results.map((r) => r.right)).toEqual([true, true, false])
  })
  it('scores an empty list as 0 of 0', () => {
    expect(scoreTree(buildTree([], 1, 2, 3), [])).toEqual({ correct: 0, total: 0, results: [] })
  })
})
