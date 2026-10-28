// Pure ID3 decision-tree logic for the Learning Tree activity. Node-safe: no React or DOM.
//
// An example is { f: [0|1, ...], l: labelIndex }: one 0/1 per yes/no feature and the index of its
// label. A tree node is either a leaf { leaf: true, label, counts, n } or a question
// { leaf: false, feature, yes, no, counts, n }. Everything is plain data, so the tree is rebuilt
// from the examples whenever they change and never stored.

// Entropy (in bits) of a list of label counts. 0 for an empty or pure set.
export function entropy(counts) {
  const total = counts.reduce((sum, c) => sum + c, 0)
  if (total === 0) return 0
  let h = 0
  for (const c of counts) {
    if (c > 0) h -= (c / total) * Math.log2(c / total)
  }
  return h
}

export function countLabels(examples, labelCount) {
  const counts = new Array(labelCount).fill(0)
  for (const ex of examples) counts[ex.l] += 1
  return counts
}

// The most common label; a tie goes to the first label. `fallback` is used with no examples.
export function majorityLabel(counts, fallback = 0) {
  let best = -1
  let label = fallback
  counts.forEach((c, i) => {
    if (c > best && c > 0) {
      best = c
      label = i
    }
  })
  return label
}

// Information gain of asking about `feature`.
export function informationGain(examples, feature, labelCount) {
  if (examples.length === 0) return 0
  const yes = examples.filter((ex) => ex.f[feature] === 1)
  const no = examples.filter((ex) => ex.f[feature] !== 1)
  const before = entropy(countLabels(examples, labelCount))
  const after =
    (yes.length / examples.length) * entropy(countLabels(yes, labelCount)) +
    (no.length / examples.length) * entropy(countLabels(no, labelCount))
  return before - after
}

// The feature with the most information gain among `available` (feature indexes). A tie goes to
// the lowest index. Null when nothing helps (no examples, or every gain is 0).
export function bestSplit(examples, available, labelCount) {
  let best = null
  for (const feature of available) {
    const gain = informationGain(examples, feature, labelCount)
    if (gain > 1e-9 && (best === null || gain > best.gain + 1e-9)) best = { feature, gain }
  }
  return best
}

// Builds the tree. Stops at maxDepth questions deep, at a pure node, or when no question helps.
// `allowed` (feature indexes) limits which features it may ask about; null means all of them.
export function buildTree(examples, featureCount, labelCount, maxDepth = 3, allowed = null) {
  const all = Array.from({ length: featureCount }, (_, i) => i).filter(
    (i) => !Array.isArray(allowed) || allowed.includes(i)
  )
  function grow(rows, available, depth, fallback) {
    const counts = countLabels(rows, labelCount)
    const label = majorityLabel(counts, fallback)
    const leaf = { leaf: true, label, counts, n: rows.length }
    const pure = counts.filter((c) => c > 0).length <= 1
    if (rows.length === 0 || pure || depth >= maxDepth) return leaf
    const split = bestSplit(rows, available, labelCount)
    if (!split) return leaf
    const rest = available.filter((f) => f !== split.feature)
    const yes = rows.filter((ex) => ex.f[split.feature] === 1)
    const no = rows.filter((ex) => ex.f[split.feature] !== 1)
    return {
      leaf: false,
      feature: split.feature,
      counts,
      n: rows.length,
      yes: grow(yes, rest, depth + 1, label),
      no: grow(no, rest, depth + 1, label),
    }
  }
  return grow(examples, all, 0, 0)
}

// Questions on the longest path (a lone leaf is 0).
export function treeDepth(node) {
  if (!node || node.leaf) return 0
  return 1 + Math.max(treeDepth(node.yes), treeDepth(node.no))
}

// How many boxes (questions and answers) the tree has.
export function nodeCount(node) {
  if (!node) return 0
  return node.leaf ? 1 : 1 + nodeCount(node.yes) + nodeCount(node.no)
}

// Walks the tree with a 0/1 feature list and returns the label index.
export function classify(node, f) {
  let at = node
  while (at && !at.leaf) at = f[at.feature] === 1 ? at.yes : at.no
  return at ? at.label : 0
}

// The route one feature list takes through the tree: every box visited (`nodes`, root first, the
// answer box last) and the questions answered on the way (`steps`: { feature, yes }).
export function pathOf(node, f) {
  const nodes = []
  const steps = []
  let at = node
  while (at) {
    nodes.push(at)
    if (at.leaf) break
    const yes = f[at.feature] === 1
    steps.push({ feature: at.feature, yes })
    at = yes ? at.yes : at.no
  }
  return { nodes, steps }
}

// Runs the tree on test rows ({ f, l }). Returns { correct, total, results: [{ predicted, right }] }.
export function scoreTree(node, rows) {
  const results = rows.map((row) => {
    const predicted = classify(node, row.f)
    return { predicted, right: predicted === row.l }
  })
  return { correct: results.filter((r) => r.right).length, total: rows.length, results }
}
