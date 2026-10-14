// The HTML Inspector's layer over the preview iframe (see ./HtmlInspector.jsx): the SVG box bands
// and flex/grid guides, the pointer catcher for inspect mode, and the side panel (a bottom sheet
// on narrow previews) with the Box, "Why this …?" and Layout sections.
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { prefersReducedMotion } from '../../../shared/motion'
import { fileNameForPreviewUrl } from './previewFileNames'
import { INSPECTOR_PROPERTIES, getInspectorProperty } from './config'
import {
  BOX_COLOURS,
  computeBoxBands,
  computeBoxes,
  formatPx,
  formatSides,
  readBoxSizes,
} from './boxModel'
import { describeElement, entryValueText, explainProperty, formatSpecificity } from './cascade'
import { readLayout } from './layout'
import { isInspectable } from './selectorPath'

const NARROW_PX = 520
const SECTION_LABELS = { box: 'Box', cascade: 'Why this…?', layout: 'Layout' }
const LAYER_LABELS = { margin: 'margin', border: 'border', padding: 'padding', content: 'content' }
const COLOUR_PROPERTIES = new Set(['color', 'background-color'])

function toRect(r) {
  return { x: r.left, y: r.top, width: r.width, height: r.height }
}

function computedStyleOf(el) {
  try {
    return el?.ownerDocument?.defaultView?.getComputedStyle(el) ?? null
  } catch {
    return null
  }
}

function elementInfo(el) {
  if (!el?.getBoundingClientRect) return null
  const style = computedStyleOf(el)
  if (!style) return null
  const sizes = readBoxSizes(style)
  const rect = toRect(el.getBoundingClientRect())
  return { rect, sizes, bands: computeBoxBands(rect, sizes), boxes: computeBoxes(rect, sizes) }
}

