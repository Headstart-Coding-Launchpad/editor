export default function TaskRunControls({
  running,
  runningTests,
  pyodideStatus,
  hasTests,
  onRun,
  onStop,
  onRunTests,
}) {
  const busy = running || runningTests
  return (
    <div className="te-run-row">
      <button
        className="btn-primary"
        onClick={busy ? onStop : onRun}
        disabled={!busy && pyodideStatus === 'loading'}
        style={{
          padding: '10px 28px',
          fontSize: 15,
          ...(busy ? { backgroundColor: '#ef4444', borderColor: '#ef4444' } : {}),
        }}
      >
        {busy ? 'Stop' : pyodideStatus === 'loading' ? 'Getting Python ready...' : 'Run'}
      </button>
      {hasTests && (
        <button
          className="btn-primary"
          onClick={onRunTests}
          disabled={running || pyodideStatus === 'loading' || runningTests}
          style={{ padding: '10px 28px', fontSize: 15 }}
        >
          {runningTests ? 'Running tests...' : 'Run Tests'}
        </button>
      )}
      {pyodideStatus === 'loading' && (
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.85rem',
            color: 'var(--colour-primary)',
          }}
        >
          Getting Python ready...
        </span>
      )}
    </div>
  )
}
