import { useEffect, useMemo, useRef, useState } from 'react'
import { STAGE_EMOJI_FONT, drawStage, sizeStageCanvas } from './canvas.js'
import { compareStages, comparisonMatches } from './raster.js'
import { describeComparison, describeStage } from './describe.js'
import BeatSequencer from '../beats/BeatSequencer.jsx'
import { isBeatCommand, readBeatSong } from '../beats/patterns.js'
import { loadStageImages } from './stageImages.js'

/**
 * The Python Stage pane (src/shared/stage/): the run's drawing on a square canvas that scales
 * to fit its box, with a screen-reader description of what is drawn.
 *
 * With a `target` (a task's stageTarget commands) it offers two toggles (44 px touch targets):
 * - Target: a faint ghost of the target over the drawing (starts as `ghostDefault`);
 * - Differences (only once `ran`): highlights the cells that differ and says, in words, where
 *   and which colours (never colour alone).
 *
 * `saveTitle` (the student's own workspace; the task's title, '' for none): a "Save my picture"
 * button that downloads the drawing as '<title>-picture.png' (Image Lab;
 * src/shared/stage/savePicture.js), once there is a drawing. null (the default) hides it.
 *
 * `compact` (the tutor's card and StudentModal) drops the toolbar and the summary.
 * `commands` may be a prefix of a run's commands (a step-by-step player draws one at a time).
 *
 * Beat Maker (src/shared/beats/): when the run called play(), its step grid shows here, in place
 * of the canvas when nothing else was drawn. `beatAutoPlay` plays it at once (the student's own
 * Run only); `beatControls` is 'full', 'play' or 'none' (default: 'play' when compact).
 */
