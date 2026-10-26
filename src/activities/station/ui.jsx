import StationBuilderEditor from './StationBuilderEditor.jsx'
import { useEffect, useRef, useState } from 'react'
import { MarkdownRenderer } from '../../shared/markdown'
import ActivityCorrect from '../ui/ActivityCorrect.jsx'
import RoundProgress from '../ui/RoundProgress.jsx'
import { COLOUR_HEX, SCENE_ART, SCENE_PX, STICKER_PATHS, WORLD_ART, artFor } from './art.js'
import StationCardSummary from './MiniStation.jsx'
import {
  CREW_IDS,
  HULL_COLOURS,
  LIGHT_COLOURS,
  SECTIONS,
  WORLDS,
  dropTarget,
  lessonOf,
  placeSpotsOf,
  sortProgress,
  spotById,
  worldIdOf,
  blockedBy,
  catalogueFor,
  countProgress,
  crateIdsFor,
  gradeStationItem,
  gradeStationTask,
  initialStationState,
  isActive,
  methodWords,
  mistakesOf,
  patternOn,
  isFreePattern,
  signalWords,
  HOLD_MS,
  nextInOrder,
  partById,
  promptFor,
  spotTakes,
  stationAction,
  stickerOf,
  stickerWords,
  trayParts,
} from './station.js'

// Space station UI (docs/architecture/station-activity.md, "Interaction"). A controlled view:
// `state`, `onChange(next | prev => next)`, `readOnly`, `teacher`, `device`. Every change goes
// through stationAction() with the method the student used, so the model records how each goal
// was done (click, double-click, drag, Ctrl+Z...). Pointer moves while dragging are UI state only.

// How far (px) the pointer must move after pressing a part before it counts as a drag.
const DRAG_START_PX = 5

// The action type that can finish each goal, so a failed attempt shows that goal's hint.
const GOAL_ACTION = {
  power_on: 'power',
  pick_colour: 'colour',
  select: 'select',
  open_crate: 'open',
  choose_captain: 'captain',
  place_part: 'place',
  undo: 'undo',
  undo_mistakes: 'undo',
  light_pattern: 'power',
  order_part: 'order',
  sort: 'place',
}

const pct = (n) => `${(n * 100).toFixed(3)}%`
const doneCount = (state) => Object.keys(state?.done ?? {}).length
// The picture's own size for a part: a cell is 0.08 of the scene's width and 0.128 of its height.
const CELL_W = SCENE_PX.cell / SCENE_PX.w
const CELL_H = SCENE_PX.cell / SCENE_PX.h
// How long the "Station upgraded!" moment plays on the scene.
const UPGRADE_MS = 3200

// How long a refused step blinks (a wrong order, a decoy crate).
const BLINK_MS = 650

