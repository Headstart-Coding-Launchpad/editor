import { useEffect, useRef, useState } from 'react'
import { MarkdownRenderer } from '../../shared/markdown'
import ActivityCorrect from '../ui/ActivityCorrect.jsx'
import RoundProgress from '../ui/RoundProgress.jsx'
import { COLOUR_HEX, artFor } from './art.js'
import StationCardSummary from './MiniStation.jsx'
import {
  CREW_IDS,
  CRATE_IDS,
  HULL_COLOURS,
  LIGHT_COLOURS,
  POSTS,
  SECTIONS,
  SPOTS,
  catalogueFor,
  gradeStationItem,
  gradeStationTask,
  initialStationState,
  methodWords,
  nearestSpot,
  partById,
  promptFor,
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

const centre = (spot) => ({ x: spot.x + spot.w / 2, y: spot.y + spot.h / 2 })
const pct = (n) => `${(n * 100).toFixed(3)}%`
const doneCount = (state) => Object.keys(state?.done ?? {}).length

function PartArt({ id }) {
  const art = artFor(id)
  return (
    <span
      className={`act-station-art act-station-art--${art.shape}`}
      style={{ '--act-station-art': art.colour }}
      aria-hidden="true"
    >
      {art.emoji}
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

  function dropSpotAt(clientX, clientY, kind = 'module') {
    const rect = sceneRef.current?.getBoundingClientRect?.()
    if (!rect || !rect.width || !rect.height) return null
    return nearestSpot(
      scene,
      { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height },
      kind
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
        const spot = dropSpotAt(e.clientX, e.clientY)
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
    held?.mode === 'drag' && held.x != null
      ? dropSpotAt(held.x, held.y, partById(held.partId)?.kind)
      : null

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

        <div
          ref={sceneRef}
          className={`act-station__scene${held ? ' is-holding' : ''}`}
          data-testid="station-scene"
          role="group"
          aria-label="Your space station"
          style={{ '--act-station-hull': hullHex, '--act-station-lights': lightsHex }}
        >
          <div className="act-station__hull" aria-hidden="true" />
          {SECTIONS.map((s) => {
            const lit = !!scene.power?.[s.id]
            return (
              <div
                key={s.id}
                className={`act-station-section act-station-section--${s.id}${lit ? ' is-lit' : ''}`}
                data-testid={`section-${s.id}`}
                data-lit={lit ? 'true' : 'false'}
              >
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
                  <span aria-hidden="true">⏻</span> {s.label}
                  <span className="act-station-power__state">{lit ? 'On' : 'Off'}</span>
                </button>
              </div>
            )
          })}

          {POSTS.map((p) => (
            <span
              key={p.id}
              className="act-station-post"
              aria-hidden="true"
              style={{ left: pct(p.x), top: pct(p.y) }}
            />
          ))}

          {/* Placed parts, and empty spots (dashed) while a part is being moved. */}
          {SPOTS.map((spot) => {
            const partId = scene.placed?.[spot.id]
            const c = centre(spot)
            const style = { left: pct(c.x), top: pct(c.y), width: `max(${pct(spot.w)}, 44px)` }
            if (partId) {
              const part = partById(partId)
              const moving = held?.mode === 'drag' && held.partId === partId
              return (
                <button
                  key={spot.id}
                  type="button"
                  className={`act-station-part${live.selected === partId ? ' is-selected' : ''}${moving ? ' is-moving' : ''}`}
                  style={style}
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
                  <PartArt id={partId} />
                </button>
              )
            }
            if (!held) return null
            return (
              <button
                key={spot.id}
                type="button"
                className={`act-station-spot${nearest === spot.id ? ' is-near' : ''}`}
                style={style}
                data-testid={`spot-${spot.id}`}
                data-spot-target={spot.id}
                aria-label={`Empty spot ${spot.id.replace('spot-', '')}`}
                onClick={() => onSpotClick(spot.id)}
              />
            )
          })}

          {/* Crew at their posts, walking in from the dock once a crate is opened. */}
          {CREW_IDS.filter((id) => scene.crew?.[id]).map((id) => {
            const post = POSTS.find((p) => p.id === scene.crew[id])
            if (!post) return null
            const captain = scene.captain === id
            return (
              <button
                key={id}
                type="button"
                className={`act-station-crew${captain ? ' is-captain' : ''}`}
                style={{ left: pct(post.x), top: pct(post.y) }}
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
                <PartArt id={id} />
                {captain && (
                  <span className="act-station-captain" data-testid="captain-badge" title="Captain">
                    👑
                  </span>
                )}
              </button>
            )
          })}
        </div>

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

        {crateIds.length > 0 && (
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
                  <span aria-hidden="true">{open ? '📭' : '📦'}</span>
                  <span className="act-station-crate__label">{part?.label}</span>
                </button>
              )
            })}
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
                <PartArt id={id} />
                <span className="act-station-crate__label">{partById(id)?.label}</span>
              </button>
            ))}
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
                <span>
                  {promptFor(item)}
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
                    <PartArt id={id} />
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
          <PartArt id={held.partId} />
        </span>
      )}
    </div>
  )
}

export { StationCardSummary }

export default {
  StudentView: StationStudentView,
  CardSummary: StationCardSummary,
  ownsLayout: true,
}
