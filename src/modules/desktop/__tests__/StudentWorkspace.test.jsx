import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StudentWorkspace from '../StudentWorkspace.jsx'
import { makeDefaultDesktop } from '../desktopState.js'

const lesson = { id: 'lesson-1', tasks: [], assets: [] }
const task = { id: 1, availableApps: ['fileManager'] }

function makeCs(overrides = {}) {
  return {
    handleDesktopChange: vi.fn(),
    handleDesktopInteraction: vi.fn(),
    readSavedTaskDesktop: vi.fn(() => null),
    desktopInteraction: { currentDir: '/', openFile: null },
    ...overrides,
  }
}

describe('Desktop StudentWorkspace', () => {
  it('renders a desktop icon that requests a File Manager window be opened', () => {
    const cs = makeCs()
    render(
      <StudentWorkspace
        lesson={lesson}
        task={task}
        cs={cs}
        viewingTaskId={null}
        currentTaskId={1}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        displayDesktop={{ fs: { '/': { type: 'dir' } }, recycleBin: [], windows: [] }}
      />
    )

    expect(screen.queryByLabelText('Search files')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /File Manager/i }))
    expect(cs.handleDesktopChange).toHaveBeenCalledTimes(1)
    const nextState = cs.handleDesktopChange.mock.calls[0][0]
    expect(nextState.windows).toHaveLength(1)
    expect(nextState.windows[0]).toMatchObject({ appId: 'fileManager', minimized: false })
  })

  it('routes file manager changes through cs.handleDesktopChange with the full desktop state', () => {
    const cs = makeCs()
    render(
      <StudentWorkspace
        lesson={lesson}
        task={task}
        cs={cs}
        viewingTaskId={null}
        currentTaskId={1}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        displayDesktop={makeDefaultDesktop(['fileManager'])}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /New Folder/i }))
    const input = screen.getByPlaceholderText('Folder name…')
    fireEvent.change(input, { target: { value: 'Homework' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(cs.handleDesktopChange).toHaveBeenCalled()
    const nextState = cs.handleDesktopChange.mock.calls[0][0]
    expect(nextState.fs['/Homework/']).toEqual({ type: 'dir' })
    expect(nextState).toHaveProperty('recycleBin')
    expect(nextState).toHaveProperty('windows')
  })

  it('disables interaction when viewing a previous task', () => {
    const cs = makeCs({ readSavedTaskDesktop: vi.fn(() => makeDefaultDesktop(['fileManager'])) })
    render(
      <StudentWorkspace
        lesson={lesson}
        task={task}
        cs={cs}
        viewingTaskId={1}
        currentTaskId={2}
        isViewingPrev
        isForcedTeacherLive={false}
        displayDesktop={makeDefaultDesktop(['fileManager'])}
      />
    )
    expect(screen.queryByRole('button', { name: /New Folder/i })).not.toBeInTheDocument()
    expect(cs.handleDesktopChange).not.toHaveBeenCalled()
  })
})
