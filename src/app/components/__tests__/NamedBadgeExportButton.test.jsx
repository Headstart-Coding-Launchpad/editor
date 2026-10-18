import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AfterClassFeedbackModal from '../AfterClassFeedbackModal'
import NamedBadgeExportButton from '../NamedBadgeExportButton'

const { download } = vi.hoisted(() => ({ download: vi.fn() }))
vi.mock('../../../badges/namedBadgeExport', () => ({ downloadNamedBadgeCsv: download }))

const rows = [{ student: 'Test Student', badge: 'Bug Hunter', emoji: '🐛' }]
const lesson = { title: 'Demo Lesson' }

describe('NamedBadgeExportButton', () => {
  it('shows nothing when no badge was earned', () => {
    const { container } = render(<NamedBadgeExportButton rows={[]} lesson={lesson} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('downloads the rows for the lesson', () => {
    render(<NamedBadgeExportButton rows={rows} lesson={lesson} />)
    fireEvent.click(screen.getByRole('button', { name: /Badges with names/ }))
    expect(download).toHaveBeenCalledWith(rows, lesson)
  })

  it('is on the go-home feedback step', () => {
    render(
      <AfterClassFeedbackModal
        report={{ lessonTitle: 'Demo Lesson' }}
        tasks={[]}
        onSave={vi.fn()}
        onDone={vi.fn()}
        namedBadgeRows={rows}
        lesson={lesson}
      />
    )
    expect(screen.getByRole('button', { name: /Badges with names/ })).toBeInTheDocument()
  })
})
