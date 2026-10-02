import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import HelpRequestButton from '../HelpRequestButton'
import PeerHelpFeedbackRail from '../PeerHelpFeedbackRail'
import PeerHelpInbox from '../PeerHelpInbox'
import TeacherPeerHelpStudentPanel from '../TeacherPeerHelpStudentPanel'
import TeacherPeerHelpAlertBanner from '../TeacherPeerHelpAlertBanner'
import TeacherPeerHelpMenu from '../TeacherPeerHelpMenu'
import { peerHelpAnchors } from '../../../peerHelpAnchors'

vi.mock('../../SharedWorkspacePreview', async (importOriginal) => ({
  ...(await importOriginal()),
  default: () => <div data-testid="snapshot-preview" />,
}))

const snapshot = { code: 'if x\nprint(x)\nend', lessonType: 'python', taskId: 2 }
const anchors = peerHelpAnchors(snapshot, 'python', null)

describe('HelpRequestButton', () => {
  it('is a plain button where peer help is not available', () => {
    const onAskTeacher = vi.fn()
    render(<HelpRequestButton onAskTeacher={onAskTeacher} />)
    fireEvent.click(screen.getByRole('button', { name: 'Need Help' }))
    expect(onAskTeacher).toHaveBeenCalled()
  })

  it('offers the classmate opt-in, and promises the name stays hidden', () => {
    const onAskWithPeers = vi.fn()
    render(
      <HelpRequestButton peerHelpAvailable onAskTeacher={vi.fn()} onAskWithPeers={onAskWithPeers} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Need Help' }))
    expect(screen.getByText(/name is never shown/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /a classmate can help too/ }))
    expect(onAskWithPeers).toHaveBeenCalled()
  })
})

describe('PeerHelpFeedbackRail', () => {
  const props = (over = {}) => ({
    anchors,
    lessonType: 'python',
    task: null,
    inbox: null,
    review: null,
    notesEnabled: false,
    ended: false,
    onMark: vi.fn(() => Promise.resolve()),
    onHint: vi.fn(() => Promise.resolve()),
    onSubmitEdit: vi.fn(() => Promise.resolve()),
    onSubmitNote: vi.fn(() => Promise.resolve()),
    ...over,
  })

  it('marks a line and sends a preset hint (ids only)', async () => {
    const p = props()
    render(<PeerHelpFeedbackRail {...p} />)
    fireEvent.click(screen.getByRole('option', { name: /Line 1/ }))
    fireEvent.click(screen.getByRole('button', { name: /Look again/ }))
    await waitFor(() =>
      expect(p.onMark).toHaveBeenCalledWith({ file: '', line: 1, verdict: 'down' })
    )
    fireEvent.change(screen.getByLabelText('Pick a hint'), { target: { value: 'py-colon' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send hint' }))
    await waitFor(() =>
      expect(p.onHint).toHaveBeenCalledWith({ file: '', line: 1, hintId: 'py-colon' })
    )
  })

  it('only lets a 👎 line be changed, and sends the change to the teacher', async () => {
    const p = props()
    const { rerender } = render(<PeerHelpFeedbackRail {...p} />)
    fireEvent.click(screen.getByRole('option', { name: /Line 1/ }))
    expect(screen.queryByRole('button', { name: /Change this line/ })).toBeNull()
    rerender(
      <PeerHelpFeedbackRail
        {...p}
        inbox={{ m1: { kind: 'mark', file: '', line: 1, verdict: 'down', createdAt: 1 } }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Change this line/ }))
    fireEvent.change(screen.getByLabelText('Suggested line 1'), { target: { value: 'if x:' } })
    fireEvent.click(screen.getByRole('button', { name: /Send change to teacher/ }))
    await waitFor(() =>
      expect(p.onSubmitEdit).toHaveBeenCalledWith({
        file: '',
        edits: [{ file: '', line: 1, op: 'replace', text: 'if x:', before: 'if x' }],
      })
    )
  })

  it('hides notes unless the teacher turned them on; a blocked note is kept, not sent', async () => {
    const p = props()
    const { rerender } = render(<PeerHelpFeedbackRail {...p} />)
    fireEvent.click(screen.getByRole('option', { name: /Line 2/ }))
    expect(screen.queryByLabelText('Note')).toBeNull()
    rerender(<PeerHelpFeedbackRail {...p} notesEnabled />)
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'this is stupid' } })
    fireEvent.click(screen.getByRole('button', { name: /Send note to teacher/ }))
    await waitFor(() =>
      expect(p.onSubmitNote).toHaveBeenCalledWith({
        file: '',
        line: 2,
        text: 'this is stupid',
        blockedReason: 'language',
      })
    )
    expect(screen.getByText(/That note was not sent/)).toBeTruthy()
  })
})

