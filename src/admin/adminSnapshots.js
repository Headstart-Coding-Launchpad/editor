// One shared Firestore listener per Admin data source (Firestore cost cuts, Ryan 8 Nov 2026).
// Admin tabs remount their panel on every switch, and each panel used to open its own
// onSnapshot, so every switch downloaded the whole lessons collection and hundreds of large
// session reports again. Here a source (a key) has one listener for every panel that uses it,
// and it stays open for ADMIN_SNAPSHOT_LINGER_MS after the last panel closes, so switching tabs
// and back reads nothing new. Data stays live: other people's edits still arrive.
// A source belongs to the signed-in user: watchAdminSnapshotsAuth follows the app's auth state,
// and any sign-out (button, session expiry, another tab) or a different user drops every cached
// result.
import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, collectionGroup, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { auth, firestore } from '../shared/firebase'
import { decodeLessonFromFirestore } from '../shared/lessonBlocksCodec'

// Short: a lingering lessons listener still bills every lesson edit made elsewhere.
export const ADMIN_SNAPSHOT_LINGER_MS = 2 * 60 * 1000

// Session reports are large (every student's answers), so lists show this many at a time with
// a Load more button.
export const REPORT_PAGE_SIZE = 20

const IDLE = Object.freeze({ data: null, loading: true, error: null })
// A source a panel does not need (key null): nothing to wait for.
// Signed out: no listener (it would be refused and cache a permission error); wait for a user.
const SIGNED_OUT = Object.freeze({ data: null, loading: false, error: null })
const DISABLED = Object.freeze({ data: null, loading: false, error: null })
const sources = new Map()
// The uid the cached sources belong to; undefined until the auth watch first reports.
let ownerUid
let stopAuthWatch = null

function stop(key) {
  const source = sources.get(key)
  if (!source) return
  clearTimeout(source.timer)
  source.unsubscribe?.()
  sources.delete(key)
}

// Drop every listener and cached result (tests).
export function resetAdminSnapshots() {
  for (const key of [...sources.keys()]) stop(key)
  ownerUid = undefined
}

// The signed-in user changed (another user, or nobody). Sources no panel uses are dropped; one a
// mounted panel still uses starts again empty (and waits, with no listener, while nobody is
// signed in) rather than keep the last user's data or orphan the panel.
function changeOwner(uid) {
  for (const [key, source] of [...sources]) {
    if (source.subscribers.size === 0) {
      stop(key)
      continue
    }
    clearTimeout(source.timer)
    source.unsubscribe?.()
    source.unsubscribe = null
    emit(source, IDLE)
    if (uid) listen(source)
  }
}

// Follow the app's Firebase auth state (the same onAuthStateChanged stream AuthContext uses),
// once per page: the Admin shell calls this when it mounts. The first report is the user the
// shell signed in as; after that a different uid, or none, drops the cache.
export function watchAdminSnapshotsAuth() {
  if (stopAuthWatch) return
  stopAuthWatch = onAuthStateChanged(auth, (user) => {
    const uid = user?.uid ?? null
    if (uid === ownerUid) return
    const first = ownerUid === undefined
    ownerUid = uid
    if (first && uid) return
    changeOwner(uid)
  })
}

function emit(source, state) {
  source.state = state
  for (const fn of source.subscribers) fn()
}

function listen(source) {
  source.unsubscribe = onSnapshot(
    source.makeQuery(),
    (snap) => {
      try {
        emit(source, { data: source.mapSnapshot(snap), loading: false, error: null })
      } catch (err) {
        // One malformed doc must not leave every tab loading forever.
        emit(source, { data: source.state.data, loading: false, error: err?.message ?? 'Error' })
      }
    },
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
    source = {
      family,
      state: ownerUid === null ? SIGNED_OUT : IDLE,
      subscribers: new Set(),
      timer: null,
      unsubscribe: null,
    }
    source.makeQuery = makeQuery
    source.mapSnapshot = mapSnapshot
    sources.set(key, source)
  }
  clearTimeout(source.timer)
  source.subscribers.add(onChange)
  if (ownerUid === null) {
    // signed out: stay idle until changeOwner starts it for the next user
  } else if (source.state.error) restart(source)
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
