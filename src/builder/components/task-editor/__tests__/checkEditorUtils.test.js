import { describe, it, expect } from 'vitest'
import {
  subjectOpFromType,
  subjectOpFromCheck,
  checkUiFromCheck,
  typeFromSubjectOp,
  checkFromSubjectOp,
  getAspectOptions,
  getOperatorOptions,
  makeCheckSkeleton,
  formatCheckFailure,
  formatCheckFailureDetail,
} from '../CheckEditors'

describe('subjectOpFromType', () => {
  it('maps output check types correctly', () => {
    expect(subjectOpFromType('code_no_error')).toEqual({ subject: 'output', operator: 'no_error' })
    expect(subjectOpFromType('output_not_empty')).toEqual({ subject: 'output', operator: 'not_empty' })
    expect(subjectOpFromType('output_empty')).toEqual({ subject: 'output', operator: 'empty' })
    expect(subjectOpFromType('output_contains')).toEqual({ subject: 'output', operator: 'contains' })
    expect(subjectOpFromType('output_equals')).toEqual({ subject: 'output', operator: 'equals' })
    expect(subjectOpFromType('output_not_contains')).toEqual({ subject: 'output', operator: 'not_contains' })
    expect(subjectOpFromType('output_not_equals')).toEqual({ subject: 'output', operator: 'not_equals' })
    expect(subjectOpFromType('output_matches_regex')).toEqual({ subject: 'output', operator: 'matches_regex' })
    expect(subjectOpFromType('output_not_matches_regex')).toEqual({ subject: 'output', operator: 'not_matches_regex' })
    expect(subjectOpFromType('output_line_count')).toEqual({ subject: 'output', operator: 'line_count' })
  })

  it('maps code check types correctly', () => {
    expect(subjectOpFromType('code_contains')).toEqual({ subject: 'code', operator: 'contains' })
    expect(subjectOpFromType('code_equals')).toEqual({ subject: 'code', operator: 'equals' })
    expect(subjectOpFromType('code_does_not_contain')).toEqual({ subject: 'code', operator: 'not_contains' })
    expect(subjectOpFromType('code_not_equals')).toEqual({ subject: 'code', operator: 'not_equals' })
    expect(subjectOpFromType('code_matches_regex')).toEqual({ subject: 'code', operator: 'matches_regex' })
    expect(subjectOpFromType('code_not_matches_regex')).toEqual({ subject: 'code', operator: 'not_matches_regex' })
  })

  it('maps element check types correctly', () => {
    expect(subjectOpFromType('element_exists')).toEqual({ subject: 'element', operator: 'exists' })
    expect(subjectOpFromType('element_count')).toEqual({ subject: 'element', operator: 'count' })
    expect(subjectOpFromType('element_value')).toEqual({ subject: 'element', operator: 'value_contains' })
    expect(subjectOpFromType('element_value_equals')).toEqual({ subject: 'element', operator: 'value_equals' })
    expect(subjectOpFromType('element_attribute')).toEqual({ subject: 'element', operator: 'attribute_equals' })
    expect(subjectOpFromType('element_style_property')).toEqual({ subject: 'element', operator: 'style_equals' })
  })

  it('maps variable check types correctly', () => {
    expect(subjectOpFromType('variable_exists')).toEqual({ subject: 'variable', operator: 'exists' })
    expect(subjectOpFromType('variable_equals')).toEqual({ subject: 'variable', operator: 'equals' })
    expect(subjectOpFromType('variable_dict_key_value')).toEqual({ subject: 'variable', operator: 'dict_key_value' })
    expect(subjectOpFromType('variable_array_nth_item')).toEqual({ subject: 'variable', operator: 'array_nth_item' })
  })

  it('falls back to output/contains for unknown types', () => {
    expect(subjectOpFromType('unknown_type')).toEqual({ subject: 'output', operator: 'contains' })
  })
})

describe('subjectOpFromCheck', () => {
  it('uses canonical check operators when present', () => {
    expect(subjectOpFromCheck({ type: 'output', operator: 'not_matches_regex' })).toEqual({ subject: 'output', operator: 'not_matches_regex' })
    expect(subjectOpFromCheck({ type: 'code', operator: 'equals' })).toEqual({ subject: 'code', operator: 'equals' })
    expect(subjectOpFromCheck({ type: 'output_line_count', operator: 'less_than' })).toEqual({ subject: 'output', operator: 'line_count_less_than' })
  })

  it('maps canonical html element checks to builder operators', () => {
    expect(subjectOpFromCheck({ type: 'html_element', operator: 'exists' })).toEqual({ subject: 'element', operator: 'exists' })
    expect(subjectOpFromCheck({ type: 'html_element_count', operator: 'greater_than_or_equal' })).toEqual({ subject: 'element', operator: 'count_greater_than_or_equal' })
    expect(subjectOpFromCheck({ type: 'html_element_value', operator: 'matches_regex' })).toEqual({ subject: 'element', operator: 'value_matches_regex' })
    expect(subjectOpFromCheck({ type: 'html_element_attribute', operator: 'not_equals' })).toEqual({ subject: 'element', operator: 'attribute_not_equals' })
    expect(subjectOpFromCheck({ type: 'html_element_style_property', operator: 'contains' })).toEqual({ subject: 'element', operator: 'style_contains' })
  })

  it('displays legacy count checks as canonical count equals', () => {
    expect(subjectOpFromCheck({ type: 'element_count' })).toEqual({ subject: 'element', operator: 'count_equals' })
  })
})

