// Name-hidden share links for exported student work (Firestore `sharedWork/{shareId}`): a
// frozen snapshot of one task's work, publicly readable at `/share/:id` only while it hasn't
// expired (30 days) or been revoked (firestore.rules). Opt-in per export; never carries a
// student name. Pure helpers here; the Firestore calls are in ./shareService.js.

export const SHARE_TTL_DAYS = 30
export const SHARE_TTL_MS = SHARE_TTL_DAYS * 24 * 60 * 60 * 1000
// Firestore documents cap at 1 MiB; the snapshot stays well under it.
export const MAX_SHARE_PAYLOAD_BYTES = 900 * 1024
export const MAX_SHARE_TITLE_LENGTH = 200
export const SHARE_COLLECTION = 'sharedWork'

/** When a link made at `createdAtMs` stops working. */
export function shareExpiryMs(createdAtMs) {
  return createdAtMs + SHARE_TTL_MS
}

/** The payload as stored: a JSON string (Scratch block trees nest deeper than Firestore maps allow). */
export function serializeSharePayload(payload) {
  return JSON.stringify(payload ?? null)
}

/** Bytes the stored payload takes (UTF-8). */
export function sharePayloadBytes(serialized) {
  return new TextEncoder().encode(serialized).length
}

/**
 * Checks a payload fits. `{ ok: true, serialized, bytes }`, or `{ ok: false, bytes, message }`
 * with a message the tutor can read.
 */
export function checkSharePayload(payload) {
  const serialized = serializeSharePayload(payload)
  const bytes = sharePayloadBytes(serialized)
  if (bytes > MAX_SHARE_PAYLOAD_BYTES) {
    const kb = Math.ceil(bytes / 1024)
    return {
      ok: false,
      bytes,
      message: `This work is too big for a share link (${kb} KB; the limit is ${Math.floor(
        MAX_SHARE_PAYLOAD_BYTES / 1024
      )} KB). The downloads still work.`,
    }
  }
  return { ok: true, serialized, bytes }
}

/** A share title: the task title only (never a name), trimmed to the stored limit. */
export function shareTitle(taskTitle) {
  const title = String(taskTitle ?? '').trim() || 'Student work'
  return title.slice(0, MAX_SHARE_TITLE_LENGTH)
}

/** An unguessable document id (22 url-safe characters, ~128 bits). */
export function randomShareId(cryptoImpl = globalThis.crypto) {
  const bytes = new Uint8Array(16)
  cryptoImpl.getRandomValues(bytes)
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let id = ''
  let bits = 0
  let value = 0
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 6) {
      bits -= 6
      id += alphabet[(value >> bits) & 63]
    }
  }
  if (bits > 0) id += alphabet[(value << (6 - bits)) & 63]
  return id
}

function toMillis(value) {
  if (value == null) return null
  if (typeof value === 'number') return value
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return null
}

/** Whether a stored share still shows: not revoked and not past its expiry. */
export function isShareLive(doc, nowMs = Date.now()) {
  if (!doc || doc.revoked) return false
  const expires = toMillis(doc.expiresAt)
  return expires != null && expires > nowMs
}

/** 'live' | 'expired' | 'revoked', for the Admin list. */
export function shareStatus(doc, nowMs = Date.now()) {
  if (doc?.revoked) return 'revoked'
  return isShareLive(doc, nowMs) ? 'live' : 'expired'
}

/** Whole days left on a live link (0 on its last day), or null. */
export function shareDaysLeft(doc, nowMs = Date.now()) {
  const expires = toMillis(doc?.expiresAt)
  if (expires == null || expires <= nowMs) return null
  return Math.floor((expires - nowMs) / (24 * 60 * 60 * 1000))
}

/** The public URL of a share (HashRouter, like every app route). */
export function shareUrl(shareId, { origin = globalThis.location?.origin ?? '', base = '/' } = {}) {
  return `${origin}${base.replace(/\/?$/, '/')}#/share/${encodeURIComponent(shareId)}`
}

/** Parses a stored payload string; null when it is missing or broken. */
export function parseSharePayload(serialized) {
  if (typeof serialized !== 'string' || !serialized) return null
  try {
    return JSON.parse(serialized)
  } catch {
    return null
  }
}
