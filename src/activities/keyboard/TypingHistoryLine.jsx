import { formatTypingHistoryLine, formatTypingTrend } from '../../shared/typingHistory.js'

// The student's typing history beside an item (`showHistory`): "Last time: 62 cpm, 91% · Best:
// 75 cpm", and once the item is finished, how far they've come. Nothing without history.
export default function TypingHistoryLine({ modeHistory, result, finished }) {
  const line = formatTypingHistoryLine(modeHistory)
  if (!line) return null
  const trend = finished ? formatTypingTrend(modeHistory, result?.cpm) : ''
  return (
    <p className="act-row" data-testid="keyboard-history">
      <span className="act-badge" title="cpm: characters a minute">
        📈 {line}
      </span>
      {trend && (
        <span className="act-badge" role="status" data-testid="keyboard-history-trend">
          🎉 {trend}
        </span>
      )}
    </p>
  )
}
