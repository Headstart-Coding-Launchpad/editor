/**
 * Plays a Turtle drawing onto a canvas (framework-free; React wraps it in useTurtlePlayback.js).
 *
 * The picture so far is kept on a back canvas and only the new records are drawn onto it each
 * frame; the visible canvas is that back canvas, plus the line being drawn and the marker. So a
 * frame costs one drawImage whatever the drawing's size (smooth for 500+ steps on a tablet).
 * The back canvas is redrawn from scratch only when a fill closes (it goes under lines already
 * drawn), or on resize.
 *
 * `drawMarker(ctx, pose, transform)` draws the marker (default the 🐢), so other modes can show
 * something else moving along the path (e.g. a vehicle).
 */
import {
  computeTurtleTransform,
  drawTurtleBackground,
  drawTurtleCommands,
  drawTurtleItems,
  drawPartialTurtleLine,
  drawTurtleMarker,
  sizeCanvasToDisplay,
} from './draw.js'
import { TURTLE_LOGICAL_WIDTH, TURTLE_LOGICAL_HEIGHT } from './engine.js'
import { buildTurtleTimeline, turtleTimelineFrame } from './playback.js'

function defaultNow() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

/**
 * Options: canvas, drawMarker, onStatus(status) ('idle' | 'playing' | 'finished'), onFrame(frame),
 * timelineOptions (buildTurtleTimeline), and for tests now/requestFrame/cancelFrame/createCanvas.
 */
export function createTurtlePlayer(options = {}) {
  const {
    canvas,
    drawMarker = drawTurtleMarker,
    onStatus = () => {},
    onFrame = () => {},
    timelineOptions = {},
    now = defaultNow,
    requestFrame = (cb) => requestAnimationFrame(cb),
    cancelFrame = (id) => cancelAnimationFrame(id),
    createCanvas = () => document.createElement('canvas'),
  } = options

  let data = {
    commands: [],
    background: '#ffffff',
    finalPose: null,
    logicalWidth: TURTLE_LOGICAL_WIDTH,
    logicalHeight: TURTLE_LOGICAL_HEIGHT,
  }
  let timeline = buildTurtleTimeline([], timelineOptions)
  let status = 'idle'
  let frameId = null
  let startedAt = 0
  let back = null
  let backCtx = null
  let backDone = 0
  let redrawIndex = 0

  // Animating needs a real 2D context: test stubs (jsdom, `getContext: () => ({})`) don't
  // count, so the drawing just shows finished.
  function usable(ctx) {
    return ctx && typeof ctx.save === 'function' ? ctx : null
  }

  function context() {
    return canvas?.getContext?.('2d') ?? null
  }

  function transformFor(target) {
    return computeTurtleTransform(
      target.width,
      target.height,
      data.logicalWidth,
      data.logicalHeight
    )
  }

  function setStatus(next) {
    if (status === next) return
    status = next
    onStatus(next)
  }

  function cancel() {
    if (frameId !== null) cancelFrame(frameId)
    frameId = null
  }

  function drawFinal() {
    const ctx = context()
    if (!ctx) return
    drawTurtleCommands(ctx, data.commands, {
      background: data.background,
      turtle: data.finalPose,
      drawMarker,
      logicalWidth: data.logicalWidth,
      logicalHeight: data.logicalHeight,
    })
  }

  function ensureBack() {
    if (!canvas) return null
    if (!back) {
      back = createCanvas()
      backCtx = usable(back?.getContext?.('2d'))
    }
    if (!backCtx) return null
    if (back.width !== canvas.width || back.height !== canvas.height) {
      back.width = canvas.width
      back.height = canvas.height
      redrawBack(backDone)
    }
    return backCtx
  }

  function redrawBack(done) {
    if (!backCtx) return
    backCtx.save()
    drawTurtleBackground(backCtx, data.background)
    drawTurtleItems(backCtx, data.commands, transformFor(back), 0, done)
    backCtx.restore()
    backDone = done
    redrawIndex = timeline.redrawAt.findIndex((count) => count > done)
    if (redrawIndex < 0) redrawIndex = timeline.redrawAt.length
  }

  function advanceBack(done) {
    if (done === backDone) return
    if (done < backDone) {
      redrawBack(done)
      return
    }
    // A fill closed in between: it goes under what's already drawn, so start again.
    if (redrawIndex < timeline.redrawAt.length && timeline.redrawAt[redrawIndex] <= done) {
      redrawBack(done)
      return
    }
    backCtx.save()
    drawTurtleItems(backCtx, data.commands, transformFor(back), backDone, done)
    backCtx.restore()
    backDone = done
  }

  function renderFrame(frame) {
    const ctx = context()
    const bctx = ensureBack()
    if (!ctx || !bctx) return
    advanceBack(frame.done)
    const transform = transformFor(canvas)
    ctx.save()
    ctx.clearRect?.(0, 0, canvas.width, canvas.height)
    ctx.drawImage(back, 0, 0)
    if (frame.active?.kind === 'line') {
      drawPartialTurtleLine(ctx, data.commands[frame.done], frame.progress, transform)
    }
    drawMarker(ctx, frame.pose, transform)
    ctx.restore()
  }

  function tick() {
    frameId = null
    if (status !== 'playing') return
    const frame = turtleTimelineFrame(timeline, now() - startedAt)
    if (frame.finished) {
      finish()
      return
    }
    renderFrame(frame)
    onFrame(frame)
    frameId = requestFrame(tick)
  }

  function finish() {
    cancel()
    drawFinal()
    onFrame(turtleTimelineFrame(timeline, timeline.totalMs))
    setStatus('finished')
  }

  return {
    /** New data: stops any playback and shows the finished drawing. */
    load(next = {}) {
      cancel()
      data = {
        ...data,
        commands: Array.isArray(next.commands) ? next.commands : [],
        background: next.background ?? '#ffffff',
        finalPose: next.finalPose ?? null,
        logicalWidth: next.logicalWidth ?? TURTLE_LOGICAL_WIDTH,
        logicalHeight: next.logicalHeight ?? TURTLE_LOGICAL_HEIGHT,
      }
      timeline = next.timeline ?? buildTurtleTimeline(data.commands, timelineOptions)
      sizeCanvasToDisplay(canvas)
      drawFinal()
      setStatus('idle')
    },
    /** Plays the loaded drawing from the start; an instant timeline just shows it finished. */
    play() {
      cancel()
      // Nothing takes any time (speed(0)), or no canvas to animate on (jsdom): show it finished.
      if (!(timeline.totalMs > 0) || !usable(context())) {
        finish()
        return
      }
      sizeCanvasToDisplay(canvas)
      backDone = 0
      if (ensureBack()) redrawBack(0)
      startedAt = now()
      setStatus('playing')
      frameId = requestFrame(tick)
    },
    /** Jumps to the finished drawing. */
    skip() {
      if (status === 'playing') finish()
    },
    /** The canvas changed size: redraw at the new size (mid-playback too). */
    resize() {
      sizeCanvasToDisplay(canvas)
      if (status === 'playing') {
        // renderFrame resizes and redraws the back canvas to match.
        renderFrame(turtleTimelineFrame(timeline, now() - startedAt))
      } else {
        drawFinal()
      }
    },
    destroy() {
      cancel()
      back = null
      backCtx = null
    },
    get status() {
      return status
    },
    get timeline() {
      return timeline
    },
  }
}
