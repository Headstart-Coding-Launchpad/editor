const { initializeApp } = require('firebase-admin/app')
const { getAuth }       = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { onCall, HttpsError } = require('firebase-functions/v2/https')

initializeApp()

function requireAdmin(auth) {
  if (!auth || auth.token.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Admin access required.')
  }
}

// Creates a new auth user, sets the custom role claim, and mirrors the account to Firestore.
exports.createAccount = onCall(async ({ data, auth }) => {
  requireAdmin(auth)
  const { email, password, role, displayName } = data
  if (!email || !password || !['teacher', 'admin'].includes(role)) {
    throw new HttpsError('invalid-argument', 'email, password, and a valid role are required.')
  }
  const user = await getAuth().createUser({ email, password, displayName: displayName ?? '' })
  await getAuth().setCustomUserClaims(user.uid, { role })
  await getFirestore().collection('users').doc(user.uid).set({
    email,
    displayName: displayName ?? '',
    role,
    disabled: false,
    createdAt: FieldValue.serverTimestamp(),
  })
  return { uid: user.uid }
})

// Updates the custom role claim on an existing user and syncs Firestore.
exports.setUserRole = onCall(async ({ data, auth }) => {
  requireAdmin(auth)
  const { uid, role } = data
  if (!uid || !['teacher', 'admin'].includes(role)) {
    throw new HttpsError('invalid-argument', 'uid and a valid role are required.')
  }
  await getAuth().setCustomUserClaims(uid, { role })
  await getFirestore().collection('users').doc(uid).update({ role })
})

// Disables an auth account and marks it as disabled in Firestore.
exports.disableAccount = onCall(async ({ data, auth }) => {
  requireAdmin(auth)
  const { uid } = data
  if (!uid) throw new HttpsError('invalid-argument', 'uid is required.')
  if (uid === auth.uid) {
    throw new HttpsError('invalid-argument', 'Cannot disable your own account.')
  }
  await getAuth().updateUser(uid, { disabled: true })
  await getFirestore().collection('users').doc(uid).update({ disabled: true })
})

// Re-enables a previously disabled account.
exports.enableAccount = onCall(async ({ data, auth }) => {
  requireAdmin(auth)
  const { uid } = data
  if (!uid) throw new HttpsError('invalid-argument', 'uid is required.')
  await getAuth().updateUser(uid, { disabled: false })
  await getFirestore().collection('users').doc(uid).update({ disabled: false })
})

// Permanently deletes an auth account and its Firestore document.
exports.deleteAccount = onCall(async ({ data, auth }) => {
  requireAdmin(auth)
  const { uid } = data
  if (!uid) throw new HttpsError('invalid-argument', 'uid is required.')
  if (uid === auth.uid) {
    throw new HttpsError('invalid-argument', 'Cannot delete your own account.')
  }
  await getAuth().deleteUser(uid)
  await getFirestore().collection('users').doc(uid).delete()
})
