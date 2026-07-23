import React, { Suspense, lazy } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import LoadingScreen from './app/components/LoadingScreen'

const LessonRoute = lazy(() => import('./app/views/LessonRoute'))
const LandingPage = lazy(() => import('./app/views/LandingPage'))
const CodeFileWorkspace = lazy(() => import('./app/views/CodeFileWorkspace'))
const LoginPage = lazy(() => import('./app/views/LoginPage'))
const AdminPortal = lazy(() => import('./admin/AdminPortal'))
const BuilderApp = lazy(() => import('./builder/App'))
const AccountSettings = lazy(() => import('./auth/AccountSettings'))

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Suspense fallback={<LoadingScreen message="Loading..." />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/account"
              element={
                <ProtectedRoute requiredRole="teacher">
                  <AccountSettings />
                </ProtectedRoute>
              }
            />
            <Route path="/lesson/:lessonId" element={<LessonRoute />} />
            <Route path="/code" element={<CodeFileWorkspace />} />
            <Route
              path="/admin/:tab?/:subtab?"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminPortal />
                </ProtectedRoute>
              }
            />
            <Route path="/builder" element={<BuilderApp />} />
            <Route path="*" element={<LandingPage />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </AuthProvider>
  )
}
