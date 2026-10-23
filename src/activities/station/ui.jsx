import StationBuilderEditor from './StationBuilderEditor.jsx'
import { useEffect, useRef, useState } from 'react'
import { MarkdownRenderer } from '../../shared/markdown'
import ActivityCorrect from '../ui/ActivityCorrect.jsx'
import RoundProgress from '../ui/RoundProgress.jsx'
import { COLOUR_HEX, SCENE_ART, SCENE_PX, artFor } from './art.js'
import StationCardSummary from './MiniStation.jsx'
import {
  CREW_IDS,
  CRATE_IDS,
  HULL_COLOURS,
  LIGHT_COLOURS,
  PLACE_SPOTS,
  SECTIONS,
  spotById,
  catalogueFor,
  gradeStationItem,
  gradeStationTask,
  initialStationState,
  methodWords,
  nearestSpot,
  partById,
  promptFor,
  spotTakes,
  stationAction,
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
  order_part: 'order',
}

const pct = (n) => `${(n * 100).toFixed(3)}%`
const doneCount = (state) => Object.keys(state?.done ?? {}).length
// The picture's own size for a part: a cell is 0.08 of the scene's width and 0.128 of its height.
const CELL_W = SCENE_PX.cell / SCENE_PX.w
const CELL_H = SCENE_PX.cell / SCENE_PX.h
// How long the "Station upgraded!" moment plays on the scene.
const UPGRADE_MS = 3200

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

// The little picture beside a goal line: the part, crate or badge it is about.
function goalIcon(item, task) {
  const catalogue = catalogueFor(task)
  const anyPart = task?.lesson === 2 ? 'crate-1' : (catalogue[0] ?? 'crate-1')
  switch (item?.goal) {
    case 'power_on':
      return { id: 'power', state: 'on' }
    case 'open_crate':
      return { id: item.target || 'crate-1', state: 'open' }
    case 'choose_captain':
      return { id: 'captain-badge' }
    case 'select':
    case 'place_part':
    case 'order_part':
      return { id: item.target || anyPart, state: 'closed' }
    case 'pick_colour':
      return { swatch: true }
    default:
      return { glyph: '↶' }
  }
}

