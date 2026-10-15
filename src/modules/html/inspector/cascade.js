// "Why this …?" for the HTML Inspector: every rule that sets a property on an element, in
// cascade order, with the winner and a plain-words reason for each loser. Reads the preview
// iframe's own document (same-origin), so it needs a DOM but no React. Never changes the page.
//
// The cascade here is the part students meet: !important, the style="…" attribute, specificity
// (./specificity.js), source order, and inheritance from a parent when nothing sets an inherited
// property directly. Browser (user-agent) styles aren't readable, so "nothing set it" reads as
// "the browser's default". Cross-origin stylesheets can't be read; they are skipped and counted.
import {
  compareSpecificity,
  formatSpecificity,
  hasPseudoElement,
  selectorSpecificity,
  splitSelectorList,
} from './specificity.js'
import { getInspectorProperty } from './config.js'

const INLINE_SPECIFICITY = Object.freeze([Infinity, 0, 0])

export const REASONS = Object.freeze({
  important: 'overridden by !important',
  inline: 'beaten by the style="…" on the tag',
  specificity: 'less specific',
  orderSameFile: 'earlier in the file',
  orderOtherFile: 'loaded earlier',
})

/** "p#intro.card.big" — tag, id and classes, as the panel and the overlay tag show it. */
export function describeElement(el) {
  if (!el?.tagName) return ''
  const tag = el.tagName.toLowerCase()
  const id = el.id ? `#${el.id}` : ''
  const classes = Array.from(el.classList ?? [])
    .map((name) => `.${name}`)
    .join('')
  return `${tag}${id}${classes}`
}

