// Read-only share viewer (`/share/:id`) for a Scratch task: the student's project in the
// Scratch workspace, read-only (blocks can't be edited or saved) with the green flag working,
// so the class can watch it run. Nothing is written anywhere: no onStateChange is given.
import ScratchWorkspace from './ScratchWorkspace.jsx'

export default function ScratchShareView({ payload }) {
  return (
    <div style={s.wrap}>
      <ScratchWorkspace
        task={payload?.task ?? {}}
        readOnly
        assetsPath={payload?.assetsPath || ''}
        initialStates={payload?.state ?? null}
      />
    </div>
  )
}

const s = {
  wrap: {
    height: 'min(80vh, 760px)',
    minHeight: 420,
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    overflow: 'hidden',
    background: '#fff',
  },
}
