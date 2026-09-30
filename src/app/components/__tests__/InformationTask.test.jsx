import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import InformationTask from '../InformationTask'
import { resetFirstViews } from '../../../shared/motion'

const lesson = { id: 'test', type: 'python', title: 'Test Lesson', description: 'Desc', level: 1 }

function findUserSelectNoneAncestor(el) {
  let node = el
  while (node && node !== document.body) {
    if (node.style?.userSelect === 'none') return node
    node = node.parentElement
  }
  return null
}

describe('InformationTask', () => {
  describe('standard type', () => {
    it('renders the explainer content', () => {
      const task = { informationType: 'standard', title: 'Read this', explainer: 'Hello world' }
      render(<InformationTask task={task} lesson={lesson} />)
      expect(screen.getByText('Hello world')).toBeInTheDocument()
    })

    it('defaults to standard when informationType is omitted', () => {
      const task = { title: 'Read this', explainer: 'Standard content' }
      render(<InformationTask task={task} lesson={lesson} />)
      expect(screen.getByText('Standard content')).toBeInTheDocument()
    })

    it('does not disable text selection by default', () => {
      const task = { informationType: 'standard', title: 'Read this', explainer: 'Hello world' }
      render(<InformationTask task={task} lesson={lesson} />)
      expect(findUserSelectNoneAncestor(screen.getByText('Hello world'))).toBeNull()
    })

    it('disables text selection when disableCopy is set', () => {
      const task = { informationType: 'standard', title: 'Read this', explainer: 'Hello world' }
      render(<InformationTask task={task} lesson={lesson} disableCopy />)
      expect(findUserSelectNoneAncestor(screen.getByText('Hello world'))).not.toBeNull()
    })
  })

  describe('introduction type', () => {
    it('renders the lesson title', () => {
      const task = { informationType: 'introduction', title: 'Intro' }
      render(<InformationTask task={task} lesson={lesson} />)
      expect(screen.getByText('Test Lesson')).toBeInTheDocument()
    })

    it('renders the lesson description', () => {
      const task = { informationType: 'introduction', title: 'Intro' }
      render(<InformationTask task={task} lesson={lesson} />)
      expect(screen.getByText('Desc')).toBeInTheDocument()
    })

    it('describes a composed lesson by its mix of modules rather than the raw "composed" type', () => {
      const task = { informationType: 'introduction', title: 'Intro' }
      const composed = {
        id: 'composed-intro',
        type: 'composed',
        title: 'Composed Lesson',
        tasks: [
          { id: 1, title: 'Scratch task', moduleType: 'scratch', starterBlocks: null },
          { id: 2, title: 'Python task', moduleType: 'python', starterCode: '' },
        ],
      }
      render(<InformationTask task={task} lesson={composed} />)
      expect(screen.getByText('Scratch + Python')).toBeInTheDocument()
      expect(screen.queryByText('composed')).not.toBeInTheDocument()
    })
  })

  describe('recap (two pane view) type', () => {
    it('renders leftContent in the left pane', () => {
      const task = {
        informationType: 'recap',
        leftContent: 'Left pane text',
        explainer: 'Right pane text',
      }
      render(<InformationTask task={task} lesson={lesson} />)
      expect(screen.getByText('Left pane text')).toBeInTheDocument()
    })

    it('renders explainer in the right pane', () => {
      const task = {
        informationType: 'recap',
        leftContent: 'Left pane text',
        explainer: 'Right pane text',
      }
      render(<InformationTask task={task} lesson={lesson} />)
      expect(screen.getByText('Right pane text')).toBeInTheDocument()
    })

    it('renders without error when leftContent is not set', () => {
      const task = { informationType: 'recap', explainer: 'Some content' }
      render(<InformationTask task={task} lesson={lesson} />)
      expect(screen.getByText('Some content')).toBeInTheDocument()
    })

    it('does not render the old hardcoded Recap! heading', () => {
      const task = { informationType: 'recap', leftContent: '', explainer: '' }
      render(<InformationTask task={task} lesson={lesson} />)
      expect(screen.queryByText('Recap!')).not.toBeInTheDocument()
    })

    it('disables text selection in both panes when disableCopy is set', () => {
      const task = {
        informationType: 'recap',
        leftContent: 'Left pane text',
        explainer: 'Right pane text',
      }
      render(<InformationTask task={task} lesson={lesson} disableCopy />)
      expect(findUserSelectNoneAncestor(screen.getByText('Left pane text'))).not.toBeNull()
      expect(findUserSelectNoneAncestor(screen.getByText('Right pane text'))).not.toBeNull()
    })
  })
})

describe('InformationTask first-view entrance', () => {
  beforeEach(() => resetFirstViews())

  const standard = { id: 'info-1', title: 'Read this', explainer: '- one\n- two' }
  const recap = {
    id: 'recap-1',
    informationType: 'recap',
    title: 'Recap',
    leftContent: '- left',
    explainer: '- right one\n- right two',
  }

  it('drops a standard task in and slides its bullets in on the first view only', () => {
    const first = render(
      <InformationTask task={standard} lesson={lesson} entranceKey="test:info-1" />
    )
    expect(first.container.querySelector('.card')).toHaveClass('motion-drop-in')
    const items = first.container.querySelectorAll('li')
    expect(items).toHaveLength(2)
    items.forEach((li) => expect(li).toHaveClass('motion-slide-in', 'motion-stagger'))
    first.unmount()

    const again = render(
      <InformationTask task={standard} lesson={lesson} entranceKey="test:info-1" />
    )
    expect(again.container.querySelector('.card')).not.toHaveClass('motion-drop-in')
    again.container.querySelectorAll('li').forEach((li) => {
      expect(li).not.toHaveClass('motion-slide-in')
    })
  })

  it("slides a recap's bullets in on the first view only", () => {
    const first = render(
      <InformationTask task={recap} lesson={lesson} entranceKey="test:recap-1" />
    )
    const items = first.container.querySelectorAll('li')
    expect(items).toHaveLength(3)
    items.forEach((li) => expect(li).toHaveClass('motion-slide-in'))
    first.unmount()

    const again = render(
      <InformationTask task={recap} lesson={lesson} entranceKey="test:recap-1" />
    )
    again.container.querySelectorAll('li').forEach((li) => {
      expect(li).not.toHaveClass('motion-slide-in')
    })
  })

  it('never animates without an entrance key (the Builder task editor)', () => {
    const { container } = render(<InformationTask task={standard} lesson={lesson} />)
    expect(container.querySelector('.card')).not.toHaveClass('motion-drop-in')
    container.querySelectorAll('li').forEach((li) => expect(li).not.toHaveClass('motion-slide-in'))
  })
})
