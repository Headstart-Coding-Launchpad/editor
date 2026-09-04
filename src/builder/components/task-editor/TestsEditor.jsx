import { Field } from './TaskEditorFields'
import { CheckListEditor } from './CheckEditors'

function makeTestId() {
  return `t${Date.now().toString(36)}`
}

function makeDefaultTest() {
  return {
    id: makeTestId(),
    name: '',
    inputs: [{ name: '', value: '' }],
    check: { type: 'output_contains', value: '' },
  }
}

function InputRow({ input, onChange, onRemove, canRemove }) {
  const s = {
    row: { display: 'flex', gap: 6, alignItems: 'center' },
    nameInput: { width: 130, flexShrink: 0 },
    valueInput: { flex: 1 },
    removeBtn: {
      flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
      color: '#9ca3af', fontSize: '1.1rem', lineHeight: 1, padding: '0 4px',
    },
  }
  return (
    <div style={s.row}>
      <input
        className="te-input"
        style={s.nameInput}
        value={input.name}
        onChange={e => onChange({ ...input, name: e.target.value })}
        placeholder="Input name"
        title="Name used in {placeholder} substitution in checks"
      />
      <input
        className="te-input"
        style={s.valueInput}
        value={input.value}
        onChange={e => onChange({ ...input, value: e.target.value })}
        placeholder="Value provided to input()"
      />
      {canRemove && (
        <button type="button" style={s.removeBtn} onClick={onRemove} title="Remove input">×</button>
      )}
    </div>
  )
}

function SingleTestEditor({ test, onChange, onRemove, lessonType }) {
  function setField(field, value) {
    onChange({ ...test, [field]: value })
  }

  function updateInput(index, updated) {
    setField('inputs', test.inputs.map((inp, i) => i === index ? updated : inp))
  }
  function removeInput(index) {
    setField('inputs', test.inputs.filter((_, i) => i !== index))
  }
  function addInput() {
    setField('inputs', [...test.inputs, { name: '', value: '' }])
  }

  const s = {
    card: {
      border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 12,
      background: '#fafafa',
    },
    header: { display: 'flex', alignItems: 'center', gap: 8 },
    nameInput: { flex: 1 },
    removeBtn: {
      background: 'none', border: '1px solid #e5e7eb', borderRadius: 6,
      cursor: 'pointer', color: '#9ca3af', fontSize: '0.8rem', padding: '3px 8px',
      fontFamily: 'var(--font-body)',
    },
    sectionLabel: {
      fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.82rem',
      color: '#6b7280', marginBottom: 4,
    },
    inputList: { display: 'flex', flexDirection: 'column', gap: 6 },
    columnHeaders: {
      display: 'flex', gap: 6, paddingRight: 28,
      fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#9ca3af',
    },
    addInputBtn: { alignSelf: 'flex-start' },
    hint: {
      fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#9ca3af',
      fontStyle: 'italic',
    },
  }

  return (
    <div style={s.card}>
      <div style={s.header}>
        <input
          className="te-input"
          style={s.nameInput}
          value={test.name}
          onChange={e => setField('name', e.target.value)}
          placeholder="Test name, e.g. Greet Alice"
        />
        <button type="button" style={s.removeBtn} onClick={onRemove}>Remove test</button>
      </div>

      <div>
        <div style={s.sectionLabel}>Inputs (provided to each input() call in order)</div>
        {test.inputs.length > 0 && (
          <div style={{ ...s.columnHeaders, marginBottom: 4 }}>
            <span style={{ width: 130 }}>Name (for {'{'} {'}'} substitution)</span>
            <span>Value</span>
          </div>
        )}
        <div style={s.inputList}>
          {test.inputs.map((inp, i) => (
            <InputRow
              key={i}
              input={inp}
              onChange={updated => updateInput(i, updated)}
              onRemove={() => removeInput(i)}
              canRemove={test.inputs.length > 1}
            />
          ))}
        </div>
        <button type="button" className="btn-ghost te-add-check-btn" style={{ marginTop: 6 }} onClick={addInput}>
          + Add input
        </button>
        <div style={{ ...s.hint, marginTop: 4 }}>
          Use {'{'} name {'}'} in the check value below to substitute this input's value, e.g. Hello {'{'} username {'}'}
        </div>
      </div>

      <div>
        <div style={s.sectionLabel}>Output check for this test</div>
        <CheckListEditor
          checks={test.check ? (Array.isArray(test.check) ? test.check : [test.check]) : [{ type: 'output_contains', value: '' }]}
          onChange={checks => setField('check', checks)}
          interactionMode="run"
          allowVariableChecks
          allowDomChecks={false}
          lessonType={lessonType}
        />
      </div>
    </div>
  )
}

export default function TestsEditor({ tests = [], onChange, lessonType }) {
  function addTest() {
    onChange([...tests, makeDefaultTest()])
  }
  function updateTest(index, updated) {
    onChange(tests.map((t, i) => i === index ? updated : t))
  }
  function removeTest(index) {
    onChange(tests.filter((_, i) => i !== index))
  }

  const s = {
    wrap: { display: 'flex', flexDirection: 'column', gap: 10 },
    description: {
      fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.5,
    },
  }

  return (
    <Field label="Tests">
      <div style={s.wrap}>
        <p style={s.description}>
          Define test cases with pre-set inputs. Students must run all tests to complete the task — plain Run stays interactive and does not count for completion.
        </p>
        {tests.map((test, i) => (
          <SingleTestEditor
            key={test.id ?? i}
            test={test}
            onChange={updated => updateTest(i, updated)}
            onRemove={() => removeTest(i)}
            lessonType={lessonType}
          />
        ))}
        <button type="button" className="btn-ghost te-add-check-btn" onClick={addTest}>
          + Add test case
        </button>
      </div>
    </Field>
  )
}
