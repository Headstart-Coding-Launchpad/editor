import React from 'react'
import { MarkdownFieldEditor } from '../ExplainerEditor'
import { Field } from './TaskEditorFields'

function CopyButtons({ output, code, onInsert }) {
  const btnBase = {
    fontFamily: 'var(--font-body)', fontSize: '0.78rem', padding: '3px 10px',
    borderRadius: 6, border: '1px solid var(--colour-primary)', background: 'transparent',
    color: 'var(--colour-primary)', cursor: 'pointer',
  }
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
      {output != null && output !== '' && (
        <button type="button" style={btnBase}
          onClick={() => onInsert(output)} title="Use the current output as the check value">
          Use output
        </button>
      )}
      {code != null && code !== '' && (
        <button type="button" style={btnBase}
          onClick={() => onInsert(code)} title="Use the current code as the check value">
          Use code
        </button>
      )}
    </div>
  )
}

function IncorrectCheckResultsDisplay({ results }) {
  if (!results || results.length === 0) return null
  const anyMatched = results.some(r => r.passed)
  return (
    <div style={{ border: '1px solid #c7d2fe', borderRadius: 8, padding: '10px 14px', fontFamily: 'var(--font-body)', fontSize: '0.88rem', lineHeight: 1.6, background: '#f0f4ff', marginTop: 8 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Incorrect checks:</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {results.map((r, i) => (
          <div key={i}>
            {r.passed
              ? <span>🎯 <strong>Incorrect check {i + 1} matched</strong>{r.hint ? <> — hint: <em>"{r.hint}"</em></> : ' — no hint set'}</span>
              : <span style={{ color: '#6b7280' }}>— Incorrect check {i + 1} did not match</span>}
          </div>
        ))}
        {!anyMatched && (
          <div style={{ marginTop: 4, color: '#6b7280', fontSize: '0.85em' }}>
            No incorrect check matched — the completion check hint (if any) will be shown instead.
          </div>
        )}
      </div>
    </div>
  )
}

function formatCheckFailure(result) {
  return `Check does not pass - ${formatCheckFailureDetail(result)}`
}

function formatCheckFailureDetail(result) {
  if (result.type === 'output_empty') return 'output is not empty'
  if (result.type === 'element_exists') return `no element matches selector "${result.selector ?? ''}"`
  if (result.type === 'element_count') return `expected ${result.value ?? ''} elements matching selector "${result.selector ?? ''}"`
  if (result.type === 'element_value') return `review expected text or input value "${result.value ?? ''}"`
  return `review your check value "${result.value ?? ''}"`
}

function subjectOpFromType(type) {
  const map = {
    'code_no_error':               { subject: 'output',  operator: 'no_error' },
    'output_not_empty':            { subject: 'output',  operator: 'not_empty' },
    'output_empty':                { subject: 'output',  operator: 'empty' },
    'output_contains':             { subject: 'output',  operator: 'contains' },
    'output_equals':               { subject: 'output',  operator: 'equals' },
    'output_not_contains':         { subject: 'output',  operator: 'not_contains' },
    'output_not_equals':           { subject: 'output',  operator: 'not_equals' },
    'output_matches_regex':        { subject: 'output',  operator: 'matches_regex' },
    'output_line_count':           { subject: 'output',  operator: 'line_count' },
    'output_line_count_at_least':  { subject: 'output',  operator: 'line_count_at_least' },
    'code_contains':               { subject: 'code',    operator: 'contains' },
    'code_equals':                 { subject: 'code',    operator: 'equals' },
    'code_does_not_contain':       { subject: 'code',    operator: 'not_contains' },
    'code_not_contains':           { subject: 'code',    operator: 'not_contains' },
    'code_not_equals':             { subject: 'code',    operator: 'not_equals' },
    'code_matches_regex':          { subject: 'code',    operator: 'matches_regex' },
    'element_exists':              { subject: 'element', operator: 'exists' },
    'element_count':               { subject: 'element', operator: 'count' },
    'element_value':               { subject: 'element', operator: 'value_contains' },
    'element_value_contains':      { subject: 'element', operator: 'value_contains' },
    'element_value_equals':        { subject: 'element', operator: 'value_equals' },
    'element_value_not_contains':  { subject: 'element', operator: 'value_not_contains' },
    'element_value_not_equals':    { subject: 'element', operator: 'value_not_equals' },
    'element_value_matches_regex': { subject: 'element', operator: 'value_matches_regex' },
    'element_attribute':           { subject: 'element', operator: 'attribute_equals' },
    'element_style_property':      { subject: 'element', operator: 'style_equals' },
    'variable_exists':             { subject: 'variable', operator: 'exists' },
    'variable_type':               { subject: 'variable', operator: 'type' },
    'variable_equals':             { subject: 'variable', operator: 'equals' },
    'variable_not_equals':         { subject: 'variable', operator: 'not_equals' },
    'variable_dict_contains':      { subject: 'variable', operator: 'dict_contains' },
    'variable_dict_equals':        { subject: 'variable', operator: 'dict_equals' },
    'variable_dict_key_value':     { subject: 'variable', operator: 'dict_key_value' },
    'variable_array_contains':     { subject: 'variable', operator: 'array_contains' },
    'variable_array_equals':       { subject: 'variable', operator: 'array_equals' },
    'variable_array_nth_item':     { subject: 'variable', operator: 'array_nth_item' },
  }
  return map[type] ?? { subject: 'output', operator: 'contains' }
}

function typeFromSubjectOp(subject, operator) {
  const maps = {
    output: {
      no_error:      'code_no_error',
      contains:      'output_contains',
      equals:        'output_equals',
      not_contains:  'output_not_contains',
      not_equals:    'output_not_equals',
      matches_regex: 'output_matches_regex',
      not_empty:     'output_not_empty',
      empty:         'output_empty',
      line_count:           'output_line_count',
      line_count_at_least:  'output_line_count_at_least',
    },
    code: {
      contains:      'code_contains',
      equals:        'code_equals',
      not_contains:  'code_not_contains',
      not_equals:    'code_not_equals',
      matches_regex: 'code_matches_regex',
    },
    element: {
      exists:              'element_exists',
      count:               'element_count',
      value_contains:      'element_value_contains',
      value_equals:        'element_value_equals',
      value_not_contains:  'element_value_not_contains',
      value_not_equals:    'element_value_not_equals',
      value_matches_regex: 'element_value_matches_regex',
      attribute_equals:    'element_attribute',
      style_equals:        'element_style_property',
    },
    variable: {
      exists:          'variable_exists',
      type:            'variable_type',
      equals:          'variable_equals',
      not_equals:      'variable_not_equals',
      dict_contains:   'variable_dict_contains',
      dict_equals:     'variable_dict_equals',
      dict_key_value:  'variable_dict_key_value',
      array_contains:  'variable_array_contains',
      array_equals:    'variable_array_equals',
      array_nth_item:  'variable_array_nth_item',
    },
  }
  return maps[subject]?.[operator] ?? 'output_contains'
}

function getOperatorOptions(subject, currentOperator = null) {
  if (subject === 'output') return [
    ...(currentOperator === 'no_error' ? [{ value: 'no_error', label: 'no error (legacy)' }] : []),
    { value: 'contains',      label: 'contains' },
    { value: 'equals',        label: 'equals' },
    { value: 'not_contains',  label: 'does not contain' },
    { value: 'not_equals',    label: 'does not equal' },
    { value: 'matches_regex', label: 'matches regex' },
    { value: 'not_empty',     label: 'is not empty' },
    { value: 'empty',         label: 'is empty' },
    { value: 'line_count',          label: 'line count equals' },
    { value: 'line_count_at_least', label: 'line count at least' },
  ]
  if (subject === 'code') return [
    { value: 'contains',      label: 'contains' },
    { value: 'equals',        label: 'equals' },
    { value: 'not_contains',  label: 'does not contain' },
    { value: 'not_equals',    label: 'does not equal' },
    { value: 'matches_regex', label: 'matches regex' },
  ]
  if (subject === 'element') return [
    { value: 'exists',              label: 'exists' },
    { value: 'count',               label: 'count equals' },
    { value: 'value_contains',      label: 'value contains' },
    { value: 'value_equals',        label: 'value equals' },
    { value: 'value_not_contains',  label: 'value does not contain' },
    { value: 'value_not_equals',    label: 'value does not equal' },
    { value: 'value_matches_regex', label: 'value matches regex' },
    { value: 'attribute_equals',    label: 'attribute equals' },
    { value: 'style_equals',        label: 'style property equals' },
  ]
  if (subject === 'variable') return [
    { value: 'exists',          label: 'exists' },
    { value: 'type',            label: 'type is' },
    { value: 'equals',          label: 'equals' },
    { value: 'not_equals',      label: 'does not equal' },
    { value: 'dict_contains',   label: 'dictionary contains' },
    { value: 'dict_equals',     label: 'dictionary equals' },
    { value: 'dict_key_value',  label: 'dictionary key value equals' },
    { value: 'array_contains',  label: 'array contains' },
    { value: 'array_equals',    label: 'array equals' },
    { value: 'array_nth_item',  label: 'array N-th item equals' },
  ]
  return []
}

function makeCheckSkeleton(type, prev = {}) {
  const hint = prev.hint ? { hint: prev.hint } : {}
  if (type === 'code_no_error' || type === 'output_not_empty' || type === 'output_empty') return { type, ...hint }
  if (type === 'variable_exists') return { type, name: prev.name ?? '', ...hint }
  if (type === 'variable_dict_key_value') return { type, name: prev.name ?? '', key: prev.key ?? '', value: prev.value ?? '', ...hint }
  if (type === 'variable_array_nth_item') return { type, name: prev.name ?? '', index: prev.index ?? '0', value: prev.value ?? '', ...hint }
  if (type.startsWith('variable_')) return { type, name: prev.name ?? '', value: prev.value ?? '', ...hint }
  if (type === 'element_exists') return { type, selector: prev.selector ?? '', ...hint }
  if (type === 'element_count') return { type, selector: prev.selector ?? '', value: prev.value ?? '1', ...hint }
  if (type === 'element_attribute') return { type, selector: prev.selector ?? '', attribute: prev.attribute ?? '', value: prev.value ?? '', ...hint }
  if (type === 'element_style_property') return { type, selector: prev.selector ?? '', property: prev.property ?? '', value: prev.value ?? '', ...hint }
  if (type === 'element_value' || type === 'element_value_contains' || type === 'element_value_equals' || type === 'element_value_not_contains' || type === 'element_value_not_equals' || type === 'element_value_matches_regex') {
    return { type, selector: prev.selector ?? '', value: prev.value ?? '', ...hint }
  }
  return { type, value: prev.value ?? '', ...hint }
}

function CheckValueEditor({ check, subject, operator, onChange, output = '', code = '' }) {
  if (check.type === 'code_no_error') {
    return <div className="te-check-help">Passes when Python runs without an error.</div>
  }
  if (check.type === 'output_not_empty') {
    return <div className="te-check-help">Passes when the run produces any visible output.</div>
  }
  if (check.type === 'output_empty') {
    return <div className="te-check-help">Passes when the run produces no visible output.</div>
  }

  if (subject === 'element') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input
          className="te-input"
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.88rem' }}
          value={check.selector ?? ''}
          onChange={e => onChange({ ...check, selector: e.target.value })}
          placeholder="CSS selector, e.g. h1  .myClass  #myId  input[type=text]"
        />
        {operator === 'exists' && (
          <div className="te-check-help">Passes when at least one matching element exists in the page.</div>
        )}
        {operator === 'attribute_equals' && (
          <>
            <input
              className="te-input"
              value={check.attribute ?? ''}
              onChange={e => onChange({ ...check, attribute: e.target.value })}
              placeholder="Attribute name, e.g. href, src, alt, class"
            />
            <input
              className="te-input"
              value={check.value ?? ''}
              onChange={e => onChange({ ...check, value: e.target.value })}
              placeholder="Optional expected attribute value..."
            />
          </>
        )}
        {operator === 'style_equals' && (
          <>
            <input
              className="te-input"
              value={check.property ?? ''}
              onChange={e => onChange({ ...check, property: e.target.value })}
              placeholder="CSS property, e.g. color, background-color, font-size"
            />
            <input
              className="te-input"
              value={check.value ?? ''}
              onChange={e => onChange({ ...check, value: e.target.value })}
              placeholder="Optional expected computed value, e.g. rgb(255, 0, 0) or 16px"
            />
          </>
        )}
        {operator === 'count' && (
          <input
            className="te-input"
            style={{ width: 160 }}
            type="number"
            min="0"
            value={check.value ?? '1'}
            onChange={e => onChange({ ...check, value: e.target.value })}
            placeholder="Expected count"
          />
        )}
        {operator !== 'exists' && operator !== 'count' && operator !== 'attribute_equals' && operator !== 'style_equals' && (
          <input
            className="te-input"
            value={check.value ?? ''}
            onChange={e => onChange({ ...check, value: e.target.value })}
            placeholder={
              operator === 'value_matches_regex' ? 'Regular expression, e.g. ^\\d+$  (case-sensitive)'
              : operator === 'value_equals'        ? 'Exact text or input value...'
              : operator === 'value_not_contains'  ? 'Text that must NOT be present...'
              : operator === 'value_not_equals'    ? 'Value it must NOT equal...'
              :                                      'Text that value must contain...'
            }
          />
        )}
      </div>
    )
  }

  if (subject === 'variable') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input
          className="te-input"
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.88rem' }}
          value={check.name ?? ''}
          onChange={e => onChange({ ...check, name: e.target.value })}
          placeholder="Variable name, e.g. score"
        />
        {operator === 'exists' && (
          <div className="te-check-help">Passes when the variable exists after the Python code runs.</div>
        )}
        {operator === 'dict_key_value' && (
          <input
            className="te-input"
            value={check.key ?? ''}
            onChange={e => onChange({ ...check, key: e.target.value })}
            placeholder="Dictionary key, e.g. name"
          />
        )}
        {operator === 'array_nth_item' && (
          <input
            className="te-input"
            style={{ width: 180 }}
            type="number"
            min="0"
            value={check.index ?? '0'}
            onChange={e => onChange({ ...check, index: e.target.value })}
            placeholder="Zero-based item index"
          />
        )}
        {operator !== 'exists' && (
          <textarea
            className="te-check-value"
            value={check.value ?? ''}
            onChange={e => onChange({ ...check, value: e.target.value })}
            placeholder={
              operator === 'type' ? 'Expected type, e.g. string, number, boolean, array, dictionary'
              : operator === 'dict_equals' ? 'Expected dictionary as JSON, e.g. {"name":"Ada","age":12}'
              : operator === 'array_equals' ? 'Expected array as JSON, e.g. ["red", "blue"]'
              : 'Expected value, e.g. hello, 5, true, or JSON'
            }
          />
        )}
      </div>
    )
  }

  if (check.type === 'output_line_count' || check.type === 'output_line_count_at_least') {
    return (
      <input
        className="te-input"
        style={{ width: 160 }}
        type="number"
        min="0"
        value={check.value ?? ''}
        onChange={e => onChange({ ...check, value: e.target.value })}
        placeholder={check.type === 'output_line_count_at_least' ? 'Minimum number of lines' : 'Expected number of lines'}
      />
    )
  }

  const showOutputCopy = subject === 'output' && output !== ''
  const showCodeCopy   = subject === 'code'   && code !== ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {(showOutputCopy || showCodeCopy) && (
        <CopyButtons
          output={showOutputCopy ? output : ''}
          code={showCodeCopy ? code : ''}
          onInsert={value => onChange({ ...check, value })}
        />
      )}
      <textarea
        className="te-check-value"
        value={check.value ?? ''}
        onChange={e => onChange({ ...check, value: e.target.value })}
        placeholder={
          operator === 'matches_regex' ? 'Regular expression, e.g. ^\\d+$  (case-sensitive)'
          : operator === 'equals'       ? 'Exact expected value...'
          : operator === 'not_equals'   ? 'Value it must NOT equal...'
          : operator === 'not_contains' ? 'String that must NOT be present...'
          :                               'String that must be present… or "option1","option2" for any one of multiple values'
        }
      />
    </div>
  )
}

