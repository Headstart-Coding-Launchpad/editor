import React, { useMemo, useState } from 'react'
import { getPeerHintCards, sortedItems } from '../../../shared/peerHelp'
import { peerHelpCapability } from '../../peerHelpAnchors'

/**
 * The helper's main view: the classmate's code, big, one row per line (or Scratch script), with
 * 👍 Good / 👎 Look again / 💡 Hint on every row. 💡 opens a few hint cards under that row. Made
 * for 9-year-olds: big targets, few words, one thing at a time. Everything sent is a fixed
 * choice, never the helper's own words.
 */
export default function PeerHelpLineList({
  anchors,
  lessonType,
  task,
  inbox,
  ended,
  onMark,
  onHint,
}) {
  const [hintFor, setHintFor] = useState(null)
  const [busy, setBusy] = useState(false)
  const capability = peerHelpCapability(lessonType)
  const cards = useMemo(() => getPeerHintCards(capability?.hints, task), [capability?.hints, task])
  const isScripts = capability?.anchors === 'scripts'

  // What this helper already sent, per row: the latest verdict and any hints.
  const sent = useMemo(() => {
    const byKey = {}
    for (const item of sortedItems(inbox)) {
      const key = `${item.file ?? ''}:${item.line}`
      const entry = (byKey[key] ??= { verdict: null, hints: [] })
      if (item.kind === 'mark') entry.verdict = item.verdict
      if (item.kind === 'hint') entry.hints.push(item.hintId)
    }
    return byKey
  }, [inbox])

  async function run(action) {
    setBusy(true)
    try {
      await action()
    } catch {
      // Refused by the rules (help ended, or paused); the header shows that state.
    } finally {
      setBusy(false)
    }
  }

  const named = anchors.some((a) => a.file)
  let lastFile = null

  return (
    <div style={s.wrap}>
      {anchors.length === 0 && <p style={s.empty}>Their code is empty.</p>}
      <ol style={s.list} aria-label="Their code">
        {anchors.map((anchor) => {
          const mine = sent[anchor.key]
          const heading = named && !isScripts && anchor.file !== lastFile ? anchor.file : null
          lastFile = anchor.file
          const where = isScripts ? anchor.label : `line ${anchor.line}`
          return (
            <li key={anchor.key} style={s.item}>
              {heading && <div style={s.fileHeading}>{heading}</div>}
              <div style={{ ...s.row, ...(hintFor === anchor.key ? s.rowOpen : null) }}>
                <span style={s.number} aria-hidden="true">
                  {isScripts ? '🧩' : anchor.line}
                </span>
                <code style={s.code}>
                  {isScripts ? `${anchor.label}: ${anchor.text}` : anchor.text || ' '}
                </code>
                {!ended && (
                  <span style={s.buttons}>
                    <button
                      type="button"
                      style={{ ...s.btn, ...(mine?.verdict === 'up' ? s.btnOn : null) }}
                      aria-label={`Good: ${where}`}
                      aria-pressed={mine?.verdict === 'up'}
                      title="Good!"
                      disabled={busy}
                      onClick={() =>
                        run(() => onMark({ file: anchor.file, line: anchor.line, verdict: 'up' }))
                      }
                    >
                      👍
                    </button>
                    <button
                      type="button"
                      style={{ ...s.btn, ...(mine?.verdict === 'down' ? s.btnOn : null) }}
                      aria-label={`Look again: ${where}`}
                      aria-pressed={mine?.verdict === 'down'}
                      title="Look again"
                      disabled={busy}
                      onClick={() =>
                        run(() => onMark({ file: anchor.file, line: anchor.line, verdict: 'down' }))
                      }
                    >
                      👎
                    </button>
                    <button
                      type="button"
                      style={{
                        ...s.btn,
                        ...(hintFor === anchor.key || mine?.hints.length ? s.btnOn : null),
                      }}
                      aria-label={`Hint: ${where}`}
                      aria-expanded={hintFor === anchor.key}
                      title="Send a hint"
                      onClick={() => setHintFor((k) => (k === anchor.key ? null : anchor.key))}
                    >
                      💡
                    </button>
                  </span>
                )}
              </div>
              {hintFor === anchor.key && !ended && (
                <div style={s.cards} role="group" aria-label={`Hints for ${where}`}>
                  {cards.map((hint) => (
                    <button
                      key={hint.id}
                      type="button"
                      style={s.card}
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await onHint({ file: anchor.file, line: anchor.line, hintId: hint.id })
                          setHintFor(null)
                        })
                      }
                    >
                      <span style={s.cardEmoji} aria-hidden="true">
                        {hint.emoji}
                      </span>
                      {hint.text}
                    </button>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

const s = {
  wrap: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: 12,
    background: 'var(--ui-surface-soft)',
    color: 'var(--colour-text)',
  },
  empty: { color: 'var(--colour-muted)', fontSize: 16 },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  item: { display: 'flex', flexDirection: 'column', gap: 6 },
  fileHeading: { fontWeight: 700, fontSize: 14, marginTop: 8 },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '4px 8px',
    borderRadius: 8,
    background: 'var(--ui-surface)',
    border: '1px solid var(--ui-border)',
  },
  rowOpen: { borderColor: 'var(--colour-primary)' },
  number: { minWidth: 28, textAlign: 'right', color: 'var(--colour-muted)', fontSize: 14 },
  code: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'var(--font-code)',
    fontSize: 16,
    whiteSpace: 'pre',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  buttons: { display: 'flex', gap: 6, flexShrink: 0 },
  btn: {
    minWidth: 44,
    minHeight: 40,
    fontSize: 20,
    borderRadius: 8,
    border: '1px solid var(--ui-border-strong)',
    background: 'var(--ui-surface)',
    cursor: 'pointer',
  },
  btnOn: { background: 'var(--ui-surface-tint)', borderColor: 'var(--colour-primary)' },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
    gap: 8,
    padding: '0 8px 8px 46px',
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    padding: '8px 12px',
    fontSize: 15,
    fontWeight: 600,
    textAlign: 'left',
    color: 'var(--colour-primary-dark)',
    background: 'var(--ui-surface)',
    border: '2px solid rgba(98,34,204,0.25)',
    borderRadius: 10,
    cursor: 'pointer',
  },
  cardEmoji: { fontSize: 22 },
}
