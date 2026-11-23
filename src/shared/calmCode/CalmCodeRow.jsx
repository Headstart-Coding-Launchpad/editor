import React, { useEffect, useRef, useState } from 'react'
import { BlocksButton, EmojiButton } from '../../modules/python/EditorToolButtons'
import './calmCode.css'

// The calm code row of the picture modules (Turtle, Arcade; sketch OK'd 23 Nov 2026): Code ·
// 😊 Emoji · Blocks, then one "More" menu for the rarely used controls and one big primary button
// last (▶ Draw, ▶ Play). Stop and "Getting Python ready..." take the big button's slot, which
// keeps the `run stop` highlight target. A menu item's `highlight` id rings More while the menu
// is shut (data-highlight-reveal). Spacing and sizes in ./calmCode.css; 44px touch targets.

/**
 * `run`: { word, stop, busyLabel, onClick, disabled, title, describedBy }. `more`: menu items
 * { id, icon, label, onClick, disabled, title, highlight } (falsy entries are skipped). `title`:
 * the row's "Code" word (off where a Code tab already names it, Arcade).
 */
export default function CalmCodeRow({ onEmoji, showBlocks = true, more = [], run, title = true }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const items = more.filter(Boolean)
  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      const outside = event.type === 'pointerdown' && !menuRef.current?.contains(event.target)
      if (outside || event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])
  const reveal = items.map((item) => item.highlight).filter(Boolean)
  return (
    <div className="calm-code-row-host">
      <div className="calm-code-row" role="group" aria-label="Code">
        {title && (
          <span className="calm-code-row__title" aria-hidden="true">
            Code
          </span>
        )}
        <EmojiButton size={44} insert={onEmoji} />
        {showBlocks && <BlocksButton className="calm-row-btn" />}
        <span className="calm-code-row__gap" />
        {items.length > 0 && (
          <div ref={menuRef} className="calm-more">
            <button
              type="button"
              className="calm-row-btn"
              aria-haspopup="menu"
              aria-expanded={open}
              data-highlight-reveal={reveal.length ? reveal.join(' ') : undefined}
              onClick={() => setOpen((was) => !was)}
            >
              More <span aria-hidden="true">▾</span>
            </button>
            {open && (
              <div role="menu" aria-label="More" className="ui-popover calm-more__menu">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    className="calm-more__item"
                    disabled={item.disabled}
                    title={item.title}
                    data-highlight-target={item.highlight}
                    onClick={() => {
                      setOpen(false)
                      item.onClick()
                    }}
                  >
                    <span aria-hidden="true">{item.icon} </span>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          className={`${run.stop ? 'btn-danger' : 'btn-primary'} btn-primary--big`}
          data-highlight-target="run stop"
          onClick={run.onClick}
          disabled={run.disabled}
          title={run.title}
          aria-describedby={run.describedBy}
        >
          {run.stop ? 'Stop' : (run.busyLabel ?? <RunWord word={run.word} />)}
        </button>
      </div>
    </div>
  )
}

function RunWord({ word }) {
  return (
    <>
      <span aria-hidden="true">▶ </span>
      {word}
    </>
  )
}

/**
 * The console folded to one line (Turtle): "Console" and the last line printed. The workspace
 * opens the console by itself when a run prints or crashes; a tap opens it too.
 */
export function ConsoleStrip({ output, onOpen }) {
  const last = String(output ?? '')
    .trimEnd()
    .split('\n')
    .pop()
  return (
    <button type="button" className="calm-console-strip" onClick={onOpen} aria-expanded={false}>
      <span className="calm-console-strip__title">Console</span>
      <span className="calm-console-strip__line">{last || 'nothing printed yet'}</span>
      <span aria-hidden="true">▴</span>
    </button>
  )
}
