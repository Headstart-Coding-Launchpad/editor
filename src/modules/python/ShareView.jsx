// Read-only share viewer (`/share/:id`) for a Python task: the code, its last output and, when
// the code drew on the Python Stage, the drawing.
import { useMemo } from 'react'
import { ShareCode, ShareOutput, shareStyles } from '../../shared/exportWork/ShareParts.jsx'
import StagePane from '../../shared/stage/StagePane.jsx'
import { readStageResult } from '../../shared/stage/sync.js'

// The share payload's `stageJson` (JSON text of compactStageForSync's shape), or null.
function readShareStage(payload) {
  if (typeof payload?.stageJson !== 'string' || !payload.stageJson) return null
  try {
    return readStageResult(JSON.parse(payload.stageJson))
  } catch {
    return null
  }
}

export default function PythonShareView({ payload }) {
  const stage = useMemo(() => readShareStage(payload), [payload])
  return (
    <div style={shareStyles.grid}>
      {stage && (
        <StagePane
          commands={stage.commands}
          ran
          compact
          truncated={stage.truncated}
          title="Stage drawing"
          style={s.stage}
        />
      )}
      <ShareCode code={payload?.code} language="python" />
      <ShareOutput output={payload?.output} />
    </div>
  )
}

const s = {
  stage: { width: '100%', maxWidth: 420, aspectRatio: '1 / 1' },
}