describe('checkUiFromCheck', () => {
  it('splits canonical checks into subject, field, and condition', () => {
    expect(checkUiFromCheck({ type: 'html_element_attribute', operator: 'exists' })).toEqual({ subject: 'element', aspect: 'attribute', operator: 'attribute_exists' })
    expect(checkUiFromCheck({ type: 'html_element_style_property', operator: 'not_equals' })).toEqual({ subject: 'element', aspect: 'style', operator: 'style_not_equals' })
    expect(checkUiFromCheck({ type: 'output_line_count', operator: 'less_than_or_equal' })).toEqual({ subject: 'output', aspect: 'line_count', operator: 'line_count_less_than_or_equal' })
    expect(checkUiFromCheck({ type: 'variable_dict_key_value' })).toEqual({ subject: 'variable', aspect: 'dictionary', operator: 'dict_key_value' })
  })
})

describe('typeFromSubjectOp', () => {
  it('round-trips with subjectOpFromType for all canonical check types', () => {
    const types = [
      'output_contains', 'output_equals', 'output_not_contains', 'output_not_equals',
      'output_matches_regex', 'output_not_matches_regex', 'output_not_empty', 'output_empty', 'output_line_count', 'output_line_count_at_least',
      'code_contains', 'code_equals', 'code_not_contains', 'code_not_equals', 'code_matches_regex', 'code_not_matches_regex',
      'element_exists', 'element_count', 'element_value_contains', 'element_value_equals',
      'element_value_not_contains', 'element_value_not_equals', 'element_value_matches_regex', 'element_value_not_matches_regex',
      'element_attribute', 'element_style_property',
      'variable_exists', 'variable_type', 'variable_equals', 'variable_not_equals', 'variable_dict_contains',
      'variable_dict_equals', 'variable_dict_key_value', 'variable_array_contains',
      'variable_array_equals', 'variable_array_nth_item',
    ]
    for (const type of types) {
      const { subject, operator } = subjectOpFromType(type)
      expect(typeFromSubjectOp(subject, operator)).toBe(type)
    }
  })

  it('legacy aliases code_does_not_contain and element_value round-trip to their canonical names', () => {
    expect(typeFromSubjectOp(...Object.values(subjectOpFromType('code_does_not_contain')))).toBe('code_not_contains')
    expect(typeFromSubjectOp(...Object.values(subjectOpFromType('element_value')))).toBe('element_value_contains')
  })

  it('handles code_no_error — maps to output/no_error and back to code_no_error', () => {
    const { subject, operator } = subjectOpFromType('code_no_error')
    expect(typeFromSubjectOp(subject, operator)).toBe('code_no_error')
  })

  it('falls back to output_contains for unknown subject/operator', () => {
    expect(typeFromSubjectOp('unknown', 'something')).toBe('output_contains')
  })
})

describe('checkFromSubjectOp', () => {
  it('writes canonical output and code checks', () => {
    expect(checkFromSubjectOp('output', 'contains', { value: 'hello', hint: 'try' })).toEqual({ type: 'output', operator: 'contains', value: 'hello', hint: 'try' })
    expect(checkFromSubjectOp('code', 'not_matches_regex', { value: 'eval\\(', flags: 'i' })).toEqual({ type: 'code', operator: 'not_matches_regex', value: 'eval\\(', flags: 'i' })
  })

  it('writes canonical line count checks', () => {
    expect(checkFromSubjectOp('output', 'line_count_less_than', { value: '5' })).toEqual({ type: 'output_line_count', operator: 'less_than', value: '5' })
  })

  it('writes canonical html element checks with their extra fields', () => {
    expect(checkFromSubjectOp('element', 'attribute_matches_regex', {
      selector: 'a',
      attribute: 'href',
      value: '^https:',
      flags: 'i',
    })).toEqual({
      type: 'html_element_attribute',
      operator: 'matches_regex',
      selector: 'a',
      attribute: 'href',
      value: '^https:',
      flags: 'i',
    })
  })
})

