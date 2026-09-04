import React, { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import StudentView from './StudentView'
import LoadingScreen from '../components/LoadingScreen'
import { DEFAULT_CIRCUIT, cloneCircuit } from '../../modules/electronics/circuit'

const PLAYGROUND_TYPES = new Set(['python', 'arcade', 'electronics'])

function makeLesson(type) {
  const task =
    type === 'arcade'
      ? {
          id: 1,
          title: 'Arcade playground',
          starterCode:
            'from headstart_arcade import game, Sprite, keys\n\n# Write your game here.\n\ngame.run()\n',
          arcadeTools: 'both',
        }
      : type === 'electronics'
        ? {
            id: 1,
            title: 'Electronics playground',
            starterCircuit: cloneCircuit(DEFAULT_CIRCUIT),
            microcontroller: { enabled: false, boardType: null, starterCode: '' },
          }
        : {
            id: 1,
            title: 'Python playground',
            starterCode: '',
          }

  return {
    // This is intentionally not a valid lesson ID. Playground work must never
    // share local persistence or a Storage asset folder with a real lesson.
    id: `__playground__${type}`,
    isPlayground: true,
    type,
    title: `${type === 'arcade' ? 'Arcade Kit' : type === 'electronics' ? 'Electronics' : 'Python'} Playground`,
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
