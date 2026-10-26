import React, { useEffect, useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { downloadFile } from '../../shared/exportWork/pictures'
import { formatAppVersion, getAppBuildInfo } from '../../shared/appVersion'
import { useTimingRun } from '../timingRun/useTimingRun'
import { displayTimes, formatClock, isTicking } from '../timingRun/timingRun'
import { saveTimingRunDoc } from '../timingRun/saveTimingRun'

// Tutor timing run (admin preview only): times each task while it is on screen, then saves
// the run on Finish. See docs/authoring/timing-runs.md.
export default function TimingRunControl({ lessonId, lesson, taskId }) {
  const { user } = useAuth()
  const run = useTimingRun({ lessonId, lesson, taskId, tutorUid: user?.uid ?? 'unknown' })
  const [, setTick] = useState(0)
  const [result, setResult] = useState(null) // { payload, status: 'saving' | 'saved' | 'error', error? }

  const running = run.state !== null
  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  async function finish() {
    const payload = run.buildPayload({
      tutorEmail: user?.email,
      appVersion: formatAppVersion(getAppBuildInfo()),
    })
    run.discard()
    setResult({ payload, status: 'saving' })
    try {
      await saveTimingRunDoc(payload)
      setResult({ payload, status: 'saved' })
    } catch (err) {
      setResult({ payload, status: 'error', error: err?.message ?? String(err) })
    }
  }

  function download(payload) {
    downloadFile(
      `timing-run-${payload.lessonId}-${payload.finishedAt}.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    )
  }

  if (result) {
    return (
      <div style={s.bar} role="status" data-testid="timing-run-result">
        <span>
          {result.status === 'saving' && 'Saving timing run…'}
          {result.status === 'saved' &&
            `Timing run saved (${formatClock(result.payload.totalSeconds)} total).`}
          {result.status === 'error' && `Could not save: ${result.error}`}
        </span>
        <button type="button" style={s.btn} onClick={() => download(result.payload)}>
          Download JSON
        </button>
        {result.status !== 'saving' && (
          <button type="button" style={s.btn} onClick={() => setResult(null)}>
            Close
          </button>
        )}
      </div>
    )
  }

  if (!running) {
    return (
      <div style={s.bar}>
        <button type="button" style={s.btn} onClick={run.start} data-testid="timing-run-start">
          ⏱ Start timing run
        </button>
      </div>
    )
  }

  const times = displayTimes(run.state, Date.now())
  const ticking = isTicking(run.state)
  return (
    <div style={s.bar} data-testid="timing-run-bar">
      <span aria-label="Time on this task">⏱ Task {formatClock(times.currentSeconds)}</span>
      <span aria-label="Total time">Total {formatClock(times.totalSeconds)}</span>
      {run.state.hidden && <span style={s.note}>tab hidden</span>}
      {run.state.userPaused && <span style={s.note}>paused</span>}
      <button type="button" style={s.btn} onClick={() => run.setPaused(ticking)}>
        {run.state.userPaused ? 'Resume' : 'Pause'}
      </button>
      <button type="button" style={s.btn} onClick={finish}>
        Finish
      </button>
    </div>
  )
}

const s = {
  bar: {
    position: 'fixed',
    bottom: 12,
    left: 12,
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 10px',
    background: '#1f2937',
    color: '#fff',
    borderRadius: 8,
    fontSize: 13,
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  btn: {
    background: '#fff',
    color: '#1f2937',
    border: 'none',
    borderRadius: 6,
    padding: '4px 10px',
    cursor: 'pointer',
    fontSize: 13,
  },
  note: { color: '#fbbf24' },
}
