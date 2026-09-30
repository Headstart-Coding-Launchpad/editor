import React, { useEffect, useRef, useState } from 'react'

/**
 * "Copy class summary": copies the class wall as plain text grouped by badge
 * (src/badges/badgeSummary.js classWallText). Used on the teacher's Badge Summary task and in the
 * session report.
 *
 * @param {object} props
 * @param {string} props.text The summary to copy.
 * @param {string} [props.className]
 * @param {object} [props.style]
 */
export default function CopyClassSummaryButton({ text, className = 'btn-ghost-outline', style }) {
  const [status, setStatus] = useState(null)
  const timerRef = useRef(null)
  useEffect(() => () => clearTimeout(timerRef.current), [])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setStatus('copied')
    } catch {
      setStatus('failed')
    }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setStatus(null), 2000)
  }

  return (
    <button type="button" className={className} style={style} onClick={handleCopy}>
      {status === 'copied'
        ? '✓ Copied'
        : status === 'failed'
          ? 'Copy failed'
          : '📋 Copy class summary'}
    </button>
  )
}
