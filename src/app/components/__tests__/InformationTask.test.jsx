import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import InformationTask from '../InformationTask'

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
