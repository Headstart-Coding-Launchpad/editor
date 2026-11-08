import { useEffect, useRef, useState } from 'react'
import { CALM_FULLSCREEN_BAR_H } from './calmPalette.js'

/**
 * The calm Scratch stage column (ScratchWorkspace, capabilities.calmScratch): a big labelled green
 * Run (the green flag) and a red Stop, Enlarge above the small stage, and one Sprite settings fold.
 * CalmStageShell wraps the stage itself: Enlarge turns that same element into a full-screen
 * stage (never remounted, so the running project, the sprites and the key handlers carry on), and
 * Back returns. The blocks stay mounted, hidden behind it.
 */

function FlagIcon({ size = 20, colour = '#fff' }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 15 15">
      <rect x="1" y="0" width="2" height="15" rx=".5" fill={colour} />
      <polygon points="3,1 14,6 3,11" fill={colour} />
    </svg>
  )
}

// `big`: the column's own Run (as tall as the mock-up's 56px); the full-screen bar's is smaller.
export function CalmRunButton({ onRun, big = true, className }) {
  return (
    <button
      type="button"
      className={className}
      data-highlight-target="green_flag"
      aria-label="Run"
      title="Run your code (the green flag)"
      onClick={(e) => {
        e.currentTarget.blur()
        onRun?.()
      }}
      style={{ ...s.run, ...(big ? s.runBig : s.runSmall) }}
    >
      <FlagIcon size={big ? 20 : 16} />
      <span>Run</span>
    </button>
  )
}

export function CalmStopButton({ onStop, big = true }) {
  return (
    <button
      type="button"
      data-highlight-target="stop"
      aria-label="Stop"
      title="Stop all scripts"
      onClick={onStop}
      style={{ ...s.stop, ...(big ? s.stopBig : s.stopSmall) }}
    >
      <span style={s.stopIcon} aria-hidden="true" />
    </button>
  )
}

function EnlargeIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" />
    </svg>
  )
}

export function CalmEnlargeButton({ onEnlarge }) {
  return (
    <button
      type="button"
      data-testid="scratch-enlarge"
      title="Show the stage full screen"
      onClick={onEnlarge}
      style={s.enlarge}
    >
      <EnlargeIcon />
      Enlarge
    </button>
  )
}

/**
 * "Sprite settings": the sprite property row (x, y, direction, size, show, rotation, costume)
 * and + Backdrop folded behind one labelled button. Starts open (`defaultOpen`) when a check of
 * the task reads a sprite property, so the child can watch x and y. The open state lives while
 * the workspace stays mounted (this task), never stored. `available` false (nothing to fold: the
 * Stage tile is selected) hides the button and the contents but keeps the open state.
 */
export function CalmSpriteSettings({ children, available = true, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  if (!available) return null
  return (
    <div style={s.settingsWrap}>
      <button
        type="button"
        data-testid="scratch-sprite-settings"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{ ...s.settings, ...(open ? s.settingsOpen : null) }}
      >
        <span aria-hidden="true">⚙</span> Sprite settings{' '}
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && <div style={s.settingsPanel}>{children}</div>}
    </div>
  )
}

