import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TurtlePicture from './TurtlePicture.jsx'
import {
  buildCourseWorld,
  courseMapsShown,
  describeCourse,
  getTaskCourse,
  readStudentMapFromCode,
  vehicleName,
} from './course.js'
import { courseMarksAt, drawCourseMap, drawCourseTop } from './drawCourse.js'
import { readCourseResult } from './courseRun.js'
import { createTurtleState } from './engine.js'
import { prefersReducedMotion } from '../../shared/motion.js'

// A course plays slower than a drawing (real turtle's speed 1 when the code sets no speed), so
// each move can be followed; a long run is still squeezed to finish within 30 seconds.
const COURSE_TIMELINE = { defaultSpeed: 1, maxMs: 30000 }

const MOTION_WORDS = {
  turtle: 'moving',
  car: 'driving',
  rover: 'driving',
  boat: 'sailing',
  drone: 'flying',
}

/**
 * The Turtle picture for a task: a plain TurtlePicture, or for a course task (task.course,
 * ./course.js) the map with the vehicle on it. Takes TurtlePicture's props plus `task`.
 *
 * Course mode:
 * - The map is drawn under the drawing (the trail); pickups, the crash mark and the vehicle on
 *   top (./drawCourse.js).
 * - With several maps, a new Run plays each map in turn (Skip skips the one playing); a tab per
 *   map (44 px) shows a tick or cross once that map has played, and picks a map to watch again.
 * - What happened (a crash, the goal reached) is shown and announced (a polite live region); the
 *   canvas's words describe the vehicle, pickups and goal.
 * - A result with no course part (a slow-mo step, a scrub preview) is drawn on map 1.
 * - Student-made maps (course.studentMap, turtle.course_map): a run on the student's own map
 *   shows that map (the run's `studentMap` text). With no run yet, or a slow-mo step, the usable
 *   map in `code` (the student's code, optional) is shown, so a maze shows as soon as it's drawn.
 */
export default function CoursePicture({ task, code = null, ...props }) {
  const courseField = task?.course
  const course = useMemo(() => getTaskCourse({ course: courseField }), [courseField])
  const previewMap = useMemo(
    () => (course?.studentMap && code ? readStudentMapFromCode(code, course.vehicle) : null),
    [course, code]
  )
  if (!course) return <TurtlePicture {...props} />
  return <CourseView course={course} previewMap={previewMap} {...props} />
}

function mapOutcome(map) {
  if (!map) return null
  if (map.status === 'not_run') return 'not_run'
  return map.goalReached && !map.crashed ? 'pass' : 'fail'
}

function outcomeWords(map, name) {
  if (!map) return ''
  if (map.status === 'not_run')
    return 'Not run: the program stopped with an error on an earlier map.'
  if (map.crashed) return map.crash?.message || `The ${name} crashed.`
  if (map.stopped && map.message) return map.message
  if (map.status === 'error') return 'The program stopped with an error.'
  if (map.goalReached) return `The ${name} reached the goal!`
  return `The ${name} finished away from the goal.`
}

