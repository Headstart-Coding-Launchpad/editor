import { useEffect, useState } from 'react'
import { fetchBadgeCatalogue } from '../../badges/catalogueService'

/**
 * The Admin badge catalogue (Firestore `badgeCatalogue`), read once when `enabled` first turns
 * true: the teacher's picker, student cards, report and Badge Summary wall pass it on as
 * `catalogueBadges`. Teachers and admins can read it; a failed read leaves it empty (the picker
 * then lists the registry badges only, and awarded catalogue badges still render from their
 * decision snapshot).
 */
export function useBadgeCatalogue(enabled = true) {
  const [catalogueBadges, setCatalogueBadges] = useState([])
  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false
    fetchBadgeCatalogue()
      .then((entries) => {
        if (!cancelled) setCatalogueBadges(entries)
      })
      .catch((err) => {
        console.warn('Badge catalogue failed to load:', err)
      })
    return () => {
      cancelled = true
    }
  }, [enabled])
  return catalogueBadges
}
