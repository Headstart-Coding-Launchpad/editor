import React from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ShotView, { SHOT_GLOBAL } from '../ShotView'

const studentViewProps = vi.fn()
vi.mock('../StudentView', () => ({
  default: (props) => {
    studentViewProps(props)
    return <div data-testid="student-view" />
  },
}))

const LESSON = { id: 'les-1', title: 'Posters', type: 'python', tasks: [{ id: 7, title: 'T' }] }

afterEach(() => {
  delete window[SHOT_GLOBAL]
  studentViewProps.mockClear()
})

describe('ShotView', () => {
  it('shows only a note when the screenshot tool has not handed it a lesson', () => {
    render(<ShotView />)
    expect(screen.getByTestId('shot-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('student-view')).not.toBeInTheDocument()
  })

  it('ignores a global without a lesson task list', () => {
    window[SHOT_GLOBAL] = { lesson: { id: 'x' } }
    render(<ShotView />)
    expect(screen.getByTestId('shot-empty')).toBeInTheDocument()
  })

  it('renders the task as a session-free preview, without the preview banner', () => {
    window[SHOT_GLOBAL] = { lesson: LESSON, taskId: 7 }
    render(<ShotView />)
    expect(screen.getByTestId('shot-page')).toBeInTheDocument()
    expect(studentViewProps).toHaveBeenCalledWith(
      expect.objectContaining({
        lesson: LESSON,
        forceSolo: true,
        previewMode: true,
        showPreviewBanner: false,
        initialTaskId: 7,
      })
    )
  })
})
