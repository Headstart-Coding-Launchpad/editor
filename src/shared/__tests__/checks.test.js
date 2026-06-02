import { describe, it, expect } from 'vitest'
import {
  normalizeChecks,
  evaluateSingleCheck,
  evaluateCheck,
  evaluateCheckResults,
  evaluateCheckWithCode,
  checkRequiresRun,
  checkAllowedForSubmit,
  filterChecksForInteraction,
  getFirstFailedCheckHint,
  getIncorrectCheckHint,
  substituteTestInputs,
  resolveTestCheck,
} from '../checks.js'

// ─── normalizeChecks ──────────────────────────────────────────────────────────

describe('normalizeChecks', () => {
  it('returns empty array for null', () => {
    expect(normalizeChecks(null)).toEqual([])
  })

  it('wraps a single check object in an array', () => {
    const check = { type: 'output_contains', value: 'hello' }
    expect(normalizeChecks(check)).toEqual([check])
  })

  it('filters out items without a type from arrays', () => {
    const checks = [{ type: 'output_contains', value: 'hi' }, { value: 'no-type' }, null]
    expect(normalizeChecks(checks)).toHaveLength(1)
  })
})

// ─── output_contains (via fallthrough) ───────────────────────────────────────

describe('evaluateSingleCheck — output_contains (fallthrough)', () => {
  it('returns true when output contains the value', () => {
    const check = { type: 'output_contains', value: 'hello' }
    expect(evaluateSingleCheck(check, 'hello world')).toBe(true)
  })

  it('returns false when output does not contain the value', () => {
    const check = { type: 'output_contains', value: 'goodbye' }
    expect(evaluateSingleCheck(check, 'hello world')).toBe(false)
  })
})

// ─── multiple options (contains) ─────────────────────────────────────────────

describe('evaluateSingleCheck — multiple contains options ("opt1","opt2" format)', () => {
  it('output_contains passes when output contains the first option', () => {
    const check = { type: 'output_contains', value: '"hello","goodbye"' }
    expect(evaluateSingleCheck(check, 'hello world')).toBe(true)
  })

  it('output_contains passes when output contains the second option', () => {
    const check = { type: 'output_contains', value: '"hello","goodbye"' }
    expect(evaluateSingleCheck(check, 'goodbye everyone')).toBe(true)
  })

  it('output_contains fails when output contains none of the options', () => {
    const check = { type: 'output_contains', value: '"hello","goodbye"' }
    expect(evaluateSingleCheck(check, 'hi there')).toBe(false)
  })

  it('output_contains with a single quoted value matches like normal', () => {
    const check = { type: 'output_contains', value: '"hello"' }
    expect(evaluateSingleCheck(check, 'hello world')).toBe(true)
  })

  it('output_contains treats value without quotes as normal single-value check', () => {
    const check = { type: 'output_contains', value: 'hello' }
    expect(evaluateSingleCheck(check, 'hello world')).toBe(true)
  })

  it('code_contains passes when code contains any of the options', () => {
    const check = { type: 'code_contains', value: '"for","while"' }
    expect(evaluateSingleCheck(check, '', { code: 'while True:' })).toBe(true)
  })

  it('code_contains fails when code contains none of the options', () => {
    const check = { type: 'code_contains', value: '"for","while"' }
    expect(evaluateSingleCheck(check, '', { code: 'x = 1' })).toBe(false)
  })

  it('code_contains normalizes whitespace in each option', () => {
    const check = { type: 'code_contains', value: '"if score > 10:","while running:"' }
    expect(evaluateSingleCheck(check, '', { code: 'if score>10:\n  print("win")' })).toBe(true)
  })

  it('answer_contains passes when answer contains any of the options', () => {
    const check = { type: 'answer_contains', value: '"paris","london"' }
    expect(evaluateSingleCheck(check, '', { answer: 'london' })).toBe(true)
  })

  it('answer_contains fails when answer contains none of the options', () => {
    const check = { type: 'answer_contains', value: '"paris","london"' }
    expect(evaluateSingleCheck(check, '', { answer: 'berlin' })).toBe(false)
  })

  it('multiple options matching is case-insensitive', () => {
    const check = { type: 'output_contains', value: '"Hello","Goodbye"' }
    expect(evaluateSingleCheck(check, 'HELLO WORLD')).toBe(true)
  })

  it('does not parse as multi-option when format has extra chars outside quotes', () => {
    const check = { type: 'output_contains', value: '"hello" extra' }
    expect(evaluateSingleCheck(check, '"hello" extra')).toBe(true)
  })
})

