import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth'
import { auth } from '../shared/firebase'

const AuthContext = createContext({ user: null, role: null, loading: true })

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [role, setRole]       = useState(null)
  const [loading, setLoading] = useState(true)
  const initializedRef        = useRef(false)
  const wasSignedInRef        = useRef(false)

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      // Only enter loading state on initial resolution, not on periodic token refreshes
      if (!initializedRef.current) setLoading(true)
      if (!firebaseUser && wasSignedInRef.current) {
        // No exception was thrown here — Firebase itself reported the user as signed
        // out. This is the shape of the cross-tab storage-event bounce (#180/#279/#305):
        // a localStorage write in another tab makes this tab's SDK briefly believe the
        // user signed out. Logging it lets us tell that case apart from a real sign-out.
        console.warn('Auth: onAuthStateChanged reported no user for a previously signed-in session — redirecting to /login.')
      }
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
  }, [])

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext
