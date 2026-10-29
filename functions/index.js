const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { normaliseHandle } = require('./handles')

initializeApp()

// Same database id as the app (VITE_FIRESTORE_DATABASE_ID); see docs/architecture/firestore-europe-plan.md.
const db = () => getFirestore(process.env.FIRESTORE_DATABASE_ID || 'london')

// A tutor handle is unique across accounts (their links and room are theirs alone).
async function assertHandleFree(handle, exceptUid) {
  const taken = await db().collection('users').where('handle', '==', handle).get()
  if (taken.docs.some((doc) => doc.id !== exceptUid)) {
    throw new HttpsError('already-exists', `The handle "${handle}" is already used.`)
  }
}

// What `handle` means for the request: '' = none given, a handle, or an invalid-argument error.
function handleOf(data) {
  if (data.handle == null || String(data.handle).trim() === '') return ''
  const handle = normaliseHandle(data.handle)
  if (!handle) {
    throw new HttpsError(
      'invalid-argument',
      'A handle is 2 to 20 lower-case letters or numbers, no spaces.'
    )
  }
  return handle
}

function requireAdmin(auth) {
  if (!auth || auth.token.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Admin access required.')
  }
}

const SA = 'firebase-adminsdk-fbsvc@headstartcoding-repl.iam.gserviceaccount.com'

// Creates a new auth user, sets the custom role claim, and mirrors the account to Firestore.
exports.createAccount = onCall(
  { region: 'europe-west1', invoker: 'public', serviceAccount: SA },
  async ({ data, auth }) => {
    requireAdmin(auth)
    const { email, password, role, displayName } = data
    const handle = handleOf(data)
    if (!email || !password || password.length < 8 || !['teacher', 'admin'].includes(role)) {
      throw new HttpsError(
        'invalid-argument',
        'email, password (min 8 chars), and a valid role are required.'
      )
    }
    if (handle) await assertHandleFree(handle, null)
    const user = await getAuth().createUser({ email, password, displayName: displayName ?? '' })
    await getAuth().setCustomUserClaims(user.uid, { role, ...(handle ? { handle } : {}) })
    try {
      await db()
        .collection('users')
        .doc(user.uid)
        .set({
          email,
          displayName: displayName ?? '',
          role,
          ...(handle ? { handle } : {}),
          disabled: false,
          createdAt: FieldValue.serverTimestamp(),
        })
    } catch (err) {
      // Roll back the Auth user so state stays consistent and the admin can retry.
      await getAuth()
        .deleteUser(user.uid)
        .catch(() => {})
      throw new HttpsError(
        'internal',
        'Failed to write user record to Firestore; Auth account has been rolled back.'
      )
    }
    return { uid: user.uid }
  }
)

// Updates the custom role claim on an existing user and syncs Firestore.
exports.setUserRole = onCall(
  { region: 'europe-west1', invoker: 'public', serviceAccount: SA },
  async ({ data, auth }) => {
    requireAdmin(auth)
    const { uid, role } = data
    if (!uid || !['teacher', 'admin'].includes(role)) {
      throw new HttpsError('invalid-argument', 'uid and a valid role are required.')
    }
    // Keep the tutor's handle: setCustomUserClaims replaces every claim.
    const existing = (await getAuth().getUser(uid)).customClaims ?? {}
    await getAuth().setCustomUserClaims(uid, {
      role,
      ...(existing.handle ? { handle: existing.handle } : {}),
    })
    // Stop the old claim: sessions made with it can't refresh past their current token.
    await getAuth().revokeRefreshTokens(uid)
    await db().collection('users').doc(uid).update({ role })
  }
)