// ─── output_equals ────────────────────────────────────────────────────────────

describe('evaluateSingleCheck — output_equals', () => {
  it('returns true when output exactly matches value (case-insensitive, trimmed)', () => {
    const check = { type: 'output_equals', value: 'Hello' }
    expect(evaluateSingleCheck(check, 'hello\n')).toBe(true)
  })

  it('returns false when output does not match', () => {
    const check = { type: 'output_equals', value: 'hello' }
    expect(evaluateSingleCheck(check, 'world')).toBe(false)
  })
})

// ─── output_not_empty ─────────────────────────────────────────────────────────

describe('evaluateSingleCheck — output_not_empty', () => {
  it('returns true when output has content', () => {
    expect(evaluateSingleCheck({ type: 'output_not_empty' }, 'some text')).toBe(true)
  })

  it('returns false for empty or whitespace-only output', () => {
    expect(evaluateSingleCheck({ type: 'output_not_empty' }, '   ')).toBe(false)
    expect(evaluateSingleCheck({ type: 'output_not_empty' }, '')).toBe(false)
  })
})

describe('evaluateSingleCheck — output_empty', () => {
  it('returns true for empty or whitespace-only output', () => {
    expect(evaluateSingleCheck({ type: 'output_empty' }, '')).toBe(true)
    expect(evaluateSingleCheck({ type: 'output_empty' }, ' \n\t ')).toBe(true)
  })

  it('returns false when output has content', () => {
    expect(evaluateSingleCheck({ type: 'output_empty' }, 'some text')).toBe(false)
  })
})

// ─── output_line_count ────────────────────────────────────────────────────────

describe('evaluateSingleCheck — output_line_count', () => {
  it('returns true when line count matches', () => {
    const check = { type: 'output_line_count', value: '3' }
    expect(evaluateSingleCheck(check, 'a\nb\nc')).toBe(true)
  })

  it('returns false when line count does not match', () => {
    const check = { type: 'output_line_count', value: '2' }
    expect(evaluateSingleCheck(check, 'a\nb\nc')).toBe(false)
  })
})

// ─── code_contains ────────────────────────────────────────────────────────────

describe('evaluateSingleCheck — code_contains', () => {
  it('returns true when code contains the value', () => {
    const check = { type: 'code_contains', value: 'print' }
    expect(evaluateSingleCheck(check, '', { code: 'print("hello")' })).toBe(true)
  })

  it('ignores whitespace outside quoted text', () => {
    const check = { type: 'code_contains', value: 'for item in range(3):' }
    expect(evaluateSingleCheck(check, '', { code: 'for\titem  in\nrange(3):' })).toBe(true)
  })

  it('preserves whitespace inside quoted text', () => {
    const check = { type: 'code_contains', value: 'print("hello world")' }
    expect(evaluateSingleCheck(check, '', { code: 'print( "helloworld" )' })).toBe(false)
  })

  it('returns false when code does not contain the value', () => {
    const check = { type: 'code_contains', value: 'for' }
    expect(evaluateSingleCheck(check, '', { code: 'x = 1' })).toBe(false)
  })
})

// ─── code_does_not_contain ───────────────────────────────────────────────────

describe('evaluateSingleCheck — code_does_not_contain', () => {
  it('returns true when code does not contain the value', () => {
    const check = { type: 'code_does_not_contain', value: 'eval' }
    expect(evaluateSingleCheck(check, '', { code: 'x = 1' })).toBe(true)
  })

  it('returns false when code contains the value', () => {
    const check = { type: 'code_does_not_contain', value: 'print("hi")' }
    expect(evaluateSingleCheck(check, '', { code: 'print( "hi" )' })).toBe(false)
  })
})

