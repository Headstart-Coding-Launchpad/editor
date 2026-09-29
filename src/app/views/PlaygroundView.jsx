import React, { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import StudentView from './StudentView'
import LoadingScreen from '../components/LoadingScreen'
import { PLAYGROUND_LESSON_TYPES } from '../../shared/composedLesson'
import { getModuleDefinition, getModuleLabel } from '../../modules/definitions'

const PLAYGROUND_TYPES = new Set(PLAYGROUND_LESSON_TYPES)

function makeLesson(type) {
  // Each playground module declares its one task (lifecycle.playgroundTask in its definition.js).
  const task = getModuleDefinition(type).lifecycle.playgroundTask()

  const playgroundTitle = getModuleLabel(type) ?? 'Python'

  return {
    // This is intentionally not a valid lesson ID. Playground work must never
    // share local persistence or a Storage asset folder with a real lesson.
    id: `__playground__${type}`,
    isPlayground: true,
    type,
    title: `${playgroundTitle} Playground`,
    description: 'A private, local coding space.',
    tasks: [task],
  }
}

export default function PlaygroundView() {
  const { type } = useParams()
  const lesson = useMemo(() => (PLAYGROUND_TYPES.has(type) ? makeLesson(type) : null), [type])
  if (!lesson) return <LoadingScreen error="That playground is not available." />
  return (
    <StudentView lessonId={lesson.id} lesson={lesson} forceSolo allowUnrestrictedTaskNavigation />
  )
}
