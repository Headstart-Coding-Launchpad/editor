import { vi } from 'vitest'

// A stand-in for usePeerHelp in view tests, so they never touch Firebase. Tests set
// `peerHelpMock.overrides` (e.g. { requestPeerHelp: vi.fn() }) before rendering.
export const peerHelpMock = { overrides: {} }

export function makePeerHelp(overrides = {}) {
  const asyncFn = () => vi.fn(() => Promise.resolve())
  return {
    ownRequest: null,
    ownRequestId: null,
    ownState: null,
    ownInbox: null,
    ownSnapshot: null,
    helpingRequestId: null,
    helpingSnapshot: null,
    helpingState: null,
    helpingInbox: null,
    helpingReview: null,
    hasPromised: false,
    setSnapshotBuilder: () => {},
    requestPeerHelp: asyncFn(),
    endOwnRequest: asyncFn(),
    respondToItem: asyncFn(),
    flagNotOk: asyncFn(),
    makeHelperPromise: asyncFn(),
    claimOffer: vi.fn(() => Promise.resolve(true)),
    sendMark: asyncFn(),
    sendHint: asyncFn(),
    submitEdit: asyncFn(),
    submitNote: asyncFn(),
    requestLatestSnapshot: asyncFn(),
    finishHelping: asyncFn(),
    allRequests: null,
    allPeerHelp: null,
    offerToClass: asyncFn(),
    endRequestAsTeacher: asyncFn(),
    endRequestForStudent: asyncFn(),
    approveItem: asyncFn(),
    rejectItem: asyncFn(),
    acknowledgeNotOk: asyncFn(),
    setNotesEnabled: asyncFn(),
    setHelperOff: asyncFn(),
    pauseAllPeerHelp: asyncFn(),
    resumePeerHelp: asyncFn(),
    readPeerHelpForReport: vi.fn(() => Promise.resolve(null)),
    ...overrides,
  }
}

export const peerHelpModuleMock = {
  usePeerHelp: () => makePeerHelp(peerHelpMock.overrides),
  clearPeerHelpData: () => Promise.resolve(),
}
