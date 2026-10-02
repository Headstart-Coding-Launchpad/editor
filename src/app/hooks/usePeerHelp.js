import { useEffect, useRef, useState } from 'react'
import { ref, onValue, set, update, remove, push, get } from 'firebase/database'
import { db } from '../../shared/firebase'
import { isSnapshotWithinLimit } from '../sharedWorkspacePayload'
import { editsFromWire } from '../../shared/peerHelp'
import { decodeHelpSnapshot, encodeHelpSnapshot } from '../peerHelpSnapshot'

// Firebase side of peer help. The data model and what each role may read or write are
// described in src/shared/peerHelp.js and enforced by database.rules.json; every subscription
// here is to a path the rules let that role read, so a denied read is treated as "nothing".
//
// role 'student': the stuck student's own request and the request they are helping with.
// role 'teacher': every request in the lesson, for the review queue and the roster.

// Subscribes to one path and returns its value; a permission-denied read is null.
function useValue(path) {
  const [value, setValue] = useState(null)
  useEffect(() => {
    if (!path) {
      setValue(null)
      return undefined
    }
    return onValue(
      ref(db, path),
      (snap) => setValue(snap.val()),
      () => setValue(null)
    )
  }, [path])
  return path ? value : null
}

export function usePeerHelp({ lessonId, session, identityId, role }) {
  const isStudent = role === 'student' && !!identityId && !!lessonId
  const isTeacher = role === 'teacher' && !!lessonId
  const sessionRef = useRef(session)
  sessionRef.current = session

  // ─── Student: my own request ──────────────────────────────────────────────
  const ownRequest = useValue(isStudent ? `peerHelpRequests/${lessonId}/${identityId}` : null)
  const ownRequestId = ownRequest?.requestId ?? null
  const ownBase = ownRequestId ? `peerHelp/${lessonId}/${ownRequestId}` : null
  const ownState = useValue(ownBase ? `${ownBase}/state` : null)
  const ownInbox = useValue(ownBase ? `${ownBase}/inbox` : null)
  // Their own work as sent, so feedback can show the line it was about.
  const ownSnapshot = useValue(ownBase ? `${ownBase}/snapshot` : null)

  // ─── Student: the request I'm helping with ────────────────────────────────
  const helpingRequestId = useValue(isStudent ? `peerHelpHelping/${lessonId}/${identityId}` : null)
  const helpBase = helpingRequestId ? `peerHelp/${lessonId}/${helpingRequestId}` : null
  const helpingSnapshot = useValue(helpBase ? `${helpBase}/snapshot` : null)
  const helpingState = useValue(helpBase ? `${helpBase}/state` : null)
  const helpingInbox = useValue(helpBase ? `${helpBase}/inbox` : null)
  const helpingReview = useValue(helpBase ? `${helpBase}/review` : null)
  const promisedAt = useValue(isStudent ? `peerHelpPromises/${lessonId}/${identityId}` : null)

  // ─── Teacher: everything ──────────────────────────────────────────────────
  const allRequests = useValue(isTeacher ? `peerHelpRequests/${lessonId}` : null)
  const allPeerHelp = useValue(isTeacher ? `peerHelp/${lessonId}` : null)
  const allRequestsRef = useRef(allRequests)
  allRequestsRef.current = allRequests
  const allPeerHelpRef = useRef(allPeerHelp)
  allPeerHelpRef.current = allPeerHelp
  const requestsLoaded = allRequests != null

  // The stuck student's client answers the helper's "Get latest" with a fresh snapshot.
  const buildSnapshotRef = useRef(null)
  const answeredRefreshRef = useRef(null)
  const refreshAskedAt = ownState?.snapshotRequestedAt ?? null
  useEffect(() => {
    if (!ownBase || !refreshAskedAt || ownState?.endedAt) return
    if (answeredRefreshRef.current === refreshAskedAt) return
    const snapshot = buildSnapshotRef.current?.()
    if (!snapshot || !isSnapshotWithinLimit(snapshot)) return
    answeredRefreshRef.current = refreshAskedAt
    set(ref(db, `${ownBase}/snapshot`), encodeHelpSnapshot(snapshot)).catch(() => {})
  }, [ownBase, refreshAskedAt, ownState?.endedAt])

  // Teacher: a request belongs to the task it was made on. When the class moves on, end every
  // open request from an earlier task and clear the opt-ins.
  const currentTaskId = session?.currentTaskId
  useEffect(() => {
    if (!isTeacher || currentTaskId == null) return
    const s = sessionRef.current
    const updates = {}
    const now = Date.now()
    for (const [requestId, offer] of Object.entries(s?.peerHelpOffers ?? {})) {
      if (offer?.endedAt == null && String(offer?.taskId) !== String(currentTaskId)) {
        updates[`sessions/${lessonId}/peerHelpOffers/${requestId}/endedAt`] = now
        updates[`peerHelp/${lessonId}/${requestId}/state/endedAt`] = now
        updates[`peerHelp/${lessonId}/${requestId}/state/endedBy`] = 'task_changed'
      }
    }
    for (const [studentId, request] of Object.entries(allRequestsRef.current ?? {})) {
      if (request?.taskId != null && String(request.taskId) !== String(currentTaskId)) {
        updates[`peerHelpRequests/${lessonId}/${studentId}`] = null
        const requestId = request.requestId
        if (requestId && updates[`peerHelp/${lessonId}/${requestId}/state/endedAt`] == null) {
          const ended = allPeerHelpRef.current?.[requestId]?.state?.endedAt
          if (ended == null) {
            updates[`peerHelp/${lessonId}/${requestId}/state/endedAt`] = now
            updates[`peerHelp/${lessonId}/${requestId}/state/endedBy`] = 'task_changed'
          }
        }
      }
    }
    if (Object.keys(updates).length) update(ref(db), updates).catch(() => {})
    // Only on a task change (and once the opt-ins have loaded).
  }, [isTeacher, lessonId, currentTaskId, requestsLoaded])

  // ─── Student operations ───────────────────────────────────────────────────

  // ✋ Help with "let a classmate help": the snapshot goes up with the request, so the teacher
  // can look before offering it.
  async function requestPeerHelp(snapshot) {
    if (!isStudent) return null
    if (!isSnapshotWithinLimit(snapshot)) throw new Error('This work is too large to share.')
    const requestId = push(ref(db, `peerHelp/${lessonId}`)).key
    await update(ref(db), {
      [`peerHelp/${lessonId}/${requestId}/stuckId`]: identityId,
      [`peerHelp/${lessonId}/${requestId}/snapshot`]: encodeHelpSnapshot(snapshot),
      [`peerHelpRequests/${lessonId}/${identityId}`]: {
        requestId,
        taskId: snapshot?.taskId ?? sessionRef.current?.currentTaskId ?? null,
        at: Date.now(),
      },
    })
    return requestId
  }

  // The stuck student ends their request (no longer stuck, or "Not OK").
  async function endOwnRequest({ notOk = false } = {}) {
    if (!ownRequestId) return
    const now = Date.now()
    const updates = {}
    if (!ownState?.endedAt) {
      updates[`${ownBase}/state/endedAt`] = now
      updates[`${ownBase}/state/endedBy`] = 'stuck'
    }
    if (notOk) updates[`${ownBase}/state/notOkAt`] = now
    const offer = sessionRef.current?.peerHelpOffers?.[ownRequestId]
    if (offer && offer.endedAt == null) {
      updates[`sessions/${lessonId}/peerHelpOffers/${ownRequestId}/endedAt`] = now
    }
    if (Object.keys(updates).length) await update(ref(db), updates)
    await remove(ref(db, `peerHelpRequests/${lessonId}/${identityId}`))
  }

  async function respondToItem(itemId, response) {
    if (!ownBase) return
    await update(ref(db, `${ownBase}/inbox/${itemId}`), { response, respondedAt: Date.now() })
  }

  // "Not OK": hides the item, alerts the teacher and ends the help.
  async function flagNotOk(itemId) {
    if (!ownBase) return
    if (itemId) await respondToItem(itemId, 'not_ok')
    await endOwnRequest({ notOk: true })
  }

  async function makeHelperPromise() {
    if (!isStudent) return
    await set(ref(db, `peerHelpPromises/${lessonId}/${identityId}`), Date.now())
  }

  // One update: the rules only let the offer be marked claimed by whoever holds helperId.
  async function claimOffer(requestId) {
    if (!isStudent) return false
    try {
      await update(ref(db), {
        [`peerHelp/${lessonId}/${requestId}/helperId`]: identityId,
        [`sessions/${lessonId}/peerHelpOffers/${requestId}/claimedAt`]: Date.now(),
        [`peerHelpHelping/${lessonId}/${identityId}`]: requestId,
      })
      return true
    } catch {
      // Someone else got there first, or the offer ended.
      return false
    }
  }

  function helperItemPath(kind) {
    const node = kind === 'mark' || kind === 'hint' ? 'inbox' : 'review'
    return push(ref(db, `${helpBase}/${node}`))
  }

  async function sendMark({ file = '', line, verdict }) {
    if (!helpBase) return
    await set(helperItemPath('mark'), { kind: 'mark', file, line, verdict, createdAt: Date.now() })
  }

  async function sendHint({ file = '', line, hintId }) {
    if (!helpBase) return
    await set(helperItemPath('hint'), {
      kind: 'hint',
      file,
      ...(line ? { line } : {}),
      hintId,
      createdAt: Date.now(),
    })
  }

  async function submitEdit({ file = '', edits }) {
    if (!helpBase) return
    await set(helperItemPath('edit'), {
      kind: 'edit',
      status: 'pending',
      file,
      edits: Object.fromEntries(
        edits.map((e, i) => [i, { line: e.line, op: e.op, text: e.text, before: e.before ?? '' }])
      ),
      createdAt: Date.now(),
    })
  }

  // blockedReason: the word filter stopped it. It is kept for the teacher, never delivered.
  async function submitNote({ file = '', line, text, blockedReason = null }) {
    if (!helpBase) return
    await set(helperItemPath('note'), {
      kind: 'note',
      status: blockedReason ? 'blocked' : 'pending',
      file,
      line,
      text,
      ...(blockedReason ? { blockedReason } : {}),
      createdAt: Date.now(),
    })
  }

  async function requestLatestSnapshot() {
    if (!helpBase) return
    await set(ref(db, `${helpBase}/state/snapshotRequestedAt`), Date.now())
  }

  async function finishHelping() {
    if (!isStudent) return
    if (helpBase && !helpingState?.endedAt) {
      const now = Date.now()
      const updates = {
        [`${helpBase}/state/endedAt`]: now,
        [`${helpBase}/state/endedBy`]: 'helper',
      }
      const offer = sessionRef.current?.peerHelpOffers?.[helpingRequestId]
      if (offer && offer.endedAt == null) {
        updates[`sessions/${lessonId}/peerHelpOffers/${helpingRequestId}/endedAt`] = now
      }
      await update(ref(db), updates).catch(() => {})
    }
    await remove(ref(db, `peerHelpHelping/${lessonId}/${identityId}`))
  }

  // ─── Teacher operations ───────────────────────────────────────────────────

  async function offerToClass(studentId) {
    const request = allRequests?.[studentId]
    const requestId = request?.requestId
    if (!requestId) return
    const snapshot = allPeerHelp?.[requestId]?.snapshot
    await set(ref(db, `sessions/${lessonId}/peerHelpOffers/${requestId}`), {
      // The session's own value, so the claim rule's taskId === currentTaskId compares like
      // with like.
      taskId: sessionRef.current?.currentTaskId ?? request.taskId,
      lessonType: snapshot?.lessonType ?? '',
      offeredAt: Date.now(),
    })
  }

  async function endRequestAsTeacher(requestId) {
    if (!requestId) return
    const now = Date.now()
    const updates = {}
    if (!allPeerHelp?.[requestId]?.state?.endedAt) {
      updates[`peerHelp/${lessonId}/${requestId}/state/endedAt`] = now
      updates[`peerHelp/${lessonId}/${requestId}/state/endedBy`] = 'teacher'
    }
    const offer = sessionRef.current?.peerHelpOffers?.[requestId]
    if (offer && offer.endedAt == null) {
      updates[`sessions/${lessonId}/peerHelpOffers/${requestId}/endedAt`] = now
    }
    const stuckId = allPeerHelp?.[requestId]?.stuckId
    if (stuckId && allRequests?.[stuckId]?.requestId === requestId) {
      updates[`peerHelpRequests/${lessonId}/${stuckId}`] = null
    }
    if (Object.keys(updates).length) await update(ref(db), updates)
  }

  // "Helped ✓" on a student also ends any peer help they asked for.
  async function endRequestForStudent(studentId) {
    const requestId = allRequests?.[studentId]?.requestId
    if (requestId) await endRequestAsTeacher(requestId)
  }

  async function approveItem(requestId, itemId) {
    const item = allPeerHelp?.[requestId]?.review?.[itemId]
    if (!item || item.status !== 'pending') return
    const now = Date.now()
    const inboxId = push(ref(db, `peerHelp/${lessonId}/${requestId}/inbox`)).key
    const delivered = {
      kind: item.kind,
      file: item.file ?? '',
      ...(item.line ? { line: item.line } : {}),
      ...(item.kind === 'note' ? { text: item.text } : {}),
      ...(item.kind === 'edit' ? { edits: editsFromWire(item.edits) } : {}),
      reviewItemId: itemId,
      createdAt: now,
    }
    await update(ref(db), {
      [`peerHelp/${lessonId}/${requestId}/inbox/${inboxId}`]: delivered,
      [`peerHelp/${lessonId}/${requestId}/review/${itemId}/status`]: 'approved',
      [`peerHelp/${lessonId}/${requestId}/review/${itemId}/decidedAt`]: now,
    })
  }

  async function rejectItem(requestId, itemId) {
    await update(ref(db, `peerHelp/${lessonId}/${requestId}/review/${itemId}`), {
      status: 'rejected',
      decidedAt: Date.now(),
    })
  }

  async function acknowledgeNotOk(requestId) {
    await set(ref(db, `peerHelp/${lessonId}/${requestId}/state/notOkSeenAt`), Date.now())
  }

  async function setNotesEnabled(enabled) {
    await set(ref(db, `sessions/${lessonId}/peerHelpSettings/notesEnabled`), !!enabled)
  }

  async function setHelperOff(studentId, off) {
    await set(ref(db, `sessions/${lessonId}/peerHelperOff/${studentId}`), off ? true : null)
  }

  // "End all peer help": ends every open request and stops new claims until resumed.
  async function pauseAllPeerHelp() {
    const now = Date.now()
    const updates = { [`sessions/${lessonId}/peerHelpSettings/pausedAt`]: now }
    for (const [requestId, offer] of Object.entries(sessionRef.current?.peerHelpOffers ?? {})) {
      if (offer?.endedAt == null)
        updates[`sessions/${lessonId}/peerHelpOffers/${requestId}/endedAt`] = now
    }
    for (const [requestId, request] of Object.entries(allPeerHelp ?? {})) {
      if (!request?.state?.endedAt) {
        updates[`peerHelp/${lessonId}/${requestId}/state/endedAt`] = now
        updates[`peerHelp/${lessonId}/${requestId}/state/endedBy`] = 'teacher'
      }
    }
    updates[`peerHelpRequests/${lessonId}`] = null
    await update(ref(db), updates)
  }

  async function resumePeerHelp() {
    await set(ref(db, `sessions/${lessonId}/peerHelpSettings/pausedAt`), null)
  }

  // One-shot read for the session report.
  async function readPeerHelpForReport() {
    if (!lessonId) return null
    const snap = await get(ref(db, `peerHelp/${lessonId}`))
    return snap.val()
  }

  return {
    // student
    ownRequest,
    ownRequestId,
    ownState,
    ownInbox,
    ownSnapshot: decodeHelpSnapshot(ownSnapshot),
    helpingRequestId,
    helpingSnapshot: decodeHelpSnapshot(helpingSnapshot),
    helpingState,
    helpingInbox,
    helpingReview,
    hasPromised: promisedAt != null,
    setSnapshotBuilder: (fn) => {
      buildSnapshotRef.current = fn
    },
    requestPeerHelp,
    endOwnRequest,
    respondToItem,
    flagNotOk,
    makeHelperPromise,
    claimOffer,
    sendMark,
    sendHint,
    submitEdit,
    submitNote,
    requestLatestSnapshot,
    finishHelping,
    // teacher
    allRequests,
    allPeerHelp,
    offerToClass,
    endRequestAsTeacher,
    endRequestForStudent,
    approveItem,
    rejectItem,
    acknowledgeNotOk,
    setNotesEnabled,
    setHelperOff,
    pauseAllPeerHelp,
    resumePeerHelp,
    readPeerHelpForReport,
  }
}

// Removes every peer help node for a lesson outside the session (new session, ended session).
export async function clearPeerHelpData(lessonId) {
  await Promise.all(
    ['peerHelp', 'peerHelpRequests', 'peerHelpHelping', 'peerHelpPromises'].map((root) =>
      remove(ref(db, `${root}/${lessonId}`)).catch(() => {})
    )
  )
}
