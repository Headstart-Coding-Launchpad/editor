import { IncorrectCheckResultsDisplay, formatCheckFailure, formatCheckFailureDetail } from './CheckEditors'

export default function TaskCheckResults({ checkResults, incorrectCheckResults }) {
  if (!checkResults) return null

  const allPassed = checkResults.every(r => r.passed)
  const blockingFeedbackMatched = incorrectCheckResults?.some(r => r.passed && (r.mode ?? 'blocking') === 'blocking') ?? false
  const taskPasses = allPassed && !blockingFeedbackMatched

  return (
    <>
      <div style={{ border: '1px solid', borderRadius: 8, padding: '10px 14px', fontFamily: 'var(--font-body)', fontSize: '0.88rem', lineHeight: 1.6, background: taskPasses ? '#f0fdf4' : '#fffbeb', borderColor: taskPasses ? '#bbf7d0' : '#fde68a', flexShrink: 0 }}>
        {checkResults.length === 1 ? (
          taskPasses
            ? 'Check passes - students will see the completion banner.'
            : blockingFeedbackMatched
              ? 'Completion check passes, but blocking feedback also matches.'
              : formatCheckFailure(checkResults[0])
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {checkResults.map((r, i) => (
              <div key={i}>{r.passed ? `Check ${i + 1} passes.` : `Check ${i + 1} does not pass - ${formatCheckFailureDetail(r)}`}</div>
            ))}
            <div style={{ marginTop: 4, fontWeight: 700 }}>
              {taskPasses ? 'All checks pass - students will see the completion banner.' : blockingFeedbackMatched ? 'Blocking feedback also matches.' : 'Not all checks pass.'}
            </div>
          </div>
        )}
      </div>
      {(!allPassed || incorrectCheckResults?.length > 0) && <IncorrectCheckResultsDisplay results={incorrectCheckResults} />}
    </>
  )
}
