function formatCheckFailure(result) {
  return `Check does not pass - ${formatCheckFailureDetail(result)}`
}

function formatCheckFailureDetail(result) {
  if (result.type === 'output_empty') return 'output is not empty'
  if (result.type === 'element_exists')
    return `no element matches selector "${result.selector ?? ''}"`
  if (result.type === 'element_count')
    return `expected ${result.value ?? ''} elements matching selector "${result.selector ?? ''}"`
  if (result.type === 'element_value')
    return `review expected text or input value "${result.value ?? ''}"`
  return `review your check value "${result.value ?? ''}"`
}

function subjectOpFromType(type) {
  const map = {
    code_no_error: { subject: 'output', operator: 'no_error' },
    output_not_empty: { subject: 'output', operator: 'not_empty' },
    output_empty: { subject: 'output', operator: 'empty' },
    output_contains: { subject: 'output', operator: 'contains' },
    output_equals: { subject: 'output', operator: 'equals' },
    output_not_contains: { subject: 'output', operator: 'not_contains' },
    output_not_equals: { subject: 'output', operator: 'not_equals' },
    output_matches_regex: { subject: 'output', operator: 'matches_regex' },
    output_not_matches_regex: { subject: 'output', operator: 'not_matches_regex' },
    output_line_count: { subject: 'output', operator: 'line_count' },
    output_line_count_at_least: { subject: 'output', operator: 'line_count_at_least' },
    code_contains: { subject: 'code', operator: 'contains' },
    code_equals: { subject: 'code', operator: 'equals' },
    code_does_not_contain: { subject: 'code', operator: 'not_contains' },
    code_not_contains: { subject: 'code', operator: 'not_contains' },
    code_not_equals: { subject: 'code', operator: 'not_equals' },
    code_matches_regex: { subject: 'code', operator: 'matches_regex' },
    code_not_matches_regex: { subject: 'code', operator: 'not_matches_regex' },
    element_exists: { subject: 'element', operator: 'exists' },
    element_count: { subject: 'element', operator: 'count' },
    element_value: { subject: 'element', operator: 'value_contains' },
    element_value_contains: { subject: 'element', operator: 'value_contains' },
    element_value_equals: { subject: 'element', operator: 'value_equals' },
    element_value_not_contains: { subject: 'element', operator: 'value_not_contains' },
    element_value_not_equals: { subject: 'element', operator: 'value_not_equals' },
    element_value_matches_regex: { subject: 'element', operator: 'value_matches_regex' },
    element_value_not_matches_regex: { subject: 'element', operator: 'value_not_matches_regex' },
    element_attribute: { subject: 'element', operator: 'attribute_equals' },
    element_style_property: { subject: 'element', operator: 'style_equals' },
    variable_exists: { subject: 'variable', operator: 'exists' },
    variable_type: { subject: 'variable', operator: 'type' },
    variable_equals: { subject: 'variable', operator: 'equals' },
    variable_not_equals: { subject: 'variable', operator: 'not_equals' },
    variable_dict_contains: { subject: 'variable', operator: 'dict_contains' },
    variable_dict_equals: { subject: 'variable', operator: 'dict_equals' },
    variable_dict_key_value: { subject: 'variable', operator: 'dict_key_value' },
    variable_array_contains: { subject: 'variable', operator: 'array_contains' },
    variable_array_equals: { subject: 'variable', operator: 'array_equals' },
    variable_array_nth_item: { subject: 'variable', operator: 'array_nth_item' },
  }
  return map[type] ?? { subject: 'output', operator: 'contains' }
}

const OUTPUT_LINE_OPERATORS = {
  line_count: 'equals',
  line_count_equals: 'equals',
  line_count_not_equals: 'not_equals',
  line_count_greater_than: 'greater_than',
  line_count_greater_than_or_equal: 'greater_than_or_equal',
  line_count_less_than: 'less_than',
  line_count_less_than_or_equal: 'less_than_or_equal',
}

const OUTPUT_LINE_OPERATOR_BY_CHECK = Object.entries(OUTPUT_LINE_OPERATORS).reduce(
  (acc, [uiOperator, checkOperator]) => ({ ...acc, [checkOperator]: uiOperator }),
  {}
)

