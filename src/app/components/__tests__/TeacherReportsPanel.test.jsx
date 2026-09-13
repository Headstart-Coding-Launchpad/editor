import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import TeacherReportsPanel from '../TeacherReportsPanel'
import { fetchSessionReports } from '../../../shared/lessonService'

vi.mock('../../../shared/lessonService', () => ({
  fetchSessionReports: vi.fn(),
}))

describe('TeacherReportsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows an empty state when there are no past reports', async () => {
    fetchSessionReports.mockResolvedValue([])
    render(<TeacherReportsPanel lessonId="demo" onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText(/No past session reports yet/)).toBeInTheDocument()
    })
  })

  it('lists past reports and opens one on View', async () => {
    fetchSessionReports.mockResolvedValue([
      {
        id: '1000',
        startedAt: 1000,
        endedAt: 2000,
        students: [{ anonymousId: 'alice', displayName: 'Alice', tasks: [] }],
        taskSummary: [],
        lessonTitle: 'Demo Lesson',
      },
    ])
    render(<TeacherReportsPanel lessonId="demo" onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'View' }))
    expect(screen.getByText('Demo Lesson')).toBeInTheDocument()
  })

  it('surfaces a fetch error', async () => {
    fetchSessionReports.mockRejectedValue(new Error('permission-denied'))
    render(<TeacherReportsPanel lessonId="demo" onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText(/Could not load reports: permission-denied/)).toBeInTheDocument()
    })
  })

  it('shows a live report as an "In progress" row above past reports, and can open it', async () => {
    fetchSessionReports.mockResolvedValue([])
    const liveReport = {
      lessonId: 'demo',
      lessonTitle: 'Demo Lesson (live)',
      sessionId: '3000',
      startedAt: 3000,
      endedAt: null,
      students: [{ anonymousId: 'sam', displayName: 'Sam', tasks: [] }],
      taskSummary: [],
    }
    render(<TeacherReportsPanel lessonId="demo" liveReport={liveReport} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('In progress')).toBeInTheDocument()
    })
    expect(screen.queryByText(/No past session reports yet/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'View' }))
    expect(screen.getByText('Demo Lesson (live)')).toBeInTheDocument()
  })
})
