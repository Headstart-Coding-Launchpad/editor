import { TYPING_HISTORY_RECENT, formatTypingHistoryChip } from '../../../shared/typingHistory'

const MODE_LABELS = {
  type_text: 'Text',
  type_code: 'Code',
  falling_words: 'Falling words',
}

function formatDate(value) {
  const date = new Date(Number(value) || 0)
  if (!Number(value)) return '—'
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// Date, mode, characters a minute, accuracy and corrections for each entry (newest first).
// Also used by Admin → Classes → a student's typing history.
export function TypingHistoryTable({ entries }) {
  return (
    <table style={s.table}>
      <thead>
        <tr>
          <th style={s.th}>Date</th>
          <th style={s.th}>Mode</th>
          <th style={s.th}>cpm</th>
          <th style={s.th}>Accuracy</th>
          <th style={s.th}>Corrections</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.id ?? `${entry.date}-${entry.itemId}`}>
            <td style={s.td}>{formatDate(entry.date)}</td>
            <td style={s.td}>{MODE_LABELS[entry.mode] ?? entry.mode}</td>
            <td style={s.td}>{entry.cpm}</td>
            <td style={s.td}>{Math.round((Number(entry.accuracy) || 0) * 100)}%</td>
            <td style={s.td}>{entry.corrections ?? 0}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Tutor-only "Typing history" in the StudentModal on a typing task (src/shared/typingHistory.js):
// the matched student's last / best / first scores from earlier lessons (the node pushed to them)
// and their most recent saved entries, this session's included.
export default function TypingHistoryPanel({ modeHistory = null, entries = null }) {
  const recent = (entries ?? []).slice(0, TYPING_HISTORY_RECENT)
  if (!modeHistory && recent.length === 0) return null
  return (
    <details style={s.panel} data-testid="modal-typing-history">
      <summary style={s.summary}>
        📈 Typing history
        {modeHistory ? ` · ${formatTypingHistoryChip(modeHistory)}` : ''}
      </summary>
      {recent.length > 0 ? (
        <TypingHistoryTable entries={recent} />
      ) : (
        <p style={s.note}>No saved scores yet.</p>
      )}
    </details>
  )
}

const s = {
  panel: {
    flexShrink: 0,
    maxHeight: '35%',
    overflowY: 'auto',
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid var(--ui-border-strong)',
    background: 'var(--ui-surface-neutral-sunk)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
  },
  summary: { cursor: 'pointer', fontWeight: 700, color: 'var(--colour-text)' },
  table: { borderCollapse: 'collapse', marginTop: 6, width: '100%' },
  th: { textAlign: 'left', padding: '2px 8px 2px 0', color: 'var(--colour-muted)' },
  td: { padding: '2px 8px 2px 0', color: 'var(--colour-text)' },
  note: { margin: '6px 0 0', color: 'var(--colour-muted)' },
}
