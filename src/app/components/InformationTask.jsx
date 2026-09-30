import React from 'react'
import { MarkdownRenderer } from '../../shared/markdown'
import ExplainerPanel from './ExplainerPanel'
import { isComposedLesson, getComposedModuleTypes } from '../../shared/composedLesson'
import { getModuleLabel } from '../../modules/definitions'
import { BADGE_SUMMARY_INFORMATION_TYPE } from '../../shared/taskUtils'
import BadgeSummaryTask from './badges/BadgeSummaryTask'
import { firstViewKey, useFirstView } from '../../shared/motion'

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

  if (informationType === 'introduction') {
    return (
      <section className="information-task information-task--introduction">
        <div className="information-intro__content">
          <h1>{lesson?.title ?? task?.title ?? 'Lesson'}</h1>
          <div className="information-intro__meta">
            {lesson?.level && <span>{lesson.level}</span>}
            <span>{lessonTypeLabel(lesson)}</span>
          </div>
          {lesson?.description && <p>{lesson.description}</p>}
        </div>
      </section>
    )
  }

  if (informationType === 'recap') {
    return (
      <section className="information-task information-task--recap">
        <div className="information-recap__left">
          <MarkdownRenderer
            content={task?.leftContent ?? ''}
            textScale={markdownTextScale}
            inheritColor
            topicType={lesson?.type}
            disableCopy={disableCopy}
            animateLists={isRecapFirstView}
          />
        </div>
        <div className="information-recap__content">
          <MarkdownRenderer
            content={task?.explainer ?? ''}
            textScale={markdownTextScale}
            topicType={lesson?.type}
            disableCopy={disableCopy}
            imageLayout="float"
            animateLists={isRecapFirstView}
          />
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
    />
  )
}
