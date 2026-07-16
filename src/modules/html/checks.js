import {
  wildcardContains,
  wildcardEquals,
  normalizeOutput,
  normalizeStyleValue,
  getElementText,
  matchesContainValue,
  matchesRegex,
  compareValues,
} from '../../shared/checkHelpers.js'

export const HTML_CHECK_TYPES = [
  'html_element',
  'html_element_count',
  'html_element_value',
  'html_element_attribute',
  'html_element_style_property',
  'element_exists',
  'element_count',
  'element_value',
  'element_value_equals',
  'element_value_not_contains',
  'element_value_not_equals',
  'element_value_matches_regex',
  'element_value_not_matches_regex',
  'element_attribute',
  'element_style_property',
]

export const HTML_CHECK_DEFINITIONS = {
  html_element: {
    subject: 'HTML element',
    operators: ['exists'],
    fields: ['selector'],
    evaluate: 'on_run',
  },
  html_element_count: {
    subject: 'HTML element count',
    operators: ['equals', 'not_equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'],
    fields: ['selector', 'operator', 'value'],
    evaluate: 'on_run',
  },
  html_element_value: {
    subject: 'HTML element value',
    operators: ['contains', 'not_contains', 'equals', 'not_equals', 'matches_regex', 'not_matches_regex'],
    fields: ['selector', 'operator', 'value', 'flags'],
    evaluate: 'on_run',
  },
  html_element_attribute: {
    subject: 'HTML element attribute',
    operators: ['exists', 'equals', 'not_equals', 'contains', 'not_contains', 'matches_regex', 'not_matches_regex'],
    fields: ['selector', 'attribute', 'operator', 'value', 'flags'],
    evaluate: 'on_run',
  },
  html_element_style_property: {
    subject: 'HTML element style property',
    operators: ['exists', 'equals', 'not_equals', 'contains', 'not_contains', 'matches_regex', 'not_matches_regex'],
    fields: ['selector', 'property', 'operator', 'value', 'flags'],
    evaluate: 'on_run',
  },
}

const HTML_LEGACY_CHECK_ALIASES = {
  element_exists: { type: 'html_element', operator: 'exists' },
  element_count: { type: 'html_element_count', operator: 'equals' },
  element_value: { type: 'html_element_value', operator: 'contains' },
  element_value_equals: { type: 'html_element_value', operator: 'equals' },
  element_value_not_contains: { type: 'html_element_value', operator: 'not_contains' },
  element_value_not_equals: { type: 'html_element_value', operator: 'not_equals' },
  element_value_matches_regex: { type: 'html_element_value', operator: 'matches_regex' },
  element_value_not_matches_regex: { type: 'html_element_value', operator: 'not_matches_regex' },
  element_attribute: { type: 'html_element_attribute', operator: 'equals' },
  element_style_property: { type: 'html_element_style_property', operator: 'equals' },
}

export function normalizeHtmlCheck(check) {
  const alias = HTML_LEGACY_CHECK_ALIASES[check?.type]
  if (!alias) return check
  return {
    ...check,
    legacyType: check.legacyType ?? check.type,
    ...alias,
    operator: check.operator ?? alias.operator,
  }
}

export function evaluateHtmlCheck(check, output, context = {}) {
  check = normalizeHtmlCheck(check)

  if (check.type === 'html_element') {
    if (!context.iframeDoc || !check.selector) return false
    try { return context.iframeDoc.querySelectorAll(check.selector).length > 0 } catch { return false }
  }

  if (check.type === 'html_element_attribute') {
    if (!context.iframeDoc || !check.selector || !check.attribute) return false
    try {
      const el = context.iframeDoc.querySelector(check.selector)
      if (!el || !el.hasAttribute(check.attribute)) return false
      const raw = el.getAttribute(check.attribute) ?? ''
      if (check.operator === 'exists' || check.value == null || check.value === '') return true
      if (check.operator === 'contains') return matchesContainValue(raw, check.value, normalizeOutput)
      if (check.operator === 'not_contains') return !wildcardContains(normalizeOutput(raw), normalizeOutput(check.value))
      if (check.operator === 'equals') return wildcardEquals(normalizeOutput(raw), normalizeOutput(check.value))
      if (check.operator === 'not_equals') return !wildcardEquals(normalizeOutput(raw), normalizeOutput(check.value))
      if (check.operator === 'matches_regex') return matchesRegex(raw, check.value, check.flags)
      if (check.operator === 'not_matches_regex') return !matchesRegex(raw, check.value, check.flags)
      return false
    } catch { return false }
  }

  if (check.type === 'html_element_style_property') {
    if (!context.iframeDoc || !check.selector || !check.property) return false
    try {
      const el = context.iframeDoc.querySelector(check.selector)
      if (!el) return false
      const style = context.iframeDoc.defaultView?.getComputedStyle(el)
      const raw = style?.getPropertyValue(check.property) || el.style?.getPropertyValue(check.property) || ''
      if (check.operator === 'exists' || check.value == null || check.value === '') return String(raw).trim().length > 0
      if (check.operator === 'contains') return matchesContainValue(raw, check.value, normalizeStyleValue)
      if (check.operator === 'not_contains') return !wildcardContains(normalizeStyleValue(raw), normalizeStyleValue(check.value))
      if (check.operator === 'equals') return wildcardEquals(normalizeStyleValue(raw), normalizeStyleValue(check.value))
      if (check.operator === 'not_equals') return !wildcardEquals(normalizeStyleValue(raw), normalizeStyleValue(check.value))
      if (check.operator === 'matches_regex') return matchesRegex(normalizeStyleValue(raw), check.value, check.flags)
      if (check.operator === 'not_matches_regex') return !matchesRegex(normalizeStyleValue(raw), check.value, check.flags)
      return false
    } catch { return false }
  }

  if (check.value == null) return false

  if (check.type === 'html_element_count') {
    if (!context.iframeDoc || !check.selector) return false
    try { return compareValues(context.iframeDoc.querySelectorAll(check.selector).length, check.operator ?? 'equals', check.value) } catch { return false }
  }

  if (check.type === 'html_element_value') {
    if (!context.iframeDoc || !check.selector) return false
    try {
      const el = context.iframeDoc.querySelector(check.selector)
      if (!el) return false
      const raw = getElementText(el)
      if (check.operator === 'contains') return matchesContainValue(raw, check.value, normalizeOutput)
      if (check.operator === 'not_contains') return !wildcardContains(normalizeOutput(raw), normalizeOutput(check.value))
      if (check.operator === 'equals') return wildcardEquals(normalizeOutput(raw), normalizeOutput(check.value))
      if (check.operator === 'not_equals') return !wildcardEquals(normalizeOutput(raw), normalizeOutput(check.value))
      if (check.operator === 'matches_regex') return matchesRegex(normalizeOutput(raw, true), check.value, check.flags)
      if (check.operator === 'not_matches_regex') return !matchesRegex(normalizeOutput(raw, true), check.value, check.flags)
      return false
    } catch { return false }
  }

  return false
}
