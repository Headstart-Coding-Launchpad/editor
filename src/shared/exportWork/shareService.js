// Firestore calls for share links (`sharedWork/{shareId}`; see ./shareLink.js and
// firestore.rules). Teachers and admins create and revoke; anyone may read a live link.
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { firestore } from '../firebase'
import {
  SHARE_COLLECTION,
  checkSharePayload,
  isShareLive,
  parseSharePayload,
  randomShareId,
  shareExpiryMs,
  shareTitle,
} from './shareLink.js'

/**
 * Freezes one task's work as a share link. Returns `{ ok: true, id, expiresAtMs }`, or
 * `{ ok: false, message }` when the payload is too big (nothing is written then).
 */
export async function createShareLink({ kind, title, payload, uid }) {
  const checked = checkSharePayload(payload)
  if (!checked.ok) return { ok: false, message: checked.message }
  const id = randomShareId()
  const expiresAtMs = shareExpiryMs(Date.now())
  await setDoc(doc(firestore, SHARE_COLLECTION, id), {
    createdAt: serverTimestamp(),
    createdBy: uid,
    expiresAt: Timestamp.fromMillis(expiresAtMs),
    revoked: false,
    kind,
    title: shareTitle(title),
    payload: checked.serialized,
  })
  return { ok: true, id, expiresAtMs }
}

/** Revokes a link: the public page stops showing it at once (the rule checks `revoked`). */
export async function revokeShareLink(id) {
  await updateDoc(doc(firestore, SHARE_COLLECTION, id), {
    revoked: true,
    revokedAt: serverTimestamp(),
  })
}

/**
 * Loads a link for the public viewer: `{ status: 'live', kind, title, payload, expiresAt }`,
 * or `{ status: 'gone' }` when it is missing, expired or revoked (the rules refuse those reads
 * for anyone but staff, so a refusal is "gone" too).
 */
export async function loadShareLink(id) {
  try {
    const snap = await getDoc(doc(firestore, SHARE_COLLECTION, id))
    if (!snap.exists()) return { status: 'gone' }
    const data = snap.data()
    if (!isShareLive(data)) return { status: 'gone' }
    const payload = parseSharePayload(data.payload)
    if (!payload) return { status: 'gone' }
    return {
      status: 'live',
      kind: data.kind,
      title: data.title,
      payload,
      expiresAt: data.expiresAt,
    }
  } catch (error) {
    if (error?.code === 'permission-denied') return { status: 'gone' }
    throw error
  }
}

/** The newest share links (Admin portal), without their payloads. */
export async function listShareLinks(max = 200) {
  const snap = await getDocs(
    query(collection(firestore, SHARE_COLLECTION), orderBy('createdAt', 'desc'), limit(max))
  )
  return snap.docs.map((d) => {
    const { payload, ...rest } = d.data()
    return { id: d.id, ...rest, payloadBytes: typeof payload === 'string' ? payload.length : 0 }
  })
}