function CourseView({
  course,
  previewMap = null,
  result,
  animate = true,
  onPlayingChange,
  style,
  canvasStyle,
  children,
}) {
  const name = vehicleName(course.vehicle)
  const courseResult = readCourseResult(result)
  // The task's maps, or the student's own (course.studentMap).
  const shownMaps = useMemo(
    () => courseMapsShown(course, courseResult, previewMap),
    [course, courseResult, previewMap]
  )
  const mapsKey = shownMaps.studentMap ? JSON.stringify(shownMaps.maps) : null
  const worlds = useMemo(
    () => shownMaps.maps.map((map) => buildCourseWorld(course.type, map, course.vehicle)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt only when the maps change
    [course, mapsKey]
  )
  const count = worlds.length
  const maps = useMemo(() => {
    if (courseResult) return courseResult.maps
    if (result) return [{ commands: result.commands ?? [], state: result.state ?? null }]
    return []
  }, [courseResult, result])
  const runId = result?.runId ?? null

  const [shown, setShown] = useState(0)
  const [revealed, setRevealed] = useState(count)
  const [sequence, setSequence] = useState(false)
  const [replay, setReplay] = useState(0)
  const [picturePlaying, setPicturePlaying] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [handledRunId, setHandledRunId] = useState(runId)

  // A new Run: play the maps from the first (or, with no animation, show them all at once).
  if (runId !== handledRunId) {
    setHandledRunId(runId)
    if (runId != null) {
      if (animate && !prefersReducedMotion()) {
        setShown(0)
        setRevealed(0)
        setSequence(true)
      } else {
        const firstMiss = maps.findIndex((map) => mapOutcome(map) !== 'pass')
        setShown(firstMiss >= 0 ? firstMiss : 0)
        setRevealed(count)
        setSequence(false)
      }
    }
  }

  // A drawing with no course part (slow-mo, a scrub preview) is map 1's.
  const index = result && !courseResult ? 0 : Math.min(shown, Math.max(0, count - 1))
  const world = worlds[index] ?? null
  const map = maps[index] ?? null
  const start = world && !world.error ? world.start : { x: 0, y: 0, heading: 0 }
  const pictureRunId = runId != null ? `${runId}:${index}:${replay}` : null
  const pictureResult = useMemo(
    () => ({
      commands: map?.commands ?? [],
      state: {
        ...createTurtleState(),
        x: start.x,
        y: start.y,
        heading: start.heading,
        ...(map?.state ?? {}),
      },
      ...(pictureRunId ? { runId: pictureRunId } : {}),
    }),
    [map, start.x, start.y, start.heading, pictureRunId]
  )

  // The player keeps one drawMarker / drawUnderlay for its canvas: they read the map shown now.
  const worldRef = useRef(world)
  const commandsRef = useRef(pictureResult.commands)
  worldRef.current = world
  commandsRef.current = pictureResult.commands
  const drawMarker = useCallback(
    (ctx, pose, transform, frame) =>
      drawCourseTop(ctx, worldRef.current, commandsRef.current, pose, transform, frame),
    []
  )
  const drawUnderlay = useCallback(
    (ctx, transform) => drawCourseMap(ctx, worldRef.current, transform),
    []
  )

  const revealedCount = sequence ? revealed : count
  const isRevealed = (i) => i < revealedCount
  const label = (i) => (count > 1 ? `Map ${i + 1}` : '')
  const ownMap = shownMaps.studentMap
  // What happened on a map, announced once each time it is shown after a Run.
  const lastAnnouncedRef = useRef(null)
  const announce = useCallback(
    (i) => {
      if (!courseResult || runId == null) return
      const key = `${runId}:${i}:${replay}`
      if (lastAnnouncedRef.current === key) return
      lastAnnouncedRef.current = key
      const words = outcomeWords(maps[i], name)
      if (words) setAnnouncement(count > 1 ? `Map ${i + 1}: ${words}` : words)
    },
    [courseResult, runId, replay, maps, name, count]
  )

  // A map finished playing (or was skipped): announce it and, in a Run's sequence, tick it off
  // and play the next.
  const handleFrame = useCallback(
    (frame) => {
      if (!frame?.finished) return
      announce(index)
      if (!sequence) return
      setRevealed((value) => Math.max(value, index + 1))
      if (index < count - 1) setShown(index + 1)
      else setSequence(false)
    },
    [sequence, index, count, announce]
  )

  // Nothing plays (no animation, reduced motion): announce the map shown straight away.
  useEffect(() => {
    if (animate && !prefersReducedMotion()) return
    announce(index)
  }, [animate, index, announce])

  const busy = sequence || picturePlaying
  useEffect(() => {
    onPlayingChange?.(busy)
  }, [busy, onPlayingChange])
  useEffect(() => () => onPlayingChange?.(false), [onPlayingChange])

  function pickMap(i) {
    setSequence(false)
    setShown(i)
    if (runId != null) setReplay((value) => value + 1)
  }

  const collected = courseMarksAt(pictureResult.commands).collected.size
  const showOutcome = courseResult && map && isRevealed(index) && !picturePlaying
  const description = world?.error
    ? `This course map can't be shown: ${world.error}.`
    : describeCourse(
        world,
        { ...pictureResult.state },
        {
          collected,
          mapLabel: count > 1 ? `Map ${index + 1} of ${count}` : ownMap ? 'Your map' : '',
          outcome: showOutcome ? { ...map, message: map.crash?.message ?? map.message } : null,
        }
      )
  const banner = world?.error
    ? `This course map can't be shown: ${world.error}.`
    : showOutcome
      ? outcomeWords(map, name)
      : ''
  const bannerTone = !showOutcome ? 'info' : mapOutcome(map) === 'pass' ? 'good' : 'bad'

  return (
    <TurtlePicture
      result={pictureResult}
      animate={animate}
      onPlayingChange={setPicturePlaying}
      drawMarker={drawMarker}
      drawUnderlay={drawUnderlay}
      timelineOptions={COURSE_TIMELINE}
      onFrame={handleFrame}
      description={description}
      playingMessage={`The ${name} is ${MOTION_WORDS[course.vehicle] ?? 'moving'}.`}
      style={style}
      canvasStyle={canvasStyle}
    >
      <div style={s.overlay} className="turtle-course-overlay">
        {count > 1 && (
          <div style={s.tabs} role="group" aria-label="Maps">
            {worlds.map((_, i) => {
              const outcome = courseResult && isRevealed(i) ? mapOutcome(maps[i]) : null
              const mark = outcome === 'pass' ? '✓' : outcome === 'fail' ? '✕' : outcome ? '–' : ''
              const state =
                outcome === 'pass'
                  ? 'reached the goal'
                  : outcome === 'fail'
                    ? maps[i]?.crashed
                      ? 'crashed'
                      : 'did not reach the goal'
                    : outcome === 'not_run'
                      ? 'not run'
                      : 'not played yet'
              return (
                <button
                  key={i}
                  type="button"
                  style={{
                    ...s.tab,
                    ...(i === index ? s.tabShown : null),
                    ...(outcome === 'pass' ? s.tabPass : outcome === 'fail' ? s.tabFail : null),
                  }}
                  aria-pressed={i === index}
                  aria-label={`${label(i)}: ${state}`}
                  title={`${label(i)}: ${state}`}
                  onClick={() => pickMap(i)}
                >
                  {label(i)}
                  {mark && (
                    <span aria-hidden="true" style={s.mark}>
                      {mark}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
        {banner && (
          <div
            style={{
              ...s.banner,
              ...(bannerTone === 'good' ? s.bannerGood : bannerTone === 'bad' ? s.bannerBad : null),
            }}
            aria-hidden="true"
          >
            {bannerTone === 'good' ? '🏁 ' : bannerTone === 'bad' ? '💥 ' : ''}
            {banner}
          </div>
        )}
      </div>
      <span style={s.srOnly} role="status" aria-live="polite">
        {announcement}
      </span>
      {children}
    </TurtlePicture>
  )
}

const s = {
  overlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
    pointerEvents: 'none',
  },
  tabs: { display: 'flex', flexWrap: 'wrap', gap: 6, pointerEvents: 'auto' },
  tab: {
    minHeight: 44,
    minWidth: 44,
    padding: '6px 12px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 14,
    fontWeight: 700,
    fontFamily: 'var(--font-body)',
    color: '#1f2937',
    background: '#fff',
    border: '2px solid #cbd5e1',
    borderRadius: 8,
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
  },
  tabShown: { borderColor: '#1f2937' },
  tabPass: { background: '#dcfce7', color: '#14532d' },
  tabFail: { background: '#fee2e2', color: '#7f1d1d' },
  mark: { fontSize: 16, lineHeight: 1 },
  banner: {
    maxWidth: '100%',
    padding: '6px 10px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: 'var(--font-body)',
    color: '#1f2937',
    background: 'rgba(255, 255, 255, 0.94)',
    border: '1px solid #cbd5e1',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
  },
  bannerGood: { borderColor: '#15803d', color: '#14532d' },
  bannerBad: { borderColor: '#b91c1c', color: '#7f1d1d' },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    whiteSpace: 'nowrap',
  },
}
