import { useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import StudentView from './StudentView'
import LoadingScreen from '../components/LoadingScreen'
import PlaygroundHelpTopics from '../components/PlaygroundHelpTopics'
import PlaygroundKitChooser from '../components/PlaygroundKitChooser'
import { PLAYGROUND_LESSON_TYPES } from '../../shared/composedLesson'
import { getModuleDefinition, getModuleLabel } from '../../modules/definitions'
import {
  CHOOSER_PATH,
  canSwitchKit,
  getPythonKit,
  hasKitChooser,
  kitPath,
  pythonKitLessonId,
} from '../playgroundKits'

const PLAYGROUND_TYPES = new Set(PLAYGROUND_LESSON_TYPES)

function makeLesson(type, kit = null) {
  // Each playground module declares its one task (lifecycle.playgroundTask in its definition.js).
  // A Python kit swaps in its own starter.
  const baseTask = getModuleDefinition(type).lifecycle.playgroundTask()
  const task = kit
    ? { ...baseTask, title: `${kit.label} playground`, starterCode: kit.starterCode }
    : baseTask

  const playgroundTitle = kit?.label ?? getModuleLabel(type) ?? 'Python'

  return {
    // This is intentionally not a valid lesson ID. Playground work must never
    // share local persistence or a Storage asset folder with a real lesson.
    id: kit ? pythonKitLessonId(kit.id) : `__playground__${type}`,
    isPlayground: true,
    type,
    title: `${playgroundTitle} Playground`,
    description: 'A private, local coding space.',
    tasks: [task],
  }
}

export default function PlaygroundView() {
  const { type } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  // The Python playground opens on the kit chooser until a kit is picked (?kit=<id>).
  const kit = hasKitChooser(type) ? getPythonKit(searchParams.get('kit')) : null
  const showChooser = hasKitChooser(type) && !kit
  const lesson = useMemo(
    () => (PLAYGROUND_TYPES.has(type) && !showChooser ? makeLesson(type, kit) : null),
    [type, kit, showChooser]
  )

  if (showChooser) return <PlaygroundKitChooser onPick={(picked) => navigate(kitPath(picked))} />
  if (!lesson) return <LoadingScreen error="That playground is not available." />

  // Turtle and Arcade are kits in the Python chooser too, so they get Switch kit as well.
  const controls = (
    <>
      {canSwitchKit(type) && (
        <button
          type="button"
          className="btn-ghost"
          style={s.topBarBtn}
          onClick={() => navigate(CHOOSER_PATH)}
        >
          Switch kit
        </button>
      )}
      <PlaygroundHelpTopics type={type} style={s.topBarBtn} />
    </>
  )

  return (
    <StudentView
      // A new kit is a new lesson: remount so nothing carries over from the last one.
      key={lesson.id}
      lessonId={lesson.id}
      lesson={lesson}
      forceSolo
      allowUnrestrictedTaskNavigation
      playgroundControls={controls}
    />
  )
}

const s = {
  topBarBtn: { fontSize: 13, padding: '5px 10px', whiteSpace: 'nowrap', flexShrink: 0 },
}