describe('PeerHelpInbox', () => {
  const base = (over = {}) => ({
    offer: { offeredAt: 1, claimedAt: 2 },
    state: null,
    snapshot,
    lessonType: 'python',
    task: null,
    onRespond: vi.fn(() => Promise.resolve()),
    onAcceptEdit: vi.fn(() => Promise.resolve(true)),
    onNotOk: vi.fn(),
    onEnd: vi.fn(),
    onClose: vi.fn(),
    ...over,
  })

  it('shows the item with the line it is about, never who sent it', () => {
    render(
      <PeerHelpInbox
        {...base()}
        inbox={{ i1: { kind: 'hint', hintId: 'py-colon', file: '', line: 1, createdAt: 1 } }}
      />
    )
    expect(screen.getByText('A classmate is looking at your code.')).toBeTruthy()
    expect(screen.getByText('Line 1')).toBeTruthy()
    expect(screen.getByText(/colon/)).toBeTruthy()
  })

  it('accepts an approved edit, and explains when the code has moved on', async () => {
    const p = base()
    const edit = {
      kind: 'edit',
      file: '',
      line: 1,
      edits: { 0: { line: 1, op: 'replace', text: 'if x:', before: 'if x' } },
      createdAt: 1,
    }
    const { rerender } = render(<PeerHelpInbox {...p} inbox={{ e1: edit }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Use this change' }))
    await waitFor(() => expect(p.onRespond).toHaveBeenCalledWith('e1', 'accepted'))
    const stale = base({ onAcceptEdit: vi.fn(() => Promise.resolve(false)) })
    rerender(<PeerHelpInbox {...stale} inbox={{ e1: edit }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Use this change' }))
    await waitFor(() => expect(screen.getByText(/code has changed since then/)).toBeTruthy())
    expect(stale.onRespond).not.toHaveBeenCalled()
  })

  it('"Not OK" goes to the teacher, per item or for the whole help', () => {
    const p = base()
    render(
      <PeerHelpInbox
        {...p}
        inbox={{ i1: { kind: 'mark', verdict: 'down', file: '', line: 1, createdAt: 1 } }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^🚩 Not OK$/ }))
    expect(p.onNotOk).toHaveBeenCalledWith('i1')
    fireEvent.click(screen.getByRole('button', { name: /Something’s not OK/ }))
    expect(p.onNotOk).toHaveBeenCalledWith(null)
  })

  it('hides items already flagged Not OK', () => {
    render(
      <PeerHelpInbox
        {...base()}
        inbox={{
          i1: { kind: 'hint', hintId: 'py-colon', line: 1, response: 'not_ok', createdAt: 1 },
        }}
      />
    )
    expect(screen.queryByText(/colon/)).toBeNull()
  })
})

describe('teacher peer help', () => {
  const session = {
    currentTaskId: 2,
    students: {
      s1: { anonymousId: 's1', displayName: 'Sam' },
      h1: { anonymousId: 'h1', displayName: 'Hal', checkPassed: true },
    },
    peerHelpOffers: {},
  }
  const peerHelp = (over = {}) => ({
    allRequests: { s1: { requestId: 'r1', taskId: 2 } },
    allPeerHelp: { r1: { stuckId: 's1', snapshot } },
    offerToClass: vi.fn(),
    endRequestAsTeacher: vi.fn(),
    setHelperOff: vi.fn(),
    approveItem: vi.fn(),
    rejectItem: vi.fn(),
    acknowledgeNotOk: vi.fn(),
    setNotesEnabled: vi.fn(),
    pauseAllPeerHelp: vi.fn(),
    resumePeerHelp: vi.fn(),
    ...over,
  })

  it('lets the teacher check the work, then offer it or decline', () => {
    const ph = peerHelp()
    render(
      <TeacherPeerHelpStudentPanel
        student={session.students.s1}
        session={session}
        lesson={null}
        peerHelp={ph}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Check their work first' }))
    expect(screen.getByTestId('snapshot-preview')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Offer to classmates' }))
    expect(ph.offerToClass).toHaveBeenCalledWith('s1')
    fireEvent.click(screen.getByRole('button', { name: 'Not this time' }))
    expect(ph.endRequestAsTeacher).toHaveBeenCalledWith('r1')
  })

  it('switches a finished student off as a helper', () => {
    const ph = peerHelp({ allRequests: {}, allPeerHelp: {} })
    render(
      <TeacherPeerHelpStudentPanel
        student={session.students.h1}
        session={session}
        lesson={null}
        peerHelp={ph}
      />
    )
    fireEvent.click(screen.getByRole('checkbox', { name: /Can help classmates today/ }))
    expect(ph.setHelperOff).toHaveBeenCalledWith('h1', true)
  })

  it('raises a Not OK alert with names until it is seen', () => {
    const ph = peerHelp({
      allPeerHelp: { r1: { stuckId: 's1', helperId: 'h1', state: { notOkAt: 5 } } },
    })
    render(<TeacherPeerHelpAlertBanner session={session} peerHelp={ph} />)
    expect(screen.getByRole('alert').textContent).toMatch(/Sam said help from Hal was not OK/)
    fireEvent.click(screen.getByRole('button', { name: 'Stop them helping today' }))
    expect(ph.setHelperOff).toHaveBeenCalledWith('h1', true)
    fireEvent.click(screen.getByRole('button', { name: 'Seen' }))
    expect(ph.acknowledgeNotOk).toHaveBeenCalledWith('r1')
  })

  it('queues pending items for approval with who sent them to whom', () => {
    const ph = peerHelp({
      allPeerHelp: {
        r1: {
          stuckId: 's1',
          helperId: 'h1',
          snapshot,
          review: {
            i1: { kind: 'note', status: 'pending', line: 1, text: 'Try a colon', createdAt: 1 },
          },
        },
      },
    })
    render(<TeacherPeerHelpMenu session={session} lesson={null} peerHelp={ph} />)
    fireEvent.click(screen.getByRole('button', { name: /Peer help \(1\)/ }))
    expect(screen.getByText(/Hal → Sam · Line 1/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(ph.approveItem).toHaveBeenCalledWith('r1', 'i1')
    fireEvent.click(screen.getByRole('button', { name: 'End all peer help' }))
    expect(ph.pauseAllPeerHelp).toHaveBeenCalled()
  })
})
