import {
  wildcardContains,
  wildcardEquals,
  normalizeOutput,
  normalizeRegexOutput,
  normalizeStyleValue,
  getElementText,
  parseMultipleContainOptions,
} from '../../shared/checkHelpers.js'

export const HTML_CHECK_TYPES = [
  'element_exists',
  'element_count',
  'element_value',
  'element_value_equals',
  'element_value_not_contains',
  'element_value_not_equals',
  'element_value_matches_regex',
  'element_attribute',
  'element_style_property',
]

export function evaluateHtmlCheck(check, output, context = {}) {
  if (check.type === 'element_exists') {
    if (!context.iframeDoc || !check.selector) return false
    try { return context.iframeDoc.querySelectorAll(check.selector).length > 0 } catch { return false }
  }

  if (check.type === 'element_attribute') {
    if (!context.iframeDoc || !check.selector || !check.attribute) return false
    try {
      const el = context.iframeDoc.querySelector(check.selector)
      if (!el || !el.hasAttribute(check.attribute)) return false
      if (check.value == null || check.value === '') return true
      return wildcardEquals(normalizeOutput(el.getAttribute(check.attribute) ?? ''), normalizeOutput(check.value))
    } catch { return false }
  }

  if (check.type === 'element_style_property') {
    if (!context.iframeDoc || !check.selector || !check.property) return false
    try {
      const el = context.iframeDoc.querySelector(check.selector)
      if (!el) return false
      const style = context.iframeDoc.defaultView?.getComputedStyle(el)
      const raw = style?.getPropertyValue(check.property) || el.style?.getPropertyValue(check.property) || ''
      if (check.value == null || check.value === '') return String(raw).trim().length > 0
      return wildcardEquals(normalizeStyleValue(raw), normalizeStyleValue(check.value))
    } catch { return false }
  }

  if (check.value == null) return false

  if (check.type === 'element_count') {
    if (!context.iframeDoc || !check.selector) return false
    try { return context.iframeDoc.querySelectorAll(check.selector).length === Number(check.value) } catch { return false }
  }

  if (check.type === 'element_value') {
    if (!context.iframeDoc || !check.selector) return false
    try {
      const el = context.iframeDoc.querySelector(check.selector)
      if (!el) return false
      const raw = getElementText(el)
      const elemOptions = parseMultipleContainOptions(check.value)
      if (elemOptions) {
        const actual = normalizeOutput(raw)
        return elemOptions.some(opt => wildcardContains(actual, normalizeOutput(opt)))
      }
      return wildcardContains(normalizeOutput(raw), normalizeOutput(check.value))
    } catch { return false }
  }

  if (check.type === 'element_value_equals') {
    if (!context.iframeDoc || !check.selector) return false
    try {
      const el = context.iframeDoc.querySelector(check.selector)
      if (!el) return false
      return wildcardEquals(normalizeOutput(getElementText(el)), normalizeOutput(check.value))
    } catch { return false }
  }

  if (check.type === 'element_value_not_contains') {
    if (!context.iframeDoc || !check.selector) return false
    try {
      const el = context.iframeDoc.querySelector(check.selector)
      if (!el) return false
      return !wildcardContains(normalizeOutput(getElementText(el)), normalizeOutput(check.value))
    } catch { return false }
  }

  if (check.type === 'element_value_not_equals') {
    if (!context.iframeDoc || !check.selector) return false
    try {
      const el = context.iframeDoc.querySelector(check.selector)
      if (!el) return false
      return !wildcardEquals(normalizeOutput(getElementText(el)), normalizeOutput(check.value))
    } catch { return false }
  }

  if (check.type === 'element_value_matches_regex') {
    if (!context.iframeDoc || !check.selector) return false
    try {
      const el = context.iframeDoc.querySelector(check.selector)
      if (!el) return false
      return new RegExp(check.value).test(normalizeRegexOutput(getElementText(el)))
    } catch { return false }
  }

  return false
}