describe('evaluateSingleCheck — code equality checks', () => {
  it('ignores whitespace outside quoted text for equality', () => {
    const check = { type: 'code_equals', value: 'name = "Ada Lovelace"' }
    expect(evaluateSingleCheck(check, '', { code: 'name="Ada Lovelace"\n' })).toBe(true)
  })

  it('does not ignore whitespace inside quoted text for equality', () => {
    const check = { type: 'code_not_equals', value: 'name = "Ada Lovelace"' }
    expect(evaluateSingleCheck(check, '', { code: 'name = "AdaLovelace"' })).toBe(true)
  })
})

describe('evaluateSingleCheck — code_matches_regex', () => {
  it('runs its pattern against whitespace-normalized code', () => {
    const check = { type: 'code_matches_regex', value: '^total=count\\+1$' }
    expect(evaluateSingleCheck(check, '', { code: ' total=count + 1\n' })).toBe(true)
  })

  it('preserves case when matching code', () => {
    const check = { type: 'code_matches_regex', value: '^Total=count\\+1$' }
    expect(evaluateSingleCheck(check, '', { code: ' total=count + 1\n' })).toBe(false)
  })
})

// ─── output_matches_regex ─────────────────────────────────────────────────────

describe('evaluateSingleCheck — output_matches_regex', () => {
  it('returns true when output matches the regex', () => {
    const check = { type: 'output_matches_regex', value: '^\\d+$' }
    expect(evaluateSingleCheck(check, '42')).toBe(true)
  })

  it('returns false when output does not match the regex', () => {
    const check = { type: 'output_matches_regex', value: '^\\d+$' }
    expect(evaluateSingleCheck(check, 'abc')).toBe(false)
  })

  it('returns false for an invalid regex pattern', () => {
    const check = { type: 'output_matches_regex', value: '[invalid' }
    expect(evaluateSingleCheck(check, 'anything')).toBe(false)
  })

  it('preserves case when matching output', () => {
    const check = { type: 'output_matches_regex', value: '^Hello$' }
    expect(evaluateSingleCheck(check, 'hello')).toBe(false)
  })
})

describe('evaluateSingleCheck - answer_matches_regex', () => {
  it('preserves case when matching short answers', () => {
    const check = { type: 'answer_matches_regex', value: '^Paris$' }
    expect(evaluateSingleCheck(check, '', { answer: 'paris' })).toBe(false)
  })
})

// ─── answer_equals ────────────────────────────────────────────────────────────

describe('evaluateSingleCheck — answer_equals', () => {
  it('returns true when context.answer matches value (case-insensitive)', () => {
    const check = { type: 'answer_equals', value: 'Paris' }
    expect(evaluateSingleCheck(check, '', { answer: 'paris' })).toBe(true)
  })

  it('returns false when context.answer does not match', () => {
    const check = { type: 'answer_equals', value: 'Paris' }
    expect(evaluateSingleCheck(check, '', { answer: 'London' })).toBe(false)
  })

  it('falls back to output when context.answer is absent', () => {
    const check = { type: 'answer_equals', value: 'hello' }
    expect(evaluateSingleCheck(check, 'hello')).toBe(true)
  })
})

// ─── Wildcard matching ────────────────────────────────────────────────────────

describe('evaluateSingleCheck — wildcard matching', () => {
  it('output_contains passes with wildcard * pattern', () => {
    const check = { type: 'output_contains', value: 'hel*orld' }
    expect(evaluateSingleCheck(check, 'hello world')).toBe(true)
  })

  it('output_equals passes with leading/trailing wildcard', () => {
    const check = { type: 'output_equals', value: '*world*' }
    expect(evaluateSingleCheck(check, 'hello world!')).toBe(true)
  })

  it('output_equals fails when wildcard pattern does not match', () => {
    const check = { type: 'output_equals', value: 'foo*baz' }
    expect(evaluateSingleCheck(check, 'foo bar qux')).toBe(false)
  })
})

// ─── Normalisation ────────────────────────────────────────────────────────────

describe('evaluateSingleCheck — normalisation', () => {
  it('output_equals is case-insensitive', () => {
    const check = { type: 'output_equals', value: 'HELLO' }
    expect(evaluateSingleCheck(check, 'hello')).toBe(true)
  })

  it('output_equals strips trailing newlines (normalizeExactOutput behaviour)', () => {
    // normalizeExactOutput strips trailing newlines but not leading/internal spaces
    const check = { type: 'output_equals', value: 'hello\n' }
    expect(evaluateSingleCheck(check, 'hello')).toBe(true)
  })

  it('output_contains normalises CRLF to LF', () => {
    const check = { type: 'output_contains', value: 'a\nb' }
    expect(evaluateSingleCheck(check, 'a\r\nb')).toBe(true)
  })
})

