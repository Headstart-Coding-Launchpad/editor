// Pure logic for the Learning Tree activity: task validation, the student's state, the tree they
// grow, the test and grading. Node-safe (no React, JSX or DOM) so the CLI, the Builder and print
// share it. The ID3 maths is in ./tree.js.
//
// State (JSON, small): { v: 1, examples: [{ n: 'cat', f: '101', l: 0 }], tried: false, d: 2 }
//   u = which features the tree may use, one 0/1 per feature (a string; only when the task has
//   studentPicksFeatures; absent means none picked yet). The examples always keep every feature.
//   d = the depth the student chose with the dial (only there once they changed it; see depthOf),
//   n = the item's name (up to 16 chars), f = one 0/1 per feature (a string), l = label index,
//   tried = the student pressed "Try it" on the current tree (adding or removing an example
//   clears it, because the tree changed). The tree and the score are never stored: they are
//   rebuilt from the examples and the lesson's test items.
import { buildTree, informationGain, scoreTree, treeDepth } from './tree.js'

export const DEFAULT_MAX_EXAMPLES = 20
export const DEFAULT_MAX_DEPTH = 3
export const MIN_MAX_EXAMPLES = 4
export const HARD_MAX_EXAMPLES = 40
export const MAX_DEPTH_LIMIT = 5
export const MAX_FEATURES = 6
export const MAX_LABELS = 6
export const MAX_NAME = 16
export const MAX_TEST_ITEMS = 12
export const MIN_TEST_ITEMS = 2
export const DEFAULT_PASS_SHARE = 0.8

const isText = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max

export const MIN_DECK = 4
export const MAX_DECK = 16

// Deck mode (task.deck): ready-made cards the student sorts into the label bins. Cards are
// { name, emoji, yes }. Without a deck the activity is the add-an-example form.
// State in deck mode adds: b = one char per card ('-' in the deck, else the bin's label index),
// ln = the bin names the child typed (studentLabels), q = one char per test item for 20 Questions
// ('-' not played, 'r'/'w' the child marked the tree's guess right/wrong). The examples are
// derived from b.
export function deckCardsOf(task) {
  return Array.isArray(task?.deck) ? task.deck : []
}

export function deckOn(task) {
  return deckCardsOf(task).length > 0
}

export function studentLabelsOn(task) {
  return deckOn(task) && task?.studentLabels === true
}

export function twentyQuestionsOn(task) {
  return deckOn(task) && task?.twentyQuestions === true
}

// The features: task.features, or (deck mode, none given) every tag the deck cards use.
export function featuresOf(task) {
  if (Array.isArray(task?.features)) return task.features.map((f) => String(f))
  const out = []
  for (const card of deckCardsOf(task)) {
    for (const tag of Array.isArray(card?.yes) ? card.yes : []) {
      if (!out.includes(String(tag))) out.push(String(tag))
    }
  }
  return out
}

// The deck as rows: { name, emoji, f: [0|1...] }.
export function deckRowsOf(task) {
  const features = featuresOf(task)
  return deckCardsOf(task).map((card, i) => {
    const yes = Array.isArray(card?.yes) ? card.yes.map(String) : []
    return {
      name: String(card?.name ?? `Card ${i + 1}`),
      emoji: String(card?.emoji ?? ''),
      f: features.map((f) => (yes.includes(f) ? 1 : 0)),
    }
  })
}

// The bin names the child sees: their own when they renamed a bin (studentLabels), else the lesson's.
export function displayLabelsOf(task, state) {
  const labels = labelsOf(task)
  if (!studentLabelsOn(task) || !Array.isArray(state?.ln)) return labels
  return labels.map((l, i) => String(state.ln[i] ?? '').trim() || l)
}

export function labelsOf(task) {
  return Array.isArray(task?.labels) ? task.labels.map((l) => String(l)) : []
}

