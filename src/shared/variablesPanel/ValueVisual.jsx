import React, { useState } from 'react'
import { formatValue } from './variablesPanel.js'
import { cellKey, describeItem, describePicture, dictKey, itemKey, sizeText } from './visuals.js'

// How much of an item's text shows on a swatch, bar or card before the full value (Show value).
const ITEM_CHARS = 16
const CARD_CHARS = 40
// Pictures with more columns than this number their ruler every 5 columns only.
const FULL_RULER_COLS = 16

/**
 * A value drawn as its visual (chooseVisual in visuals.js): swatches, bars, a picture, a table,
 * rows of tiles, cards, labelled bars or a "drawn on the Stage" size line. Index numbers always
 * show; the exact Python value is one tap away (tap the visual or press Show value), so "5" and
 * 5 still read differently. `changedItems` (a Set of item keys) marks the items that changed.
 * Colour is never the only signal: every item carries its text, and each has screen-reader
 * words such as "palette, item 0: red".
 */
export default function ValueVisual({ name, node, visual, changedItems = null }) {
  const [showText, setShowText] = useState(false)
  const changed = changedItems ?? new Set()
  const toggle = () => setShowText((value) => !value)
  const notRead = visual.notRead ?? 0
  return (
    <>
      <div className={`ntp-visual ntp-visual--${visual.kind}`} onClick={toggle}>
        <VisualBody name={name} node={node} visual={visual} changed={changed} />
      </div>
      {notRead > 0 && (
        <span className="ntp-more">
          {notRead} more {notRead === 1 ? 'item' : 'items'} not shown
        </span>
      )}
      <button
        type="button"
        className="btn-ghost-outline ntp-expand"
        aria-expanded={showText}
        onClick={toggle}
      >
        {showText ? 'Hide value' : 'Show value'}
      </button>
      {showText && <code className="ntp-value ntp-exact">{formatValue(node)}</code>}
    </>
  )
}

function ItemMark({ on }) {
  if (!on) return null
  return (
    <span className="ntp-item-mark" aria-hidden="true" title="changed">
      ●
    </span>
  )
}

const changedWords = (on) => (on ? ', changed' : '')