// ─── evaluateCheckResults ─────────────────────────────────────────────────────

describe('evaluateCheckResults', () => {
  it('returns an array of check objects with passed flag', () => {
    const checks = [
      { type: 'output_contains', value: 'hello' },
      { type: 'output_contains', value: 'missing' },
    ]
    const results = evaluateCheckResults(checks, 'hello world')
    expect(results).toHaveLength(2)
    expect(results[0].passed).toBe(true)
    expect(results[1].passed).toBe(false)
  })

  it('preserves original check properties in results', () => {
    const check = { type: 'output_contains', value: 'hi', hint: 'Try printing hi' }
    const [result] = evaluateCheckResults(check, 'hi there')
    expect(result.hint).toBe('Try printing hi')
    expect(result.type).toBe('output_contains')
  })

  it('returns empty array when no valid checks provided', () => {
    expect(evaluateCheckResults(null, 'output')).toEqual([])
  })
})

// ─── evaluateCheck (all-must-pass) ───────────────────────────────────────────

describe('evaluateCheck', () => {
  it('returns true when all checks pass', () => {
    const checks = [
      { type: 'output_contains', value: 'hello' },
      { type: 'output_contains', value: 'world' },
    ]
    expect(evaluateCheck(checks, 'hello world')).toBe(true)
  })

  it('returns false when any check fails', () => {
    const checks = [
      { type: 'output_contains', value: 'hello' },
      { type: 'output_contains', value: 'missing' },
    ]
    expect(evaluateCheck(checks, 'hello world')).toBe(false)
  })

  it('returns false for empty checks', () => {
    expect(evaluateCheck([], 'anything')).toBe(false)
  })
})

// ─── evaluateCheckWithCode ────────────────────────────────────────────────────

describe('evaluateCheckWithCode', () => {
  it('returns true when code satisfies a code_contains check', () => {
    const check = { type: 'code_contains', value: 'for' }
    expect(evaluateCheckWithCode(check, 'for i in range(10):')).toBe(true)
  })

  it('returns false when a run-required check is in the list', () => {
    const checks = [
      { type: 'code_contains', value: 'print' },
      { type: 'output_contains', value: 'hello' },
    ]
    expect(evaluateCheckWithCode(checks, 'print("hello")')).toBe(false)
  })
})

// ─── checkRequiresRun / checkAllowedForSubmit ─────────────────────────────────

describe('checkRequiresRun', () => {
  it('returns true for output_contains', () => {
    expect(checkRequiresRun({ type: 'output_contains' })).toBe(true)
  })

  it('returns true for output_empty', () => {
    expect(checkRequiresRun({ type: 'output_empty' })).toBe(true)
  })

  it('returns false for code_contains', () => {
    expect(checkRequiresRun({ type: 'code_contains' })).toBe(false)
  })
})

describe('checkAllowedForSubmit', () => {
  it('returns true for code_contains', () => {
    expect(checkAllowedForSubmit({ type: 'code_contains' })).toBe(true)
  })

  it('returns false for output_contains', () => {
    expect(checkAllowedForSubmit({ type: 'output_contains' })).toBe(false)
  })
})

// ─── filterChecksForInteraction ───────────────────────────────────────────────

describe('filterChecksForInteraction', () => {
  const mixed = [
    { type: 'code_contains', value: 'for' },
    { type: 'output_contains', value: 'hello' },
  ]

  it('returns all checks in non-submit mode', () => {
    expect(filterChecksForInteraction(mixed, 'run')).toHaveLength(2)
  })

  it('filters to submit-allowed checks only in submit mode', () => {
    const result = filterChecksForInteraction(mixed, 'submit')
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('code_contains')
  })
})

// ─── getFirstFailedCheckHint ──────────────────────────────────────────────────