function CheckListEditor({ checks, onChange, interactionMode = 'run', allowVariableChecks = false, allowDomChecks = false, lessonType = null, output = '', code = '' }) {
  const submitMode = interactionMode === 'submit'

  function updateCheck(index, updated) {
    onChange(checks.map((c, i) => i === index ? updated : c))
  }
  function removeCheck(index) {
    onChange(checks.filter((_, i) => i !== index))
  }
  function addCheck() {
    onChange([...checks, submitMode ? { type: 'code_contains', value: '' } : { type: 'output_contains', value: '' }])
  }

  function handleSubjectChange(index, newSubject) {
    const current = checks[index]
    const defaultOp = newSubject === 'output' ? 'contains'
      : newSubject === 'code' ? 'contains'
      : newSubject === 'variable' ? 'exists'
      : 'exists'
    updateCheck(index, makeCheckSkeleton(typeFromSubjectOp(newSubject, defaultOp), current))
  }

  function handleOperatorChange(index, newOperator) {
    const current = checks[index]
    const { subject } = subjectOpFromType(current.type)
    updateCheck(index, makeCheckSkeleton(typeFromSubjectOp(subject, newOperator), current))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      {checks.map((check, index) => {
        const { subject, operator } = subjectOpFromType(check.type)
        const operatorOptions = getOperatorOptions(subject, operator)
        return (
          <div key={index} className="te-check-row">
            {checks.length > 1 && <span className="te-check-index">#{index + 1}</span>}
            <div className="te-check-editor">
              <select
                className="te-select"
                style={{ flex: '0 0 auto' }}
                value={subject}
                onChange={e => handleSubjectChange(index, e.target.value)}
              >
                {!submitMode && <option value="output">Output</option>}
                <option value="code">Code</option>
                {allowVariableChecks && <option value="variable">Variable</option>}
                {allowDomChecks && <option value="element">Element</option>}
              </select>
              <select
                className="te-select"
                style={{ flex: '0 0 auto' }}
                value={operator}
                onChange={e => handleOperatorChange(index, e.target.value)}
              >
                {operatorOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <CheckValueEditor
                check={check}
                subject={subject}
                operator={operator}
                onChange={updated => updateCheck(index, updated)}
                output={output}
                code={code}
              />
              <div style={{ gridColumn: '1 / -1' }}>
                <MarkdownFieldEditor
                  height={118}
                  minHeight={104}
                  ariaLabel={`Check ${index + 1} hint Markdown editor views`}
                  value={check.hint ?? ''}
                  onChange={value => updateCheck(index, { ...check, hint: value })}
                  placeholder="Suggestion shown in the completion banner when this check fails..."
                  lessonType={lessonType}
                />
              </div>
            </div>
            {checks.length > 1 && (
              <button type="button" className="te-check-remove-btn" onClick={() => removeCheck(index)} title="Remove check">×</button>
            )}
          </div>
        )
      })}
      <button type="button" className="btn-ghost te-add-check-btn" onClick={addCheck}>
        + Add check
      </button>
    </div>
  )
}

export { CopyButtons, IncorrectCheckResultsDisplay, formatCheckFailure, formatCheckFailureDetail, subjectOpFromType, typeFromSubjectOp, getOperatorOptions, makeCheckSkeleton, CheckValueEditor, CheckListEditor }
