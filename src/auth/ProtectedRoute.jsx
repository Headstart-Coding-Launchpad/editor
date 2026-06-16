import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import LoadingScreen from '../app/components/LoadingScreen'

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, role, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen message="Checking sign-in…" />

  if (!user || (requiredRole && role !== requiredRole && role !== 'admin')) {
    const reason = !user ? 'no signed-in user' : `role "${role ?? 'none'}" does not satisfy required role "${requiredRole}"`
    console.warn(`ProtectedRoute: redirecting ${location.pathname} to /login (${reason}).`)
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }

  return children
}