const ELEMENT_OPERATOR_DEFS = {
  value_contains: { type: 'html_element_value', operator: 'contains' },
  value_not_contains: { type: 'html_element_value', operator: 'not_contains' },
  value_equals: { type: 'html_element_value', operator: 'equals' },
  value_not_equals: { type: 'html_element_value', operator: 'not_equals' },
  value_matches_regex: { type: 'html_element_value', operator: 'matches_regex' },
  value_not_matches_regex: { type: 'html_element_value', operator: 'not_matches_regex' },
  attribute_exists: { type: 'html_element_attribute', operator: 'exists' },
  attribute_contains: { type: 'html_element_attribute', operator: 'contains' },
  attribute_not_contains: { type: 'html_element_attribute', operator: 'not_contains' },
  attribute_equals: { type: 'html_element_attribute', operator: 'equals' },
  attribute_not_equals: { type: 'html_element_attribute', operator: 'not_equals' },
  attribute_matches_regex: { type: 'html_element_attribute', operator: 'matches_regex' },
  attribute_not_matches_regex: { type: 'html_element_attribute', operator: 'not_matches_regex' },
  style_exists: { type: 'html_element_style_property', operator: 'exists' },
  style_contains: { type: 'html_element_style_property', operator: 'contains' },
  style_not_contains: { type: 'html_element_style_property', operator: 'not_contains' },
  style_equals: { type: 'html_element_style_property', operator: 'equals' },
  style_not_equals: { type: 'html_element_style_property', operator: 'not_equals' },
  style_matches_regex: { type: 'html_element_style_property', operator: 'matches_regex' },
  style_not_matches_regex: { type: 'html_element_style_property', operator: 'not_matches_regex' },
}

function subjectOpFromCheck(check) {
  if (!check?.type) return { subject: 'output', operator: 'contains' }
  if (check.type === 'output') return { subject: 'output', operator: check.operator ?? 'contains' }
  if (check.type === 'code') return { subject: 'code', operator: check.operator ?? 'contains' }
  if (check.type === 'output_line_count') {
    return {
      subject: 'output',
      operator: OUTPUT_LINE_OPERATOR_BY_CHECK[check.operator ?? 'equals'] ?? 'line_count_equals',
    }
  }
  if (check.type === 'html_element') return { subject: 'element', operator: 'exists' }
  if (check.type === 'html_element_count') {
    return {
      subject: 'element',
      operator:
        OUTPUT_LINE_OPERATOR_BY_CHECK[check.operator ?? 'equals']?.replace('line_count', 'count') ??
        'count_equals',
    }
  }
  if (check.type === 'html_element_value') {
    const entry = Object.entries(ELEMENT_OPERATOR_DEFS).find(
      ([, def]) => def.type === check.type && def.operator === (check.operator ?? 'contains')
    )
    return { subject: 'element', operator: entry?.[0] ?? 'value_contains' }
  }
  if (check.type === 'html_element_attribute') {
    const entry = Object.entries(ELEMENT_OPERATOR_DEFS).find(
      ([, def]) => def.type === check.type && def.operator === (check.operator ?? 'equals')
    )
    return { subject: 'element', operator: entry?.[0] ?? 'attribute_equals' }
  }
  if (check.type === 'html_element_style_property') {
    const entry = Object.entries(ELEMENT_OPERATOR_DEFS).find(
      ([, def]) => def.type === check.type && def.operator === (check.operator ?? 'equals')
    )
    return { subject: 'element', operator: entry?.[0] ?? 'style_equals' }
  }
  const legacy = subjectOpFromType(check.type)
  if (legacy.operator === 'line_count')
    return { subject: legacy.subject, operator: 'line_count_equals' }
  if (legacy.operator === 'line_count_at_least')
    return { subject: legacy.subject, operator: 'line_count_greater_than_or_equal' }
  if (legacy.operator === 'count') return { subject: legacy.subject, operator: 'count_equals' }
  return legacy
}