describe('getFirstFailedCheckHint', () => {
  it('returns hint from first failed check that has one', () => {
    const checks = [
      { type: 'output_contains', value: 'missing', hint: 'Use print' },
    ]
    expect(getFirstFailedCheckHint(checks, 'hello')).toBe('Use print')
  })

  it('returns empty string when all checks pass', () => {
    const checks = [{ type: 'output_contains', value: 'hello', hint: 'Try again' }]
    expect(getFirstFailedCheckHint(checks, 'hello world')).toBe('')
  })
})

// ─── getIncorrectCheckHint ────────────────────────────────────────────────────

describe('getIncorrectCheckHint', () => {
  it('returns hint from the first incorrect check that passes', () => {
    const checks = [
      { type: 'output_contains', value: 'hello', hint: 'You used print — good start but wrong output' },
    ]
    expect(getIncorrectCheckHint(checks, 'hello')).toBe('You used print — good start but wrong output')
  })

  it('returns empty string when no incorrect check matches', () => {
    const checks = [{ type: 'output_contains', value: 'missing', hint: 'Hint' }]
    expect(getIncorrectCheckHint(checks, 'hello')).toBe('')
  })
})

// ─── DOM checks with null iframeDoc ───────────────────────────────────────────

describe('evaluateSingleCheck — DOM checks with null iframeDoc', () => {
  it('element_exists returns false when iframeDoc is null', () => {
    expect(evaluateSingleCheck({ type: 'element_exists', selector: 'h1' }, '', { iframeDoc: null })).toBe(false)
  })

  it('element_count returns false when iframeDoc is null', () => {
    expect(evaluateSingleCheck({ type: 'element_count', selector: 'p', value: '2' }, '', { iframeDoc: null })).toBe(false)
  })

  it('element_value returns false when iframeDoc is null', () => {
    expect(evaluateSingleCheck({ type: 'element_value', selector: '#out', value: 'hi' }, '', { iframeDoc: null })).toBe(false)
  })
})

// ─── variable checks with empty context ───────────────────────────────────────

describe('evaluateSingleCheck — variable checks', () => {
  it('variable_exists returns false when variables is empty', () => {
    expect(evaluateSingleCheck({ type: 'variable_exists', name: 'x' }, '', { variables: {} })).toBe(false)
  })

  it('variable_exists returns true when variable is present', () => {
    expect(evaluateSingleCheck(
      { type: 'variable_exists', name: 'x' },
      '',
      { variables: { x: { json: '"hello"', type: 'str' } } },
    )).toBe(true)
  })

  it('variable_equals returns true for matching value', () => {
    expect(evaluateSingleCheck(
      { type: 'variable_equals', name: 'x', value: '42' },
      '',
      { variables: { x: { json: '42', type: 'int' } } },
    )).toBe(true)
  })

  it('variable_equals returns false for mismatched value', () => {
    expect(evaluateSingleCheck(
      { type: 'variable_equals', name: 'x', value: '99' },
      '',
      { variables: { x: { json: '42', type: 'int' } } },
    )).toBe(false)
  })
})

// ─── element_style_property with url() values ────────────────────────────────

describe('evaluateSingleCheck — element_style_property url() normalisation', () => {
  function makeStyleContext(propertyValue) {
    const el = { style: { getPropertyValue: () => '' } }
    return {
      iframeDoc: {
        querySelector: () => el,
        defaultView: { getComputedStyle: () => ({ getPropertyValue: () => propertyValue }) },
      },
    }
  }

  it('matches when computed url() has CDN prefix but check value uses relative filename', () => {
    const context = makeStyleContext('url("https://cdn.example.com/skiing.jpg")')
    expect(evaluateSingleCheck(
      { type: 'element_style_property', selector: '.poster', property: 'background-image', value: "url('skiing.jpg')" },
      '', context,
    )).toBe(true)
  })

  it('matches when both sides use the same relative filename', () => {
    const context = makeStyleContext("url('skiing.jpg')")
    expect(evaluateSingleCheck(
      { type: 'element_style_property', selector: '.poster', property: 'background-image', value: "url('skiing.jpg')" },
      '', context,
    )).toBe(true)
  })

  it('does not match when filenames differ', () => {
    const context = makeStyleContext('url("https://cdn.example.com/skiing.jpg")')
    expect(evaluateSingleCheck(
      { type: 'element_style_property', selector: '.poster', property: 'background-image', value: "url('hiking.jpg')" },
      '', context,
    )).toBe(false)
  })

  it('matches url() without quotes', () => {
    const context = makeStyleContext('url(https://cdn.example.com/skiing.jpg)')
    expect(evaluateSingleCheck(
      { type: 'element_style_property', selector: '.poster', property: 'background-image', value: 'url(skiing.jpg)' },
      '', context,
    )).toBe(true)
  })

  it('passes presence-only check (no value) when url() property is set', () => {
    const context = makeStyleContext('url("https://cdn.example.com/skiing.jpg")')
    expect(evaluateSingleCheck(
      { type: 'element_style_property', selector: '.poster', property: 'background-image' },
      '', context,
    )).toBe(true)
  })
})

