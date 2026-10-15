import { useRef, useState } from 'react'
import {
  findStudentMapCall,
  normalizeStudentMapText,
  studentMapProblems,
  vehicleName,
  writeStudentMapToCode,
  GRID_LEGEND,
  GRID_MAX_SIZE,
} from './course.js'

/**
 * The tap-to-paint map editor for a Turtle course task with `studentMap: true` (P6-16,
 * docs/authoring/turtle.md "Students make their own map"). The student picks a tool (wall, road,
 * goal, star, start) and taps or drags over the squares; "Use this map" writes the map into their
 * code as `turtle.course_map("""…""")` (replacing the map already there, or adding a call after
 * `import turtle`). Typing the map works too; this is for tablets, where typing a maze is fiddly.
 *
 * - It opens on the map in the code when there is one (unknown characters and off-map spaces
 *   become walls), else the task's map.
 * - There is only ever one start: placing it moves it; tapping the start again turns it.
 * - Squares are at least 44 px; a big map scrolls. Rows and columns go from 3 to 30.
 * - Each square is a button named for screen readers ("Row 2, column 3: wall"), so the grid works
 *   from the keyboard too.
 */

export const MAP_EDITOR_MIN_SIZE = 3
const CELL_SIZE = 44

const TOOLS = [
  { id: 'wall', char: '#', label: 'Wall', icon: '🧱' },
  { id: 'road', char: '.', label: 'Road', icon: '⬜' },
  { id: 'goal', char: 'G', label: 'Goal', icon: '🏁' },
  { id: 'star', char: '*', label: 'Star', icon: '⭐' },
  { id: 'start', char: '>', label: 'Start', icon: '▶️' },
]

// The start turns clockwise each time it is tapped: east, south, west, north.
const START_TURNS = { '>': 'v', v: '<', '<': '^', '^': '>' }
const START_WORDS = { '>': 'east', v: 'south', '<': 'west', '^': 'north' }
const START_ARROWS = { '>': '▶', v: '▼', '<': '◀', '^': '▲' }

const DEFAULT_MAP = ['#######', '#>...G#', '#######']

/** The editor's grid (rows of characters, all the same length) from a map's text. */
export function gridFromMapText(text) {
  const tidy = normalizeStudentMapText(text)
  if (!tidy) return DEFAULT_MAP.map((row) => row.split(''))
  const lines = tidy.split('\n').slice(0, GRID_MAX_SIZE)
  const cols = Math.min(
    GRID_MAX_SIZE,
    Math.max(MAP_EDITOR_MIN_SIZE, ...lines.map((line) => line.length))
  )
  while (lines.length < MAP_EDITOR_MIN_SIZE) lines.push('')
  let startSeen = false
  return lines.map((line) => {
    const row = []
    for (let c = 0; c < cols; c += 1) {
      let ch = line[c] ?? '#'
      const kind = GRID_LEGEND[ch]
      if (!kind || kind === 'off') ch = '#'
      if (GRID_LEGEND[ch] === 'start') {
        if (startSeen) ch = '.'
        startSeen = true
      }
      row.push(ch)
    }
    return row
  })
}

/** The map text for a grid. */
export function mapTextFromGrid(grid) {
  return grid.map((row) => row.join('')).join('\n')
}

/** The grid after painting square (row, col) with `tool` (one of the TOOLS ids). Pure. */
export function paintGrid(grid, row, col, tool, { turnStart = false } = {}) {
  const current = grid[row]?.[col]
  if (current === undefined) return grid
  const spec = TOOLS.find((item) => item.id === tool)
  if (!spec) return grid
  if (tool === 'start') {
    const isStart = GRID_LEGEND[current] === 'start'
    if (isStart && !turnStart) return grid
    const mark = isStart ? START_TURNS[current] : '>'
    return grid.map((line, r) =>
      line.map((ch, c) => {
        if (r === row && c === col) return mark
        return GRID_LEGEND[ch] === 'start' ? '.' : ch
      })
    )
  }
  if (current === spec.char) return grid
  return grid.map((line, r) =>
    r === row ? line.map((ch, c) => (c === col ? spec.char : ch)) : line
  )
}

/** The grid with a row or column added (walls) or taken away at the end, within the limits. */
export function resizeGrid(grid, { rows = 0, cols = 0 } = {}) {
  let next = grid.map((line) => [...line])
  if (rows > 0 && next.length < GRID_MAX_SIZE) {
    next.push(Array.from({ length: next[0].length }, () => '#'))
  } else if (rows < 0 && next.length > MAP_EDITOR_MIN_SIZE) {
    next = next.slice(0, -1)
  }
  if (cols > 0 && next[0].length < GRID_MAX_SIZE) {
    next = next.map((line) => [...line, '#'])
  } else if (cols < 0 && next[0].length > MAP_EDITOR_MIN_SIZE) {
    next = next.map((line) => line.slice(0, -1))
  }
  return next
}

