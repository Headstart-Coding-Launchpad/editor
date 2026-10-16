// Answer fields for predictions (p6-27): what a number answer box accepts and the attributes
// that bring up a numeric keypad on touch screens. Pure and Node-safe, so a plain DOM input (not
// only the name-tag panel's React number field, PredictAnswerField.jsx) can share the rules.

/**
 * `text` with anything a number can't hold taken out: digits, one decimal point and a leading
 * minus for a decimal field; digits only for `whole` (a count). Spaces are dropped. Partial
 * numbers stay ("-", "3.", "."), so typing is never fought.
 */
export function sanitizeNumberText(text, { whole = false } = {}) {
  const raw = String(text ?? '').replace(/\s+/g, '')
  if (whole) return raw.replace(/\D+/g, '')
  let out = ''
  let point = false
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') out += ch
    else if (ch === '.' && !point) {
      point = true
      out += ch
    } else if (ch === '-' && out === '') out += ch
  }
  return out
}

/**
 * The attributes of a number answer input (`type="text"`, so partial numbers and a leading
 * minus survive): `inputMode` decimal (whole: numeric) for the touch keypad, and no autocorrect.
 * Keys are DOM attribute names; React callers use numberInputProps.
 */
export function numberInputAttributes({ whole = false } = {}) {
  return {
    type: 'text',
    inputmode: whole ? 'numeric' : 'decimal',
    autocomplete: 'off',
    autocorrect: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    enterkeyhint: 'done',
  }
}

/** numberInputAttributes as React props. */
export function numberInputProps({ whole = false } = {}) {
  return {
    type: 'text',
    inputMode: whole ? 'numeric' : 'decimal',
    autoComplete: 'off',
    autoCorrect: 'off',
    autoCapitalize: 'off',
    spellCheck: false,
    enterKeyHint: 'done',
  }
}
