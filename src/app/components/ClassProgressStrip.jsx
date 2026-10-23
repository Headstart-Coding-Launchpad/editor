import React from 'react'
import { countCurrentTaskDone } from '../../shared/classProgress'

/**
 * A thin strip under the top bar while the tutor is live: the class's current task and how
 * many students have finished it ("4 of 7 done"). Counts only, never names. Used on the
 * presentation window and on students' screens while Go Live is on. Renders nothing when the
 * class is empty or the task is an information task (nothing to finish).
 */
export default function ClassProgressStrip({ session, task }) {
  const { done, total } = countCurrentTaskDone(session)
  if (total === 0 || !task || task.taskType === 'information') return null
  return (
    <div
      data-testid="class-progress-strip"
      role="status"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '4px 16px',
        fontSize: 14,
        background: '#eef2ff',
        borderBottom: '1px solid #c7d2fe',
        color: '#1e1b4b',
      }}
    >
      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {task.title ?? 'This task'}
      </span>
      <span>
        {done} of {total} done
      </span>
    </div>
  )
}
