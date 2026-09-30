import React, { useMemo } from 'react'
import { MarkdownRenderer } from '../../../shared/markdown'
import {
  buildClassWall,
  classWallText,
  CLASS_WALL_TITLE,
  rosterNameFor,
} from '../../../badges/badgeSummary'
import { listMyMoments } from '../../../badges/celebration'
import BadgeStickerSheet from './BadgeStickerSheet'
import CopyClassSummaryButton from './CopyClassSummaryButton'

/**
 * The class wall: one row per badge with the names of everyone who earned it. Never grouped by
 * student, and no counts.
 */
export function ClassWall({ wall, emptyText }) {
  if (wall.length === 0) return <p className="badge-summary__empty">{emptyText}</p>
  return (
    <ul className="badge-summary__wall" aria-label="Class coding moments">
      {wall.map((row) => (
        <li key={row.badgeId} className="badge-summary__row">
          <span className="badge-summary__emoji" aria-hidden="true">
            {row.badge?.emoji ?? '🏅'}
          </span>
          <span className="badge-summary__badge">{row.badge?.title ?? row.badgeId}</span>
          <span className="badge-summary__names">{row.names.join(', ')}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * The Badge Summary task ("Today's Coding Moments": `taskType: information`,
 * `informationType: badges`).
 *
 * - `student`: their own moments as a sticker sheet flipping in, then the class wall. A student
 *   with no moments gets a warm line about the class instead of an empty state.
 * - `teacher`: a projector-friendly class wall and "Copy class summary".
 * - `presentation`: the class wall only (the teacher's presentation window).
 * - No `decisions` (the Builder preview): a note that it fills in during a live session.
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
                <section className="badge-summary__mine" aria-label="Your coding moments">
                  <h2 className="badge-summary__heading">Your coding moments</h2>
                  <BadgeStickerSheet moments={myMoments} animate staggerMs={260} />
                </section>
              ) : (
                <p className="badge-summary__warm">
                  Every coder&apos;s moments look different — here&apos;s what the class celebrated
                  today.
                </p>
              ))}

            <section className="badge-summary__class" aria-label="The class wall">
              {variant === 'student' && myMoments.length > 0 && (
                <h2 className="badge-summary__heading">The whole class</h2>
              )}
              <ClassWall
                wall={wall}
                emptyText="Coding moments will appear here as they're celebrated."
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