// Sets (or clears, with an empty handle) a tutor's handle claim and mirrors it to Firestore.
// The tutor's next sign-in (or token refresh) picks it up, so their tokens are revoked.
exports.setUserHandle = onCall(
  { region: 'europe-west1', invoker: 'public', serviceAccount: SA },
  async ({ data, auth }) => {
    requireAdmin(auth)
    const { uid } = data
    if (!uid) throw new HttpsError('invalid-argument', 'uid is required.')
    const handle = handleOf(data)
    if (handle) await assertHandleFree(handle, uid)
    const existing = (await getAuth().getUser(uid)).customClaims ?? {}
    const { handle: _old, ...rest } = existing
    await getAuth().setCustomUserClaims(uid, { ...rest, ...(handle ? { handle } : {}) })
    await getAuth().revokeRefreshTokens(uid)
    await db()
      .collection('users')
      .doc(uid)
      .update({ handle: handle || FieldValue.delete() })
    return { handle }
  }
)

// Disables an auth account and marks it as disabled in Firestore.
exports.disableAccount = onCall(
  { region: 'europe-west1', invoker: 'public', serviceAccount: SA },
  async ({ data, auth }) => {
    requireAdmin(auth)
    const { uid } = data
    if (!uid) throw new HttpsError('invalid-argument', 'uid is required.')
    if (uid === auth.uid) {
      throw new HttpsError('invalid-argument', 'Cannot disable your own account.')
    }
    await getAuth().updateUser(uid, { disabled: true })
    await getAuth().revokeRefreshTokens(uid)
    await db().collection('users').doc(uid).update({ disabled: true })
  }
)

// Re-enables a previously disabled account.
exports.enableAccount = onCall(
  { region: 'europe-west1', invoker: 'public', serviceAccount: SA },
  async ({ data, auth }) => {
    requireAdmin(auth)
    const { uid } = data
    if (!uid) throw new HttpsError('invalid-argument', 'uid is required.')
    await getAuth().updateUser(uid, { disabled: false })
    await db().collection('users').doc(uid).update({ disabled: false })
  }
)

// Permanently deletes an auth account and its Firestore document.
exports.deleteAccount = onCall(
  { region: 'europe-west1', invoker: 'public', serviceAccount: SA },
  async ({ data, auth }) => {
    requireAdmin(auth)
    const { uid } = data
    if (!uid) throw new HttpsError('invalid-argument', 'uid is required.')
    if (uid === auth.uid) {
      throw new HttpsError('invalid-argument', 'Cannot delete your own account.')
    }
    // Delete Firestore document first — if it fails, the Auth user still exists and the op is retryable.
    await db().collection('users').doc(uid).delete()
    await getAuth().deleteUser(uid)
  }
)

// Allows an admin to set another account's password. Users change their own
// password through Firebase Auth on the client so recent-login checks apply.
exports.updateAccountPassword = onCall(
  { region: 'europe-west1', invoker: 'public', serviceAccount: SA },
  async ({ data, auth }) => {
    requireAdmin(auth)
    const { uid, password } = data
    if (!uid || !password || password.length < 8) {
      throw new HttpsError('invalid-argument', 'uid and password (min 8 chars) are required.')
    }
    if (uid === auth.uid) {
      throw new HttpsError('invalid-argument', 'Use account settings to change your own password.')
    }
    await getAuth().updateUser(uid, { password })
  }
)

// Data retention (Hub #303): daily at 03:00 UK time. Dry run for now: it counts what is past
// its limit and writes the counts to retentionLog/{date}; see functions/retention.js.
const { onSchedule } = require('firebase-functions/v2/scheduler')
const retention = require('./retention.js')

exports.retentionSweep = onSchedule(
  { schedule: '0 3 * * *', timeZone: 'Europe/London', region: 'europe-west1', serviceAccount: SA },
  async () => {
    const now = Date.now()
    const counts = await retention.sweep(db(), now)
    const day = new Date(now).toISOString().slice(0, 10)
    await db()
      .collection('retentionLog')
      .doc(day)
      .set({ at: FieldValue.serverTimestamp(), dryRun: !retention.DELETE, counts })
  }
)
