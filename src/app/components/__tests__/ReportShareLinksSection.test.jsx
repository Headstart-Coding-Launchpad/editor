import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../shared/exportWork/shareService.js', () => ({
  revokeShareLink: vi.fn(async () => {}),
}))

import ReportShareLinksSection from '../ReportShareLinksSection'
import { revokeShareLink } from '../../../shared/exportWork/shareService.js'

const report = {
  students: [
    { studentLabel: 'Student 1', studentKey: 's_a' },
    { studentLabel: 'Student 2', studentKey: 's_b' },
  ],
  shareLinks: [
    {
      studentKey: 's_a',
      kind: 'scratch',
      taskTitle: 'Dance party',
      shareId: 'id1',
      url: 'https://x/#/share/id1',
      expiresAt: Date.UTC(2026, 10, 20),
    },
    { studentKey: 's_b', error: 'too big' },
  ],
}

describe('ReportShareLinksSection', () => {
  it('renders nothing without links', () => {
    const { container } = render(<ReportShareLinksSection report={{ students: [] }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists each link under the anonymous label, copies all, and revokes one', async () => {
    const writeText = vi.fn(async () => {})
    Object.assign(navigator, { clipboard: { writeText } })
    render(<ReportShareLinksSection report={report} />)
    expect(screen.getByText('Student 1')).toBeInTheDocument()
    expect(screen.getByText('Scratch · Dance party')).toBeInTheDocument()
    expect(screen.getByText(/No link: too big/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Copy all (1)' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Student 1: https://x/#/share/id1'))

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))
    await waitFor(() => expect(screen.getByText('Revoked')).toBeInTheDocument())
    expect(revokeShareLink).toHaveBeenCalledWith('id1')
  })
})