export default function InspectorLayer({
  doc,
  frame,
  config,
  on,
  following,
  hoverEl,
  setHoverEl,
  selectedEl,
  onSelect,
  onClear,
  property,
  onPropertyChange,
  tick,
}) {
  const wrapRef = useRef(null)
  const [width, setWidth] = useState(0)
  const [panelHidden, setPanelHidden] = useState(false)
  const [panelSide, setPanelSide] = useState('right')
  const [, setResizeTick] = useState(0)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined
    const measure = () => {
      setWidth(el.clientWidth)
      setResizeTick((t) => t + 1)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const pointAt = (event) => {
    const box = wrapRef.current?.getBoundingClientRect()
    if (!box || !doc) return null
    try {
      return doc.elementFromPoint(event.clientX - box.left, event.clientY - box.top)
    } catch {
      return null
    }
  }

  const interactive = on && !following
  const hoverInfo = interactive && hoverEl && hoverEl !== selectedEl ? elementInfo(hoverEl) : null
  const selectedInfo = selectedEl ? elementInfo(selectedEl) : null
  const show = config.show
  const layout = selectedEl && show.includes('layout') ? readLayout(selectedEl) : null
  const narrow = width > 0 && width < NARROW_PX

  // `tick` re-renders on scroll/resize; reading it keeps the linter honest about why.
  void tick

  return (
    <div ref={wrapRef} style={s.layer} data-inspector-layer="">
      <svg style={s.svg} aria-hidden="true" focusable="false">
        {selectedInfo && (
          <BoxDrawing
            info={selectedInfo}
            el={selectedEl}
            showBands={show.includes('box') && !hoverInfo}
            selected
          />
        )}
        {hoverInfo && <BoxDrawing info={hoverInfo} el={hoverEl} showBands={show.includes('box')} />}
        {layout && <LayoutDrawing layout={layout} />}
      </svg>
      {interactive && (
        <div
          style={s.catcher}
          onPointerMove={(event) => {
            if (event.pointerType === 'touch') return
            const el = pointAt(event)
            if (el !== hoverEl) setHoverEl(isInspectable(el) ? el : null)
          }}
          onPointerLeave={() => setHoverEl(null)}
          onClick={(event) => {
            const el = pointAt(event)
            if (el) onSelect(el)
          }}
          onWheel={(event) => {
            try {
              frame?.contentWindow?.scrollBy(event.deltaX, event.deltaY)
            } catch {
              /* nothing to scroll */
            }
          }}
          role="presentation"
        />
      )}
      {selectedEl && (
        <InspectorPanel
          el={selectedEl}
          info={selectedInfo}
          layout={layout}
          show={show}
          property={property}
          onPropertyChange={onPropertyChange}
          onSelect={onSelect}
          onClear={onClear}
          following={following}
          narrow={narrow}
          hidden={panelHidden}
          setHidden={setPanelHidden}
          side={panelSide}
          setSide={setPanelSide}
        />
      )}
      {interactive && !selectedEl && (
        <div style={s.hint} role="status">
          Point at part of the page to see its boxes. Click (or tap) to choose it.
        </div>
      )}
    </div>
  )
}

function BoxDrawing({ info, el, showBands, selected = false }) {
  const { bands, boxes } = info
  const border = boxes.border
  const label = `${describeElement(el)} · ${formatPx(border.width)} × ${formatPx(border.height)}`
  const tagY = boxes.margin.y > 22 ? boxes.margin.y - 20 : boxes.margin.y + boxes.margin.height + 2
  return (
    <g>
      {showBands &&
        bands.flatMap((band) =>
          band.rects.map((rect, i) => (
            <rect
              key={`${band.layer}-${i}`}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              fill={BOX_COLOURS[band.layer]}
              fillOpacity={band.layer === 'content' ? 0.35 : 0.45}
            />
          ))
        )}
      {showBands &&
        bands
          .filter((band) => band.layer !== 'content' && band.rects.length > 0)
          .map((band) => {
            const top = band.rects[0]
            if (top.height < 13 || top.width < 70) return null
            return (
              <BandLabel
                key={band.layer}
                x={top.x + 3}
                y={top.y + Math.min(top.height, 15) - 3}
                text={`${LAYER_LABELS[band.layer]} ${formatSides(band.sizes)}`}
              />
            )
          })}
      {showBands && boxes.content.height >= 14 && boxes.content.width >= 80 && (
        <BandLabel
          x={boxes.content.x + 3}
          y={boxes.content.y + 12}
          text={`content ${formatPx(boxes.content.width)} × ${formatPx(boxes.content.height)}`}
        />
      )}
      <rect
        x={border.x}
        y={border.y}
        width={border.width}
        height={border.height}
        fill="none"
        stroke={selected ? '#0072B2' : '#1f2937'}
        strokeWidth={selected ? 2 : 1}
        strokeDasharray={selected ? undefined : '4 3'}
      />
      <g transform={`translate(${Math.max(0, boxes.margin.x)}, ${Math.max(0, tagY)})`}>
        <rect width={Math.min(320, label.length * 6.6 + 12)} height={18} rx={4} fill="#111827" />
        <text x={6} y={13} fill="#fff" fontSize={11} fontFamily="'JetBrains Mono', monospace">
          {label}
        </text>
      </g>
    </g>
  )
}

function BandLabel({ x, y, text }) {
  return (
    <text
      x={x}
      y={y}
      fontSize={10}
      fontFamily="var(--font-body), sans-serif"
      fontWeight={700}
      fill="#111827"
      stroke="#fff"
      strokeWidth={3}
      paintOrder="stroke"
    >
      {text}
    </text>
  )
}

function LayoutDrawing({ layout }) {
  const markerId = `hsc-inspector-arrow-${useId().replace(/:/g, '')}`
  if (layout.kind === 'grid') {
    const top = layout.rows[0]?.y
    const bottom = layout.rows[layout.rows.length - 1]?.y
    const left = layout.columns[0]?.x
    const right = layout.columns[layout.columns.length - 1]?.x
    return (
      <g>
        {layout.gaps.map((gap, i) => (
          <rect key={`gap-${i}`} {...gapRect(gap)} fill="#CC79A7" fillOpacity={0.3} />
        ))}
        {layout.columns.map((line) => (
          <g key={`c${line.number}`}>
            <line
              x1={line.x}
              x2={line.x}
              y1={top ?? 0}
              y2={bottom ?? 0}
              stroke="#CC79A7"
              strokeWidth={1.5}
              strokeDasharray="5 3"
            />
            <BandLabel x={line.x + 2} y={(top ?? 0) + 11} text={String(line.number)} />
          </g>
        ))}
        {layout.rows.map((line) => (
          <g key={`r${line.number}`}>
            <line
              x1={left ?? 0}
              x2={right ?? 0}
              y1={line.y}
              y2={line.y}
              stroke="#CC79A7"
              strokeWidth={1.5}
              strokeDasharray="5 3"
            />
            <BandLabel x={(left ?? 0) + 2} y={line.y + 11} text={String(line.number)} />
          </g>
        ))}
      </g>
    )
  }
  const { main, cross } = layout
  return (
    <g>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#D55E00" />
        </marker>
      </defs>
      {layout.gaps.map((gap, i) => (
        <rect key={`gap-${i}`} {...gapRect(gap)} fill="#CC79A7" fillOpacity={0.35} />
      ))}
      <line {...lineProps(main)} stroke="#D55E00" strokeWidth={3} markerEnd={`url(#${markerId})`} />
      <line
        {...lineProps(cross)}
        stroke="#D55E00"
        strokeWidth={2}
        strokeDasharray="6 4"
        markerEnd={`url(#${markerId})`}
      />
      <BandLabel
        x={Math.min(main.x1, main.x2) + 4}
        y={Math.min(main.y1, main.y2) - 4}
        text="main axis"
      />
      <BandLabel
        x={Math.min(cross.x1, cross.x2) + 4}
        y={Math.min(cross.y1, cross.y2) + 12}
        text="cross axis"
      />
    </g>
  )
}

function gapRect(gap) {
  return { x: gap.x, y: gap.y, width: gap.width, height: gap.height }
}

function lineProps(axis) {
  return { x1: axis.x1, y1: axis.y1, x2: axis.x2, y2: axis.y2 }
}

function InspectorPanel({
  el,
  info,
  layout,
  show,
  property,
  onPropertyChange,
  onSelect,
  onClear,
  following,
  narrow,
  hidden,
  setHidden,
  side,
  setSide,
}) {
  const [section, setSection] = useState(show[0])
  const activeSection = show.includes(section) ? section : show[0]
  const headingId = useId()
  const reduced = prefersReducedMotion()
  const tag = el.tagName.toLowerCase()
  const classes = Array.from(el.classList ?? [])
  const parent = el.parentElement && el.parentElement.tagName !== 'HTML' ? el.parentElement : null
  const child = Array.from(el.children ?? []).find(isInspectable) ?? null
  const prev = previousInspectable(el)
  const next = nextInspectable(el)

  const panelStyle = narrow
    ? { ...s.panel, ...s.sheet, ...(reduced ? {} : s.sheetAnimate) }
    : { ...s.panel, ...s.side, ...(side === 'left' ? { left: 0 } : { right: 0 }) }

  if (hidden) {
    return (
      <button
        type="button"
        style={narrow ? { ...s.reopen, bottom: 8, right: 8 } : { ...s.reopen, top: 8, [side]: 8 }}
        onClick={() => setHidden(false)}
      >
        Show Inspector panel
      </button>
    )
  }

  return (
    <section style={panelStyle} aria-labelledby={headingId} className="hsc-inspector-panel">
      <div style={s.panelHead}>
        <h3 id={headingId} style={s.panelTitle} aria-live="polite">
          <code style={s.tagCode}>&lt;{tag}&gt;</code>
        </h3>
        <div style={s.headButtons}>
          {!narrow && (
            <button
              type="button"
              style={s.smallBtn}
              onClick={() => setSide(side === 'right' ? 'left' : 'right')}
              title="Move the panel to the other side"
            >
              {side === 'right' ? '◀ Move' : 'Move ▶'}
            </button>
          )}
          <button type="button" style={s.smallBtn} onClick={() => setHidden(true)}>
            Hide
          </button>
        </div>
      </div>
      <dl style={s.facts}>
        <dt style={s.factKey}>Tag</dt>
        <dd style={s.factVal}>
          <code>{tag}</code>
        </dd>
        <dt style={s.factKey}>id</dt>
        <dd style={s.factVal}>
          {el.id ? <code>#{el.id}</code> : <span style={s.muted}>none</span>}
        </dd>
        <dt style={s.factKey}>Classes</dt>
        <dd style={s.factVal}>
          {classes.length ? (
            classes.map((name) => (
              <code key={name} style={s.classChip}>
                .{name}
              </code>
            ))
          ) : (
            <span style={s.muted}>none</span>
          )}
        </dd>
      </dl>
      {!following && (
        <div style={s.navRow} role="group" aria-label="Choose another element">
          <NavButton label="Parent" icon="⬆" target={parent} onSelect={onSelect} />
          <NavButton label="First child" icon="⬇" target={child} onSelect={onSelect} />
          <NavButton label="Previous" icon="◀" target={prev} onSelect={onSelect} />
          <NavButton label="Next" icon="▶" target={next} onSelect={onSelect} />
          <button type="button" style={s.navBtn} onClick={onClear}>
            Clear
          </button>
        </div>
      )}
      {show.length > 1 && (
        <div style={s.tabs} role="tablist" aria-label="Inspector sections">
          {show.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeSection === key}
              style={activeSection === key ? { ...s.tabBtn, ...s.tabBtnOn } : s.tabBtn}
              onClick={() => setSection(key)}
            >
              {SECTION_LABELS[key]}
            </button>
          ))}
        </div>
      )}
      <div style={s.sectionBody} role={show.length > 1 ? 'tabpanel' : undefined}>
        {activeSection === 'box' && <BoxSection info={info} />}
        {activeSection === 'cascade' && (
          <CascadeSection
            el={el}
            property={property}
            onPropertyChange={onPropertyChange}
            following={following}
            onSelect={onSelect}
          />
        )}
        {activeSection === 'layout' && (
          <LayoutSection
            el={el}
            layout={layout}
            parent={parent}
            onSelect={onSelect}
            following={following}
          />
        )}
      </div>
    </section>
  )
}

