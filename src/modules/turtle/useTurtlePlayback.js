import { useCallback, useEffect, useRef, useState } from 'react'
import { createTurtlePlayer } from './turtlePlayer.js'
import { prefersReducedMotion } from '../../shared/motion.js'

/**
 * React wrapper around createTurtlePlayer (./turtlePlayer.js): keeps a canvas showing a Turtle
 * drawing, and plays it when a new run arrives.
 *
 * - `canvas`: the <canvas> element (held in state by the caller, so a re-parented canvas works).
 * - `commands`, `background`, `finalPose`: the drawing (a run's turtle result).
 * - `runId`: set on a real Run's result (runWithRuntime.js). A runId this hook has not seen
 *   before plays the drawing when `animate` is on; anything else (the first result it sees, a
 *   scrub preview or slow-mo frame with no runId, the same run arriving again) shows the
 *   finished drawing at once. Mid-playback, the same runId again keeps playing.
 * - `animate`: false for views that only ever show finished drawings (a watching tutor).
 * - Reduced motion (prefersReducedMotion): a new run shows at once and `canPlay` offers Play.
 * - `drawMarker`, `drawUnderlay`, `timelineOptions`, `onFrame(frame)`: passed to the player (other
 *   modes can draw their own marker and a layer under the drawing, and follow the frames, e.g. a
 *   vehicle on a course map).
 *
 * Returns { status, playing, canPlay, play, skip, timeline }.
 */
export function useTurtlePlayback({
  canvas,
  commands,
  background = '#ffffff',
  finalPose = null,
  runId = null,
  animate = true,
  drawMarker,
  drawUnderlay,
  timelineOptions,
  onFrame,
}) {
  const [player, setPlayer] = useState(null)
  const [status, setStatus] = useState('idle')
  const [timeline, setTimeline] = useState(null)
  const seenRunIdRef = useRef(runId)
  const playingRunIdRef = useRef(null)
  const onFrameRef = useRef(onFrame)
  onFrameRef.current = onFrame
  const animateRef = useRef(animate)
  animateRef.current = animate

  useEffect(() => {
    if (!canvas) return undefined
    const next = createTurtlePlayer({
      canvas,
      drawMarker,
      drawUnderlay,
      timelineOptions,
      onStatus: setStatus,
      onFrame: (frame) => onFrameRef.current?.(frame),
    })
    setPlayer(next)
    const observer =
      typeof ResizeObserver === 'function' ? new ResizeObserver(() => next.resize()) : null
    observer?.observe(canvas)
    return () => {
      observer?.disconnect()
      next.destroy()
      setPlayer(null)
    }
    // drawMarker/drawUnderlay/timelineOptions are fixed per mode (a course reads its current map
    // through refs); a new canvas makes a new player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas])

  useEffect(() => {
    if (!player) return
    const isNewRun = runId != null && runId !== seenRunIdRef.current
    if (runId != null) seenRunIdRef.current = runId
    // The same run again (e.g. a Go Live snapshot re-sent) while it plays: keep playing.
    if (
      !isNewRun &&
      runId != null &&
      runId === playingRunIdRef.current &&
      player.status === 'playing'
    ) {
      return
    }
    player.load({ commands, background, finalPose })
    setTimeline(player.timeline)
    playingRunIdRef.current = null
    if (isNewRun && animateRef.current && !prefersReducedMotion()) {
      playingRunIdRef.current = runId
      player.play()
    }
  }, [player, commands, background, finalPose, runId])

  // Turning animation off mid-playback (slow-mo starting) shows the finished drawing.
  useEffect(() => {
    if (!animate && player?.status === 'playing') player.skip()
  }, [animate, player])

  const play = useCallback(() => {
    if (!player) return
    playingRunIdRef.current = seenRunIdRef.current
    player.play()
  }, [player])

  const skip = useCallback(() => player?.skip(), [player])

  const playing = status === 'playing'
  const canPlay = !playing && animate && prefersReducedMotion() && (timeline?.totalMs ?? 0) > 0
  return { status, playing, canPlay, play, skip, timeline }
}
