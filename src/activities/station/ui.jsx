import { gradeStationTask, promptFor, stationAction, methodWords } from './station.js'

// Space station UI (placeholder). A plain list of goals with buttons that send the real actions,
// so the model can be driven end to end. The real station picture, drag and Ctrl+Z come next.
// Controlled view: ActivityHost passes `state`, `onChange(next | prev => next)`, `readOnly`.

const BUTTONS = [
  { label: 'Power on everything', action: { type: 'power', section: 'all', method: 'click' } },
  {
    label: 'Hull: red',
    action: { type: 'colour', target: 'hull', colour: 'red', method: 'click' },
  },
  { label: 'Undo', action: { type: 'undo', method: 'ctrl_z' } },
]

export function StationStudentView({ task, state, onChange, readOnly = false }) {
  const result = gradeStationTask(task, state)
  const act = (action) => onChange?.((prev) => stationAction(prev, action, task))
  return (
    <div className="act-panel" data-testid="station-activity">
      <ul>
        {(task?.items ?? []).map((item) => {
          const r = result.itemResults[item.id]
          return (
            <li key={item.id}>
              {r?.correct ? '✓ ' : ''}
              {promptFor(item)}
              {r?.method ? ` (${methodWords(r.method)})` : ''}
            </li>
          )
        })}
      </ul>
      {!readOnly &&
        BUTTONS.map((b) => (
          <button key={b.label} type="button" className="act-btn" onClick={() => act(b.action)}>
            {b.label}
          </button>
        ))}
    </div>
  )
}

export default {
  StudentView: StationStudentView,
}