// The hint is Markdown (a check's hint can say **say**); the one-line bar shows it as plain text.
function plainHint(text) {
  return String(text)
    .replace(/\*\*|`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Over the lesson screen, but under the classroom's own overlays: the tutor's "Coding Paused"
// screen (999), peer-help prompts (900-950) and the class countdown (200) still show on top.
export const CALM_FULLSCREEN_Z = 150

// The blocks-pane highlight targets hidden behind the full-screen stage: Back is the way to them.
const BLOCKS_PANE_REVEALS = 'category costumes_tab sounds_tab'

/**
 * Wraps the stage. Not full screen: a plain wrapper. Full screen: the same wrapper fixed over the
 * whole window (a dialog), with a thin bar on top (Back, then `controls`: Run, Stop, Reset Stage,
 * then the hint line) and the stage centred below. The stage (`children`) keeps its place in the
 * tree either way, so it is never remounted. Escape goes back. `readOnly` (a tutor watching): Back
 * only, no controls or hint.
 */
export function CalmStageShell({
  fullscreen,
  onBack,
  controls = null,
  hint = '',
  readOnly = false,
  children,
}) {
  const onBackRef = useRef(onBack)
  onBackRef.current = onBack
  // Escape goes back, and only that: heard first (window, capture phase) and stopped there, so a
  // modal around the stage (the tutor's student window closes on Escape) is not closed with it.
  useEffect(() => {
    if (!fullscreen) return undefined
    function onKey(event) {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onBackRef.current?.()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [fullscreen])

  return (
    <div
      data-testid={fullscreen ? 'scratch-fullscreen-stage' : undefined}
      role={fullscreen ? 'dialog' : undefined}
      aria-modal={fullscreen ? true : undefined}
      aria-label={fullscreen ? 'Stage, full screen' : undefined}
      style={fullscreen ? s.overlay : s.contents}
    >
      {fullscreen && (
        <div style={s.bar}>
          <button
            type="button"
            data-testid="scratch-fullscreen-back"
            data-highlight-reveal={BLOCKS_PANE_REVEALS}
            onClick={onBack}
            style={s.back}
            title="Back to your blocks"
          >
            <span aria-hidden="true">←</span> Back
          </button>
          {!readOnly && controls}
          {!readOnly && hint ? (
            <span style={s.hint} title={plainHint(hint)}>
              <span aria-hidden="true">💡</span> {plainHint(hint)}
            </span>
          ) : null}
        </div>
      )}
      <div style={fullscreen ? s.stageArea : s.contents}>{children}</div>
    </div>
  )
}

// The calm screen's purple outline button (Enlarge, Sprite settings), as the Blocks button.
const OUTLINE_BUTTON = {
  alignItems: 'center',
  minHeight: 44,
  padding: '6px 14px',
  borderRadius: 10,
  border: '1px solid #c4b5fd',
  background: '#fff',
  color: '#5b21b6',
  fontFamily: 'var(--font-body)',
  fontWeight: 700,
  fontSize: 15,
  cursor: 'pointer',
}

const s = {
  run: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    border: 'none',
    borderRadius: 12,
    background: 'linear-gradient(180deg, #22c55e, #16a34a)',
    color: '#fff',
    fontFamily: 'var(--font-title, var(--font-body))',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(22, 163, 74, 0.35)',
    whiteSpace: 'nowrap',
  },
  runBig: { flex: '1 1 auto', minHeight: 56, fontSize: 21, padding: '6px 18px' },
  runSmall: { minHeight: 44, fontSize: 17, padding: '4px 20px' },
  stop: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: 12,
    background: '#ef4444',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
  },
  stopBig: { width: 56, minHeight: 56 },
  stopSmall: { width: 44, minHeight: 44 },
  stopIcon: {
    width: 14,
    height: 14,
    flexShrink: 0,
    display: 'inline-block',
    background: '#fff',
    borderRadius: 2,
  },
  enlarge: { ...OUTLINE_BUTTON, display: 'inline-flex', gap: 8, whiteSpace: 'nowrap' },
  settingsWrap: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  settings: {
    ...OUTLINE_BUTTON,
    display: 'flex',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
  },
  settingsOpen: { background: '#f5f3ff', borderColor: '#8b5cf6' },
  settingsPanel: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 },
  contents: { display: 'contents' },
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: CALM_FULLSCREEN_Z,
    display: 'flex',
    flexDirection: 'column',
    background: '#1e1b2e',
  },
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minHeight: CALM_FULLSCREEN_BAR_H,
    padding: '6px 10px',
    background: '#4c1d95',
    flexShrink: 0,
    minWidth: 0,
  },
  back: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    padding: '6px 16px',
    borderRadius: 10,
    border: 'none',
    background: '#fff',
    color: '#5b21b6',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: 16,
    cursor: 'pointer',
    flexShrink: 0,
  },
  hint: {
    marginLeft: 6,
    minWidth: 0,
    padding: '8px 14px',
    borderRadius: 10,
    background: '#eff6ff',
    color: '#1e3a8a',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 15,
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  stageArea: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
}
