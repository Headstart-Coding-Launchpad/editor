import React, { useState } from 'react'
import StudentView from './StudentView'

// `#/shot`: the page `hsc lessons screenshot` (cli/lesson-screenshot.mjs) captures. It shows one
// task exactly as a student sees it, with no session: StudentView's previewMode keeps code in
// memory and writes no solo log or progress, as the Builder's preview does.
//
// The lesson comes only from `window.__HSC_SHOT__` ({ lesson, taskId }), which the CLI sets
// with Playwright before the app loads. It is never read from the URL, so a link can't make
// this page show someone else's content.
export const SHOT_GLOBAL = '__HSC_SHOT__'

function readShot() {
  const shot = typeof window !== 'undefined' ? window[SHOT_GLOBAL] : null
  return shot && shot.lesson && Array.isArray(shot.lesson.tasks) ? shot : null
}

export default function ShotView() {
  const [shot] = useState(readShot)

  if (!shot) {
    return (
      <div style={s.empty} data-testid="shot-empty">
        This page is used by the LaunchPad screenshot tool.
      </div>
    )
  }

  return (
    <div style={s.page} data-testid="shot-page">
      <StudentView
        lesson={shot.lesson}
        forceSolo
        previewMode
        showPreviewBanner={false}
        allowUnrestrictedTaskNavigation
        initialTaskId={shot.taskId ?? null}
      />
    </div>
  )
}

const s = {
  page: { display: 'flex', flexDirection: 'column', height: '100%' },
  empty: { padding: 32, color: 'var(--colour-text-muted, #64748b)' },
}
