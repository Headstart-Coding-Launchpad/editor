import { useState, useEffect, useCallback } from 'react'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { auth } from '../../shared/firebase'

const STORAGE_KEY = 'headstart_identity'
const MAX_SIGN_IN_ATTEMPTS = 3
const RETRY_DELAY_MS = 800

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Retries signInAnonymously a few times with a short, linearly-increasing delay before
// giving up. A blocked/failed anonymous sign-in (privacy settings, an ad blocker, a
// transient network blip) previously fell back to a local-only UUID on the first error —
// that UUID has no backing Firebase Auth session, so every subsequent Realtime Database
// write (which requires auth.uid === $anonymousId) is silently rejected. Retrying first
// gives a transient failure a real chance to resolve before that fallback is taken.
async function signInWithRetry() {
  let lastErr = null
  for (let attempt = 1; attempt <= MAX_SIGN_IN_ATTEMPTS; attempt++) {
    try {
      const cred = await signInAnonymously(auth)
      return cred.user.uid
    } catch (err) {
      lastErr = err
      if (attempt < MAX_SIGN_IN_ATTEMPTS) await wait(RETRY_DELAY_MS * attempt)
    }
  }
  throw lastErr
}

export function useIdentity() {
  const [identity, setIdentity] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [authUid, setAuthUid] = useState(null)
  const [authError, setAuthError] = useState(false)
  const [signInAttempt, setSignInAttempt] = useState(0)

  // Ensure an anonymous Firebase Auth session exists and capture the stable UID.
  // browserLocalPersistence (set in firebase.js) makes this UID persistent across
  // page reloads so it can serve as the stable student key in the Realtime Database.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (user) {
        setAuthUid(user.uid)
        setAuthError(false)
      } else {
        signInWithRetry()
          .then(uid => {
            setAuthUid(uid)
            setAuthError(false)
          })
          .catch(err => {
            console.warn('Anonymous sign-in failed after retries; falling back to local UUID:', err)
            setAuthUid(crypto.randomUUID())
            setAuthError(true)
          })
      }
    })
    return () => unsubscribe()
  }, [signInAttempt])

  // Re-subscribes to auth state, which re-triggers the sign-in (and its retries) above.
  const retrySignIn = useCallback(() => {
    setAuthError(false)
    setSignInAttempt(n => n + 1)
  }, [])

  // Load identity from localStorage once the Firebase UID is known.
  // If the stored anonymousId differs from the Firebase UID (legacy UUID), migrate it
  // so database writes pass the new per-student auth rules.
  useEffect(() => {
    if (authUid == null) return
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (parsed.anonymousId !== authUid) {
          const migrated = { ...parsed, anonymousId: authUid }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
          setIdentity(migrated)
        } else {
          setIdentity(parsed)
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
    setLoaded(true)
  }, [authUid])

  function save(id) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(id))
    setIdentity(id)
  }

  /** Create a fresh identity (new session or first ever visit). */
  function createIdentity(displayName, sessionTimestamp) {
    const id = {
      anonymousId:          authUid,
      displayName,
      lastSessionTimestamp: sessionTimestamp,
    }
    save(id)
    return id
  }

  /** Update only the session timestamp (called after joining an existing session). */
  function updateTimestamp(sessionTimestamp) {
    if (!identity) return
    const updated = { ...identity, lastSessionTimestamp: sessionTimestamp }
    save(updated)
  }

  /** Update only the display name (teacher rename). */
  function updateDisplayName(displayName) {
    if (!identity) return
    const updated = { ...identity, displayName }
    save(updated)
  }

  return { identity, loaded, authError, retrySignIn, createIdentity, updateTimestamp, updateDisplayName }
}