const maskStyle = (src) => ({ WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` })

// A part's picture. `flipY` hangs it under the hull, `flipX` mirrors the left docking arm.
function PartImg({ id, state, flipX = false, flipY = false, className = '' }) {
  const art = artFor(id, state)
  if (!art) return null
  const flip = `${flipX ? ' is-flip-x' : ''}${flipY ? ' is-flip-y' : ''}`
  return (
    <img
      className={`act-station-img${flip}${className ? ` ${className}` : ''}`}
      src={art.src}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  )
}

// The white glow mask tinted by CSS: the selection halo and the "Station upgraded!" sparkle.
function GlowImg({ id, state, flipX = false, flipY = false, className = 'act-station-glow' }) {
  const art = artFor(id, state)
  const flip = `${flipX ? ' is-flip-x' : ''}${flipY ? ' is-flip-y' : ''}`
  return art ? (
    <span className={`${className}${flip}`} style={maskStyle(art.glow)} aria-hidden="true" />
  ) : null
}

// Where a part sits inside its spot: art size, bottom of the box (top of it when it hangs).
function placement(spot, part) {
  const w = (part?.cells?.[0] ?? 1) * CELL_W
  const h = (part?.cells?.[1] ?? 1) * CELL_H
  return {
    left: pct(spot.x + (spot.w - w) / 2),
    top: pct(spot.flipY ? spot.y : spot.y + spot.h - h),
    width: pct(w),
    height: pct(h),
  }
}

// A few sparkles around the newest part while the upgrade moment plays (still when motion is reduced).
function Sparks() {
  return (
    <span className="act-station-sparks" aria-hidden="true">
      <span>✦</span>
      <span>✦</span>
      <span>✦</span>
      <span>✦</span>
    </span>
  )
}

const spotBox = (spot) => ({
  left: pct(spot.x),
  top: pct(spot.y),
  width: pct(spot.w),
  height: pct(spot.h),
})

// A sticker (a colour and a shape, drawn in code) on a crate or on the delivery note.
function Sticker({ sticker, size = 40, className = '' }) {
  const [colour, shape] = String(sticker ?? '').split('-')
  const d = STICKER_PATHS[shape]
  if (!d || !COLOUR_HEX[colour]) return null
  return (
    <svg
      className={`act-station-sticker${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      data-sticker={sticker}
    >
      <path
        d={d}
        fill={COLOUR_HEX[colour]}
        stroke="#0f172a"
        strokeWidth="6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// The little picture beside a goal line: the part, crate or badge it is about.
function goalIcon(item, task) {
  const catalogue = catalogueFor(task)
  const anyPart = task?.lesson === 2 ? 'crate-1' : (catalogue[0] ?? 'crate-1')
  if (item?.card) return { glyph: '🔍' }
  switch (item?.goal) {
    case 'power_on':
    case 'light_pattern':
      return { id: 'power', state: 'on' }
    case 'open_crate':
      return { id: item.target || 'crate-1', state: 'open' }
    case 'choose_captain':
      return { id: 'captain-badge' }
    case 'select':
    case 'place_part':
    case 'order_part':
      return { id: item.target || item.order?.[0] || anyPart, state: 'closed' }
    case 'pick_colour':
      return { swatch: true, colour: item.match }
    case 'sort':
      return { glyph: '🐾' }
    default:
      return { glyph: '↶' }
  }
}

function GoalIcon({ item, task }) {
  const icon = goalIcon(item, task)
  if (icon.swatch) {
    return (
      <span
        className="act-station-goal__icon is-swatch"
        style={icon.colour ? { background: COLOUR_HEX[icon.colour] } : undefined}
        aria-hidden="true"
      />
    )
  }
  if (icon.glyph) {
    return (
      <span className="act-station-goal__icon is-glyph" aria-hidden="true">
        {icon.glyph}
      </span>
    )
  }
  return (
    <span className="act-station-goal__icon" aria-hidden="true">
      <PartImg id={icon.id} state={icon.state} />
    </span>
  )
}

const titleCase = (word) => (word ? word[0].toUpperCase() + word.slice(1) : '')

// The target card beside a goal line, big enough to read from across the room: the order to follow,
// the colour to match, the stickers on the delivery note, the part in the picture, or how many.
// Null for a goal with nothing to show.
function GoalCard({ item, task, state, blink, onSend }) {
  const scene = state.scene
  const order = Array.isArray(item.order) && item.order.length ? item.order : null
  const progress = countProgress(task, item, state)
  const finished = !!state.done?.[item.id]
  let body = null
  let label = ''
  const active = isActive(task, state.done, item)
  const mark = state.done?.[item.id]
  if (isFreePattern(item)) {
    label = 'Make your own signal'
    body = (
      <span className="act-station-card__step" data-testid={`card-free-${item.id}`}>
        {mark ? (
          <span className="act-station-card__name" data-testid={`signal-${item.id}`}>
            Signal sent: {signalWords(mark.pattern)}
          </span>
        ) : (
          <>
            <button
              type="button"
              className="act-station-send"
              data-testid={`send-${item.id}`}
              disabled={!onSend || !active}
              onClick={onSend}
            >
              Send signal
            </button>
            <span className="act-station-card__name">
              {active ? 'Switch lights on or off, then send' : 'Waits for the cards before it'}
            </span>
          </>
        )}
      </span>
    )
  } else if (item.goal === 'light_pattern' && item.pattern) {
    label = 'Make the lights look like this'
    body = SECTIONS.map((sec) => {
      const want = patternOn(item.pattern[sec.id])
      return (
        <span
          key={sec.id}
          className="act-station-card__step"
          data-testid={`card-pattern-${item.id}-${sec.id}`}
          data-on={want ? 'true' : 'false'}
        >
          <span className="act-station-card__pic">
            <PartImg id="power" state={want ? 'on' : 'off'} />
          </span>
          <span className="act-station-card__name">
            {sec.label}: {want ? 'On' : 'Off'}
          </span>
        </span>
      )
    })
  } else if (item.goal === 'sort') {
    const sorted = sortProgress(task, item, state)
    label = 'Every animal in its home'
    body = (
      <span className="act-station-card__step" data-testid={`card-sort-${item.id}`}>
        <span className="act-station-card__pic">
          <span className="act-station-card__glyph">🐾</span>
        </span>
        <span className="act-station-card__name" data-testid={`sorted-${item.id}`}>
          {sorted.have} of {sorted.need} at home
        </span>
      </span>
    )
  } else if (item.goal === 'undo_mistakes') {
    const total = Array.isArray(task.mistakes) ? task.mistakes.length : 0
    const left = Math.min(mistakesOf(scene).length, total)
    label = worldIdOf(task) === 'zoo' ? "The keeper's mistakes" : "The clumsy robot's drops"
    body = (
      <span className="act-station-card__step" data-testid={`card-mistakes-${item.id}`}>
        <span className="act-station-card__pic">
          <span className="act-station-card__glyph">↶</span>
        </span>
        <span className="act-station-card__name" data-testid={`mistakes-left-${item.id}`}>
          {left === 0 ? 'All put back' : `${left} to put back`}
        </span>
      </span>
    )
  } else if (order) {
    const next = finished || !active ? null : nextInOrder(item, scene)
    const stepDone = (id) =>
      finished ||
      (item.goal === 'power_on'
        ? !!scene.power?.[id]
        : item.goal === 'open_crate'
          ? scene.crates?.[id] === 'open'
          : Object.values(scene.placed ?? {}).includes(id))
    label = item.goal === 'place_part' ? 'Plan card: build in this order' : 'Do these in this order'
    body = order.map((id, i) => (
      <span
        key={id}
        className={`act-station-card__step${stepDone(id) ? ' is-done' : ''}${id === next ? ' is-next' : ''}`}
        data-testid={`card-step-${item.id}-${id}`}
      >
        <span className="act-station-card__num">{i + 1}</span>
        <span className="act-station-card__pic">
          {item.goal === 'power_on' ? (
            <PartImg id="power" state="on" />
          ) : (
            <PartImg id={id} state={item.goal === 'open_crate' ? 'closed' : undefined} />
          )}
          {item.goal === 'open_crate' && stickerOf(task, id) && (
            <Sticker
              sticker={stickerOf(task, id)}
              size={26}
              className="act-station-card__sticker"
            />
          )}
        </span>
        <span className="act-station-card__name">
          {item.goal === 'power_on'
            ? SECTIONS.find((sec) => sec.id === id)?.label
            : partById(id)?.label}
        </span>
      </span>
    ))
  } else if (item.goal === 'pick_colour' && item.match) {
    label = 'Match this colour'
    body = (
      <span className="act-station-card__step" data-testid={`card-colour-${item.id}`}>
        <span
          className="act-station-card__colour"
          style={{ background: COLOUR_HEX[item.match] }}
          aria-hidden="true"
        />
        <span className="act-station-card__name">{titleCase(item.match)}</span>
      </span>
    )
  } else if (item.goal === 'open_crate' && item.onlyNoted === true) {
    label = 'Delivery note: open only these'
    body = (Array.isArray(task.note) ? task.note : []).map((sticker) => (
      <span key={sticker} className="act-station-card__step" data-testid={`note-${sticker}`}>
        <Sticker sticker={sticker} size={56} />
        <span className="act-station-card__name">{stickerWords(sticker)}</span>
      </span>
    ))
  } else if (item.card) {
    label = 'Find this one'
    body = (
      <span className="act-station-card__step" data-testid={`card-part-${item.id}`}>
        <span className="act-station-card__pic is-big">
          <PartImg id={item.card} />
        </span>
      </span>
    )
  } else if (progress) {
    label = `Exactly ${progress.need}`
    body = (
      <span className="act-station-card__step" data-testid={`card-count-${item.id}`}>
        <span className="act-station-card__pic">
          {item.goal === 'undo' ? (
            <span className="act-station-card__glyph">↶</span>
          ) : (
            <PartImg
              id={item.goal === 'open_crate' ? 'crate-1' : item.target}
              state={item.goal === 'open_crate' ? 'closed' : undefined}
            />
          )}
        </span>
        <span className="act-station-card__times">×{progress.need}</span>
        <span className="act-station-card__name" data-testid={`count-${item.id}`}>
          {Math.min(progress.have, progress.need)} of {progress.need}
        </span>
      </span>
    )
  }
  if (!body) return null
  // The goal just finished while the next card waits: a short "sent" moment before switching off.
  const sent = state.hold?.goalId === item.id
  return (
    <div
      className={`act-station-card${sent ? ' is-sent' : ''}`}
      data-testid={`card-${item.id}`}
      data-blink={blink}
      role="group"
      aria-label={label}
    >
      <span className="act-station-card__label">{label}</span>
      <span className="act-station-card__row">{body}</span>
      {sent && (
        <span className="act-station-card__sent" role="status" data-testid={`sent-${item.id}`}>
          {item.goal === 'light_pattern' ? 'Signal sent ✓' : 'Done ✓'}
        </span>
      )}
    </div>
  )
}

export function StationStudentView({ task, state, onChange, readOnly = false, teacher = false }) {
  const live = state?.scene ? state : initialStationState(task)
  const scene = live.scene
  const result = gradeStationTask(task, live)
  const items = Array.isArray(task?.items) ? task.items : []
  const interactive = !readOnly && !!onChange
  // A finished power goal stays lit for a moment before the station switches off for the next card.
  const holdAt = live.hold?.at ?? null
  const holding = !!live.hold
  const showMethods = readOnly || teacher
  const worldId = worldIdOf(task)
  const isStation = worldId === 'station'
  const world = WORLDS[worldId]
  const worldArt = WORLD_ART[worldId] ?? null
  const lesson = lessonOf(task)
  const spotList = placeSpotsOf(worldId)
  const catalogue = lesson === 4 ? catalogueFor(task) : []
  const tray = trayParts(task, scene)
  const showTray = lesson === 3 || lesson === 4
  const crateIds = crateIdsFor(task).filter((id) => scene.crates?.[id])
  const selectedSticker = crateIds.includes(live.selected) ? stickerOf(task, live.selected) : null
  // The bay is only there while a crate is still waiting to be opened.
  const showBay = crateIds.some((id) => scene.crates[id] !== 'open')
  const showPads = showTray
  // Spots worth marking as empty pads: those a part from this lesson's list can go on.
  const padKinds = new Set(catalogueFor(task).map((id) => partById(id)?.kind))
  const mistakeSpots = mistakesOf(scene)
  const litCount = SECTIONS.filter((s) => scene.power?.[s.id]).length

  const sceneRef = useRef(null)
  const latest = useRef({})
  latest.current = { state: live }
  const keyRef = useRef(false)
  const dragRef = useRef(null)
  const suppressClick = useRef(false)
  const scrolled = useRef(false)
  // What the student is holding: { partId, from: spotId | null, mode: 'drag' | 'pick', x, y }.
  const [held, setHeld] = useState(null)
  // The model's hint for an attempt that did not count (cleared when a goal is done).
  const [hint, setHint] = useState(null)
  // The "Station upgraded!" moment: { spot } names the newest thing built, for the pop and sparkle.
  const [upgrade, setUpgrade] = useState(null)
  // A step a goal refused: { ids, n }. The things named in `ids` blink for a moment.
  const [blink, setBlink] = useState(null)
  const prevScene = useRef(live.scene)
  const newest = useRef(null)
  const wasDone = useRef(result.done)

  // Remember what was added last, and play the upgrade moment when the core goals complete.
  useEffect(() => {
    const before = prevScene.current
    prevScene.current = scene
    if (before !== scene) {
      const addedSpot = Object.keys(scene.placed ?? {}).find(
        (id) => before?.placed?.[id] !== scene.placed[id]
      )
      const crewId = CREW_IDS.find(
        (id) => scene.crew?.[id] && scene.crew[id] !== before?.crew?.[id]
      )
      if (addedSpot) newest.current = addedSpot
      else if (scene.captain && scene.captain !== before?.captain)
        newest.current = scene.crew?.[scene.captain] ?? null
      else if (crewId) newest.current = scene.crew[crewId]
      else newest.current = null
    }
    if (result.done && !wasDone.current) setUpgrade({ spot: newest.current })
    wasDone.current = result.done
  }, [scene, result.done])

  // End the hold after HOLD_MS; a hold found on first load (a reload) ends at once.
  const firstRun = useRef(true)
  useEffect(() => {
    const first = firstRun.current
    firstRun.current = false
    if (!interactive || holdAt == null) return undefined
    const wait = first ? 0 : Math.max(0, HOLD_MS - (Date.now() - holdAt))
    const timer = setTimeout(
      () => onChange((prev) => stationAction(prev, { type: 'release' }, task)),
      wait
    )
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdAt, interactive])

  useEffect(() => {
    if (!blink) return undefined
    const timer = setTimeout(() => setBlink(null), BLINK_MS)
    return () => clearTimeout(timer)
  }, [blink])

  useEffect(() => {
    if (!upgrade) return undefined
    const timer = setTimeout(() => setUpgrade(null), UPGRADE_MS)
    return () => clearTimeout(timer)
  }, [upgrade])

  // A part picked up by click follows the pointer until it is dropped, put back or Escape.
  useEffect(() => {
    if (held?.mode !== 'pick') return undefined
    const move = (e) => setHeld((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : h))
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [held?.mode])

  // Alternating 0 / 1 lets a repeated wrong step restart the blink animation.
  const blinkOf = (id) => (blink?.ids.includes(id) ? blink.n % 2 : undefined)

  // A step the goals refuse changes nothing: the card and the thing pressed blink, with a hint.
  function refuse(blocker, action) {
    const thing =
      action.type === 'power'
        ? `section-${action.section}`
        : action.type === 'open'
          ? `crate-${action.crate}`
          : action.from
            ? `part-${action.part}`
            : `tray-${action.part}`
    setBlink((b) => ({ ids: [`card-${blocker.id}`, thing], n: (b?.n ?? 0) + 1 }))
    setHint(
      blocker.onlyNoted === true && action.type === 'open'
        ? "That crate isn't on the note, so it stays shut. Try another."
        : gradeStationItem(task, blocker, latest.current.state).hint
    )
  }

  function act(action) {
    if (!interactive) return
    const cur = latest.current.state
    const blocker = blockedBy(task, cur, action)
    if (blocker) {
      refuse(blocker, action)
      return
    }
    const next = stationAction(cur, action, task)
    if (action.type !== 'select' || action.id) {
      if (doneCount(next) > doneCount(cur)) setHint(null)
      else {
        const item = items.find(
          (it) =>
            !next.done?.[it.id] &&
            (GOAL_ACTION[it.goal] === action.type || (action.type === 'send' && isFreePattern(it)))
        )
        setHint(item ? gradeStationItem(task, item, next).hint : null)
      }
    }
    onChange((prev) => stationAction(prev, action, task))
  }

  // Enter / Space on a focused control counts as the keyboard method.
  const pressMethod = () => {
    const m = keyRef.current ? 'keyboard' : 'click'
    keyRef.current = false
    return m
  }

  function onRootKeyDown(e) {
    if (!interactive) return
    if (e.key === 'Escape' && held) {
      dragRef.current = null
      setHeld(null)
      return
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.altKey) {
      e.preventDefault()
      act({ type: 'undo', method: e.metaKey && !e.ctrlKey ? 'cmd_z' : 'ctrl_z' })
      return
    }
    if (!e.defaultPrevented && (e.key === 'Enter' || e.key === ' ')) keyRef.current = true
  }

  function onRootClick(e) {
    if (!interactive || suppressClick.current) return
    const t = e.target
    if (held) {
      if (!t.closest?.('[data-spot-target]') && !t.closest?.('[data-tray-part]')) {
        // A part picked up by click and put down in the wrong enclosure blinks like a wrong drag.
        const wrong = dropAt(e.clientX, e.clientY, held.partId)?.wrong
        if (wrong && held.mode === 'pick') wrongHome(wrong, held.partId, held.from)
        setHeld(null)
      }
      return
    }
    if (live.selected && !t.closest?.('button, [data-keep-selection]')) {
      act({ type: 'select', id: null, method: 'click' })
    }
  }

  // Where a point on the screen would drop a part: { spot }, { wrong: kind } or null.
  function dropAt(clientX, clientY, partId) {
    const rect = sceneRef.current?.getBoundingClientRect?.()
    if (!rect || !rect.width || !rect.height) return null
    return dropTarget(
      task,
      scene,
      { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height },
      partId
    )
  }

  // An animal dropped in an enclosure that is not its own: the enclosure blinks, the animal goes
  // back where it came from, and nothing is saved except a count the tutor can see.
  function wrongHome(kind, partId, from) {
    setBlink((b) => ({
      ids: [`enclosure-${kind}`, from ? `part-${partId}` : `tray-${partId}`],
      n: (b?.n ?? 0) + 1,
    }))
    setHint(
      `The ${partById(partId)?.label?.toLowerCase()} doesn't live there. Pick it up again and watch for the glow.`
    )
    if (interactive) onChange((prev) => stationAction(prev, { type: 'wrong', part: partId }, task))
  }

  // Pointer handlers for a part that can be dragged (a tray part or a placed one).
  function dragHandlers(partId, from) {
    return {
      onPointerDown: (e) => {
        if (!interactive || e.button > 0) return
        keyRef.current = false
        dragRef.current = {
          partId,
          from,
          x0: e.clientX,
          y0: e.clientY,
          id: e.pointerId,
          active: false,
        }
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId)
        } catch {
          // Capture is a nicety (jsdom, odd browsers); the drag still works without it.
        }
      },
      onPointerMove: (e) => {
        const d = dragRef.current
        if (!d || d.id !== e.pointerId) return
        if (!d.active) {
          if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < DRAG_START_PX) return
          d.active = true
          setHeld({ partId, from, mode: 'drag', x: e.clientX, y: e.clientY })
        } else {
          setHeld((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : h))
        }
      },
      onPointerUp: (e) => {
        const d = dragRef.current
        dragRef.current = null
        try {
          e.currentTarget.releasePointerCapture?.(e.pointerId)
        } catch {
          // Already released.
        }
        // A press with no movement is a click: the click handler picks up or selects.
        if (!d || !d.active) return
        // The browser still sends a click after the drag; it must not pick up or clear.
        suppressClick.current = true
        setTimeout(() => {
          suppressClick.current = false
        }, 0)
        setHeld(null)
        const target = dropAt(e.clientX, e.clientY, partId)
        if (target?.spot) {
          act({
            type: 'place',
            part: partId,
            spot: target.spot,
            method: 'drag',
            from: from ?? undefined,
          })
        } else if (target?.wrong) wrongHome(target.wrong, partId, from)
      },
      onPointerCancel: () => {
        dragRef.current = null
        setHeld(null)
      },
    }
  }

  function onTrayPartClick(partId, e) {
    if (!interactive || suppressClick.current) return
    if (held?.partId === partId && held.mode === 'pick') setHeld(null)
    else
      setHeld({
        partId,
        from: null,
        mode: 'pick',
        x: e?.clientX ? e.clientX : null,
        y: e?.clientY ? e.clientY : null,
      })
  }

  function onSpotClick(spotId) {
    if (!interactive || suppressClick.current || !held) return
    if (held.mode === 'pick') {
      act({ type: 'place', part: held.partId, spot: spotId, method: 'pick_drop' })
      setHeld(null)
    }
  }

  function onCrateKeyDown(e, crateId) {
    if (!interactive || e.key !== 'Enter' || live.selected !== crateId) return
    e.preventDefault()
    keyRef.current = false
    if (scene.crates[crateId] === 'closed')
      act({ type: 'open', crate: crateId, method: 'keyboard' })
  }

  // The nearest empty spot to the dragged part, lit while the student drags.
  const nearest =
    held?.mode === 'drag' && held.x != null ? dropAt(held.x, held.y, held.partId)?.spot : null

  const lightsHex = COLOUR_HEX[scene.lights] ?? COLOUR_HEX.orange
  const hullHex = COLOUR_HEX[scene.hull] ?? COLOUR_HEX.blue
  const core = result.core

  return (
    <div
      className="act-station"
      data-testid="station-activity"
      tabIndex={-1}
      onKeyDown={onRootKeyDown}
      onClick={onRootClick}
      onPointerDown={() => {
        keyRef.current = false
      }}
    >
      <div className="act-station__main">
        {task?.title && <h2 className="act-title">{task.title}</h2>}
        {(task?.explainer ?? task?.description) && (
          <div className="act-station__intro">
            <MarkdownRenderer
              content={task.explainer ?? task.description}
              topicType={null}
              disableCopy
              showLibrary={false}
            />
          </div>
        )}

        <div className="act-station__scene-wrap">
          <div
            ref={sceneRef}
            className={`act-station__scene${held ? ' is-holding' : ''}${upgrade ? ' is-upgraded' : ''}`}
            data-testid="station-scene"
            data-world={worldId}
            data-upgraded={upgrade ? 'true' : 'false'}
            role="group"
            aria-label={
              isStation
                ? 'Your space station'
                : worldId === 'zoo'
                  ? 'Your zoo'
                  : 'The toy shop window'
            }
            style={{
              '--act-station-hull': hullHex,
              '--act-station-lights': lightsHex,
              '--act-station-lit': litCount / SECTIONS.length,
            }}
          >
            {isStation && (
              <>
                <img
                  className="act-station-layer"
                  src={SCENE_ART.backdrop}
                  alt=""
                  aria-hidden="true"
                />
                <img
                  className="act-station-layer"
                  src={SCENE_ART.interior.dark}
                  alt=""
                  aria-hidden="true"
                />
                <img
                  className="act-station-layer act-station-layer--lit"
                  src={SCENE_ART.interior.lit}
                  alt=""
                  aria-hidden="true"
                />

                {/* Crew show through the portholes: they sit behind the hull. */}
                {CREW_IDS.filter((id) => scene.crew?.[id]).map((id) => {
                  const post = spotById(scene.crew[id])
                  if (!post) return null
                  const captain = scene.captain === id
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`act-station-crew${captain ? ' is-captain' : ''}${upgrade?.spot === post.id ? ' is-newest' : ''}`}
                      style={spotBox(post)}
                      data-testid={`crew-${id}`}
                      aria-label={
                        captain
                          ? `${partById(id)?.label}, the captain`
                          : `Make ${partById(id)?.label} the captain`
                      }
                      aria-pressed={captain}
                      disabled={!interactive}
                      onClick={() => {
                        if (!captain) act({ type: 'captain', crew: id, method: 'click' })
                      }}
                    >
                      {upgrade?.spot === post.id && <GlowImg id={id} />}
                      <PartImg id={id} />
                      {upgrade?.spot === post.id && <Sparks />}
                    </button>
                  )
                })}

                <img
                  className="act-station-layer"
                  src={SCENE_ART.hull.dark}
                  alt=""
                  aria-hidden="true"
                />
                <img
                  className="act-station-layer act-station-layer--lit act-station-layer--hull"
                  src={SCENE_ART.hull.lit}
                  alt=""
                  aria-hidden="true"
                />
                <span
                  className="act-station-layer act-station-hull-tint"
                  style={maskStyle(SCENE_ART.hullGlow)}
                  aria-hidden="true"
                />
                {upgrade && (
                  <span
                    className="act-station-layer act-station-sweep"
                    data-testid="station-upgrade-fx"
                    style={maskStyle(SCENE_ART.hull.lit)}
                    aria-hidden="true"
                  />
                )}

                {SECTIONS.map((s) => {
                  const lit = !!scene.power?.[s.id]
                  const spot = spotById(s.spot)
                  return (
                    <div
                      key={s.id}
                      className={`act-station-section${lit ? ' is-lit' : ''}`}
                      style={spotBox(spot)}
                      data-testid={`section-${s.id}`}
                      data-lit={lit ? 'true' : 'false'}
                      data-blink={blinkOf(`section-${s.id}`)}
                    >
                      {lit && <GlowImg id="power" state="on" className="act-station-power-halo" />}
                      <button
                        type="button"
                        className="act-station-power"
                        aria-pressed={lit}
                        aria-label={`${s.label} power`}
                        disabled={!interactive || holding}
                        onClick={() => {
                          const method = pressMethod()
                          if (!lit) act({ type: 'power', section: s.id, method })
                          else if (lesson === 1)
                            act({ type: 'power', section: s.id, on: false, method })
                        }}
                      >
                        <PartImg id="power" state={lit ? 'on' : 'off'} />
                      </button>
                      <span className="act-station-power__name" aria-hidden="true">
                        {s.label}
                        <span className="act-station-power__state">{lit ? 'On' : 'Off'}</span>
                      </span>
                    </div>
                  )
                })}
              </>
            )}
            {worldArt && (
              <>
                <img
                  className="act-station-layer"
                  src={worldArt.backdrop}
                  alt=""
                  aria-hidden="true"
                />
                {worldArt.base && (
                  <img
                    className="act-station-layer"
                    src={worldArt.base}
                    alt=""
                    aria-hidden="true"
                  />
                )}
                {/* While an animal is held, its own enclosure glows; a wrong drop blinks the one it hit. */}
                {world.enclosures.map((e) => {
                  const home = !!held && partById(held.partId)?.kind === e.kind
                  const blinking = blinkOf(`enclosure-${e.kind}`)
                  if (!home && blinking === undefined) return null
                  return (
                    <span
                      key={e.kind}
                      className={`act-station-layer act-station-enclosure${home ? ' is-home' : ''}`}
                      style={maskStyle(worldArt.enclosureGlow(e.kind))}
                      data-testid={`enclosure-${e.kind}`}
                      data-blink={blinking}
                      aria-hidden="true"
                    />
                  )
                })}
              </>
            )}

            {/* Placed parts, and empty spots (dashed) while a part is being moved. */}
            {spotList.map((spot) => {
              const partId = scene.placed?.[spot.id]
              if (partId) {
                const part = partById(partId)
                const moving = held?.mode === 'drag' && held.partId === partId
                const isNewest = upgrade?.spot === spot.id
                return (
                  <button
                    key={spot.id}
                    type="button"
                    className={`act-station-part${live.selected === partId ? ' is-selected' : ''}${mistakeSpots.includes(spot.id) ? ' is-mistake' : ''}${moving ? ' is-moving' : ''}${isNewest ? ' is-newest' : ''}`}
                    style={placement(spot, part)}
                    data-testid={`part-${partId}`}
                    data-part={partId}
                    data-spot={spot.id}
                    data-blink={blinkOf(`part-${partId}`)}
                    aria-pressed={live.selected === partId}
                    aria-label={`${part?.label ?? partId}, ${mistakeSpots.includes(spot.id) ? 'dropped by the clumsy robot' : 'on the station'}`}
                    disabled={!interactive}
                    onClick={() => {
                      if (suppressClick.current) return
                      act({ type: 'select', id: partId, method: 'click' })
                    }}
                    {...dragHandlers(partId, spot.id)}
                  >
                    {(live.selected === partId || isNewest) && (
                      <GlowImg id={partId} flipY={!!spot.flipY} flipX={!!spot.flipX} />
                    )}
                    <PartImg id={partId} flipX={!!spot.flipX} flipY={!!spot.flipY} />
                    {isNewest && <Sparks />}
                  </button>
                )
              }
              if (!held) {
                if (!showPads || !spot.accepts.some((k) => padKinds.has(k))) return null
                return (
                  <span
                    key={spot.id}
                    className="act-station-pad"
                    style={spotBox(spot)}
                    data-testid={`pad-${spot.id}`}
                    aria-hidden="true"
                  />
                )
              }
              if (!spotTakes(spot, partById(held.partId))) return null
              return (
                <button
                  key={spot.id}
                  type="button"
                  className={`act-station-spot${nearest === spot.id ? ' is-near' : ''}`}
                  style={spotBox(spot)}
                  data-testid={`spot-${spot.id}`}
                  data-spot-target={spot.id}
                  aria-label={`Empty spot, ${spot.id.replace(/-/g, ' ')}`}
                  onClick={() => onSpotClick(spot.id)}
                />
              )
            })}

            {/* The captain badge sits in front of the hull, on the porthole. */}
            {CREW_IDS.filter((id) => scene.captain === id && scene.crew?.[id]).map((id) => {
              const post = spotById(scene.crew[id])
              if (!post) return null
              return (
                <span
                  key={id}
                  className="act-station-captain"
                  style={spotBox(post)}
                  data-testid="captain-badge"
                  title="Captain"
                >
                  <PartImg id="captain-badge" />
                </span>
              )
            })}
          </div>
        </div>

        {showTray && (
          <div className="act-station__tray" data-testid="station-tray">
            <span className="act-station__bay-title">
              {worldId === 'zoo' ? 'Animals' : worldId === 'toyshop' ? 'Toys' : 'Parts tray'}
            </span>
            {tray.length === 0 && (
              <span className="act-station__empty">
                {lesson === 4
                  ? `Order ${worldId === 'toyshop' ? 'a toy' : 'a part'} and it will appear here.`
                  : worldId === 'zoo'
                    ? 'Every animal is in the zoo.'
                    : 'All parts are in place.'}
              </span>
            )}
            {tray.map((id) => (
              <button
                key={id}
                type="button"
                className={`act-station-tray-part${held?.partId === id ? ' is-held' : ''}`}
                data-testid={`tray-${id}`}
                data-tray-part={id}
                data-blink={blinkOf(`tray-${id}`)}
                aria-label={`${partById(id)?.label}. Drag onto the station, or click to pick up.`}
                aria-pressed={held?.partId === id && held.mode === 'pick'}
                disabled={!interactive}
                onClick={(e) => onTrayPartClick(id, e)}
                {...dragHandlers(id, null)}
              >
                <PartImg id={id} />
                <span className="act-station-crate__label">{partById(id)?.label}</span>
              </button>
            ))}
          </div>
        )}

        {lesson === 1 && (
          <div className="act-station__colours">
            {[
              ['hull', 'Hull colour', HULL_COLOURS],
              ['lights', 'Light colour', LIGHT_COLOURS],
            ].map(([target, label, list]) => (
              <div key={target} className="act-station-swatches" role="group" aria-label={label}>
                <span className="act-station-swatches__label">{label}</span>
                {list.map((colour) => {
                  const on = scene[target] === colour
                  return (
                    <button
                      key={colour}
                      type="button"
                      className={`act-station-swatch${on ? ' is-on' : ''}`}
                      style={{ '--act-swatch': COLOUR_HEX[colour] }}
                      aria-label={`${label} ${colour}`}
                      aria-pressed={on}
                      disabled={!interactive}
                      onClick={() => {
                        const method = pressMethod()
                        if (!on) act({ type: 'colour', target, colour, method })
                      }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {showBay && (
          <div className="act-station__bay" data-testid="station-bay">
            <span className="act-station__bay-title">Delivery bay</span>
            {crateIds.map((id) => {
              const open = scene.crates[id] === 'open'
              const part = partById(id)
              return (
                <button
                  key={id}
                  type="button"
                  className={`act-station-crate${open ? ' is-open' : ''}${live.selected === id ? ' is-selected' : ''}`}
                  data-testid={`crate-${id}`}
                  data-blink={blinkOf(`crate-${id}`)}
                  aria-pressed={live.selected === id}
                  aria-label={`${part?.label}, ${open ? 'open' : 'closed'}${stickerOf(task, id) ? `, sticker ${stickerWords(stickerOf(task, id))}` : ''}`}
                  disabled={!interactive}
                  onClick={() => {
                    if (suppressClick.current) return
                    act({ type: 'select', id, method: 'click' })
                  }}
                  onDoubleClick={() => {
                    if (open) return
                    act({ type: 'open', crate: id, method: 'double_click' })
                  }}
                  onKeyDown={(e) => onCrateKeyDown(e, id)}
                >
                  <span className="act-station-crate__pic">
                    <PartImg id={id} state={open ? 'open' : 'closed'} />
                    {stickerOf(task, id) && (
                      <Sticker
                        sticker={stickerOf(task, id)}
                        size={26}
                        className="act-station-crate__sticker"
                      />
                    )}
                  </span>
                  <span className="act-station-crate__label">{part?.label}</span>
                </button>
              )
            })}
            {selectedSticker && (
              <span className="act-station-reader" data-testid="sticker-reader" role="status">
                <Sticker sticker={selectedSticker} size={72} />
                <span>
                  {partById(live.selected)?.label} has a {stickerWords(selectedSticker)}
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      <aside className="act-station__side">
        <h3 className="act-station__heading">This week</h3>
        <RoundProgress
          done={result.counted}
          total={result.total}
          core={core}
          flags={result.flags}
        />
        <ol className="act-station__goals" data-testid="station-goals">
          {items.map((item, i) => {
            const r = result.itemResults[item.id]
            return (
              <li
                key={item.id}
                className={`act-station-goal${r?.correct ? ' is-done' : ''}`}
                data-testid={`goal-${item.id}`}
              >
                <span className="act-station-goal__tick" aria-hidden="true">
                  {r?.correct ? '✓' : ''}
                </span>
                <GoalIcon item={item} task={task} />
                <span className="act-station-goal__text">
                  {promptFor(item, lesson, worldId)}
                  {i >= core && <span className="act-station-goal__bonus"> ⭐ Bonus</span>}
                  {r?.correct && showMethods && r.method && (
                    <span className="act-station-goal__method" data-testid={`method-${item.id}`}>
                      {' '}
                      ({methodWords(r.method)})
                    </span>
                  )}
                  <span className="act-station-sr">{r?.correct ? ' (done)' : ' (to do)'}</span>
                </span>
                <GoalCard
                  item={item}
                  task={task}
                  state={live}
                  blink={blinkOf(`card-${item.id}`)}
                  onSend={
                    interactive && !holding
                      ? () => act({ type: 'send', method: pressMethod() })
                      : undefined
                  }
                />
              </li>
            )
          })}
        </ol>

        {interactive && hint && !result.done && (
          <p className="act-hint" role="status" data-testid="station-hint">
            {hint}
          </p>
        )}
        {result.done && (
          <ActivityCorrect>
            {worldId === 'zoo'
              ? 'Zoo sorted!'
              : worldId === 'toyshop'
                ? 'Toy shop stocked!'
                : 'Station upgraded!'}
          </ActivityCorrect>
        )}
        {result.done && interactive && !teacher && (
          <p className="act-station__keep">You can keep building if you like.</p>
        )}

        {teacher && interactive && (
          <button
            type="button"
            className="btn-ghost-outline act-btn"
            data-testid="station-tutor-undo"
            disabled={!(live.undo ?? []).length}
            onClick={() =>
              onChange((prev) => stationAction(prev, { type: 'undo', method: 'tutor' }, task))
            }
          >
            Undo last change
          </button>
        )}

        {catalogue.length > 0 && (
          <div className="act-station__catalogue-wrap">
            <h3 className="act-station__heading">
              {worldId === 'toyshop' ? 'Toy catalogue' : 'Parts catalogue'}
            </h3>
            <ul
              className="act-station__catalogue"
              data-testid="station-catalogue"
              aria-label={`${worldId === 'toyshop' ? 'Toy' : 'Parts'} catalogue. Scroll to see every ${worldId === 'toyshop' ? 'toy' : 'part'}.`}
              tabIndex={0}
              onScroll={() => {
                scrolled.current = true
              }}
            >
              {catalogue.map((id) => {
                const ordered =
                  (scene.ordered ?? []).includes(id) ||
                  Object.values(scene.placed ?? {}).includes(id)
                return (
                  <li key={id} className="act-station-cat-row" data-testid={`cat-${id}`}>
                    <PartImg id={id} />
                    <span className="act-station-cat-row__name">{partById(id)?.label}</span>
                    <button
                      type="button"
                      className="btn-primary act-btn"
                      data-testid={`order-${id}`}
                      aria-label={`Order ${partById(id)?.label}`}
                      disabled={!interactive || ordered}
                      onClick={() =>
                        act({
                          type: 'order',
                          part: id,
                          scrolled: scrolled.current,
                          method: 'click',
                        })
                      }
                    >
                      {ordered ? 'Ordered' : 'Order'}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </aside>

      {held && held.x != null && (
        <span
          className="act-station-ghost"
          data-testid="station-ghost"
          style={{ left: held.x, top: held.y }}
          aria-hidden="true"
        >
          <PartImg id={held.partId} />
        </span>
      )}
    </div>
  )
}

export { StationCardSummary }

export default {
  StudentView: StationStudentView,
  BuilderEditor: StationBuilderEditor,
  BuilderIcon: () => <span aria-hidden="true">🚀</span>,
  builderHint: 'Build a space station',
  CardSummary: StationCardSummary,
  ownsLayout: true,
}
