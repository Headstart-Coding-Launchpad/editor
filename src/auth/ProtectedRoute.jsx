import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import LoadingScreen from '../app/components/LoadingScreen'

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, role, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen message="Checking sign-in…" />

  if (!user || (requiredRole && role !== requiredRole && role !== 'admin')) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }

  return children
}
