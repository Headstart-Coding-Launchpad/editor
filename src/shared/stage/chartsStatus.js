// Whether the Python worker is loading matplotlib right now (charts, ./charts.js), for the output
// panel's "Loading charts… (first time only)". One flag for the page: there is one worker.
import { useSyncExternalStore } from 'react'

let loading = false
const listeners = new Set()

export function setChartsLoading(value) {
  const next = !!value
  if (next === loading) return
  loading = next
  for (const listener of listeners) listener()
}

export function isChartsLoading() {
  return loading
}

export function subscribeChartsLoading(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** React: true while matplotlib loads. */
export function useChartsLoading() {
  return useSyncExternalStore(subscribeChartsLoading, isChartsLoading, () => false)
}
