// CSS selector specificity for the HTML Inspector's "Why this …?" panel (./cascade.js). Pure.
//
// Specificity is [ids, classes, types]: ids count `#id`; classes count `.class`, `[attr]` and
// pseudo-classes; types count element names. `*` and combinators add nothing. Pseudo-elements
// (`::before`, legacy `:before`) are ignored: the Inspector only explains rules on the element
// itself. `:is()`, `:not()` and `:has()` take their most specific argument, `:where()` adds
// nothing, and the `:nth-*()` family counts as one pseudo-class (its `of S` part is ignored).

const LEGACY_PSEUDO_ELEMENTS = new Set(['before', 'after', 'first-line', 'first-letter'])
const MOST_SPECIFIC_ARG = new Set(['is', 'not', 'has', 'matches', '-webkit-any', '-moz-any'])
const ZERO_ARG = new Set(['where'])

const IDENT_CHAR = /[\w\u00a0-\uffff-]/

function readIdent(selector, start) {
  let i = start
  while (i < selector.length) {
    if (selector[i] === '\\') {
      i += 2
      continue
    }
    if (!IDENT_CHAR.test(selector[i])) break
    i += 1
  }
  return i
}

// Index just past the bracket that closes the one opened at `start` (`(` or `[`), skipping
// quoted strings. Returns selector.length when it never closes.
function skipBalanced(selector, start) {
  const open = selector[start]
  const close = open === '(' ? ')' : ']'
  let depth = 0
  let quote = null
  for (let i = start; i < selector.length; i += 1) {
    const ch = selector[i]
    if (quote) {
      if (ch === '\\') i += 1
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") quote = ch
    else if (ch === open) depth += 1
    else if (ch === close) {
      depth -= 1
      if (depth === 0) return i + 1
    }
  }
  return selector.length
}

/** Splits a selector list on its top-level commas (not those inside brackets or strings). */
export function splitSelectorList(list) {
  const text = String(list ?? '')
  const parts = []
  let depth = 0
  let quote = null
  let last = 0
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quote) {
      if (ch === '\\') i += 1
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") quote = ch
    else if (ch === '(' || ch === '[') depth += 1
    else if (ch === ')' || ch === ']') depth -= 1
    else if (ch === ',' && depth === 0) {
      parts.push(text.slice(last, i).trim())
      last = i + 1
    }
  }
  parts.push(text.slice(last).trim())
  return parts.filter(Boolean)
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function maxOf(list) {
  return splitSelectorList(list)
    .map((selector) => selectorSpecificity(selector))
    .reduce((best, next) => (compareSpecificity(next, best) > 0 ? next : best), [0, 0, 0])
}

/** The specificity [ids, classes, types] of one complex selector (no top-level commas). */
export function selectorSpecificity(selector) {
  const text = String(selector ?? '')
  let total = [0, 0, 0]
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === '#') {
      total = add(total, [1, 0, 0])
      i = readIdent(text, i + 1)
    } else if (ch === '.') {
      total = add(total, [0, 1, 0])
      i = readIdent(text, i + 1)
    } else if (ch === '[') {
      total = add(total, [0, 1, 0])
      i = skipBalanced(text, i)
    } else if (ch === ':') {
      const isElement = text[i + 1] === ':'
      const nameStart = isElement ? i + 2 : i + 1
      const nameEnd = readIdent(text, nameStart)
      const name = text.slice(nameStart, nameEnd).toLowerCase()
      const hasArgs = text[nameEnd] === '('
      const argsEnd = hasArgs ? skipBalanced(text, nameEnd) : nameEnd
      if (isElement || LEGACY_PSEUDO_ELEMENTS.has(name)) {
        // Pseudo-elements are ignored.
      } else if (MOST_SPECIFIC_ARG.has(name) && hasArgs) {
        total = add(total, maxOf(text.slice(nameEnd + 1, argsEnd - 1)))
      } else if (ZERO_ARG.has(name)) {
        // :where() adds nothing.
      } else {
        total = add(total, [0, 1, 0])
      }
      i = argsEnd
    } else if (ch === '*') {
      i += 1
    } else if (IDENT_CHAR.test(ch) || ch === '\\') {
      const end = readIdent(text, i)
      // A namespace prefix (`svg|rect`) is part of the type selector; `|` itself adds nothing.
      total = add(total, [0, 0, 1])
      i = end
    } else if (ch === '(' || ch === '"' || ch === "'") {
      // Stray brackets or strings outside a pseudo-class: skip them whole.
      i = ch === '(' ? skipBalanced(text, i) : text.indexOf(ch, i + 1) + 1 || text.length
    } else {
      // Combinators (` `, `>`, `+`, `~`), `|` and anything else add nothing.
      i += 1
    }
  }
  return total
}

/** Compares two specificities: > 0 when `a` is more specific, < 0 when less, 0 when equal. */
export function compareSpecificity(a, b) {
  for (let i = 0; i < 3; i += 1) {
    const diff = (a?.[i] ?? 0) - (b?.[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/** "(1,0,2)" — specificity as the panel's secondary text. */
export function formatSpecificity(spec) {
  return `(${(spec ?? [0, 0, 0]).join(',')})`
}

/** Whether a selector targets a pseudo-element (`::before`, `:after`), which never matches the
 * element itself. */
export function hasPseudoElement(selector) {
  const text = String(selector ?? '')
  if (/::/.test(text)) return true
  return /:(before|after|first-line|first-letter)\b/i.test(text)
}