function aspectFromSubjectOperator(subject, operator) {
  if (subject === 'output') {
    if (operator === 'no_error') return 'status'
    if (operator === 'not_empty' || operator === 'empty') return 'output_state'
    if (operator.startsWith('line_count')) return 'line_count'
    return 'text'
  }
  if (subject === 'code') return 'source'
  if (subject === 'element') {
    if (operator === 'exists') return 'element'
    if (operator.startsWith('count_')) return 'count'
    if (operator.startsWith('attribute_')) return 'attribute'
    if (operator.startsWith('style_')) return 'style'
    return 'value'
  }
  if (subject === 'variable') {
    if (operator.startsWith('dict_')) return 'dictionary'
    if (operator.startsWith('array_')) return 'array'
    return 'variable'
  }
  return 'value'
}

function checkUiFromCheck(check) {
  const { subject, operator } = subjectOpFromCheck(check)
  return { subject, aspect: aspectFromSubjectOperator(subject, operator), operator }
}

function getAspectOptions(subject, currentAspect = null) {
  if (subject === 'output')
    return [
      { value: 'text', label: 'Text' },
      { value: 'line_count', label: 'Line count' },
      { value: 'output_state', label: 'Output state' },
      ...(currentAspect === 'status' ? [{ value: 'status', label: 'Run status' }] : []),
    ]
  if (subject === 'code') return [{ value: 'source', label: 'Source' }]
  if (subject === 'element')
    return [
      { value: 'element', label: 'Element' },
      { value: 'value', label: 'Value' },
      { value: 'attribute', label: 'Attribute' },
      { value: 'style', label: 'Style property' },
      { value: 'count', label: 'Count' },
    ]
  if (subject === 'variable')
    return [
      { value: 'variable', label: 'Variable' },
      { value: 'dictionary', label: 'Dictionary' },
      { value: 'array', label: 'Array' },
    ]
  return []
}

function defaultOperatorForAspect(subject, aspect) {
  if (subject === 'output') {
    if (aspect === 'line_count') return 'line_count_equals'
    if (aspect === 'output_state') return 'not_empty'
    if (aspect === 'status') return 'no_error'
    return 'contains'
  }
  if (subject === 'code') return 'contains'
  if (subject === 'element') {
    if (aspect === 'element') return 'exists'
    if (aspect === 'count') return 'count_equals'
    if (aspect === 'attribute') return 'attribute_exists'
    if (aspect === 'style') return 'style_exists'
    return 'value_contains'
  }
  if (subject === 'variable') {
    if (aspect === 'dictionary') return 'dict_contains'
    if (aspect === 'array') return 'array_contains'
    return 'exists'
  }
  return 'contains'
}

function typeFromSubjectOp(subject, operator) {
  const maps = {
    output: {
      no_error: 'code_no_error',
      contains: 'output_contains',
      equals: 'output_equals',
      not_contains: 'output_not_contains',
      not_equals: 'output_not_equals',
      matches_regex: 'output_matches_regex',
      not_matches_regex: 'output_not_matches_regex',
      not_empty: 'output_not_empty',
      empty: 'output_empty',
      line_count: 'output_line_count',
      line_count_at_least: 'output_line_count_at_least',
    },
    code: {
      contains: 'code_contains',
      equals: 'code_equals',
      not_contains: 'code_not_contains',
      not_equals: 'code_not_equals',
      matches_regex: 'code_matches_regex',
      not_matches_regex: 'code_not_matches_regex',
    },
    element: {
      exists: 'element_exists',
      count: 'element_count',
      value_contains: 'element_value_contains',
      value_equals: 'element_value_equals',
      value_not_contains: 'element_value_not_contains',
      value_not_equals: 'element_value_not_equals',
      value_matches_regex: 'element_value_matches_regex',
      value_not_matches_regex: 'element_value_not_matches_regex',
      attribute_equals: 'element_attribute',
      style_equals: 'element_style_property',
    },
    variable: {
      exists: 'variable_exists',
      type: 'variable_type',
      equals: 'variable_equals',
      not_equals: 'variable_not_equals',
      dict_contains: 'variable_dict_contains',
      dict_equals: 'variable_dict_equals',
      dict_key_value: 'variable_dict_key_value',
      array_contains: 'variable_array_contains',
      array_equals: 'variable_array_equals',
      array_nth_item: 'variable_array_nth_item',
    },
  }
  return maps[subject]?.[operator] ?? 'output_contains'
}

