import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import {
  initializeAuth,
  browserLocalPersistence,
  browserSessionPersistence,
  indexedDBLocalPersistence,
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

export const db = getDatabase(app)
// Sign-in lives in localStorage. Don't use getAuth() + setPersistence(): getAuth() prefers
// IndexedDB, so every newly opened tab moved the saved user out of localStorage and back
// again. The removal fired a storage event that looked like a sign-out in every other open
// tab, and a slow move back bounced them to /login (Ryan's Admin "auth issue", HSC Audit
// item 8; same family as #180/#279). IndexedDB is listed last only to rescue a user left
// there by the old code: it is migrated into localStorage once, with no removal event.
export const auth = initializeAuth(app, {
  persistence: [browserLocalPersistence, browserSessionPersistence, indexedDBLocalPersistence],
})
// Which Firestore database to use (Hub P24: the move to `eu` in London, see
// docs/architecture/firestore-europe-plan.md). The CLI, Functions and audit scripts use the same id.
export const firestore = getFirestore(
  app,
  import.meta.env.VITE_FIRESTORE_DATABASE_ID || '(default)'
)
export const functions = getFunctions(
  app,
  import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'europe-west1'
)
export const storage = getStorage(app)