function previousInspectable(el) {
  for (let node = el.previousElementSibling; node; node = node.previousElementSibling) {
    if (isInspectable(node)) return node
  }
  return null
}

function nextInspectable(el) {
  for (let node = el.nextElementSibling; node; node = node.nextElementSibling) {
    if (isInspectable(node)) return node
  }
  return null
}

function NavButton({ label, icon, target, onSelect }) {
  return (
    <button
      type="button"
      style={target ? s.navBtn : { ...s.navBtn, ...s.navBtnOff }}
      disabled={!target}
      onClick={() => target && onSelect(target)}
      title={target ? `${label}: ${describeElement(target)}` : `No ${label.toLowerCase()}`}
    >
      <span aria-hidden="true">{icon}</span> {label}
    </button>
  )
}

function BoxSection({ info }) {
  if (!info) return null
  const { sizes, boxes } = info
  const ring = (layer, inner) => (
    <div
      style={{ ...s.ring, borderColor: BOX_COLOURS[layer], background: `${BOX_COLOURS[layer]}33` }}
    >
      <div style={s.ringLabel}>
        <span style={{ ...s.swatch, background: BOX_COLOURS[layer] }} aria-hidden="true" />
        {layer} <strong>{formatSides(sizes[layer])}</strong>
      </div>
      {inner}
    </div>
  )
  return (
    <div>
      <p style={s.note}>Every element is a set of boxes, one inside the other. Sizes are in px.</p>
      {ring(
        'margin',
        ring(
          'border',
          ring(
            'padding',
            <div
              style={{
                ...s.ring,
                ...s.contentBox,
                borderColor: BOX_COLOURS.content,
                background: `${BOX_COLOURS.content}33`,
              }}
            >
              <span style={{ ...s.swatch, background: BOX_COLOURS.content }} aria-hidden="true" />
              content{' '}
              <strong>
                {formatPx(boxes.content.width)} × {formatPx(boxes.content.height)}
              </strong>
            </div>
          )
        )
      )}
      <p style={s.note}>
        Margin is space outside the border. Padding is space inside it, around the content.
      </p>
    </div>
  )
}

