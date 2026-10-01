import React from 'react'
import { MarkdownRenderer } from '../../shared/markdown'
import ExplainerPanel from './ExplainerPanel'
import { isComposedLesson, getComposedModuleTypes } from '../../shared/composedLesson'
import { getModuleLabel } from '../../modules/definitions'
import { BADGE_SUMMARY_INFORMATION_TYPE } from '../../shared/taskUtils'
import BadgeSummaryTask from './badges/BadgeSummaryTask'
import { firstViewKey, useFirstView } from '../../shared/motion'
import InkSurface from '../liveInk/InkSurface'
import { SURFACE_KINDS, surfaceId } from '../liveInk/liveInkData'

function singleTypeLabel(type) {
  return getModuleLabel(type, 'lessonIntro') ?? (type || 'Lesson')
}

// A composed lesson's own `.type` is just 'composed' — describe it by the
// mix of modules its code tasks actually use instead.
function lessonTypeLabel(lesson) {
  if (!isComposedLesson(lesson)) return singleTypeLabel(lesson?.type)
  const types = getComposedModuleTypes(lesson)
  return types.length ? types.map(singleTypeLabel).join(' + ') : 'Lesson'
}

// `badgeWall` (Badge Summary tasks only): `{ decisions, students, viewerId, variant,
// catalogueBadges }` from the live session; see BadgeSummaryTask. Left out, the task renders its
// preview note (the Builder).
// `entranceKey` (usually `firstViewKey(lessonId, taskId)`): on the task's first view the body's
// bullets slide in (and a standard task's panel drops in). Null (the Builder's task editor)
// never animates.
export default function InformationTask({
  task,
  lesson,
  fill = true,
  disableCopy = false,
  badgeWall = null,
  entranceKey = null,
}) {
  const informationType = task?.informationType ?? 'standard'
  const markdownTextScale = 1.4
  const information = entranceKey == null ? null : firstViewKey('information', entranceKey)
  const isRecapFirstView = useFirstView(
    informationType === 'recap' && information ? firstViewKey('recap', information) : null
  )

  if (informationType === BADGE_SUMMARY_INFORMATION_TYPE) {
    return <BadgeSummaryTask task={task} lesson={lesson} disableCopy={disableCopy} {...badgeWall} />
  }

  // Presentation annotations (src/app/liveInk): each block of content is its own surface, named
  // by kind + task id. Inert outside a live lesson / the Presentation window.
  const inkId = (kind) => (task?.id == null ? null : surfaceId(kind, task.id))

  if (informationType === 'introduction') {
    // Not Markdown, so its three parts carry hand-written anchors.
    return (
      <section className="information-task information-task--introduction">
        <InkSurface id={inkId(SURFACE_KINDS.intro)} style={s.introSurface}>
          <div className="information-intro__content">
            <h1 data-md-anchor="title">{lesson?.title ?? task?.title ?? 'Lesson'}</h1>
            <div className="information-intro__meta" data-md-anchor="meta">
              {lesson?.level && <span>{lesson.level}</span>}
              <span>{lessonTypeLabel(lesson)}</span>
            </div>
            {lesson?.description && <p data-md-anchor="description">{lesson.description}</p>}
          </div>
        </InkSurface>
      </section>
    )
  }

  if (informationType === 'recap') {
    return (
      <section className="information-task information-task--recap">
        <div className="information-recap__left">
          <InkSurface id={inkId(SURFACE_KINDS.recapLeft)}>
            <MarkdownRenderer
              content={task?.leftContent ?? ''}
              textScale={markdownTextScale}
              inheritColor
              topicType={lesson?.type}
              disableCopy={disableCopy}
              animateLists={isRecapFirstView}
            />
          </InkSurface>
        </div>
        <div className="information-recap__content">
          <InkSurface id={inkId(SURFACE_KINDS.recap)}>
            <MarkdownRenderer
              content={task?.explainer ?? ''}
              textScale={markdownTextScale}
              topicType={lesson?.type}
              disableCopy={disableCopy}
              imageLayout="float"
              animateLists={isRecapFirstView}
            />
          </InkSurface>
        </div>
      </section>
    )
  }

  return (
    <ExplainerPanel
      title={task?.title}
      content={task?.explainer ?? ''}
      collapsible={false}
      fill={fill}
      markdownTextScale={markdownTextScale}
      topicType={lesson?.type}
      showLibrary={false}
      disableCopy={disableCopy}
      imageLayout="float"
      entranceKey={information}
      inkSurfaceId={inkId(SURFACE_KINDS.info)}
    />
  )
}

const s = {
  // Keeps the introduction's centred column at its own width once it sits inside a surface.
  introSurface: { width: 'min(860px, 100%)' },
}
