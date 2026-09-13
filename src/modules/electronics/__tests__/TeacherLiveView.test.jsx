import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ElectronicsTeacherLiveView from '../TeacherLiveView.jsx'

const workspaceProps = vi.hoisted(() => ({ current: null }))

vi.mock('../ElectronicsWorkspace.jsx', () => ({
  default: (props) => {
    workspaceProps.current = props
    return null
  },
}))

describe('ElectronicsTeacherLiveView', () => {
  it("forwards onActivity and isInSandbox to ElectronicsWorkspace, matching every other module's TeacherLiveView", () => {
    const onActivity = vi.fn()
    render(
      <ElectronicsTeacherLiveView
        task={{}}
        displayState={null}
        readOnly
        onChange={vi.fn()}
        onTabChange={vi.fn()}
        onActivity={onActivity}
        isInSandbox
      />
    )

    expect(workspaceProps.current.onActivity).toBe(onActivity)
    expect(workspaceProps.current.isInSandbox).toBe(true)
  })
})