export function maxExamplesOf(task) {
  const n = task?.maxExamples
  return Number.isInteger(n) && n >= MIN_MAX_EXAMPLES && n <= HARD_MAX_EXAMPLES
    ? n
    : DEFAULT_MAX_EXAMPLES
}

export function maxDepthOf(task) {
  const n = task?.maxDepth
  return Number.isInteger(n) && n >= 1 && n <= MAX_DEPTH_LIMIT ? n : DEFAULT_MAX_DEPTH
}

// Whether the student gets the depth dial (the author can hide it with studentDepth: false).
export function studentDepthOn(task) {
  return task?.studentDepth !== false
}

// Keeps a chosen depth in 1..the author's maxDepth.
export function clampDepth(task, d) {
  const n = Math.round(Number(d))
  if (!Number.isFinite(n)) return maxDepthOf(task)
  return Math.max(1, Math.min(maxDepthOf(task), n))
}

// The depth the tree is grown to: the student's choice (when the dial is on), else maxDepth.
export function depthOf(task, state) {
  if (!studentDepthOn(task) || !Number.isInteger(state?.d)) return maxDepthOf(task)
  return clampDepth(task, state.d)
}

// studentPicksFeatures: the most features the student may let the tree use (0 when the task does
// not offer the choice, which means the tree uses every feature).
export function picksOf(task) {
  const n = task?.studentPicksFeatures
  const count = featuresOf(task).length
  return Number.isInteger(n) && n >= 1 && count >= 1 ? Math.min(n, count) : 0
}

// Which features the tree may use (indexes): all of them unless the student picks.
export function allowedFeaturesOf(task, state) {
  const count = featuresOf(task).length
  const all = Array.from({ length: count }, (_, i) => i)
  if (!picksOf(task)) return all
  const u = typeof state?.u === 'string' ? state.u : ''
  return all.filter((i) => u[i] === '1')
}

// The names of the features the tree may use.
export function chosenFeaturesOf(task, state) {
  const features = featuresOf(task)
  return allowedFeaturesOf(task, state).map((i) => features[i])
}

// "has_fur" is shown as the question "has fur?".
export function featureQuestion(name) {
  const text = String(name ?? '')
    .replace(/_/g, ' ')
    .trim()
  return text.endsWith('?') ? text : `${text}?`
}

// The lesson's test items as rows: { id, name, f: [0|1...], l }. Items that don't fit are skipped.
export function testRowsOf(task) {
  const features = featuresOf(task)
  const labels = labelsOf(task)
  const items = Array.isArray(task?.testItems) ? task.testItems : []
  return items
    .map((item, i) => {
      const yes = Array.isArray(item?.yes) ? item.yes.map(String) : []
      return {
        id: `t${i + 1}`,
        name: String(item?.name ?? `Item ${i + 1}`),
        emoji: typeof item?.emoji === 'string' ? item.emoji : '',
        f: features.map((f) => (yes.includes(f) ? 1 : 0)),
        l: labels.indexOf(String(item?.label)),
      }
    })
    .filter((row) => row.l >= 0)
}

// How many test items the tree must sort right: passAt as a count (1 or more, whole) or a share
// (above 0 and below 1); default 80% rounded up (4 of 5).
export function targetOf(task, total) {
  const p = task?.passAt
  let target
  if (typeof p === 'number' && p > 0 && p < 1) target = Math.ceil(p * total - 1e-9)
  else if (Number.isInteger(p) && p >= 1) target = p
  else target = Math.ceil(DEFAULT_PASS_SHARE * total - 1e-9)
  return Math.max(1, Math.min(total, target))
}

export function initialLearningTreeState() {
  return { v: 1, examples: [], tried: false }
}

