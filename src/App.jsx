import React, { Suspense, lazy } from 'react'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import LoadingScreen from './app/components/LoadingScreen'
import RenderErrorBoundary from './app/components/RenderErrorBoundary'
import { isStaffRoute } from './shared/staffRoute'

const LessonRoute = lazy(() => import('./app/views/LessonRoute'))
const LandingPage = lazy(() => import('./app/views/LandingPage'))
const RoomRoute = lazy(() => import('./app/views/RoomRoute'))
const CodeFileWorkspace = lazy(() => import('./app/views/CodeFileWorkspace'))
const PlaygroundView = lazy(() => import('./app/views/PlaygroundView'))
const SharedWorkView = lazy(() => import('./app/views/SharedWorkView'))
const LoginPage = lazy(() => import('./app/views/LoginPage'))
const AdminPortal = lazy(() => import('./admin/AdminPortal'))
const BuilderApp = lazy(() => import('./builder/App'))
const AccountSettings = lazy(() => import('./auth/AccountSettings'))
const ShotView = lazy(() => import('./app/views/ShotView'))

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <RouteErrorBoundary>
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
              <Route path="/room/:handle" element={<RoomRoute />} />
              <Route path="/code" element={<CodeFileWorkspace />} />
              <Route path="/playground/:type" element={<PlaygroundView />} />
              <Route path="/share/:id" element={<SharedWorkView />} />
              <Route
                path="/admin/:tab?/:subtab?"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminPortal />
                  </ProtectedRoute>
                }
              />
              <Route path="/builder" element={<BuilderApp />} />
              <Route path="/shot" element={<ShotView />} />
              <Route path="*" element={<LandingPage />} />
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </HashRouter>
    </AuthProvider>
  )
}

// The last catch for a render error (R2): the page shows a Try again card instead of going blank,
// and moving to another page clears it. Staff pages (isStaffRoute: admin, builder, the tutor
// lesson window, presentation, preview) get the plain tutor card; every other page can be a
// child's, so it gets the child card.
function RouteErrorBoundary({ children }) {
  const { pathname, search } = useLocation()
  return (
    <RenderErrorBoundary
      label="This page"
      variant={isStaffRoute(pathname, search) ? 'tutor' : 'child'}
      resetKey={pathname}
    >
      {children}
    </RenderErrorBoundary>
  )
}
