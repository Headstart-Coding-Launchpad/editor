import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ref } from 'firebase/database'
import { db } from '../../shared/firebase'
import { onValueWhenSignedIn } from '../../shared/onValueWhenSignedIn'
import { normaliseHandle } from '../../shared/sessionKey'
import { normaliseRoom, roomLessonHash, roomPath } from '../../shared/tutorRoom'
import { useIdentity } from '../hooks/useIdentity'
import LoadingScreen from '../components/LoadingScreen'

// A tutor's permanent class link, /room/<handle>: waits for that tutor to start a lesson, then
// takes the student to it (/lesson/<lessonId>?t=<handle>). Nothing is written here; the student
// just needs the anonymous sign-in the live lesson uses.
export default function RoomRoute() {
  const { handle: rawHandle } = useParams()
  const handle = normaliseHandle(rawHandle)
  const { loaded } = useIdentity()
  const [room, setRoom] = useState(undefined)

  useEffect(() => {
    if (!handle) return undefined
    return onValueWhenSignedIn(ref(db, roomPath(handle)), (snap) =>
      setRoom(normaliseRoom(snap.exists() ? snap.val() : null))
    )
  }, [handle])

  if (!handle) return <Navigate to="/" replace />
  if (room) return <Navigate to={roomLessonHash(handle, room)} replace />
  if (!loaded || room === undefined) return <LoadingScreen message="Finding your class…" />
  return (
    <main
      style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', textAlign: 'center' }}
    >
      <div role="status" data-testid="room-waiting">
        <h1>Waiting for your tutor</h1>
        <p>Your lesson will open here by itself as soon as it starts.</p>
      </div>
    </main>
  )
}