export default function StagePane({
  commands,
  target = null,
  ghostDefault = true,
  ran = false,
  matchTolerance,
  compact = false,
  truncated = false,
  title = 'Stage',
  saveTitle = null,
  style,
  beatAutoPlay = false,
  beatControls,
}) {
  const canvasRef = useRef(null)
  const [ghostOn, setGhostOn] = useState(ghostDefault)
  const [diffOn, setDiffOn] = useState(false)
  const hasTarget = Array.isArray(target) && target.length > 0
  const list = useMemo(() => (Array.isArray(commands) ? commands : []), [commands])
  const canDiff = hasTarget && ran && !compact
  const comparison = useMemo(
    () => (canDiff ? compareStages(list, target) : null),
    [canDiff, list, target]
  )
  const matches = comparison ? comparisonMatches(comparison, matchTolerance) : false
  const showDiff = canDiff && diffOn
  const showGhost = hasTarget && ghostOn && !compact
  const description = useMemo(() => describeStage(list), [list])
  const beatSong = useMemo(() => readBeatSong(list), [list])
  const drawsToo = useMemo(() => list.some((c) => !isBeatCommand(c)), [list])
  const showCanvas = !beatSong || drawsToo || hasTarget
  const canSave = !compact && typeof saveTitle === 'string' && drawsToo
  const [saving, setSaving] = useState(false)
  function savePicture() {
    setSaving(true)
    import('./savePicture.js')
      .then(({ saveStagePicture, stagePictureFileName }) =>
        saveStagePicture(list, stagePictureFileName(saveTitle))
      )
      .catch(() => {})
      .finally(() => setSaving(false))
  }

  useEffect(() => {
    if (!canDiff) setDiffOn(false)
  }, [canDiff])

  // Canvas text doesn't repaint when a web font arrives, so emoji drawn before Noto Color Emoji
  // loaded would keep the system glyphs. Google Fonts splits Noto by unicode-range, so load the
  // pieces for the characters actually drawn, then redraw (request #85).
  const [fontVersion, setFontVersion] = useState(0)
  const drawnText = useMemo(
    () =>
      [...list, ...(hasTarget ? target : [])]
        .map((c) =>
          c?.type === 'stamp' ? c.emoji : c?.type === 'text' ? String(c.text ?? '') : ''
        )
        .filter((t) => typeof t === 'string' && t)
        .join(''),
    [list, hasTarget, target]
  )
  useEffect(() => {
    if (!drawnText) return undefined
    let cancelled = false
    Promise.resolve(document.fonts?.load(`32px '${STAGE_EMOJI_FONT}'`, drawnText))
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFontVersion((v) => v + 1)
      })
    return () => {
      cancelled = true
    }
  }, [drawnText])

  // A chart (plt.show(), ./charts.js) is a PNG the browser decodes first: draw again once it has.
  const [imageVersion, setImageVersion] = useState(0)
  useEffect(() => {
    if (!list.some((c) => c?.type === 'image')) return undefined
    let cancelled = false
    loadStageImages(list).then((loaded) => {
      if (loaded && !cancelled) setImageVersion((v) => v + 1)
    })
    return () => {
      cancelled = true
    }
  }, [list])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    function redraw() {
      sizeStageCanvas(canvas)
      // jsdom (unit tests) has no 2D context and returns null.
      const ctx = canvas.getContext?.('2d')
      if (ctx)
        drawStage(ctx, list, {
          ghost: showGhost ? target : null,
          diff: showDiff ? comparison : null,
        })
    }
    redraw()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(redraw)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [list, target, showGhost, showDiff, comparison, fontVersion, showCanvas, imageVersion])

  return (
    <section style={{ ...s.pane, ...style }} aria-label={title} data-testid="stage-pane">
      {!compact && (
        <div style={s.toolbar} className="ui-tabs">
          <span style={s.title}>{title}</span>
          {(hasTarget || canSave) && (
            <div style={s.toggles}>
              {canSave && (
                <button
                  type="button"
                  className="btn-ghost-outline"
                  style={s.toggle}
                  onClick={savePicture}
                  disabled={saving}
                  title="Download your picture as a PNG file"
                  data-testid="stage-save-picture"
                >
                  Save my picture
                </button>
              )}
              {hasTarget && (
                <button
                  type="button"
                  className="btn-ghost-outline"
                  style={{ ...s.toggle, ...(ghostOn ? s.toggleOn : null) }}
                  aria-pressed={ghostOn}
                  onClick={() => setGhostOn((on) => !on)}
                  title="Show the target faintly over your drawing"
                >
                  Target
                </button>
              )}
              {canDiff && (
                <button
                  type="button"
                  className="btn-ghost-outline"
                  style={{ ...s.toggle, ...(diffOn ? s.toggleOn : null) }}
                  aria-pressed={diffOn}
                  onClick={() => setDiffOn((on) => !on)}
                  title="Highlight where your drawing is different from the target"
                >
                  Differences
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {beatSong && (
        <BeatSequencer
          song={beatSong}
          autoPlay={beatAutoPlay}
          controls={beatControls ?? (compact ? 'play' : 'full')}
          compact={compact}
        />
      )}
      {showCanvas && (
        <div style={compact ? { ...s.fit, minHeight: 0 } : s.fit}>
          <div style={s.square}>
            <canvas ref={canvasRef} style={s.canvas} role="img" aria-label={description} />
          </div>
        </div>
      )}
      {!compact && comparison && (diffOn || matches) && (
        <p style={{ ...s.summary, ...(matches ? s.summaryMatch : null) }} aria-live="polite">
          {describeComparison(comparison, { matches })}
        </p>
      )}
      {truncated && <p style={s.note}>Showing the newest part of a very big drawing.</p>}
    </section>
  )
}

const s = {
  pane: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    minWidth: 0,
    gap: 6,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  title: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.86rem',
    color: 'var(--colour-primary)',
    padding: '0 10px',
  },
  toggles: { marginLeft: 'auto', display: 'flex', gap: 6, paddingRight: 6 },
  toggle: {
    minHeight: 44,
    minWidth: 44,
    padding: '0 14px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#374151',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  },
  toggleOn: {
    background: '#eef2ff',
    borderColor: '#6366f1',
    color: '#3730a3',
  },
  // A size container, so the square inside can be as big as fits both ways.
  fit: {
    flex: '1 1 auto',
    minHeight: 120,
    minWidth: 0,
    containerType: 'size',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  square: {
    width: 'min(100cqw, 100cqh)',
    aspectRatio: '1 / 1',
    maxWidth: '100%',
    maxHeight: '100%',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
    background: '#fff',
  },
  canvas: { width: '100%', height: '100%', display: 'block' },
  summary: {
    margin: 0,
    padding: '8px 12px',
    borderRadius: 8,
    background: '#fdf2f8',
    border: '1px solid #fbcfe8',
    color: '#831843',
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    flexShrink: 0,
  },
  summaryMatch: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#166534',
  },
  note: {
    margin: 0,
    color: '#6b7280',
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    flexShrink: 0,
  },
}