function squareWords(ch) {
  const kind = GRID_LEGEND[ch]
  if (kind === 'start') return `start, facing ${START_WORDS[ch]}`
  if (kind === 'pickup') return 'star'
  return kind ?? 'wall'
}

export default function CourseMapEditor({ code, course, onApply, onClose }) {
  const vehicle = course?.vehicle
  // Read once, when the editor opens: the map in the code, else the task's map.
  const [grid, setGrid] = useState(() => {
    const call = findStudentMapCall(code)
    const fallback = typeof course?.maps?.[0] === 'string' ? course.maps[0] : null
    return gridFromMapText(call ? call.text : fallback)
  })
  const [tool, setTool] = useState('wall')
  const paintingRef = useRef(false)
  const lastCellRef = useRef(null)

  const text = mapTextFromGrid(grid)
  const problems = studentMapProblems(text, vehicle)
  const rows = grid.length
  const cols = grid[0]?.length ?? 0

  function paintAt(row, col, options) {
    setGrid((current) => paintGrid(current, row, col, tool, options))
  }

  function cellFromPoint(event) {
    const element = document.elementFromPoint?.(event.clientX, event.clientY)
    const cell = element?.closest?.('[data-map-cell]')
    if (!cell) return null
    return { row: Number(cell.dataset.row), col: Number(cell.dataset.col) }
  }

  function handlePointerDown(event) {
    const cell = event.target.closest?.('[data-map-cell]')
    if (!cell) return
    event.preventDefault()
    const row = Number(cell.dataset.row)
    const col = Number(cell.dataset.col)
    paintingRef.current = true
    lastCellRef.current = `${row}:${col}`
    // Tapping the start with the start tool turns it.
    paintAt(row, col, { turnStart: true })
  }

  function handlePointerMove(event) {
    if (!paintingRef.current || tool === 'start') return
    const cell = cellFromPoint(event)
    if (!cell) return
    const key = `${cell.row}:${cell.col}`
    if (key === lastCellRef.current) return
    lastCellRef.current = key
    paintAt(cell.row, cell.col)
  }

  function stopPainting() {
    paintingRef.current = false
    lastCellRef.current = null
  }

  // A square pressed from the keyboard (Enter / Space): pointer presses paint on pointer down.
  function handleCellClick(event, row, col) {
    if (event.detail !== 0) return
    paintAt(row, col, { turnStart: true })
  }

  function apply() {
    if (problems.length) return
    onApply?.(writeStudentMapToCode(code, text))
  }

  const name = vehicleName(vehicle)

  return (
    <div
      className="ui-modal-backdrop"
      style={s.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Map editor"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose?.()
      }}
    >
      <div style={s.card}>
        <div style={s.header}>
          <h2 style={s.title}>🧱 Make your map</h2>
          <button type="button" style={s.close} onClick={onClose} aria-label="Close" title="Close">
            ✕
          </button>
        </div>
        <div style={s.body}>
          <p style={s.help}>
            Pick a tool, then tap or drag over the squares. Tap the start again to turn the {name}.
          </p>
          <div style={s.tools} role="group" aria-label="Tools">
            {TOOLS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="btn-ghost-outline"
                style={{ ...s.tool, ...(tool === item.id ? s.toolOn : null) }}
                aria-pressed={tool === item.id}
                onClick={() => setTool(item.id)}
              >
                <span aria-hidden="true">{item.icon}</span> {item.label}
              </button>
            ))}
          </div>
          <div style={s.sizes}>
            <SizeControl
              label="Rows"
              value={rows}
              onLess={() => setGrid((g) => resizeGrid(g, { rows: -1 }))}
              onMore={() => setGrid((g) => resizeGrid(g, { rows: 1 }))}
            />
            <SizeControl
              label="Columns"
              value={cols}
              onLess={() => setGrid((g) => resizeGrid(g, { cols: -1 }))}
              onMore={() => setGrid((g) => resizeGrid(g, { cols: 1 }))}
            />
          </div>
          <div style={s.gridScroll}>
            <div
              role="group"
              aria-label={`Your map, ${cols} squares wide and ${rows} tall`}
              style={{
                ...s.grid,
                gridTemplateColumns: `repeat(${cols}, ${CELL_SIZE}px)`,
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={stopPainting}
              onPointerCancel={stopPainting}
              onPointerLeave={stopPainting}
              data-testid="course-map-grid"
            >
              {grid.map((line, r) => (
                <div key={r} style={s.row}>
                  {line.map((ch, c) => (
                    <button
                      key={c}
                      type="button"
                      data-map-cell=""
                      data-row={r}
                      data-col={c}
                      aria-label={`Row ${r + 1}, column ${c + 1}: ${squareWords(ch)}`}
                      style={{ ...s.cell, ...cellLook(ch) }}
                      onClick={(event) => handleCellClick(event, r, c)}
                    >
                      <span aria-hidden="true">{cellMark(ch)}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <p
            style={{ ...s.status, ...(problems.length ? s.statusBad : s.statusGood) }}
            role="status"
            aria-live="polite"
          >
            {problems.length ? `${problems[0]}.` : 'Your map is ready to drive.'}
          </p>
          <div style={s.actions}>
            <button type="button" className="btn-ghost-outline" style={s.action} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              style={s.action}
              onClick={apply}
              disabled={problems.length > 0}
            >
              Use this map
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SizeControl({ label, value, onLess, onMore }) {
  return (
    <div style={s.size} role="group" aria-label={label}>
      <span style={s.sizeLabel}>
        {label}: {value}
      </span>
      <button
        type="button"
        className="btn-ghost-outline"
        style={s.sizeBtn}
        onClick={onLess}
        disabled={value <= MAP_EDITOR_MIN_SIZE}
        aria-label={`Fewer ${label.toLowerCase()}`}
      >
        −
      </button>
      <button
        type="button"
        className="btn-ghost-outline"
        style={s.sizeBtn}
        onClick={onMore}
        disabled={value >= GRID_MAX_SIZE}
        aria-label={`More ${label.toLowerCase()}`}
      >
        +
      </button>
    </div>
  )
}

function cellMark(ch) {
  const kind = GRID_LEGEND[ch]
  if (kind === 'goal') return '🏁'
  if (kind === 'pickup') return '⭐'
  if (kind === 'start') return START_ARROWS[ch]
  return ''
}

// Walls are dark and hatched, road pale: they differ by pattern as well as colour.
function cellLook(ch) {
  const kind = GRID_LEGEND[ch]
  if (kind === 'wall' || kind === 'off' || !kind) return s.wall
  if (kind === 'start') return s.start
  return s.road
}

const s = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1200,
    padding: 16,
  },
  card: {
    background: 'var(--ui-surface, #fff)',
    color: 'var(--colour-text)',
    width: 'min(760px, 100%)',
    maxHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 14px',
  },
  title: { margin: 0, fontSize: 18, flex: 1 },
  close: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 8,
    fontSize: 18,
    cursor: 'pointer',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 14,
    minHeight: 0,
    overflow: 'auto',
  },
  help: { margin: 0, fontSize: 14, color: 'var(--colour-muted, #475569)' },
  tools: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  tool: {
    minHeight: 44,
    minWidth: 44,
    padding: '6px 12px',
    fontSize: 15,
    fontWeight: 700,
    borderRadius: 8,
  },
  toolOn: { outline: '3px solid var(--colour-primary, #6d28d9)', outlineOffset: 1 },
  sizes: { display: 'flex', flexWrap: 'wrap', gap: 16 },
  size: { display: 'flex', alignItems: 'center', gap: 6 },
  sizeLabel: { fontSize: 14, fontWeight: 600, minWidth: 90 },
  sizeBtn: { minWidth: 44, minHeight: 44, fontSize: 20, fontWeight: 700, borderRadius: 8 },
  gridScroll: {
    overflow: 'auto',
    maxHeight: '55vh',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 6,
    alignSelf: 'stretch',
  },
  grid: { display: 'grid', gap: 2, touchAction: 'none', width: 'max-content' },
  // Each row's squares sit straight in the grid's columns.
  row: { display: 'contents' },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    padding: 0,
    border: '1px solid #cbd5e1',
    borderRadius: 4,
    fontSize: 22,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
  },
  wall: {
    background: 'repeating-linear-gradient(45deg, #334155 0 6px, #475569 6px 12px)',
    borderColor: '#1e293b',
  },
  road: { background: '#f8fafc' },
  start: { background: '#dbeafe', color: '#1e3a8a', fontWeight: 700 },
  status: { margin: 0, fontSize: 15, fontWeight: 600 },
  statusBad: { color: '#b91c1c' },
  statusGood: { color: '#15803d' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  action: { minHeight: 44, padding: '8px 18px', fontSize: 15 },
}
