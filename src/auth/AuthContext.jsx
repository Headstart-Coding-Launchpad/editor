import React, { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth'
import { auth } from '../shared/firebase'

const AuthContext = createContext({ user: null, role: null, loading: true })

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [role, setRole]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true)
      try {
        if (firebaseUser) {
          // Force-refresh ensures we pick up custom claim changes (e.g. after setUserRole)
          const tokenResult = await getIdTokenResult(firebaseUser, true)
          setUser(firebaseUser)
          setRole(tokenResult.claims.role ?? null)
        } else {
          setUser(null)
          setRole(null)
        }
      } catch {
        setUser(null)
        setRole(null)
      } finally {
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
