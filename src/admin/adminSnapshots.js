// One shared Firestore listener per Admin data source (Firestore cost cuts, Ryan 8 Nov 2026).
// Admin tabs remount their panel on every switch, and each panel used to open its own
// onSnapshot, so every switch downloaded the whole lessons collection and hundreds of large
// session reports again. Here a source (a key) has one listener for every panel that uses it,
// and it stays open for ADMIN_SNAPSHOT_LINGER_MS after the last panel closes, so switching tabs
// and back reads nothing new. Data stays live: other people's edits still arrive.
import { useCallback, useRef, useSyncExternalStore } from 'react'
import { collection, collectionGroup, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { firestore } from '../shared/firebase'
import { decodeLessonFromFirestore } from '../shared/lessonBlocksCodec'

export const ADMIN_SNAPSHOT_LINGER_MS = 10 * 60 * 1000

// Session reports are large (every student's answers), so lists show this many at a time with
// a Load more button.
export const REPORT_PAGE_SIZE = 20

const IDLE = Object.freeze({ data: null, loading: true, error: null })
const sources = new Map()

function stop(key) {
  const source = sources.get(key)
  if (!source) return
  clearTimeout(source.timer)
  source.unsubscribe?.()
  sources.delete(key)
}

// For tests: drop every listener and cached result.
export function resetAdminSnapshots() {
  for (const key of [...sources.keys()]) stop(key)
}

function subscribe(key, makeQuery, mapSnapshot, onChange) {
  let source = sources.get(key)
  if (!source) {
    source = { state: IDLE, subscribers: new Set(), timer: null, unsubscribe: null }
    sources.set(key, source)
  }
  clearTimeout(source.timer)
  source.subscribers.add(onChange)
  if (!source.unsubscribe) {
    const current = source
    const emit = (state) => {
      current.state = state
      for (const fn of current.subscribers) fn()
    }
    current.unsubscribe = onSnapshot(
      makeQuery(),
      (snap) => emit({ data: mapSnapshot(snap), loading: false, error: null }),
      (err) => emit({ data: current.state.data, loading: false, error: err?.message ?? 'Error' })
    )
  }
  return () => {
    source.subscribers.delete(onChange)
    if (source.subscribers.size > 0) return
    // A failed listener is dead; drop it now so the next open tries again.
    if (source.state.error) stop(key)
    else source.timer = setTimeout(() => stop(key), ADMIN_SNAPSHOT_LINGER_MS)
  }
}

// { data, loading, error } for a shared source. `key` names the query (include anything that
// changes it, such as a limit); null means "not needed here" and opens nothing.
export function useAdminSnapshot(key, makeQuery, mapSnapshot) {
  const latest = useRef({ makeQuery, mapSnapshot })
  latest.current = { makeQuery, mapSnapshot }
  const subscribeToKey = useCallback(
    (onChange) =>
      key == null
        ? () => {}
        : subscribe(
            key,
            () => latest.current.makeQuery(),
            (snap) => latest.current.mapSnapshot(snap),
            onChange
          ),
    [key]
  )
  const getState = useCallback(
    () => (key == null ? IDLE : (sources.get(key)?.state ?? IDLE)),
    [key]
  )
  return useSyncExternalStore(subscribeToKey, getState, getState)
}

const mapLessons = (snap) =>
  snap.docs.map((d) => ({ id: d.id, ...decodeLessonFromFirestore(d.data()) }))

// Every lesson, live (the Lessons, Levels, Solo and Sessions tabs share it). Firestore's web SDK
// cannot fetch only some fields, so a panel that needs only titles derives them from this one
// shared copy rather than opening its own.
export function useAdminLessons(enabled = true) {
  return useAdminSnapshot(
    enabled ? 'lessons' : null,
    () => collection(firestore, 'lessons'),
    mapLessons
  )
}

// The newest `count` session reports across all lessons, live, newest first.
export function useRecentReports(count = REPORT_PAGE_SIZE) {
  return useAdminSnapshot(
    `recentReports:${count}`,
    () =>
      query(
        collectionGroup(firestore, 'sessionReports'),
        orderBy('startedAt', 'desc'),
        limit(count)
      ),
    (snap) =>
      snap.docs.map((d) => ({ id: d.id, lessonId: d.ref.parent.parent?.id ?? null, ...d.data() }))
  )
}