// ─── guard: null/malformed check ──────────────────────────────────────────────

describe('evaluateSingleCheck — guard conditions', () => {
  it('returns false for null check', () => {
    expect(evaluateSingleCheck(null, 'output')).toBe(false)
  })

  it('returns false for check without type', () => {
    expect(evaluateSingleCheck({ value: 'hello' }, 'hello')).toBe(false)
  })

  it('returns false when check.value is null for output_equals', () => {
    expect(evaluateSingleCheck({ type: 'output_equals' }, 'hello')).toBe(false)
  })
})

// ─── substituteTestInputs ─────────────────────────────────────────────────────

describe('substituteTestInputs', () => {
  const inputs = [
    { name: 'username', value: 'Alice' },
    { name: 'age', value: '30' },
  ]

  it('replaces a single placeholder', () => {
    expect(substituteTestInputs('Hello {username}', inputs)).toBe('Hello Alice')
  })

  it('replaces multiple different placeholders', () => {
    expect(substituteTestInputs('{username} is {age}', inputs)).toBe('Alice is 30')
  })

  it('replaces all occurrences of the same placeholder', () => {
    expect(substituteTestInputs('{username} and {username}', inputs)).toBe('Alice and Alice')
  })

  it('returns the string unchanged when no placeholders match', () => {
    expect(substituteTestInputs('no placeholder here', inputs)).toBe('no placeholder here')
  })

  it('returns the original value when inputs is empty', () => {
    expect(substituteTestInputs('Hello {username}', [])).toBe('Hello {username}')
  })

  it('returns the original value when inputs is undefined', () => {
    expect(substituteTestInputs('Hello {username}', undefined)).toBe('Hello {username}')
  })

  it('returns non-string values unchanged', () => {
    expect(substituteTestInputs(42, inputs)).toBe(42)
  })

  it('skips inputs with no name', () => {
    expect(substituteTestInputs('Hello {username}', [{ name: '', value: 'X' }, { name: 'username', value: 'Bob' }])).toBe('Hello Bob')
  })
})

// ─── resolveTestCheck ─────────────────────────────────────────────────────────

describe('resolveTestCheck', () => {
  const inputs = [{ name: 'username', value: 'Alice' }]

  it('substitutes value in a single check', () => {
    const result = resolveTestCheck({ type: 'output_contains', value: 'Hello {username}' }, inputs)
    expect(result.value).toBe('Hello Alice')
  })

  it('substitutes value in each check of an array', () => {
    const checks = [
      { type: 'output_contains', value: 'Hello {username}' },
      { type: 'code_contains', value: 'print' },
    ]
    const result = resolveTestCheck(checks, inputs)
    expect(result[0].value).toBe('Hello Alice')
    expect(result[1].value).toBe('print')
  })

  it('does not mutate non-string value fields', () => {
    const check = { type: 'output_line_count', value: 3 }
    const result = resolveTestCheck(check, inputs)
    expect(result.value).toBe(3)
  })

  it('returns null/undefined unchanged', () => {
    expect(resolveTestCheck(null, inputs)).toBeNull()
    expect(resolveTestCheck(undefined, inputs)).toBeUndefined()
  })

  it('returns check unchanged when inputs is empty', () => {
    const check = { type: 'output_contains', value: 'Hello {username}' }
    const result = resolveTestCheck(check, [])
    expect(result.value).toBe('Hello {username}')
  })
})