function checkFromSubjectOp(subject, operator, prev = {}) {
  const meta = {
    ...(prev.hint ? { hint: prev.hint } : {}),
    ...(prev.mode ? { mode: prev.mode } : {}),
    ...(prev.show ? { show: prev.show } : {}),
  }

  if (subject === 'output') {
    if (operator === 'no_error' || operator === 'not_empty' || operator === 'empty') {
      return makeCheckSkeleton(typeFromSubjectOp(subject, operator), prev)
    }
    if (operator.startsWith('line_count')) {
      return {
        type: 'output_line_count',
        operator: OUTPUT_LINE_OPERATORS[operator] ?? 'equals',
        value: prev.value ?? '',
        ...meta,
      }
    }
    return {
      type: 'output',
      operator,
      value: prev.value ?? '',
      ...(operator.includes('regex') && prev.flags ? { flags: prev.flags } : {}),
      ...meta,
    }
  }

  if (subject === 'code') {
    return {
      type: 'code',
      operator,
      value: prev.value ?? '',
      ...(operator.includes('regex') && prev.flags ? { flags: prev.flags } : {}),
      ...meta,
    }
  }

  if (subject === 'element') {
    if (operator === 'exists')
      return { type: 'html_element', operator: 'exists', selector: prev.selector ?? '', ...meta }
    if (operator.startsWith('count')) {
      const countOperator = operator.replace('count_', '')
      return {
        type: 'html_element_count',
        operator: countOperator || 'equals',
        selector: prev.selector ?? '',
        value: prev.value ?? '1',
        ...meta,
      }
    }
    const def = ELEMENT_OPERATOR_DEFS[operator] ?? ELEMENT_OPERATOR_DEFS.value_contains
    const base = { type: def.type, operator: def.operator, selector: prev.selector ?? '', ...meta }
    if (def.type === 'html_element_attribute') base.attribute = prev.attribute ?? ''
    if (def.type === 'html_element_style_property') base.property = prev.property ?? ''
    if (def.operator !== 'exists') base.value = prev.value ?? ''
    if (def.operator.includes('regex') && prev.flags) base.flags = prev.flags
    return base
  }

  return makeCheckSkeleton(typeFromSubjectOp(subject, operator), prev)
}

function getOperatorOptions(subject, currentOperator = null, aspect = null) {
  const currentAspect =
    aspect ??
    aspectFromSubjectOperator(subject, currentOperator ?? defaultOperatorForAspect(subject, aspect))
  if (subject === 'output') {
    if (currentAspect === 'status') return [{ value: 'no_error', label: 'no error (legacy)' }]
    if (currentAspect === 'output_state')
      return [
        { value: 'not_empty', label: 'is not empty' },
        { value: 'empty', label: 'is empty' },
      ]
    if (currentAspect === 'line_count')
      return [
        { value: 'line_count_equals', label: 'equals' },
        { value: 'line_count_not_equals', label: 'does not equal' },
        { value: 'line_count_greater_than', label: 'greater than' },
        { value: 'line_count_greater_than_or_equal', label: 'at least' },
        { value: 'line_count_less_than', label: 'less than' },
        { value: 'line_count_less_than_or_equal', label: 'at most' },
      ]
    return [
      { value: 'contains', label: 'contains' },
      { value: 'equals', label: 'equals' },
      { value: 'not_contains', label: 'does not contain' },
      { value: 'not_equals', label: 'does not equal' },
      { value: 'matches_regex', label: 'matches regex' },
      { value: 'not_matches_regex', label: 'does not match regex' },
    ]
  }
  if (subject === 'code')
    return [
      { value: 'contains', label: 'contains' },
      { value: 'equals', label: 'equals' },
      { value: 'not_contains', label: 'does not contain' },
      { value: 'not_equals', label: 'does not equal' },
      { value: 'matches_regex', label: 'matches regex' },
      { value: 'not_matches_regex', label: 'does not match regex' },
    ]
  if (subject === 'element') {
    if (currentAspect === 'element') return [{ value: 'exists', label: 'exists' }]
    if (currentAspect === 'count')
      return [
        { value: 'count_equals', label: 'equals' },
        { value: 'count_not_equals', label: 'does not equal' },
        { value: 'count_greater_than', label: 'greater than' },
        { value: 'count_greater_than_or_equal', label: 'at least' },
        { value: 'count_less_than', label: 'less than' },
        { value: 'count_less_than_or_equal', label: 'at most' },
      ]
    const prefix =
      currentAspect === 'attribute' ? 'attribute' : currentAspect === 'style' ? 'style' : 'value'
    return [
      ...(prefix === 'value' ? [] : [{ value: `${prefix}_exists`, label: 'exists' }]),
      { value: `${prefix}_contains`, label: 'contains' },
      { value: `${prefix}_not_contains`, label: 'does not contain' },
      { value: `${prefix}_equals`, label: 'equals' },
      { value: `${prefix}_not_equals`, label: 'does not equal' },
      { value: `${prefix}_matches_regex`, label: 'matches regex' },
      { value: `${prefix}_not_matches_regex`, label: 'does not match regex' },
    ]
  }
  if (subject === 'variable') {
    if (currentAspect === 'dictionary')
      return [
        { value: 'dict_contains', label: 'contains value' },
        { value: 'dict_equals', label: 'equals' },
        { value: 'dict_key_value', label: 'key value equals' },
      ]
    if (currentAspect === 'array')
      return [
        { value: 'array_contains', label: 'contains' },
        { value: 'array_equals', label: 'equals' },
        { value: 'array_nth_item', label: 'item at index equals' },
      ]
    return [
      { value: 'exists', label: 'exists' },
      { value: 'type', label: 'type is' },
      { value: 'equals', label: 'equals' },
    ]
  }
  return []
}