describe('getOperatorOptions', () => {
  it('returns aspect options for split check controls', () => {
    expect(getAspectOptions('element').map(o => o.value)).toEqual(['element', 'value', 'attribute', 'style', 'count'])
    expect(getAspectOptions('output').map(o => o.value)).toEqual(['text', 'line_count', 'output_state'])
    expect(getAspectOptions('variable').map(o => o.value)).toEqual(['variable', 'dictionary', 'array'])
  })

  it('returns output operators without no_error', () => {
    const opts = getOperatorOptions('output')
    expect(opts.map(o => o.value)).not.toContain('no_error')
    expect(opts.map(o => o.value)).toContain('contains')
    expect(opts.map(o => o.value)).toContain('equals')
  })

  it('shows no_error only for an existing legacy check', () => {
    const opts = getOperatorOptions('output', 'no_error', 'status')
    expect(opts[0]).toEqual({ value: 'no_error', label: 'no error (legacy)' })
  })

  it('returns code operators', () => {
    const opts = getOperatorOptions('code')
    expect(opts.map(o => o.value)).toEqual(['contains', 'equals', 'not_contains', 'not_equals', 'matches_regex', 'not_matches_regex'])
  })

  it('returns element operators scoped by aspect', () => {
    expect(getOperatorOptions('element', null, 'element').map(o => o.value)).toEqual(['exists'])
    expect(getOperatorOptions('element', null, 'attribute').map(o => o.value)).toEqual([
      'attribute_exists',
      'attribute_contains',
      'attribute_not_contains',
      'attribute_equals',
      'attribute_not_equals',
      'attribute_matches_regex',
      'attribute_not_matches_regex',
    ])
    expect(getOperatorOptions('element', null, 'count').map(o => o.value)).toContain('count_less_than_or_equal')
  })

  it('returns variable operators scoped by aspect', () => {
    expect(getOperatorOptions('variable', null, 'variable').map(o => o.value)).toEqual(['exists', 'type', 'equals'])
    expect(getOperatorOptions('variable', null, 'dictionary').map(o => o.value)).toContain('dict_key_value')
    expect(getOperatorOptions('variable', null, 'array').map(o => o.value)).toContain('array_nth_item')
  })

  it('returns empty array for unknown subject', () => {
    expect(getOperatorOptions('unknown')).toEqual([])
  })
})

describe('makeCheckSkeleton', () => {
  it('produces no-value skeletons for no-value types', () => {
    expect(makeCheckSkeleton('code_no_error')).toEqual({ type: 'code_no_error' })
    expect(makeCheckSkeleton('output_not_empty')).toEqual({ type: 'output_not_empty' })
    expect(makeCheckSkeleton('output_empty')).toEqual({ type: 'output_empty' })
  })

  it('preserves hint from prev', () => {
    expect(makeCheckSkeleton('code_no_error', { hint: 'try again' })).toEqual({ type: 'code_no_error', hint: 'try again' })
    expect(makeCheckSkeleton('output_contains', { hint: 'check output', value: 'hello' })).toEqual({ type: 'output_contains', value: 'hello', hint: 'check output' })
  })

  it('produces value skeleton for simple check types', () => {
    expect(makeCheckSkeleton('output_contains')).toEqual({ type: 'output_contains', value: '' })
    expect(makeCheckSkeleton('code_contains')).toEqual({ type: 'code_contains', value: '' })
  })

  it('produces name+value skeleton for variable checks', () => {
    expect(makeCheckSkeleton('variable_equals')).toEqual({ type: 'variable_equals', name: '', value: '' })
    expect(makeCheckSkeleton('variable_type')).toEqual({ type: 'variable_type', name: '', value: '' })
  })

  it('produces name-only skeleton for variable_exists', () => {
    expect(makeCheckSkeleton('variable_exists')).toEqual({ type: 'variable_exists', name: '' })
  })

  it('produces selector skeleton for element_exists', () => {
    expect(makeCheckSkeleton('element_exists')).toEqual({ type: 'element_exists', selector: '' })
  })

  it('produces selector+value with default "1" for element_count', () => {
    expect(makeCheckSkeleton('element_count')).toEqual({ type: 'element_count', selector: '', value: '1' })
  })

  it('produces selector+attribute+value for element_attribute', () => {
    expect(makeCheckSkeleton('element_attribute')).toEqual({ type: 'element_attribute', selector: '', attribute: '', value: '' })
  })

  it('produces selector+property+value for element_style_property', () => {
    expect(makeCheckSkeleton('element_style_property')).toEqual({ type: 'element_style_property', selector: '', property: '', value: '' })
  })

  it('preserves prev values when switching types within variable category', () => {
    const prev = { type: 'variable_equals', name: 'score', value: '10', hint: 'check score' }
    const next = makeCheckSkeleton('variable_dict_contains', prev)
    expect(next).toEqual({ type: 'variable_dict_contains', name: 'score', value: '10', hint: 'check score' })
  })
})

describe('formatCheckFailure', () => {
  it('prefixes with "Check does not pass"', () => {
    expect(formatCheckFailure({ type: 'output_contains', value: 'hello' })).toMatch(/^Check does not pass/)
  })

  it('formats output_empty failure', () => {
    expect(formatCheckFailureDetail({ type: 'output_empty' })).toBe('output is not empty')
  })

  it('formats element_exists failure with selector', () => {
    const detail = formatCheckFailureDetail({ type: 'element_exists', selector: 'h1' })
    expect(detail).toContain('h1')
  })

  it('formats element_count failure with count and selector', () => {
    const detail = formatCheckFailureDetail({ type: 'element_count', value: '3', selector: '.item' })
    expect(detail).toContain('3')
    expect(detail).toContain('.item')
  })

  it('formats generic failure with value fallback', () => {
    const detail = formatCheckFailureDetail({ type: 'output_contains', value: 'hello' })
    expect(detail).toContain('hello')
  })
})
