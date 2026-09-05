import React from 'react'
import { MarkdownFieldEditor } from '../ExplainerEditor'
import { getStageRole } from '../../../shared/taskUtils'
import {
  formatCheckFailure,
  formatCheckFailureDetail,
  subjectOpFromType,
  subjectOpFromCheck,
  checkUiFromCheck,
  typeFromSubjectOp,
  checkFromSubjectOp,
  getAspectOptions,
  defaultOperatorForAspect,
  getOperatorOptions,
  makeCheckSkeleton,
  isRegexOperator,
} from './check-editors/checkEditorUtils'

function CopyButtons({ output, code, onInsert }) {
  const btnBase = {
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    padding: '3px 10px',
    borderRadius: 6,
    border: '1px solid var(--colour-primary)',
    background: 'transparent',
    color: 'var(--colour-primary)',
    cursor: 'pointer',
  }
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
      {output != null && output !== '' && (
        <button
          type="button"
          style={btnBase}
          onClick={() => onInsert(output)}
          title="Use the current output as the check value"
        >
          Use output
        </button>
      )}
      {code != null && code !== '' && (
        <button
          type="button"
          style={btnBase}
          onClick={() => onInsert(code)}
          title="Use the current code as the check value"
        >
          Use code
        </button>
      )}
    </div>
  )
}

