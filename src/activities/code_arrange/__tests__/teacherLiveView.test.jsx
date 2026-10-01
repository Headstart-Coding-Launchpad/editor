import React from 'react'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CodeArrangeTeacherLiveView } from '../ui.jsx'
import { PYTHON_CODE_ARRANGE_TASK } from '../../../test/fixtures/legacyActivityTasks.js'

const boardProps = vi.fn()
vi.mock('../CodeArrangeTask.jsx', () => ({
  default: (props) => {
    boardProps(props)
    return null
  },
}))

beforeEach(() => boardProps.mockClear())

function renderFor(student) {
  render(
    <CodeArrangeTeacherLiveView
      task={PYTHON_CODE_ARRANGE_TASK}
      student={student}
      mirror="code"
      files={[]}
      slots={{}}
      iframeSrc={null}
      iframeRef={{ current: null }}
    />
  )
  return boardProps.mock.calls.at(-1)[0]
}

// StudentModal's board shows the same pass/fail as the StudentCard: a teacher override wins,
// otherwise the last run's result once the student has run.
describe('CodeArrangeTeacherLiveView pass/fail', () => {
  it('is neither passed nor attempted before the student runs', () => {
    expect(renderFor({ checkPassed: null, lastRunStatus: null })).toMatchObject({
      checkPassed: false,
      checkAttempted: false,
    })
  })

  it("shows the last run's result", () => {
    expect(renderFor({ checkPassed: false, lastRunStatus: 'success' })).toMatchObject({
      checkPassed: false,
      checkAttempted: true,
    })
    expect(renderFor({ checkPassed: true, lastRunStatus: 'success' })).toMatchObject({
      checkPassed: true,
      checkAttempted: true,
    })
  })

  it("lets the teacher's override win", () => {
    expect(
      renderFor({
        checkPassed: false,
        lastRunStatus: 'success',
        checkOverridePushedAt: 10,
        checkOverridePassed: true,
      })
    ).toMatchObject({ checkPassed: true, checkAttempted: true })
    expect(
      renderFor({
        checkPassed: true,
        lastRunStatus: null,
        checkOverridePushedAt: 11,
        checkOverridePassed: false,
      })
    ).toMatchObject({ checkPassed: false, checkAttempted: true })
  })
})
