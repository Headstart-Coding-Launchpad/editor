import { COLOUR_HEX } from './art.js'
import { SECTIONS, SPOTS, stationProgress } from './station.js'

// A tiny picture of the station for the tutor's card: lit sections and filled spots as dots.
const SECTION_BOXES = {
  core: [61, 8, 38, 46],
  left: [13, 18, 42, 44],
  right: [105, 18, 42, 44],
  dock: [64, 60, 32, 14],
}

export function MiniStationPicture({ scene }) {
  const lights = COLOUR_HEX[scene?.lights] ?? COLOUR_HEX.orange
  return (
    <svg
      className="act-station-mini__svg"
      viewBox="0 0 160 80"
      role="img"
      aria-label="The student's space station"
      data-testid="station-mini-picture"
    >
      <rect x="0" y="0" width="160" height="80" rx="8" fill="#0f172a" />
      <rect
        x="3"
        y="6"
        width="154"
        height="68"
        rx="30"
        fill={COLOUR_HEX[scene?.hull] ?? COLOUR_HEX.blue}
      />
      {SECTIONS.map((s) => {
        const [x, y, w, h] = SECTION_BOXES[s.id]
        const lit = !!scene?.power?.[s.id]
        return (
          <rect
            key={s.id}
            data-testid={`mini-section-${s.id}`}
            data-lit={lit ? 'true' : 'false'}
            x={x}
            y={y}
            width={w}
            height={h}
            rx="6"
            fill={lit ? lights : '#1e293b'}
            opacity={lit ? 0.95 : 0.85}
          />
        )
      })}
      {SPOTS.map((spot) => {
        const filled = Object.prototype.hasOwnProperty.call(scene?.placed ?? {}, spot.id)
        return (
          <circle
            key={spot.id}
            data-testid={`mini-spot-${spot.id}`}
            data-filled={filled ? 'true' : 'false'}
            cx={(spot.x + spot.w / 2) * 160}
            cy={(spot.y + spot.h / 2) * 80}
            r="3.2"
            fill={filled ? '#ffffff' : 'none'}
            stroke="#ffffff"
            strokeOpacity="0.7"
            strokeWidth="0.8"
          />
        )
      })}
    </svg>
  )
}

function parseState(raw) {
  if (raw && typeof raw === 'object') return raw
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export default function StationCardSummary({ task, raw, state }) {
  const s = state?.scene ? state : parseState(raw)
  if (!s?.scene) return <span data-testid="station-card">No station yet</span>
  const { done, core } = stationProgress(task, s)
  return (
    <span className="act-station-mini" data-testid="station-card">
      <MiniStationPicture scene={s.scene} />
      <span className="act-station-mini__text">
        {Math.min(done, core)}/{core} goals
      </span>
    </span>
  )
}
