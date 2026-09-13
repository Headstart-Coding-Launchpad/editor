import {
  normalizeOutput,
  normalizeStyleValue,
  getElementText,
  compareValues,
  compareText,
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
    try {
      return context.iframeDoc.querySelectorAll(check.selector).length > 0
    } catch {
      return false
    }
  }

  if (check.type === 'html_element_attribute') {
    if (!context.iframeDoc || !check.selector || !check.attribute) return false
    try {
      const el = context.iframeDoc.querySelector(check.selector)
      if (!el || !el.hasAttribute(check.attribute)) return false
      const raw = el.getAttribute(check.attribute) ?? ''
      if (check.operator === 'exists' || check.value == null || check.value === '') return true
      return compareText(raw, check.operator, check.value, { flags: check.flags }) ?? false
    } catch {
      return false
    }
  }

  if (check.type === 'html_element_style_property') {
    if (!context.iframeDoc || !check.selector || !check.property) return false
    try {
      const el = context.iframeDoc.querySelector(check.selector)
      if (!el) return false
      const style = context.iframeDoc.defaultView?.getComputedStyle(el)
      const raw =
        style?.getPropertyValue(check.property) || el.style?.getPropertyValue(check.property) || ''
      if (check.operator === 'exists' || check.value == null || check.value === '')
        return String(raw).trim().length > 0
      return (
        compareText(raw, check.operator, check.value, {
          normalize: normalizeStyleValue,
          normalizeRegex: normalizeStyleValue,
          flags: check.flags,
        }) ?? false
      )
    } catch {
      return false
    }
  }

  if (check.value == null) return false

  if (check.type === 'html_element_count') {
    if (!context.iframeDoc || !check.selector) return false
    try {
      return compareValues(
        context.iframeDoc.querySelectorAll(check.selector).length,
        check.operator ?? 'equals',
        check.value
      )
    } catch {
      return false
    }
  }

  if (check.type === 'html_element_value') {
    if (!context.iframeDoc || !check.selector) return false
    try {
      const el = context.iframeDoc.querySelector(check.selector)
      if (!el) return false
      const raw = getElementText(el)
      return (
        compareText(raw, check.operator, check.value, {
          normalizeRegex: (value) => normalizeOutput(value, true),
          flags: check.flags,
        }) ?? false
      )
    } catch {
      return false
    }
  }

  return false
}
