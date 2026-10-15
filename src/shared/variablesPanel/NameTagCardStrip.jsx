import './NameTagPanel.css'
import {
  currentSnapshot,
  describeVariable,
  getShowVariables,
  readSyncedVariables,
  visibleVars,
  visualOptions,
} from './variablesPanel.js'
import { cardVisuals, describePicture } from './visuals.js'

const MAX_CHIPS = 12
const MAX_BARS = 12

/**
 * The tutor's student card: small thumbnails of the student's list visuals from their last Run
 * (up to two variables whose visual is colour swatches, a picture or bars), beside the output.
 * Nothing for a task without the name-tag panel, with `visuals: false`, or before a Run of this
 * task. `synced` is the student's students/{id}/currentVariables.
 */
export default function NameTagCardStrip({ task, synced }) {
  const config = getShowVariables(task)
  if (!config || config.visuals === false) return null
  const { run } = readSyncedVariables(synced)
  if (!run || (run.taskId != null && String(run.taskId) !== String(task?.id))) return null
  const items = cardVisuals(visibleVars(currentSnapshot(run), config.hide), visualOptions(config))
  if (items.length === 0) return null
  return (
    <div className="ntp-card-strip" data-testid="card-variable-visuals">
      {items.map(({ name, node, visual }) => {
        const words =
          visual.kind === 'picture' ? describePicture(name, visual) : describeVariable(name, node)
        return (
          <div key={name} className="ntp-card-thumb" title={words} role="img" aria-label={words}>
            <code className="ntp-card-thumb-name" aria-hidden="true">
              {name}
            </code>
            <Thumb visual={visual} />
          </div>
        )
      })}
    </div>
  )
}

function Thumb({ visual }) {
  if (visual.kind === 'swatches') {
    const shown = visual.items.slice(0, MAX_CHIPS)
    return (
      <span className="ntp-thumb-chips" aria-hidden="true">
        {shown.map((item) => (
          <span key={item.index} className="ntp-thumb-chip" style={{ background: item.hex }} />
        ))}
        {visual.items.length > shown.length && (
          <span className="ntp-thumb-more">+{visual.items.length - shown.length}</span>
        )}
      </span>
    )
  }
  if (visual.kind === 'bars') {
    const shown = visual.items.slice(0, MAX_BARS)
    return (
      <span className="ntp-thumb-bars" aria-hidden="true">
        {shown.map((item) => (
          <span
            key={item.index}
            className={`ntp-thumb-bar${item.number < 0 ? ' is-negative' : ''}`}
            style={{ height: `${Math.max(8, Math.round(item.fraction * 100))}%` }}
          />
        ))}
      </span>
    )
  }
  if (visual.kind === 'picture') {
    return (
      <span
        className="ntp-thumb-picture"
        style={{
          gridTemplateColumns: `repeat(${visual.cols}, 1fr)`,
          gridTemplateRows: `repeat(${visual.rows}, 1fr)`,
        }}
        aria-hidden="true"
      >
        {visual.cells.flatMap((row, r) =>
          row.map((cell, c) => (
            <span
              key={`${r},${c}`}
              className={`ntp-thumb-pixel${cell.hex ? '' : ' is-clear'}`}
              style={cell.hex ? { background: cell.hex } : undefined}
            />
          ))
        )}
      </span>
    )
  }
  return null
}