function GoalIcon({ item, task }) {
  const icon = goalIcon(item, task)
  if (icon.swatch) return <span className="act-station-goal__icon is-swatch" aria-hidden="true" />
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

export function StationStudentView({ task, state, onChange, readOnly = false, teacher = false }) {
  const live = state?.scene ? state : initialStationState(task)
  const scene = live.scene
  const result = gradeStationTask(task, live)
  const items = Array.isArray(task?.items) ? task.items : []
  const interactive = !readOnly && !!onChange
  const showMethods = readOnly || teacher
  const lesson = task?.lesson
  const catalogue = lesson === 4 ? catalogueFor(task) : []
  const tray = trayParts(task, scene)
  const showTray = lesson === 3 || lesson === 4
  const crateIds = CRATE_IDS.filter((id) => scene.crates?.[id])
  // The bay is only there while a crate is still waiting to be opened.
  const showBay = crateIds.some((id) => scene.crates[id] !== 'open')
  const showPads = showTray
  // Spots worth marking as empty pads: those a part from this lesson's list can go on.
  const padKinds = new Set(catalogueFor(task).map((id) => partById(id)?.kind))
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

  function act(action) {
    if (!interactive) return
    const cur = latest.current.state
    const next = stationAction(cur, action, task)
    if (action.type !== 'select' || action.id) {
      if (doneCount(next) > doneCount(cur)) setHint(null)
      else {
        const item = items.find((it) => !next.done?.[it.id] && GOAL_ACTION[it.goal] === action.type)
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
      if (!t.closest?.('[data-spot-target]') && !t.closest?.('[data-tray-part]')) setHeld(null)
      return
    }
    if (live.selected && !t.closest?.('button, [data-keep-selection]')) {
      act({ type: 'select', id: null, method: 'click' })
    }
  }

  function dropSpotAt(clientX, clientY, partId) {
    const rect = sceneRef.current?.getBoundingClientRect?.()
    if (!rect || !rect.width || !rect.height) return null
    return nearestSpot(
      scene,
      { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height },
      partId
    )
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
        const spot = dropSpotAt(e.clientX, e.clientY, partId)
        if (spot) act({ type: 'place', part: partId, spot, method: 'drag' })
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
    held?.mode === 'drag' && held.x != null ? dropSpotAt(held.x, held.y, held.partId) : null

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
            data-upgraded={upgrade ? 'true' : 'false'}
            role="group"
            aria-label="Your space station"
            style={{
              '--act-station-hull': hullHex,
              '--act-station-lights': lightsHex,
              '--act-station-lit': litCount / SECTIONS.length,
            }}
          >
            <img className="act-station-layer" src={SCENE_ART.backdrop} alt="" aria-hidden="true" />
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
                >
                  {lit && <GlowImg id="power" state="on" className="act-station-power-halo" />}
                  <button
                    type="button"
                    className="act-station-power"
                    aria-pressed={lit}
                    aria-label={`${s.label} power`}
                    disabled={!interactive}
                    onClick={() => {
                      const method = pressMethod()
                      if (!lit) act({ type: 'power', section: s.id, method })
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

            {/* Placed parts, and empty spots (dashed) while a part is being moved. */}
            {PLACE_SPOTS.map((spot) => {
              const partId = scene.placed?.[spot.id]
              if (partId) {
                const part = partById(partId)
                const moving = held?.mode === 'drag' && held.partId === partId
                const isNewest = upgrade?.spot === spot.id
                return (
                  <button
                    key={spot.id}
                    type="button"
                    className={`act-station-part${live.selected === partId ? ' is-selected' : ''}${moving ? ' is-moving' : ''}${isNewest ? ' is-newest' : ''}`}
                    style={placement(spot, part)}
                    data-testid={`part-${partId}`}
                    data-part={partId}
                    data-spot={spot.id}
                    aria-pressed={live.selected === partId}
                    aria-label={`${part?.label ?? partId}, on the station`}
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
                  aria-pressed={live.selected === id}
                  aria-label={`${part?.label}, ${open ? 'open' : 'closed'}`}
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
                  <PartImg id={id} state={open ? 'open' : 'closed'} />
                  <span className="act-station-crate__label">{part?.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <aside className="act-station__side">
        <h3 className="act-station__heading">This week</h3>
        <RoundProgress done={result.correct} total={result.total} core={core} />
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
                <span>
                  {promptFor(item, lesson)}
                  {i >= core && <span className="act-station-goal__bonus"> ⭐ Bonus</span>}
                  {r?.correct && showMethods && r.method && (
                    <span className="act-station-goal__method" data-testid={`method-${item.id}`}>
                      {' '}
                      ({methodWords(r.method)})
                    </span>
                  )}
                  <span className="act-station-sr">{r?.correct ? ' (done)' : ' (to do)'}</span>
                </span>
              </li>
            )
          })}
        </ol>

        {interactive && hint && !result.done && (
          <p className="act-hint" role="status" data-testid="station-hint">
            {hint}
          </p>
        )}
        {result.done && <ActivityCorrect>Station upgraded!</ActivityCorrect>}
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
            <h3 className="act-station__heading">Parts catalogue</h3>
            <ul
              className="act-station__catalogue"
              data-testid="station-catalogue"
              aria-label="Parts catalogue. Scroll to see every part."
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
        {showTray && (
          <div className="act-station__tray" data-testid="station-tray">
            <span className="act-station__bay-title">Parts tray</span>
            {tray.length === 0 && (
              <span className="act-station__empty">
                {lesson === 4 ? 'Order a part and it will appear here.' : 'All parts are in place.'}
              </span>
            )}
            {tray.map((id) => (
              <button
                key={id}
                type="button"
                className={`act-station-tray-part${held?.partId === id ? ' is-held' : ''}`}
                data-testid={`tray-${id}`}
                data-tray-part={id}
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
