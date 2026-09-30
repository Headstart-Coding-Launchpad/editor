import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MarkdownRenderer } from '../../../shared/markdown'
import { firstViewKey, MOTION_MS, MOTION_STAGGER_CAP, useFirstView } from '../../../shared/motion'
import {
  buildClassWall,
  classWallText,
  CLASS_WALL_TITLE,
  rosterNameFor,
} from '../../../badges/badgeSummary'
import { listMyMoments } from '../../../badges/celebration'
import BadgeStickerSheet from './BadgeStickerSheet'
import CopyClassSummaryButton from './CopyClassSummaryButton'

// The entrance timings (docs/architecture/motion-system.md). TUMBLE_MS mirrors `.motion-tumble-in`
// in src/index.css; change both together.
export const TUMBLE_MS = 720
export const STICKER_STAGGER_MS = 260
export const EMOJI_STAGGER_MS = 200
const ROW_STAGGER_MS = MOTION_MS.stagger

/** When the last of `count` staggered tumbles has landed (0 when there are none). */
function tumbleEndMs(count, staggerMs) {
  if (count <= 0) return 0
  return Math.min(count - 1, MOTION_STAGGER_CAP) * staggerMs + TUMBLE_MS
}

function rowDropMs(startMs, index) {
  return startMs + Math.min(index, MOTION_STAGGER_CAP) * ROW_STAGGER_MS
}

/** One wall row. Its motion is worked out once, on mount, so a live update never re-delays it. */
function ClassWallRow({ row, initialMotion }) {
  const [motion] = useState(initialMotion)
  return (
    <li className={`badge-summary__row ${motion?.rowClassName ?? ''}`.trim()} style={motion?.style}>
      <span
        className={`badge-summary__emoji ${motion?.emojiClassName ?? ''}`.trim()}
        aria-hidden="true"
      >
        {row.badge?.emoji ?? '🏅'}
      </span>
      <span className="badge-summary__badge">{row.badge?.title ?? row.badgeId}</span>
      <span className="badge-summary__names">{row.names.join(', ')}</span>
    </li>
  )
}

/**
 * The class wall: one row per badge with the names of everyone who earned it. Never grouped by
 * student, and no counts.
 *
 * `rowMotion(row, index)` (optional, the Badge Summary's entrance) returns a row's
 * `{ rowClassName, emojiClassName, style }`; it is called once, when the row mounts.
 */
export function ClassWall({ wall, emptyText, rowMotion = null }) {
  if (wall.length === 0) return <p className="badge-summary__empty">{emptyText}</p>
  return (
    <ul className="badge-summary__wall" aria-label="Class coding moments">
      {wall.map((row, index) => (
        <ClassWallRow
          key={row.badgeId}
          row={row}
          initialMotion={rowMotion ? () => rowMotion(row, index) : null}
        />
      ))}
    </ul>
  )
}

/**
 * The Badge Summary task ("Today's Coding Moments": `taskType: information`,
 * `informationType: badges`).
 *
 * - `student`: their own moments as a sticker sheet, then the class wall. A student with no
 *   moments gets a warm line about the class instead of an empty state.
 * - `teacher`: a projector-friendly class wall and "Copy class summary".
 * - `presentation`: the class wall only (the teacher's presentation window).
 * - No `decisions` (the Builder preview): a note that it fills in during a live session.
 *
 * Entrance (first view of the task on this screen only, `useFirstView`): the student's stickers
 * tumble in one by one, then the class wall's rows drop into place; on the teacher and
 * presentation views each row's emoji tumbles in, then the rows drop in under them. Whatever is on
 * screen at mount is the entrance; a sticker or row that arrives later (a live award) only drops in
 * plainly, with no delay, even on a revisit.
 *
 * @param {object} props
 * @param {object} props.task
 * @param {object} [props.lesson]
 * @param {object} [props.decisions] The session's `badges` node.
 * @param {object} [props.students] The session's `students` node, for names.
 * @param {string|null} [props.viewerId] The student viewing (student variant).
 * @param {'student'|'teacher'|'presentation'} [props.variant]
 * @param {object[]} [props.catalogueBadges] Admin-catalogue badges.
 * @param {boolean} [props.disableCopy] Passed to the explainer's Markdown.
 */