// Reads any saved/shared/invalid state into the clean form for this task.
export function normalizeState(task, raw) {
  const base = initialLearningTreeState()
  if (!raw || typeof raw !== 'object') return base
  const featureCount = featuresOf(task).length
  const labelCount = labelsOf(task).length
  const cap = maxExamplesOf(task)
  let out
  if (deckOn(task)) {
    const deck = deckRowsOf(task)
    const bRaw = typeof raw.b === 'string' ? raw.b : ''
    const b = deck
      .map((_, i) => (/^\d$/.test(bRaw[i] ?? '') && Number(bRaw[i]) < labelCount ? bRaw[i] : '-'))
      .join('')
    const examples = deck.flatMap((card, i) =>
      b[i] === '-' ? [] : [{ n: card.name.slice(0, MAX_NAME), f: card.f.join(''), l: Number(b[i]) }]
    )
    out = { v: 1, examples, b, tried: false }
    if (studentLabelsOn(task) && Array.isArray(raw.ln)) {
      out.ln = Array.from({ length: labelCount }, (_, i) =>
        String(raw.ln[i] ?? '').slice(0, MAX_NAME)
      )
    }
    if (twentyQuestionsOn(task)) {
      const rows = testRowsOf(task).length
      const qRaw = typeof raw.q === 'string' && examples.length >= 2 ? raw.q : ''
      out.q = Array.from({ length: rows }, (_, i) =>
        qRaw[i] === 'r' || qRaw[i] === 'w' ? qRaw[i] : '-'
      ).join('')
      out.tried = out.q.includes('r') || out.q.includes('w')
    } else out.tried = raw.tried === true && examples.length > 0
  } else {
    const examples = (Array.isArray(raw.examples) ? raw.examples : [])
      .filter(
        (ex) =>
          ex &&
          typeof ex.f === 'string' &&
          ex.f.length === featureCount &&
          /^[01]*$/.test(ex.f) &&
          Number.isInteger(ex.l) &&
          ex.l >= 0 &&
          ex.l < labelCount
      )
      .slice(0, cap)
      .map((ex) => ({ n: String(ex.n ?? '').slice(0, MAX_NAME), f: ex.f, l: ex.l }))
    out = { v: 1, examples, tried: raw.tried === true && examples.length > 0 }
  }
  if (studentDepthOn(task) && Number.isInteger(raw.d)) out.d = clampDepth(task, raw.d)
  const picks = picksOf(task)
  if (
    picks &&
    typeof raw.u === 'string' &&
    raw.u.length === featureCount &&
    /^[01]*$/.test(raw.u)
  ) {
    let kept = 0
    out.u = Array.from(raw.u, (c) => {
      if (c === '1' && kept < picks) {
        kept += 1
        return '1'
      }
      return '0'
    }).join('')
  }
  return out
}

// The examples as tree rows.
export function rowsOf(state) {
  return (state?.examples ?? []).map((ex) => ({
    n: ex.n,
    f: Array.from(ex.f, (c) => (c === '1' ? 1 : 0)),
    l: ex.l,
  }))
}

export function treeOf(task, state) {
  return buildTree(
    rowsOf(state),
    featuresOf(task).length,
    labelsOf(task).length,
    depthOf(task, state),
    picksOf(task) ? allowedFeaturesOf(task, state) : null
  )
}