function makeCheckSkeleton(type, prev = {}) {
  const meta = {
    ...(prev.hint ? { hint: prev.hint } : {}),
    ...(prev.mode ? { mode: prev.mode } : {}),
    ...(prev.show ? { show: prev.show } : {}),
  }
  if (type === 'code_no_error' || type === 'output_not_empty' || type === 'output_empty')
    return { type, ...meta }
  if (type === 'variable_exists') return { type, name: prev.name ?? '', ...meta }
  if (type === 'variable_dict_key_value')
    return { type, name: prev.name ?? '', key: prev.key ?? '', value: prev.value ?? '', ...meta }
  if (type === 'variable_array_nth_item')
    return {
      type,
      name: prev.name ?? '',
      index: prev.index ?? '0',
      value: prev.value ?? '',
      ...meta,
    }
  if (type.startsWith('variable_'))
    return { type, name: prev.name ?? '', value: prev.value ?? '', ...meta }
  if (type === 'element_exists') return { type, selector: prev.selector ?? '', ...meta }
  if (type === 'element_count')
    return { type, selector: prev.selector ?? '', value: prev.value ?? '1', ...meta }
  if (type === 'element_attribute')
    return {
      type,
      selector: prev.selector ?? '',
      attribute: prev.attribute ?? '',
      value: prev.value ?? '',
      ...meta,
    }
  if (type === 'element_style_property')
    return {
      type,
      selector: prev.selector ?? '',
      property: prev.property ?? '',
      value: prev.value ?? '',
      ...meta,
    }
  if (
    type === 'element_value' ||
    type === 'element_value_contains' ||
    type === 'element_value_equals' ||
    type === 'element_value_not_contains' ||
    type === 'element_value_not_equals' ||
    type === 'element_value_matches_regex' ||
    type === 'element_value_not_matches_regex'
  ) {
    return { type, selector: prev.selector ?? '', value: prev.value ?? '', ...meta }
  }
  return { type, value: prev.value ?? '', ...meta }
}

function isRegexOperator(operator) {
  return String(operator ?? '').includes('matches_regex')
}

export {
  formatCheckFailure,
  formatCheckFailureDetail,
  subjectOpFromType,
  subjectOpFromCheck,
  aspectFromSubjectOperator,
  checkUiFromCheck,
  getAspectOptions,
  defaultOperatorForAspect,
  typeFromSubjectOp,
  checkFromSubjectOp,
  getOperatorOptions,
  makeCheckSkeleton,
  isRegexOperator,
}
