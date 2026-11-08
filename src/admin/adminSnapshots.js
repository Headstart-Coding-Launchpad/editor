// One shared Firestore listener per Admin data source (Firestore cost cuts, Ryan 8 Nov 2026).
// Admin tabs remount their panel on every switch, and each panel used to open its own
// onSnapshot, so every switch downloaded the whole lessons collection and hundreds of large
// session reports again. Here a source (a key) has one listener for every panel that uses it,
// and it stays open for ADMIN_SNAPSHOT_LINGER_MS after the last panel closes, so switching tabs
// and back reads nothing new. Data stays live: other people's edits still arrive.
// A source belongs to the signed-in user: when someone else signs in, every cached result is
// dropped (setAdminSnapshotsUser), and signing out drops them too (resetAdminSnapshots).
import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react'
import { collection, collectionGroup, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { firestore } from '../shared/firebase'
import { decodeLessonFromFirestore } from '../shared/lessonBlocksCodec'

export const ADMIN_SNAPSHOT_LINGER_MS = 10 * 60 * 1000

// Session reports are large (every student's answers), so lists show this many at a time with
// a Load more button.
export const REPORT_PAGE_SIZE = 20

const IDLE = Object.freeze({ data: null, loading: true, error: null })
// A source a panel does not need (key null): nothing to wait for.
const DISABLED = Object.freeze({ data: null, loading: false, error: null })
const sources = new Map()
let ownerUid = null

function stop(key) {
  const source = sources.get(key)
  if (!source) return
  clearTimeout(source.timer)
  source.unsubscribe?.()
  sources.delete(key)
}

// Drop every listener and cached result (sign-out, and tests).
export function resetAdminSnapshots() {
  for (const key of [...sources.keys()]) stop(key)
  ownerUid = null
}

// Called by the Admin shell with the signed-in user's uid before its panels subscribe. A
// different user drops everything cached for the last one. A missing uid (the brief null while
// Firebase restores a session) changes nothing; signing out calls resetAdminSnapshots.
export function setAdminSnapshotsUser(uid) {
  if (!uid || uid === ownerUid) return
  const previous = ownerUid
  ownerUid = uid
  if (previous === null) return
  for (const [key, source] of [...sources]) {
    if (source.subscribers.size === 0) {
      stop(key)
      continue
    }
    // Still on screen (normally none: Admin unmounts on sign-out): start again empty rather
    // than orphan it. Its panels hear a moment later, as this runs while the shell renders.
    source.unsubscribe?.()
    source.unsubscribe = null
    source.state = IDLE
    listen(source)
    queueMicrotask(() => {
      for (const fn of source.subscribers) fn()
    })
  }
}

function emit(source, state) {
  source.state = state
  for (const fn of source.subscribers) fn()
}

function listen(source) {
  source.unsubscribe = onSnapshot(
    source.makeQuery(),
    (snap) => emit(source, { data: source.mapSnapshot(snap), loading: false, error: null }),
    (err) =>
      emit(source, { data: source.state.data, loading: false, error: err?.message ?? 'Error' })
  )
}

// A failed listener is dead: stop it and open a fresh one, keeping its panels and last data.
function restart(source) {
  source.unsubscribe?.()
  source.unsubscribe = null
  emit(source, { data: source.state.data, loading: true, error: null })
  listen(source)
}

export function retryAdminSnapshot(key) {
  const source = key == null ? null : sources.get(key)
  if (source?.state.error) restart(source)
}

function subscribe(key, family, makeQuery, mapSnapshot, onChange) {
  let source = sources.get(key)
  if (!source) {
    source = { family, state: IDLE, subscribers: new Set(), timer: null, unsubscribe: null }
    source.makeQuery = makeQuery
    source.mapSnapshot = mapSnapshot
    sources.set(key, source)
  }
  clearTimeout(source.timer)
  source.subscribers.add(onChange)
  if (source.state.error) restart(source)
  else if (!source.unsubscribe) listen(source)
  // Load more moves a panel to a bigger page of the same family (reports:20 -> reports:40):
  // the smaller page nobody uses any more stops now rather than lingering.
  if (family != null) {
    for (const [otherKey, other] of sources) {
      if (otherKey !== key && other.family === family && other.subscribers.size === 0)
        stop(otherKey)
    }
  }
  return () => {
    source.subscribers.delete(onChange)
    if (source.subscribers.size > 0 || sources.get(key) !== source) return
    // A failed listener is dead; drop it now so the next open tries again.
    if (source.state.error) stop(key)
    else source.timer = setTimeout(() => stop(key), ADMIN_SNAPSHOT_LINGER_MS)
  }
}

// { data, loading, error, retry } for a shared source. `key` names the query (include anything
// that changes it, such as a limit); null means "not needed here", opens nothing and is not
// loading. `family` groups the pages of one list (the key without its limit), so Load more
// stops the smaller page at once. `retry` restarts a failed source.
export function useAdminSnapshot(key, makeQuery, mapSnapshot, { family = null } = {}) {
  const latest = useRef({ makeQuery, mapSnapshot })
  latest.current = { makeQuery, mapSnapshot }
  const subscribeToKey = useCallback(
    (onChange) =>
      key == null
        ? () => {}
        : subscribe(
            key,
            family,
            () => latest.current.makeQuery(),
            (snap) => latest.current.mapSnapshot(snap),
            onChange
          ),
    [key, family]
  )
  const getState = useCallback(
    () => (key == null ? DISABLED : (sources.get(key)?.state ?? IDLE)),
    [key]
  )
  const state = useSyncExternalStore(subscribeToKey, getState, getState)
  const retry = useCallback(() => retryAdminSnapshot(key), [key])
  return useMemo(() => ({ ...state, retry }), [state, retry])
}

// Load more for a live list read `count` at a time (`size` = how many the source returned).
// There may be more while the page came back full; the most seen for this count is kept, so a
// deletion that shrinks a full page does not hide the button. While a bigger page loads, or if
// it failed, the button stays (as Loading or Retry).
export function useLoadMore({ source, size, count, pageSize }) {
  const seen = useRef({ count, max: 0 })
  if (seen.current.count !== count) seen.current = { count, max: 0 }
  if (source.data != null && size > seen.current.max) seen.current.max = size
  const askedForMore = count > pageSize
  const failed = askedForMore && !!source.error
  const pending = askedForMore && source.loading
  return { hasMore: failed || pending || seen.current.max >= count, failed }
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
      snap.docs.map((d) => ({ id: d.id, lessonId: d.ref.parent.parent?.id ?? null, ...d.data() })),
    { family: 'recentReports' }
  )
}