export default function BadgeSummaryTask({
  task,
  lesson,
  decisions,
  students,
  viewerId = null,
  variant = 'student',
  catalogueBadges = [],
  disableCopy = false,
}) {
  const live = decisions !== undefined
  const wall = useMemo(
    () => buildClassWall(decisions ?? {}, { nameFor: rosterNameFor(students), catalogueBadges }),
    [decisions, students, catalogueBadges]
  )
  const myMoments = useMemo(
    () => (variant === 'student' ? listMyMoments(decisions ?? {}, viewerId, catalogueBadges) : []),
    [variant, decisions, viewerId, catalogueBadges]
  )
  const firstView = useFirstView(
    live ? firstViewKey('badge-summary', lesson?.id, task?.id, variant) : null
  )
  // False during the first render: what mounts then is the entrance, anything later only drops in.
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
  }, [])
  const [atStart] = useState(() => ({ stickers: myMoments.length, rows: wall.length }))
  const animateEntrance = live && firstView
  // Student: the wall starts once the last sticker has landed.
  const wallStartMs = animateEntrance ? tumbleEndMs(atStart.stickers, STICKER_STAGGER_MS) : 0

  const rowMotion = (row, index) => {
    if (mounted.current) return { rowClassName: 'motion-drop-in' }
    if (!animateEntrance) return null
    if (variant === 'student') {
      return {
        rowClassName: 'badge-summary__row--drop motion-drop-in',
        style: { '--badge-summary-delay': `${rowDropMs(wallStartMs, index)}ms` },
      }
    }
    return {
      rowClassName: 'badge-summary__row--tumble',
      emojiClassName: 'motion-tumble-in',
      style: {
        '--badge-summary-emoji-delay': `${Math.min(index, MOTION_STAGGER_CAP) * EMOJI_STAGGER_MS}ms`,
        '--badge-summary-delay': `${rowDropMs(tumbleEndMs(atStart.rows, EMOJI_STAGGER_MS), index)}ms`,
      },
    }
  }
  // The "Your coding moments" section and "The whole class" heading: part of the entrance when
  // the student had moments at mount, otherwise they appear with the first award and drop in.
  const lateMine = atStart.stickers === 0
  let wallHeadingClass = 'badge-summary__heading'
  if (lateMine) wallHeadingClass += ' motion-drop-in'
  else if (animateEntrance) wallHeadingClass += ' badge-summary__heading--drop motion-drop-in'

  const title = String(task?.title ?? '').trim() || CLASS_WALL_TITLE
  const explainer = String(task?.explainer ?? '').trim()

  return (
    <section
      className={`information-task badge-summary badge-summary--${variant}`}
      aria-label={title}
    >
      <div className="badge-summary__content">
        <h1 className="badge-summary__title">
          <span aria-hidden="true">🎖️</span> {title}
        </h1>
        {explainer && (
          <div className="badge-summary__explainer">
            <MarkdownRenderer
              content={explainer}
              topicType={lesson?.type}
              disableCopy={disableCopy}
            />
          </div>
        )}

        {!live ? (
          <p className="badge-summary__empty">
            In a live session this shows the class&apos;s coding moments, grouped by badge. Solo
            learners skip it.
          </p>
        ) : (
          <>
            {variant === 'student' &&
              (myMoments.length > 0 ? (
                <section
                  className={`badge-summary__mine${lateMine ? ' motion-drop-in' : ''}`}
                  aria-label="Your coding moments"
                >
                  <h2 className="badge-summary__heading">Your coding moments</h2>
                  <BadgeStickerSheet
                    moments={myMoments}
                    entrance="tumble"
                    animate={animateEntrance && !lateMine}
                    staggerMs={STICKER_STAGGER_MS}
                  />
                </section>
              ) : (
                <p className="badge-summary__warm">
                  Every coder&apos;s moments look different — here&apos;s what the class celebrated
                  today.
                </p>
              ))}

            <section className="badge-summary__class" aria-label="The class wall">
              {variant === 'student' && myMoments.length > 0 && (
                <h2
                  className={wallHeadingClass}
                  style={{ '--badge-summary-delay': `${wallStartMs}ms` }}
                >
                  The whole class
                </h2>
              )}
              <ClassWall
                wall={wall}
                emptyText="Coding moments will appear here as they're celebrated."
                rowMotion={rowMotion}
              />
            </section>

            {variant === 'teacher' && (
              <div className="badge-summary__actions">
                <CopyClassSummaryButton text={classWallText(wall, { title })} />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