function sheetLabel(sheet, index, { fileNameForUrl, pageName }) {
  const owner = sheet?.ownerNode
  const tag = owner?.tagName?.toLowerCase?.()
  if (tag === 'style') return pageName ? `<style> in ${pageName}` : '<style>'
  const href = sheet?.href ?? owner?.getAttribute?.('href') ?? ''
  const known = href ? fileNameForUrl?.(href) : null
  if (known) return known
  if (href && !href.startsWith('blob:')) return href.split(/[?#]/)[0].split('/').pop() || href
  return `stylesheet ${index + 1}`
}

function mediaApplies(rule, win) {
  const text = rule?.media?.mediaText
  if (!text || typeof win?.matchMedia !== 'function') return true
  try {
    return win.matchMedia(text).matches
  } catch {
    return true
  }
}

// Style rules in document order, flattening @media (when it applies), @supports, @layer and
// @import. `onSkip` is called for each sheet whose rules can't be read (cross-origin).
function collectStyleRules(doc, win, onSkip) {
  const out = []
  const sheets = Array.from(doc?.styleSheets ?? [])
  function walk(rules, sheetIndex, sheet) {
    for (const rule of Array.from(rules ?? [])) {
      if (rule?.selectorText != null && rule.style) {
        out.push({ rule, sheetIndex, sheet })
      } else if (rule?.styleSheet) {
        let nested = null
        try {
          nested = rule.styleSheet.cssRules
        } catch {
          onSkip(rule.styleSheet)
          continue
        }
        walk(nested, sheetIndex, sheet)
      } else if (rule?.cssRules) {
        if (rule.media && !mediaApplies(rule, win)) continue
        walk(rule.cssRules, sheetIndex, sheet)
      }
    }
  }
  sheets.forEach((sheet, sheetIndex) => {
    let rules = null
    try {
      rules = sheet.cssRules
    } catch {
      onSkip(sheet)
      return
    }
    walk(rules, sheetIndex, sheet)
  })
  return out
}

// What a style declaration sets among `longhands`. Browsers expand a shorthand (`margin: 4px`)
// into its longhands; where a CSSOM doesn't, the shorthand stands in for all of them.
function readDeclaration(style, longhands, shorthand = null) {
  const values = {}
  const important = {}
  for (const name of longhands) {
    const value = style?.getPropertyValue?.(name)
    if (value == null || value === '') continue
    values[name] = String(value).trim()
    important[name] = style.getPropertyPriority?.(name) === 'important'
  }
  if (Object.keys(values).length === 0 && shorthand) {
    const value = style?.getPropertyValue?.(shorthand)
    if (value) {
      const isImportant = style.getPropertyPriority?.(shorthand) === 'important'
      for (const name of longhands) {
        values[name] = String(value).trim()
        important[name] = isImportant
      }
    }
  }
  return Object.keys(values).length > 0 ? { values, important } : null
}

function bestMatch(el, selectorText) {
  let best = null
  for (const selector of splitSelectorList(selectorText)) {
    if (hasPseudoElement(selector)) continue
    let matches = false
    try {
      matches = el.matches(selector)
    } catch {
      matches = false
    }
    if (!matches) continue
    const specificity = selectorSpecificity(selector)
    if (!best || compareSpecificity(specificity, best.specificity) > 0) {
      best = { selector, specificity }
    }
  }
  return best
}

/**
 * Every declaration on `el` that sets one of `longhands`: author rules (in document order) and
 * the style attribute. Each: { id, kind: 'rule' | 'inline', selector, ruleSelector,
 * specificity, values, important, order, sheetIndex, source, shorthandValue }.
 */
export function collectDeclarations(el, longhands, ctx = {}) {
  const doc = el?.ownerDocument
  const win = doc?.defaultView ?? ctx.win
  const skipped = new Set()
  const rules = ctx.rules ?? collectStyleRules(doc, win, (sheet) => skipped.add(sheet))
  const out = []
  rules.forEach(({ rule, sheetIndex, sheet }, order) => {
    const read = readDeclaration(rule.style, longhands, ctx.shorthand)
    if (!read) return
    const match = bestMatch(el, rule.selectorText)
    if (!match) return
    out.push({
      id: `rule-${order}`,
      kind: 'rule',
      selector: match.selector,
      ruleSelector: rule.selectorText,
      specificity: match.specificity,
      ...read,
      order,
      sheetIndex,
      source: sheetLabel(sheet, sheetIndex, ctx),
      shorthandValue: ctx.shorthand ? rule.style.getPropertyValue(ctx.shorthand) || '' : '',
    })
  })
  const inline = readDeclaration(el?.style, longhands, ctx.shorthand)
  if (inline && el.getAttribute?.('style')) {
    out.push({
      id: 'inline',
      kind: 'inline',
      selector: 'style="…"',
      ruleSelector: null,
      specificity: INLINE_SPECIFICITY,
      ...inline,
      order: Number.MAX_SAFE_INTEGER,
      sheetIndex: -1,
      source: 'the tag itself',
      shorthandValue: ctx.shorthand ? el.style.getPropertyValue(ctx.shorthand) || '' : '',
    })
  }
  return { declarations: out, skippedSheets: ctx.skippedSheets ?? skipped.size }
}

// Cascade precedence for one longhand: > 0 when `a` beats `b`.
export function comparePrecedence(a, b, longhand) {
  const ai = !!a.important[longhand]
  const bi = !!b.important[longhand]
  if (ai !== bi) return ai ? 1 : -1
  const aInline = a.kind === 'inline'
  const bInline = b.kind === 'inline'
  if (aInline !== bInline) return aInline ? 1 : -1
  const spec = compareSpecificity(a.specificity, b.specificity)
  if (spec !== 0) return spec
  return a.order - b.order
}

/** Why `loser` lost to `winner` on `longhand`, as { key, text } in plain words. */
export function loseReason(loser, winner, longhand) {
  if (winner.important[longhand] && !loser.important[longhand]) {
    return { key: 'important', text: REASONS.important }
  }
  if (winner.kind === 'inline' && loser.kind !== 'inline') {
    return { key: 'inline', text: REASONS.inline }
  }
  if (compareSpecificity(winner.specificity, loser.specificity) > 0) {
    return { key: 'specificity', text: REASONS.specificity }
  }
  return winner.sheetIndex === loser.sheetIndex
    ? { key: 'order', text: REASONS.orderSameFile }
    : { key: 'order', text: REASONS.orderOtherFile }
}

/**
 * Ranks declarations: per longhand the highest precedence wins. Returns the entries sorted
 * winner first, each with status 'winner' (wins every longhand it sets), 'partial' (wins some —
 * `winsFor` lists them) or 'loser' (with `reason` against what beat it).
 */
export function rankDeclarations(declarations, longhands) {
  const winners = {}
  for (const longhand of longhands) {
    const setters = declarations.filter((decl) => longhand in decl.values)
    if (setters.length === 0) continue
    winners[longhand] = setters.reduce((best, decl) =>
      comparePrecedence(decl, best, longhand) > 0 ? decl : best
    )
  }
  const entries = declarations.map((decl) => {
    const set = Object.keys(decl.values)
    const winsFor = set.filter((longhand) => winners[longhand] === decl)
    if (winsFor.length === set.length) return { ...decl, status: 'winner', winsFor, reason: null }
    const lostOn = set.find((longhand) => winners[longhand] !== decl)
    const beatenBy = winners[lostOn]
    return {
      ...decl,
      status: winsFor.length > 0 ? 'partial' : 'loser',
      winsFor,
      reason: loseReason(decl, beatenBy, lostOn),
      beatenBy: beatenBy.id,
    }
  })
  const rank = { winner: 0, partial: 1, loser: 2 }
  const first = longhands.find((longhand) => winners[longhand])
  return entries.sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status]
    const on = longhands.find((l) => l in a.values && l in b.values) ?? first
    return on ? comparePrecedence(b, a, on) : 0
  })
}

