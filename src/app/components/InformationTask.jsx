import React from 'react'
import { MarkdownRenderer } from '../../shared/markdown'
import ExplainerPanel from './ExplainerPanel'

function lessonTypeLabel(type) {
  if (type === 'python') return 'Python'
  if (type === 'scratch') return 'Scratch'
  if (type === 'html') return 'Web Dev'
  return type || 'Lesson'
}

export default function InformationTask({ task, lesson, fill = true, disableCopy = false }) {
  const informationType = task?.informationType ?? 'standard'
  const markdownTextScale = 1.4

  if (informationType === 'introduction') {
    return (
      <section className="information-task information-task--introduction">
        <div className="information-intro__content">
          <h1>{lesson?.title ?? task?.title ?? 'Lesson'}</h1>
          <div className="information-intro__meta">
            {lesson?.level && <span>{lesson.level}</span>}
            <span>{lessonTypeLabel(lesson?.type)}</span>
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
          <MarkdownRenderer content={task?.leftContent ?? ''} textScale={markdownTextScale} inheritColor topicType={lesson?.type} disableCopy={disableCopy} />
        </div>
        <div className="information-recap__content">
          <MarkdownRenderer content={task?.explainer ?? ''} textScale={markdownTextScale} topicType={lesson?.type} disableCopy={disableCopy} imageLayout="float" />
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
    />
  )
}
