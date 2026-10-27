import { onValue } from 'firebase/database'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'

// Live session data is readable only when signed in (students sign in anonymously; #288).
// A listener attached before the sign-in lands is refused and cancelled for good, so this
// waits for a user, then attaches. Returns the unsubscribe function. Unit tests get a
// signed-in stand-in from src/test/setup.js.
export function onValueWhenSignedIn(dbRef, callback) {
  let unsubValue = null
  let done = false
  const unsubAuth = onAuthStateChanged(auth, (user) => {
    if (!user || done || unsubValue) return
    unsubValue = onValue(dbRef, callback)
  })
  return () => {
    done = true
    unsubAuth()
    if (unsubValue) unsubValue()
  }
}