/** What an entry sets, for display: the shorthand when the rule wrote one, else its longhands. */
export function entryValueText(entry, prop) {
  if (entry.shorthandValue) return entry.shorthandValue
  const names = Object.keys(entry.values)
  if (prop.longhands.length === 1 || names.length === 1) {
    return names.length === 1 && prop.longhands.length > 1
      ? `${names[0]}: ${entry.values[names[0]]}`
      : entry.values[names[0]]
  }
  return names.map((name) => `${name}: ${entry.values[name]}`).join('; ')
}

function computedText(el, prop) {
  const win = el?.ownerDocument?.defaultView
  let style = null
  try {
    style = win?.getComputedStyle?.(el) ?? null
  } catch {
    style = null
  }
  if (!style) return ''
  const whole = style.getPropertyValue(prop.key)
  if (whole) return String(whole).trim()
  const parts = prop.longhands.map((name) => style.getPropertyValue(name)).filter(Boolean)
  return parts.length === 0
    ? ''
    : parts.every((part) => part === parts[0])
      ? parts[0]
      : parts.join(' ')
}

/**
 * Explains one property on one element:
 * {
 *   property, label, value (computed), entries (ranked, see rankDeclarations),
 *   inherited: null | { from, element, entries } — when nothing sets an inherited property on
 *     the element itself, the nearest parent that does,
 *   source: 'set' | 'inherited' | 'default',
 *   skippedSheets — stylesheets that couldn't be read (cross-origin),
 * }
 * `options.fileNameForUrl(url)` names a stylesheet from its blob URL; `options.pageName` names
 * the page for its <style> blocks.
 */
export function explainProperty(el, propertyKey, options = {}) {
  const prop = getInspectorProperty(propertyKey)
  const doc = el?.ownerDocument
  const win = doc?.defaultView
  const skipped = new Set()
  const rules = collectStyleRules(doc, win, (sheet) => skipped.add(sheet))
  const ctx = {
    ...options,
    rules,
    skippedSheets: 0,
    shorthand: prop.longhands.length > 1 ? prop.key : null,
  }
  const own = collectDeclarations(el, prop.longhands, ctx).declarations
  const base = {
    property: prop.key,
    label: prop.label,
    value: computedText(el, prop),
    skippedSheets: skipped.size,
  }
  if (own.length > 0) {
    return {
      ...base,
      entries: rankDeclarations(own, prop.longhands),
      inherited: null,
      source: 'set',
    }
  }
  if (prop.inherited) {
    for (let parent = el?.parentElement; parent; parent = parent.parentElement) {
      const found = collectDeclarations(parent, prop.longhands, ctx).declarations
      if (found.length === 0) continue
      return {
        ...base,
        entries: [],
        inherited: {
          from: describeElement(parent),
          element: parent,
          entries: rankDeclarations(found, prop.longhands),
        },
        source: 'inherited',
      }
    }
  }
  return { ...base, entries: [], inherited: null, source: 'default' }
}

export { formatSpecificity }
