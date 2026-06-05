import React from 'react'
import { useParams, useSearchParams, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import TeacherView from './TeacherView'
import StudentView from './StudentView'
import LoadingScreen from '../components/LoadingScreen'

export default function LessonRoute() {
  const { lessonId }    = useParams()
  const [searchParams]  = useSearchParams()
  const location        = useLocation()
  const isTeacher       = searchParams.get('teacher') === 'true'
  const isLive          = searchParams.get('live') === 'true'
  const isPresent       = searchParams.get('present') === 'true'
  const { user, role, loading } = useAuth()

  if (isTeacher) {
    if (loading) return <LoadingScreen message="Checking sign-in…" />
    const isAuthorised = user && (role === 'teacher' || role === 'admin')
    if (!isAuthorised) {
      const redirect = encodeURIComponent(location.pathname + location.search)
      return <Navigate to={`/login?redirect=${redirect}`} replace />
    }
    if (isPresent) return <StudentView lessonId={lessonId} teacherPresentation />
    return <TeacherView lessonId={lessonId} />
  }

  return <StudentView lessonId={lessonId} soloMode={!isLive} />
}
