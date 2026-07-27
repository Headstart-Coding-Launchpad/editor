import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../modules/registry', () => ({
  getLessonModule: () => ({
    type: 'python',
    StudentWorkspace: () => <div>Workspace</div>,
    getLayoutStyles: () => ({}),
  }),
}))

import LessonTaskContent from '../LessonTaskContent'

describe('LessonTaskContent', () => {
  it('renders a teacher-revealed support stage without crashing student view', () => {
    render(
      <LessonTaskContent
        lesson={{ type: 'python' }}
        task={{
          id: 1,
          title: 'Say hello',
          codeStages: [{ label: 'Greeting', code: 'print("Hello")', revealable: true }],
        }}
        cs={{
          inPersonalSandbox: false,
          activeSupportStageIndex: 0,
          supportStageReveals: { 0: { source: 'teacher' } },
        }}
        currentTaskId={1}
        isSandbox={false}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isMobile={false}
        isQuizTask={false}
        isAutoEvaluatedQuiz={false}
        isInformationTask={false}
        isTeacherEditing={false}
      />,
    )

    expect(screen.getByLabelText('Greeting stage reference')).toHaveTextContent('print("Hello")')
    expect(screen.getByText('Opened by your teacher')).toBeInTheDocument()
  })
})