function IncorrectCheckResultsDisplay({ results }) {
  if (!results || results.length === 0) return null
  const anyMatched = results.some((r) => r.passed)
  return (
    <div
      style={{
        border: '1px solid #c7d2fe',
        borderRadius: 8,
        padding: '10px 14px',
        fontFamily: 'var(--font-body)',
        fontSize: '0.88rem',
        lineHeight: 1.6,
        background: '#f0f4ff',
        marginTop: 8,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Feedback checks:</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {results.map((r, i) => (
          <div key={i}>
            {r.passed ? (
              <span>
                🎯 <strong>Incorrect check {i + 1} matched</strong>
                {r.hint ? (
                  <>
                    {' '}
                    — hint: <em>"{r.hint}"</em>
                  </>
                ) : (
                  ' — no hint set'
                )}
              </span>
            ) : (
              <span style={{ color: '#6b7280' }}>— Incorrect check {i + 1} did not match</span>
            )}
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
    const isAttribute = operator.startsWith('attribute_')
    const isStyle = operator.startsWith('style_')
    const isValue = operator.startsWith('value_')
    const needsValue =
      !operator.endsWith('_exists') && operator !== 'exists' && !operator.startsWith('count_')
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input
          className="te-input"
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.88rem' }}
          value={check.selector ?? ''}
          onChange={(e) => onChange({ ...check, selector: e.target.value })}
          placeholder="CSS selector, e.g. h1  .myClass  #myId  input[type=text]"
        />
        {operator === 'exists' && (
          <div className="te-check-help">
            Passes when at least one matching element exists in the page.
          </div>
        )}
        {isAttribute && (
          <>
            <input
              className="te-input"
              value={check.attribute ?? ''}
              onChange={(e) => onChange({ ...check, attribute: e.target.value })}
              placeholder="Attribute name, e.g. href, src, alt, class"
            />
            {needsValue && (
              <input
                className="te-input"
                value={check.value ?? ''}
                onChange={(e) => onChange({ ...check, value: e.target.value })}
                placeholder="Expected attribute value..."
              />
            )}
          </>
        )}
        {isStyle && (
          <>
            <input
              className="te-input"
              value={check.property ?? ''}
              onChange={(e) => onChange({ ...check, property: e.target.value })}
              placeholder="CSS property, e.g. color, background-color, font-size"
            />
            {needsValue && (
              <input
                className="te-input"
                value={check.value ?? ''}
                onChange={(e) => onChange({ ...check, value: e.target.value })}
                placeholder="Expected computed value, e.g. rgb(255, 0, 0) or 16px"
              />
            )}
          </>
        )}
        {operator.startsWith('count_') && (
          <input
            className="te-input"
            style={{ width: 160 }}
            type="number"
            min="0"
            value={check.value ?? '1'}
            onChange={(e) => onChange({ ...check, value: e.target.value })}
            placeholder="Expected count"
          />
        )}
        {isValue && (
          <input
            className="te-input"
            value={check.value ?? ''}
            onChange={(e) => onChange({ ...check, value: e.target.value })}
            placeholder={
              operator === 'value_matches_regex' || operator === 'value_not_matches_regex'
                ? 'Regular expression, e.g. ^\\d+$'
                : operator === 'value_equals'
                  ? 'Exact text or input value...'
                  : operator === 'value_not_contains'
                    ? 'Text that must NOT be present...'
                    : operator === 'value_not_equals'
                      ? 'Value it must NOT equal...'
                      : 'Text that value must contain...'
            }
          />
        )}
        {isRegexOperator(operator) && (
          <input
            className="te-input"
            style={{ width: 180 }}
            value={check.flags ?? ''}
            onChange={(e) => onChange({ ...check, flags: e.target.value })}
            placeholder="Regex flags, e.g. i or m"
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
          onChange={(e) => onChange({ ...check, name: e.target.value })}
          placeholder="Variable name, e.g. score"
        />
        {operator === 'exists' && (
          <div className="te-check-help">
            Passes when the variable exists after the Python code runs.
          </div>
        )}
        {operator === 'dict_key_value' && (
          <input
            className="te-input"
            value={check.key ?? ''}
            onChange={(e) => onChange({ ...check, key: e.target.value })}
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
            onChange={(e) => onChange({ ...check, index: e.target.value })}
            placeholder="Zero-based item index"
          />
        )}
        {operator !== 'exists' && (
          <textarea
            className="te-check-value"
            value={check.value ?? ''}
            onChange={(e) => onChange({ ...check, value: e.target.value })}
            placeholder={
              operator === 'type'
                ? 'Expected type, e.g. string, number, boolean, array, dictionary'
                : operator === 'dict_equals'
                  ? 'Expected dictionary as JSON, e.g. {"name":"Ada","age":12}'
                  : operator === 'array_equals'
                    ? 'Expected array as JSON, e.g. ["red", "blue"]'
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
        onChange={(e) => onChange({ ...check, value: e.target.value })}
        placeholder={
          check.operator === 'greater_than_or_equal' || check.type === 'output_line_count_at_least'
            ? 'Minimum number of lines'
            : 'Number of lines'
        }
      />
    )
  }

  const showOutputCopy = subject === 'output' && output !== ''
  const showCodeCopy = subject === 'code' && code !== ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {(showOutputCopy || showCodeCopy) && (
        <CopyButtons
          output={showOutputCopy ? output : ''}
          code={showCodeCopy ? code : ''}
          onInsert={(value) => onChange({ ...check, value })}
        />
      )}
      <textarea
        className="te-check-value"
        value={check.value ?? ''}
        onChange={(e) => onChange({ ...check, value: e.target.value })}
        placeholder={
          operator === 'matches_regex'
            ? 'Regular expression, e.g. ^\\d+$  (case-sensitive)'
            : operator === 'not_matches_regex'
              ? 'Regular expression that must NOT match, e.g. ^\\d+$'
              : operator === 'equals'
                ? 'Exact expected value...'
                : operator === 'not_equals'
                  ? 'Value it must NOT equal...'
                  : operator === 'not_contains'
                    ? 'String that must NOT be present...'
                    : 'String that must be present… or "option1","option2" for any one of multiple values'
        }
      />
      {isRegexOperator(operator) && (
        <input
          className="te-input"
          style={{ width: 180 }}
          value={check.flags ?? ''}
          onChange={(e) => onChange({ ...check, flags: e.target.value })}
          placeholder="Regex flags, e.g. i or m"
        />
      )}
    </div>
  )
}

// The "how should this check's feedback behave" pair. Every check editor - builder,
// electronics, filesystem and scratch - had its own copy of these two selects; only the
// wrapper style and one option label ever differed.
//
// `onChange` receives the whole updated check, so callers that hold checks in a list can
// splice it straight back in.
function CheckFeedbackControls({
  check,
  onChange,
  style,
  afterAttemptLabel = 'After attempt',
  children,
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', ...style }}>
      <select
        className="te-select"
        value={check.mode ?? 'blocking'}
        onChange={(e) => onChange({ ...check, mode: e.target.value })}
        title="Feedback behaviour"
      >
        <option value="blocking">Blocking</option>
        <option value="nudge">Nudge</option>
      </select>
      <select
        className="te-select"
        value={check.show === 'on_pause' ? 'on_idle' : (check.show ?? 'after_attempt')}
        onChange={(e) => onChange({ ...check, show: e.target.value })}
        title="When to show feedback"
      >
        <option value="after_attempt">{afterAttemptLabel}</option>
        <option value="on_idle">On idle</option>
      </select>
      {children}
    </div>
  )
}

export function FeedbackStageOfferControls({ check, stages = [], onChange }) {
  const selectedStageIndex = check.stageOffer?.stageIndex
  const supportStages = stages
    .map((stage, index) => ({ stage, index }))
    .filter(({ stage }) => getStageRole(stage) === 'support')
  const hasStage =
    Number.isInteger(Number(selectedStageIndex)) &&
    supportStages.some(({ index }) => index === Number(selectedStageIndex))

  return (
    <div
      style={{
        gridColumn: '1 / -1',
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontFamily: 'var(--font-body)',
          fontSize: '0.8rem',
          fontWeight: 600,
        }}
      >
        Priority
        <input
          className="te-input"
          style={{ width: 62, padding: '4px 6px', fontSize: '0.82rem' }}
          type="number"
          min="1"
          value={check.priority ?? ''}
          onChange={(e) =>
            onChange({
              ...check,
              priority: e.target.value === '' ? undefined : Number(e.target.value),
            })
          }
          title="Lower numbers are shown first when more than one feedback check matches"
        />
      </label>
      <select
        className="te-select"
        value={hasStage ? String(selectedStageIndex) : ''}
        onChange={(e) => {
          if (e.target.value === '') {
            const { stageOffer: _stageOffer, ...next } = check
            onChange(next)
            return
          }
          onChange({
            ...check,
            stageOffer: {
              stageIndex: Number(e.target.value),
              action: 'preview',
              afterMatches: check.stageOffer?.afterMatches ?? 2,
            },
          })
        }}
        title="Offer a stage when this feedback check matches"
      >
        <option value="">No linked stage</option>
        {supportStages.map(({ stage, index }) => (
          <option key={index} value={index}>
            {stage.label || `Support ${index + 1}`}
          </option>
        ))}
      </select>
      {hasStage && (
        <>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#6b7280' }}>
            Shows a read-only hint.
          </span>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontFamily: 'var(--font-body)',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            Offer after
            <input
              className="te-input"
              style={{ width: 52, padding: '4px 6px', fontSize: '0.82rem' }}
              type="number"
              min="1"
              value={check.stageOffer?.afterMatches ?? 2}
              onChange={(e) =>
                onChange({
                  ...check,
                  stageOffer: {
                    ...check.stageOffer,
                    afterMatches: e.target.value === '' ? undefined : Number(e.target.value),
                  },
                })
              }
              title="Number of times this feedback check must match before offering the stage"
            />
            matches
          </label>
        </>
      )}
    </div>
  )
}

function CheckListEditor({
  checks,
  onChange,
  interactionMode = 'run',
  allowVariableChecks = false,
  allowDomChecks = false,
  lessonType = null,
  output = '',
  code = '',
  feedbackEditor = false,
  stages = [],
}) {
  const submitMode = interactionMode === 'submit'

  function updateCheck(index, updated) {
    onChange(checks.map((c, i) => (i === index ? updated : c)))
  }
  function removeCheck(index) {
    onChange(checks.filter((_, i) => i !== index))
  }
  function addCheck() {
    const check = checkFromSubjectOp(submitMode ? 'code' : 'output', 'contains')
    onChange([
      ...checks,
      feedbackEditor
        ? { ...check, mode: 'blocking', show: 'after_attempt', priority: checks.length + 1 }
        : check,
    ])
  }

  function handleSubjectChange(index, newSubject) {
    const current = checks[index]
    const defaultAspect = getAspectOptions(newSubject)[0]?.value ?? 'value'
    const defaultOp = defaultOperatorForAspect(newSubject, defaultAspect)
    updateCheck(index, checkFromSubjectOp(newSubject, defaultOp, current))
  }

  function handleAspectChange(index, newAspect) {
    const current = checks[index]
    const { subject } = checkUiFromCheck(current)
    updateCheck(
      index,
      checkFromSubjectOp(subject, defaultOperatorForAspect(subject, newAspect), current)
    )
  }

  function handleOperatorChange(index, newOperator) {
    const current = checks[index]
    const { subject } = checkUiFromCheck(current)
    updateCheck(index, checkFromSubjectOp(subject, newOperator, current))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      {checks.map((check, index) => {
        const { subject, aspect, operator } = checkUiFromCheck(check)
        const aspectOptions = getAspectOptions(subject, aspect)
        const operatorOptions = getOperatorOptions(subject, operator, aspect)
        return (
          <div key={index} className="te-check-row">
            {checks.length > 1 && <span className="te-check-index">#{index + 1}</span>}
            <div className="te-check-editor">
              <select
                className="te-select"
                style={{ flex: '0 0 auto' }}
                value={subject}
                onChange={(e) => handleSubjectChange(index, e.target.value)}
              >
                {!submitMode && <option value="output">Output</option>}
                <option value="code">Code</option>
                {allowVariableChecks && <option value="variable">Variable</option>}
                {allowDomChecks && <option value="element">Element</option>}
              </select>
              <select
                className="te-select"
                style={{ flex: '0 0 auto' }}
                value={aspect}
                onChange={(e) => handleAspectChange(index, e.target.value)}
              >
                {aspectOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                className="te-select"
                style={{ flex: '0 0 auto' }}
                value={operator}
                onChange={(e) => handleOperatorChange(index, e.target.value)}
              >
                {operatorOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <div className="te-check-value-editor">
                <CheckValueEditor
                  check={check}
                  subject={subject}
                  operator={operator}
                  onChange={(updated) => updateCheck(index, updated)}
                  output={output}
                  code={code}
                />
              </div>
              {feedbackEditor && (
                <CheckFeedbackControls
                  check={check}
                  onChange={(updated) => updateCheck(index, updated)}
                  style={{ gridColumn: '1 / -1' }}
                  afterAttemptLabel="After run or submit"
                >
                  <FeedbackStageOfferControls
                    check={check}
                    stages={stages}
                    onChange={(updated) => updateCheck(index, updated)}
                  />
                </CheckFeedbackControls>
              )}
              <div style={{ gridColumn: '1 / -1' }}>
                <MarkdownFieldEditor
                  height={118}
                  minHeight={104}
                  ariaLabel={`Check ${index + 1} hint Markdown editor views`}
                  value={check.hint ?? ''}
                  onChange={(value) => updateCheck(index, { ...check, hint: value })}
                  placeholder="Suggestion shown in the completion banner when this check fails..."
                  lessonType={lessonType}
                />
              </div>
            </div>
            <button
              type="button"
              className="te-check-remove-btn"
              onClick={() => removeCheck(index)}
              title="Remove check"
            >
              ×
            </button>
          </div>
        )
      })}
      <button type="button" className="btn-ghost te-add-check-btn" onClick={addCheck}>
        + Add check
      </button>
    </div>
  )
}

export {
  CopyButtons,
  IncorrectCheckResultsDisplay,
  formatCheckFailure,
  formatCheckFailureDetail,
  subjectOpFromType,
  subjectOpFromCheck,
  checkUiFromCheck,
  typeFromSubjectOp,
  checkFromSubjectOp,
  getAspectOptions,
  getOperatorOptions,
  makeCheckSkeleton,
  CheckValueEditor,
  CheckListEditor,
  CheckFeedbackControls,
}
