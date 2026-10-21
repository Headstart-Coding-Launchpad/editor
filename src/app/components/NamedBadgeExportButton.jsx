import React from 'react'
import { downloadNamedBadgeCsv } from '../../badges/namedBadgeExport'

// Tutor-only download of which student earned which badge, by name (src/badges/namedBadgeExport.js).
// The rows live only in the tutor's browser; the saved report stays anonymous.
export default function NamedBadgeExportButton({ rows, lesson, style }) {
  if (!rows?.length) return null
  return (
    <button
      type="button"
      className="btn-ghost"
      style={style}
      onClick={() => downloadNamedBadgeCsv(rows, lesson)}
      title="A CSV of each student's badges, with names, for Pencilcase. Names aren't saved: download it before you close this."
    >
      ⬇ Badges with names (CSV)
    </button>
  )
}