function VisualBody({ name, node, visual, changed }) {
  switch (visual.kind) {
    case 'swatches':
      return (
        <ol className="ntp-swatches" start={0} aria-label={`${name}: colours`}>
          {visual.items.map((item) => {
            const on = changed.has(itemKey(item.index))
            return (
              <li key={item.index} className={`ntp-swatch${on ? ' is-item-changed' : ''}`}>
                <span
                  className="ntp-swatch-chip"
                  style={{ background: item.hex }}
                  aria-hidden="true"
                />
                <code className="ntp-value" aria-hidden="true">
                  {formatValue(item.node, { maxChars: ITEM_CHARS })}
                </code>
                <span className="ntp-index" aria-hidden="true">
                  {item.index}
                  <ItemMark on={on} />
                </span>
                <span className="ntp-sr-only">
                  {describeItem(name, visual, item)}
                  {changedWords(on)}
                </span>
              </li>
            )
          })}
        </ol>
      )
    case 'bars':
    case 'dictBars': {
      const rows =
        visual.kind === 'bars'
          ? visual.items.map((item) => ({
              key: itemKey(item.index),
              label: String(item.index),
              item,
              number: item.number,
              fraction: item.fraction,
              valueNode: item.node,
            }))
          : visual.entries.map((entry) => ({
              key: dictKey(entry.key),
              label: formatValue(entry.key, { maxChars: ITEM_CHARS }),
              item: entry,
              number: entry.number,
              fraction: entry.fraction,
              valueNode: entry.value,
            }))
      return (
        <ol className="ntp-bars" start={0} aria-label={`${name}: bars`}>
          {rows.map((row) => {
            const on = changed.has(row.key)
            return (
              <li
                key={row.key}
                className={`ntp-bar-row${on ? ' is-item-changed' : ''}${
                  visual.kind === 'dictBars' ? ' ntp-bar-row--keyed' : ''
                }`}
              >
                <span
                  className={visual.kind === 'bars' ? 'ntp-index' : 'ntp-bar-key'}
                  aria-hidden="true"
                >
                  {row.label}
                </span>
                <span className="ntp-bar-track" aria-hidden="true">
                  <span
                    className={`ntp-bar${row.number < 0 ? ' is-negative' : ''}`}
                    style={{ width: `${Math.round(row.fraction * 1000) / 10}%` }}
                  />
                </span>
                <code className="ntp-value" aria-hidden="true">
                  {formatValue(row.valueNode, { maxChars: ITEM_CHARS })}
                  <ItemMark on={on} />
                </code>
                <span className="ntp-sr-only">
                  {describeItem(name, visual, row.item)}
                  {changedWords(on)}
                </span>
              </li>
            )
          })}
        </ol>
      )
    }
    case 'cards':
      return (
        <ul className="ntp-cards" aria-label={`${name}: entries`}>
          {visual.entries.map((entry, index) => {
            const key = dictKey(entry.key)
            const on = changed.has(key)
            return (
              <li key={`${key}#${index}`} className={`ntp-card${on ? ' is-item-changed' : ''}`}>
                <code className="ntp-card-key" aria-hidden="true">
                  {formatValue(entry.key, { maxChars: ITEM_CHARS })}
                  <ItemMark on={on} />
                </code>
                <span className="ntp-card-value" aria-hidden="true">
                  {entry.hex && (
                    <span
                      className="ntp-swatch-chip ntp-swatch-chip--small"
                      style={{ background: entry.hex }}
                    />
                  )}
                  <code className="ntp-value">
                    {formatValue(entry.value, { maxChars: CARD_CHARS })}
                  </code>
                </span>
                <span className="ntp-sr-only">
                  {describeItem(name, visual, entry)}
                  {changedWords(on)}
                </span>
              </li>
            )
          })}
        </ul>
      )
    case 'picture':
      return <Picture name={name} visual={visual} changed={changed} />
    case 'table':
      return (
        <div className="ntp-table-wrap">
          <table className="ntp-table">
            <caption className="ntp-sr-only">
              {name}: {visual.rows.length} by {visual.cols} table
            </caption>
            <thead>
              <tr>
                <td />
                {visual.rows[0].map((_, col) => (
                  <th key={col} scope="col" className="ntp-index">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visual.rows.map((row, r) => (
                <tr key={r}>
                  <th scope="row" className="ntp-index">
                    {r}
                  </th>
                  {row.map((cell, c) => {
                    const on = changed.has(cellKey(r, c))
                    return (
                      <td key={c} className={on ? 'is-item-changed' : undefined}>
                        <code className="ntp-value">
                          {formatValue(cell, { maxChars: ITEM_CHARS })}
                        </code>
                        <ItemMark on={on} />
                        {on && <span className="ntp-sr-only"> (changed)</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'rows':
      return (
        <ol className="ntp-rows" start={0} aria-label={`${name}: rows`}>
          {visual.rows.map((row, r) => (
            <li key={r} className="ntp-row">
              <span className="ntp-index ntp-row-index">{r}</span>
              <ol className="ntp-tiles" start={0}>
                {row.cells.map((cell, c) => {
                  const on = changed.has(cellKey(r, c))
                  return (
                    <li key={c} className={`ntp-tile${on ? ' is-item-changed' : ''}`}>
                      <code className="ntp-value">
                        {formatValue(cell, { maxChars: ITEM_CHARS })}
                      </code>
                      <span className="ntp-index">
                        {c}
                        <ItemMark on={on} />
                      </span>
                    </li>
                  )
                })}
              </ol>
            </li>
          ))}
        </ol>
      )
    case 'size':
      return <code className="ntp-value ntp-size">{sizeText(node, visual)}</code>
    default:
      return null
  }
}

function Picture({ name, visual, changed }) {
  const { rows, cols, cells } = visual
  const everyCol = cols <= FULL_RULER_COLS
  const ruler = (index) => (everyCol || index % 5 === 0 ? index : '')
  const changedCount = [...changed].filter((key) => key.includes(',')).length
  const colourCount = visual.colours.filter((entry) => entry.hex).length
  return (
    <>
      <div
        className="ntp-picture"
        role="img"
        aria-label={
          describePicture(name, visual) +
          (changedCount > 0
            ? `. ${changedCount} ${changedCount === 1 ? 'pixel' : 'pixels'} changed`
            : '')
        }
        style={{ '--ntp-cols': cols }}
      >
        <span className="ntp-ruler ntp-ruler--corner" aria-hidden="true" />
        {cells[0].map((_, c) => (
          <span key={`c${c}`} className="ntp-ruler" aria-hidden="true">
            {ruler(c)}
          </span>
        ))}
        {cells.map((row, r) => (
          <React.Fragment key={r}>
            <span className="ntp-ruler ntp-ruler--row" aria-hidden="true">
              {rows <= FULL_RULER_COLS || r % 5 === 0 ? r : ''}
            </span>
            {row.map((cell, c) => {
              const on = changed.has(cellKey(r, c))
              return (
                <span
                  key={c}
                  className={`ntp-pixel${cell.hex ? '' : ' is-clear'}${on ? ' is-item-changed' : ''}`}
                  style={cell.hex ? { background: cell.hex } : undefined}
                  title={`row ${r}, column ${c}: ${cell.words}${on ? ' (changed)' : ''}`}
                  aria-hidden="true"
                />
              )
            })}
          </React.Fragment>
        ))}
      </div>
      <span className="ntp-more" aria-hidden="true">
        {rows} × {cols} picture · {colourCount} {colourCount === 1 ? 'colour' : 'colours'}
        {changedCount > 0 ? ` · ${changedCount} changed` : ''}
      </span>
    </>
  )
}
