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
  // `live=true` is a legacy param from before the smart join flow — bare URLs now
  // auto-join an active/waiting session and prompt solo-vs-wait otherwise, so it's
  // simply ignored (kept out of forceSolo) rather than removed, to avoid breaking
  // already-shared links.
  const forceSolo       = searchParams.get('solo') === 'true'
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

  return <StudentView lessonId={lessonId} forceSolo={forceSolo} />
}