// Whole-task result: the tree, its depth, the score on the test items, and whether it passes.
// The score only counts once the student has pressed Try it on the current tree.
export function gradeTask(task, state) {
  const tree = treeOf(task, state)
  const rows = testRowsOf(task)
  const scored = scoreTree(tree, rows)
  const target = targetOf(task, rows.length)
  if (twentyQuestionsOn(task)) {
    // 20 Questions: only the cards the child has played count. With studentLabels the bins are
    // the child's own, so a round passes when the child marked it right; otherwise it passes
    // when the tree's guess matches the test item's label.
    const q = typeof state?.q === 'string' ? state.q : ''
    const mine = studentLabelsOn(task)
    const played = rows.map((_, i) => q[i] === 'r' || q[i] === 'w')
    const results = scored.results.map((r, i) => ({
      ...r,
      right: played[i] && (mine ? q[i] === 'r' : r.right),
    }))
    const correct = results.filter((r) => r.right).length
    const tried = played.some(Boolean)
    return {
      tree,
      depth: treeDepth(tree),
      count: state?.examples?.length ?? 0,
      tried,
      total: rows.length,
      playedCount: played.filter(Boolean).length,
      played,
      correct,
      results,
      rows,
      target,
      passed: tried && rows.length > 0 && correct >= target,
    }
  }
  const tried = state?.tried === true
  return {
    tree,
    depth: treeDepth(tree),
    count: state?.examples?.length ?? 0,
    tried,
    total: rows.length,
    playedCount: tried ? rows.length : 0,
    played: rows.map(() => tried),
    correct: tried ? scored.correct : 0,
    results: scored.results,
    rows,
    target,
    passed: tried && rows.length > 0 && scored.correct >= target,
  }
}

// A hint for a tree that did not pass yet. Short, plain, points at the problem, no answer.
export function hintFor(task, state) {
  const g = gradeTask(task, state)
  if (deckOn(task)) {
    if (g.count < 2) return 'Drag some cards into the bins first.'
    if (!g.tried)
      return twentyQuestionsOn(task)
        ? 'Press Play 20 Questions to test your tree on a new card.'
        : 'Press Try it to see how your tree does on new cards.'
    if (g.passed) return null
    return `Your tree got ${g.correct} of ${g.playedCount}. Sort the cards a different way and play again.`
  }
  if (g.count === 0)
    return 'Add some examples first. Name an item, tick what is true, pick a label.'
  if (picksOf(task) && allowedFeaturesOf(task, state).length === 0)
    return `Pick up to ${picksOf(task)} features for the tree to use.`
  if (!g.tried) return 'Press Try it to see how your tree does on new things.'
  if (g.passed) return null
  const wrong = g.results.findIndex((r) => !r.right)
  const name = g.rows[wrong]?.name
  return name
    ? `Your tree got ${g.correct} of ${g.total}. It got "${name}" wrong. Add an example like it.`
    : `Your tree got ${g.correct} of ${g.total}. Add examples that show it the difference.`
}

// What is sent to Firebase, the tutor card and the attempt log: the examples (the tutor needs to
// see them) with the numbers a report wants.
export function sharedState(task, state) {
  const clean = normalizeState(task, state)
  const g = gradeTask(task, clean)
  return {
    ...clean,
    count: g.count,
    depth: g.depth,
    chosenDepth: depthOf(task, clean),
    ...(picksOf(task) ? { chosenFeatures: chosenFeaturesOf(task, clean) } : {}),
    score: g.tried ? { correct: g.correct, total: g.playedCount } : null,
    ...(deckOn(task) ? { sorted: g.count, labelNames: displayLabelsOf(task, clean) } : {}),
  }
}

// itemProgress for the report and grade: test item id -> right (only after Try it).
export function itemResultsOf(task, state) {
  const g = gradeTask(task, state)
  if (!g.tried) return {}
  return Object.fromEntries(
    g.rows.flatMap((row, i) => (g.played[i] ? [[row.id, g.results[i].right]] : []))
  )
}

