import React from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import LessonRoute from './app/views/LessonRoute'
import LandingPage from './app/views/LandingPage'
import LoginPage from './app/views/LoginPage'
import AdminPortal from './admin/AdminPortal'
import BuilderApp from './builder/App'

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/lesson/:lessonId" element={<LessonRoute />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminPortal />
              </ProtectedRoute>
            }
          />
          <Route path="/builder" element={<BuilderApp />} />
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
