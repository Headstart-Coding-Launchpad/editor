import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth'
import { auth } from '../shared/firebase'

const AuthContext = createContext({ user: null, role: null, loading: true })

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [role, setRole]       = useState(null)
  const [loading, setLoading] = useState(true)
  const initializedRef        = useRef(false)

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
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
      } catch {
        if (firebaseUser) {
          // Cached token fetch failed — retry with a network refresh before giving up.
          // This covers new popup windows where the in-memory token cache is cold.
          try {
            const retryResult = await getIdTokenResult(firebaseUser, true)
            setUser(firebaseUser)
            setRole(retryResult.claims.role ?? null)
          } catch {
            setUser(null)
            setRole(null)
          }
        } else {
          setUser(null)
          setRole(null)
        }
      } finally {
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