// Authoring validation shared by the Builder and the CLI. `n` is the 1-based task number.
// Every message pushed here must be listed in docs/authoring/validation-errors.md
// (validationErrorsDoc.test.js checks it), with `…` in place of each ${...}.
export function validateLearningTreeTask(task, n) {
  const errors = []
  const where = `Task ${n}`
  const features = task?.features
  const labels = task?.labels
  let featureNames = []
  let labelNames = []

  if (task?.deck != null) {
    const deck = task.deck
    if (!Array.isArray(deck) || deck.length < MIN_DECK || deck.length > MAX_DECK) {
      errors.push(`${where}: deck needs ${MIN_DECK} to ${MAX_DECK} cards.`)
    }
    if (task.studentLabels != null && typeof task.studentLabels !== 'boolean') {
      errors.push(`${where}: studentLabels must be true or false.`)
    }
    if (task.twentyQuestions != null && typeof task.twentyQuestions !== 'boolean') {
      errors.push(`${where}: twentyQuestions must be true or false.`)
    }
  } else if (task?.studentLabels != null || task?.twentyQuestions != null) {
    errors.push(`${where}: studentLabels and twentyQuestions need a deck.`)
  }

  // Deck mode may leave `features` out: then every tag the cards use is a feature.
  const featureList = features == null && deckOn(task) ? featuresOf(task) : features
  if (
    !Array.isArray(featureList) ||
    featureList.length < 1 ||
    featureList.length > MAX_FEATURES ||
    !featureList.every((f) => isText(f, 24)) ||
    new Set(featureList).size !== featureList.length
  ) {
    errors.push(
      `${where}: features must be 1 to ${MAX_FEATURES} different names, each 1 to 24 characters.`
    )
  } else featureNames = featureList

  if (
    !Array.isArray(labels) ||
    labels.length < 2 ||
    labels.length > MAX_LABELS ||
    !labels.every((l) => isText(l, MAX_NAME)) ||
    new Set(labels).size !== labels.length
  ) {
    errors.push(
      `${where}: labels must be 2 to ${MAX_LABELS} different names, each 1 to ${MAX_NAME} characters.`
    )
  } else labelNames = labels

  if (
    task?.maxExamples != null &&
    !(
      Number.isInteger(task.maxExamples) &&
      task.maxExamples >= MIN_MAX_EXAMPLES &&
      task.maxExamples <= HARD_MAX_EXAMPLES
    )
  ) {
    errors.push(
      `${where}: maxExamples must be a whole number from ${MIN_MAX_EXAMPLES} to ${HARD_MAX_EXAMPLES}.`
    )
  }
  if (
    task?.maxDepth != null &&
    !(Number.isInteger(task.maxDepth) && task.maxDepth >= 1 && task.maxDepth <= MAX_DEPTH_LIMIT)
  ) {
    errors.push(`${where}: maxDepth must be a whole number from 1 to ${MAX_DEPTH_LIMIT}.`)
  }

  if (task?.studentDepth != null && typeof task.studentDepth !== 'boolean') {
    errors.push(`${where}: studentDepth must be true or false.`)
  }

  if (task?.studentPicksFeatures != null) {
    const n = task.studentPicksFeatures
    const most = Math.max(featureNames.length, 1)
    if (!(Number.isInteger(n) && n >= 1 && n <= most)) {
      errors.push(
        `${where}: studentPicksFeatures must be a whole number from 1 to the number of features (${most}).`
      )
    }
  }

  if (Array.isArray(task?.deck)) {
    task.deck.forEach((card, i) => {
      const label = `${where} card ${i + 1}`
      if (!isText(card?.name, MAX_NAME)) {
        errors.push(`${label}: name is required (1 to ${MAX_NAME} characters).`)
      }
      if (!isText(card?.emoji, 8)) errors.push(`${label}: emoji is required.`)
      if (
        !Array.isArray(card?.yes) ||
        !card.yes.every((f) => featureNames.includes(f)) ||
        new Set(card.yes).size !== card.yes.length
      ) {
        errors.push(`${label}: yes must list only the task's features, each once.`)
      }
    })
  }

  const items = task?.testItems
  if (!Array.isArray(items) || items.length < MIN_TEST_ITEMS || items.length > MAX_TEST_ITEMS) {
    errors.push(`${where}: testItems needs ${MIN_TEST_ITEMS} to ${MAX_TEST_ITEMS} items.`)
  } else {
    items.forEach((item, i) => {
      const label = `${where} item ${i + 1}`
      if (!isText(item?.name, MAX_NAME)) {
        errors.push(`${label}: name is required (1 to ${MAX_NAME} characters).`)
      }
      if (!labelNames.includes(item?.label)) {
        errors.push(`${label}: label must be one of the task's labels.`)
      }
      if (
        !Array.isArray(item?.yes) ||
        !item.yes.every((f) => featureNames.includes(f)) ||
        new Set(item.yes).size !== item.yes.length
      ) {
        errors.push(`${label}: yes must list only the task's features, each once.`)
      }
    })
  }

  const p = task?.passAt
  if (p != null) {
    const total = Array.isArray(items) ? items.length : 0
    const fraction = typeof p === 'number' && p > 0 && p < 1
    const count = Number.isInteger(p) && p >= 1 && p <= total
    if (!fraction && !count) {
      errors.push(
        `${where}: passAt must be a share above 0 and below 1 (0.8) or a whole number of test items.`
      )
    }
  }
  return errors
}

export function validateLearningTreeWarnings(task, n) {
  const warnings = []
  const rows = testRowsOf(task)
  if (rows.length >= MIN_TEST_ITEMS) {
    const first = rows.filter((r) => r.l === 0).length
    // An empty tree answers the first label every time; the lesson must not let that pass.
    if (first >= targetOf(task, rows.length)) {
      warnings.push(
        `Task ${n}: the first label is the right answer for ${first} of ${rows.length} test items, so an empty tree could pass. Make more test items use the other labels.`
      )
    }
  }
  return warnings
}

// A tree that works: the lesson's own test items as examples, tried. (The student's real
// examples are their own, so this is only for "show answers" and the contract tests.)
export function solutionFor(task) {
  if (deckOn(task)) return deckSolutionFor(task)
  const examples = testRowsOf(task)
    .slice(0, maxExamplesOf(task))
    .map((row) => ({ n: row.name.slice(0, MAX_NAME), f: row.f.join(''), l: row.l }))
  const state = { v: 1, examples, tried: examples.length > 0 }
  const picks = picksOf(task)
  if (picks) {
    // The most useful features on the test items themselves.
    const rows = testRowsOf(task)
    const ranked = featuresOf(task)
      .map((_, i) => ({ i, gain: informationGain(rows, i, labelsOf(task).length) }))
      .sort((a, b) => b.gain - a.gain || a.i - b.i)
      .slice(0, picks)
      .map((r) => r.i)
    state.u = featuresOf(task)
      .map((_, i) => (ranked.includes(i) ? '1' : '0'))
      .join('')
  }
  return state
}

// Deck mode "show answers": split the deck on the feature that best separates the test items,
// the side that mostly shares the feature going to the label those items mostly have.
function deckSolutionFor(task) {
  const rows = testRowsOf(task)
  const labelCount = labelsOf(task).length
  const deck = deckRowsOf(task)
  let best = 0
  let bestGain = -1
  featuresOf(task).forEach((_, i) => {
    const gain = informationGain(rows, i, labelCount)
    if (gain > bestGain + 1e-9) {
      best = i
      bestGain = gain
    }
  })
  const majority = (side) => {
    const counts = new Array(labelCount).fill(0)
    rows.filter((r) => r.f[best] === side).forEach((r) => (counts[r.l] += 1))
    return counts.indexOf(Math.max(...counts))
  }
  const yesLabel = majority(1)
  let noLabel = majority(0)
  if (noLabel === yesLabel) noLabel = (yesLabel + 1) % labelCount
  const b = deck.map((card) => String(card.f[best] === 1 ? yesLabel : noLabel)).join('')
  const state = { v: 1, b, examples: [], tried: false }
  if (twentyQuestionsOn(task)) state.q = 'r'.repeat(rows.length)
  else state.tried = true
  if (studentLabelsOn(task)) state.ln = labelsOf(task)
  const picks = picksOf(task)
  if (picks) {
    state.u = featuresOf(task)
      .map((_, i) => (i === best ? '1' : '0'))
      .join('')
  }
  return normalizeState(task, state)
}
