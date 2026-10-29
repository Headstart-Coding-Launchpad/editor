import { render, screen, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoomRoute from '../RoomRoute'

const state = vi.hoisted(() => ({ callback: null }))

vi.mock('firebase/database', () => ({ ref: (_db, path) => ({ path }) }))
vi.mock('../../../shared/firebase', () => ({ db: {} }))
vi.mock('../../../shared/onValueWhenSignedIn', () => ({
  onValueWhenSignedIn: (dbRef, callback) => {
    state.callback = { dbRef, callback }
    return () => {}
  },
}))
vi.mock('../../hooks/useIdentity', () => ({ useIdentity: () => ({ loaded: true }) }))

function Where() {
  const location = useLocation()
  return <div data-testid="where">{location.pathname + location.search}</div>
}

function renderRoom(path = '/room/sam') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/room/:handle" element={<RoomRoute />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('RoomRoute (/room/<handle>)', () => {
  beforeEach(() => {
    state.callback = null
  })

  it('waits for the tutor, then takes the student to that tutor’s live lesson', () => {
    renderRoom()
    expect(state.callback.dbRef).toEqual({ path: 'rooms/sam' })
    act(() => state.callback.callback({ exists: () => false }))
    expect(screen.getByTestId('room-waiting')).toHaveTextContent('Waiting for your tutor')
    act(() =>
      state.callback.callback({
        exists: () => true,
        val: () => ({ lessonId: 'abc123', sessionKey: 'abc123~sam', startedAt: 1 }),
      })
    )
    expect(screen.getByTestId('where')).toHaveTextContent('/lesson/abc123?t=sam')
  })

  it('sends a link that is not a plain handle to the home page without listening', () => {
    renderRoom('/room/a.b')
    expect(state.callback).toBeNull()
    expect(screen.getByTestId('where')).toHaveTextContent('/')
  })
})