function CascadeSection({ el, property, onPropertyChange, following, onSelect }) {
  const prop = getInspectorProperty(property)
  const selectId = useId()
  const result = useMemo(
    () =>
      explainProperty(el, prop.key, {
        fileNameForUrl: fileNameForPreviewUrl,
        pageName: fileNameForPreviewUrl(el.ownerDocument?.URL ?? '') ?? 'the page',
      }),
    [el, prop.key]
  )
  return (
    <div>
      <div style={s.questionRow}>
        <label htmlFor={selectId} style={s.question}>
          Why this
        </label>
        <select
          id={selectId}
          value={prop.key}
          onChange={(event) => onPropertyChange(event.target.value)}
          disabled={following}
          style={s.select}
        >
          {INSPECTOR_PROPERTIES.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
        <span style={s.question}>?</span>
      </div>
      <p style={s.valueLine}>
        It is <ValueText value={result.value} colour={COLOUR_PROPERTIES.has(prop.key)} />
      </p>
      {result.source === 'set' && <EntryList entries={result.entries} prop={prop} />}
      {result.source === 'inherited' && (
        <div>
          <p style={s.note}>
            Nothing sets the {prop.label} on this <code>{el.tagName.toLowerCase()}</code>, so it is{' '}
            <strong>inherited from</strong>{' '}
            {following ? (
              <code>{result.inherited.from}</code>
            ) : (
              <button
                type="button"
                style={s.linkBtn}
                onClick={() => onSelect(result.inherited.element)}
              >
                <code>{result.inherited.from}</code>
              </button>
            )}
            , the element it sits inside:
          </p>
          <EntryList
            entries={result.inherited.entries}
            prop={prop}
            inheritedFrom={result.inherited.from}
          />
        </div>
      )}
      {result.source === 'default' && (
        <p style={s.note}>
          Nothing in your CSS sets the {prop.label} here, so it is the browser&apos;s default.
        </p>
      )}
      {result.skippedSheets > 0 && (
        <p style={s.note}>
          {result.skippedSheets === 1
            ? '1 stylesheet comes from another website. The Inspector can’t read it, so its rules aren’t listed.'
            : `${result.skippedSheets} stylesheets come from another website. The Inspector can’t read them, so their rules aren’t listed.`}
        </p>
      )}
    </div>
  )
}

function ValueText({ value, colour }) {
  if (!value) return <span style={s.muted}>not set</span>
  return (
    <span>
      {colour && <span style={{ ...s.swatch, background: value }} aria-hidden="true" />}
      <code>{value}</code>
    </span>
  )
}

function EntryList({ entries, prop, inheritedFrom = null }) {
  return (
    <ol style={s.entries} aria-label={`Rules that set the ${prop.label}, strongest first`}>
      {entries.map((entry) => {
        const won = entry.status !== 'loser'
        const valueText = entryValueText(entry, prop)
        const important = Object.values(entry.important).some(Boolean)
        return (
          <li key={entry.id} style={won ? { ...s.entry, ...s.entryWin } : s.entry}>
            <div style={s.entryTop}>
              <span style={won ? s.badgeWin : s.badgeLose}>
                {entry.status === 'winner'
                  ? inheritedFrom
                    ? '✓ Passed down'
                    : '✓ Wins'
                  : entry.status === 'partial'
                    ? '✓ Wins some'
                    : '✗ Loses'}
              </span>
              <code style={s.selector}>{entry.selector}</code>
            </div>
            <div style={won ? s.entryValue : { ...s.entryValue, ...s.struck }}>
              {!won && <span style={s.srOnly}>Crossed out: </span>}
              {prop.label}: <code>{valueText}</code>
              {important && <strong style={s.important}> !important</strong>}
            </div>
            {entry.reason && (
              <div style={s.reason}>
                {entry.status === 'partial'
                  ? `Wins for ${entry.winsFor.join(', ')}; the rest is ${entry.reason.text}`
                  : `Why it loses: ${entry.reason.text}`}
              </div>
            )}
            <div style={s.source}>
              {entry.kind === 'inline' ? 'From the style="…" on the tag' : `From ${entry.source}`}
              {entry.kind === 'rule' && (
                <span style={s.spec} title="Specificity: ids, classes, tags">
                  {' '}
                  · specificity {formatSpecificity(entry.specificity)}
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function LayoutSection({ el, layout, parent, onSelect, following }) {
  if (!layout) {
    const parentLayout = parent ? readLayout(parent) : null
    return (
      <div>
        <p style={s.note}>
          This <code>{el.tagName.toLowerCase()}</code> isn&apos;t a flex or grid container, so it
          has no layout lines to show.
        </p>
        {parentLayout && (
          <p style={s.note}>
            It sits inside a {parentLayout.kind} container.{' '}
            {!following && (
              <button type="button" style={s.linkBtn} onClick={() => onSelect(parent)}>
                Show the parent&apos;s layout
              </button>
            )}
          </p>
        )}
      </div>
    )
  }
  if (layout.kind === 'grid') {
    return (
      <div>
        <p style={s.note}>
          This is a <strong>grid</strong> container: {layout.columnCount} column
          {layout.columnCount === 1 ? '' : 's'} and {layout.rowCount} row
          {layout.rowCount === 1 ? '' : 's'}. The dashed lines are the numbered grid lines.
        </p>
        <ul style={s.list}>
          <li>Gap between columns: {formatPx(layout.columnGap)}px</li>
          <li>Gap between rows: {formatPx(layout.rowGap)}px</li>
        </ul>
      </div>
    )
  }
  const directionWords = {
    row: 'left to right',
    'row-reverse': 'right to left',
    column: 'top to bottom',
    'column-reverse': 'bottom to top',
  }
  return (
    <div>
      <p style={s.note}>
        This is a <strong>flex</strong> container. Its children line up along the main axis (the
        solid arrow).
      </p>
      <ul style={s.list}>
        <li>
          Main axis: <code>{layout.direction}</code> (
          {directionWords[layout.direction] ?? layout.direction})
        </li>
        <li>Cross axis: the dashed arrow, across the main axis</li>
        <li>
          Gap: {formatPx(layout.gap)}px{layout.gaps.length > 0 ? ' (the shaded strips)' : ''}
        </li>
        <li>
          justify-content (along the main axis): <code>{layout.justify}</code>
        </li>
        <li>
          align-items (along the cross axis): <code>{layout.align}</code>
        </li>
        <li>
          flex-wrap: <code>{layout.wrap}</code>
        </li>
      </ul>
    </div>
  )
}

const s = {
  layer: { position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' },
  svg: { position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' },
  catcher: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'auto',
    cursor: 'crosshair',
    touchAction: 'pan-x pan-y',
  },
  hint: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    padding: '6px 10px',
    borderRadius: 8,
    background: 'rgba(17,24,39,0.85)',
    color: '#fff',
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    pointerEvents: 'none',
  },
  panel: {
    position: 'absolute',
    pointerEvents: 'auto',
    background: 'var(--colour-surface, #fff)',
    color: 'var(--colour-text, #111827)',
    boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 10,
  },
  side: { top: 0, bottom: 0, width: 290, borderLeft: '1px solid #e5e7eb' },
  sheet: {
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '60%',
    borderTop: '1px solid #e5e7eb',
    borderRadius: '12px 12px 0 0',
  },
  sheetAnimate: { animation: 'hsc-inspector-sheet-up 220ms ease-out' },
  reopen: {
    position: 'absolute',
    pointerEvents: 'auto',
    minHeight: 44,
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    background: '#fff',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    cursor: 'pointer',
  },
  panelHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  panelTitle: { margin: 0, fontSize: '1rem', fontFamily: 'var(--font-title)' },
  tagCode: { fontFamily: "'JetBrains Mono', monospace" },
  headButtons: { display: 'flex', gap: 6 },
  smallBtn: {
    minHeight: 32,
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid #d1d5db',
    background: '#f9fafb',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
  },
  facts: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: '2px 10px',
    margin: 0,
  },
  factKey: { fontWeight: 700, color: '#4b5563' },
  factVal: { margin: 0, display: 'flex', flexWrap: 'wrap', gap: 4 },
  classChip: { background: '#f3f4f6', borderRadius: 4, padding: '0 4px' },
  muted: { color: '#6b7280' },
  navRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  navBtn: {
    minHeight: 44,
    minWidth: 44,
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    background: '#fff',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
  },
  navBtnOff: { opacity: 0.45, cursor: 'default' },
  tabs: { display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb' },
  tabBtn: {
    minHeight: 44,
    padding: '6px 10px',
    border: 'none',
    borderBottom: '3px solid transparent',
    background: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.82rem',
    color: '#4b5563',
  },
  tabBtnOn: { color: '#0072B2', borderBottom: '3px solid #0072B2' },
  sectionBody: { display: 'flex', flexDirection: 'column', gap: 6 },
  note: { margin: '4px 0', lineHeight: 1.45 },
  ring: {
    border: '2px solid',
    borderRadius: 6,
    padding: '4px 10px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  ringLabel: { display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem' },
  contentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: '8px 10px',
    fontSize: '0.78rem',
  },
  swatch: {
    display: 'inline-block',
    width: 12,
    height: 12,
    borderRadius: 3,
    border: '1px solid rgba(0,0,0,0.3)',
    marginRight: 4,
    verticalAlign: 'middle',
  },
  questionRow: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  question: { fontWeight: 700, fontFamily: 'var(--font-title)' },
  select: { minHeight: 36, fontFamily: 'var(--font-body)', fontSize: '0.85rem' },
  valueLine: { margin: '2px 0' },
  entries: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  entry: {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '6px 8px',
    background: '#fafafa',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  entryWin: { borderColor: '#009E73', background: '#ecfdf5', borderWidth: 2 },
  entryTop: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  badgeWin: { fontWeight: 700, color: '#065f46' },
  badgeLose: { fontWeight: 700, color: '#6b7280' },
  selector: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 },
  entryValue: {},
  struck: { textDecoration: 'line-through', color: '#6b7280' },
  important: { color: '#b45309' },
  reason: { color: '#92400e', fontWeight: 600 },
  source: { color: '#6b7280', fontSize: '0.75rem' },
  spec: { fontFamily: "'JetBrains Mono', monospace" },
  linkBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    color: '#0072B2',
    textDecoration: 'underline',
    cursor: 'pointer',
    font: 'inherit',
  },
  list: { margin: '4px 0', paddingLeft: 18, lineHeight: 1.5 },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    whiteSpace: 'nowrap',
  },
}
