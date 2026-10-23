import { COLOUR_HEX } from './art.js'
import { PLACE_SPOTS, SECTIONS, SCENE_ASPECT, spotById, stationProgress } from './station.js'

// A tiny picture of the station for the tutor's card (160 x 100, the scene's 1.6:1): the hull in its
// colour, a power light per section and a dot per spot, filled when a part is placed there.
const W = 160
const H = W / SCENE_ASPECT
const HULL = { x: 0.156, y: 0.283, w: 0.6875, h: 0.433 }

export function MiniStationPicture({ scene }) {
  const lights = COLOUR_HEX[scene?.lights] ?? COLOUR_HEX.orange
  return (
    <svg
      className="act-station-mini__svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="The student's space station"
      data-testid="station-mini-picture"
    >
      <rect x="0" y="0" width={W} height={H} rx="8" fill="#0f172a" />
      <rect
        x={HULL.x * W}
        y={HULL.y * H}
        width={HULL.w * W}
        height={HULL.h * H}
        rx="16"
        fill={COLOUR_HEX[scene?.hull] ?? COLOUR_HEX.blue}
      />
      {SECTIONS.map((s) => {
        const spot = spotById(s.spot)
        const lit = !!scene?.power?.[s.id]
        return (
          <circle
            key={s.id}
            data-testid={`mini-section-${s.id}`}
            data-lit={lit ? 'true' : 'false'}
            cx={(spot.x + spot.w / 2) * W}
            cy={(spot.y + spot.h / 2) * H}
            r="7"
            fill={lit ? lights : '#1e293b'}
            stroke="#ffffff"
            strokeOpacity="0.6"
            strokeWidth="1"
          />
        )
      })}
      {PLACE_SPOTS.map((spot) => {
        const filled = Object.prototype.hasOwnProperty.call(scene?.placed ?? {}, spot.id)
        return (
          <circle
            key={spot.id}
            data-testid={`mini-spot-${spot.id}`}
            data-filled={filled ? 'true' : 'false'}
            cx={(spot.x + spot.w / 2) * W}
            cy={(spot.y + spot.h / 2) * H}
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
