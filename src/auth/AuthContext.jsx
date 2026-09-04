import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth'
import { auth } from '../shared/firebase'

const AuthContext = createContext({ user: null, role: null, loading: true })

// How long to wait for a cross-tab storage-event bounce (#180/#279/#305) to recover
// before treating a reported sign-out as real.
const BOUNCE_RECOVERY_GRACE_MS = 1000

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [role, setRole]       = useState(null)
  const [loading, setLoading] = useState(true)
  const initializedRef        = useRef(false)
  const wasSignedInRef        = useRef(false)

  useEffect(() => {
    let bounceRecoveryTimeout = null

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // A new auth event always supersedes any pending bounce-recovery wait.
      if (bounceRecoveryTimeout) {
        clearTimeout(bounceRecoveryTimeout)
        bounceRecoveryTimeout = null
      }

      if (!firebaseUser && wasSignedInRef.current) {
        // onAuthStateChanged fired null while we had a live session.
        // This is the cross-tab storage-event bounce shape (#180/#279/#305): a
        // localStorage write in another tab (e.g. Firebase's own token refresh)
        // can make the SDK briefly report null before restoring the real user.
        // Hold the loading state and wait; if the user comes back in a subsequent
        // onAuthStateChanged call, cancel the timeout and stay signed in.
        // If not, it's a real sign-out and we redirect after the grace period.
        console.warn('Auth: onAuthStateChanged reported no user for a previously signed-in session — waiting for potential bounce recovery before redirecting.')
        setLoading(true)

        bounceRecoveryTimeout = setTimeout(() => {
          console.warn('Auth: no recovery within grace period — treating as a real sign-out and redirecting to /login.')
          wasSignedInRef.current = false
          setUser(null)
          setRole(null)
          setLoading(false)
          bounceRecoveryTimeout = null
        }, BOUNCE_RECOVERY_GRACE_MS)
        return
      }

      // Only enter loading state on initial resolution, not on periodic token refreshes
      if (!initializedRef.current) setLoading(true)
      try {
        if (firebaseUser) {
          const tokenResult = await getIdTokenResult(firebaseUser, false)
          setUser(firebaseUser)
          setRole(tokenResult.claims.role ?? null)
        } else {
          setUser(null)
          setRole(null)
        }
      } catch (err) {
        if (firebaseUser) {
          // Cached token fetch failed transiently (e.g. cold popup window) — retry once.
          // Do NOT pass forceRefresh=true: it rewrites the persisted auth user even when
          // the cached token was still valid, which fires a storage event in every other
          // open tab and can look like a sign-out there, bouncing it to /login (#180,
          // regressed by the popup retry added for #279). A genuinely expired token still
          // forces its own network refresh with forceRefresh=false, so retrying recovers
          // the cold-cache case without the unconditional cross-tab churn.
          console.warn('Auth: cached ID token fetch failed, retrying with a network refresh:', err)
          try {
            const retryResult = await getIdTokenResult(firebaseUser, false)
            setUser(firebaseUser)
            setRole(retryResult.claims.role ?? null)
          } catch (retryErr) {
            console.error('Auth: ID token retry also failed — signing out and redirecting to /login:', retryErr)
            setUser(null)
            setRole(null)
          }
        } else {
          setUser(null)
          setRole(null)
        }
      } finally {
        wasSignedInRef.current = !!firebaseUser
        initializedRef.current = true
        setLoading(false)
      }
    })

    return () => {
      unsubscribe()
      if (bounceRecoveryTimeout) clearTimeout(bounceRecoveryTimeout)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext
