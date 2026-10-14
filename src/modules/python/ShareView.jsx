// Read-only share viewer (`/share/:id`) for a Python task: the code and its last output.
import { ShareCode, ShareOutput, shareStyles } from '../../shared/exportWork/ShareParts.jsx'

export default function PythonShareView({ payload }) {
  return (
    <div style={shareStyles.grid}>
      <ShareCode code={payload?.code} language="python" />
      <ShareOutput output={payload?.output} />
    </div>
  )
}
