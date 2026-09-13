import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'

export const PROJECT_ID = 'demo-hsc-rules'

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8')

// Each test file gets its own environment loaded with the real rules files from the
// repo root, so a rules change is tested exactly as it will be deployed.
export function createTestEnvironment() {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    database: { rules: read('database.rules.json') },
    firestore: { rules: read('firestore.rules') },
    storage: { rules: read('storage.rules') },
  })
}

export const STUDENT_ID = 'student-1'
export const OTHER_STUDENT_ID = 'student-2'

// Students are login-less but signed in anonymously, so they have a uid and no role claim.
export function contexts(testEnv) {
  return {
    anonymous: testEnv.unauthenticatedContext(),
    student: testEnv.authenticatedContext(STUDENT_ID),
    otherStudent: testEnv.authenticatedContext(OTHER_STUDENT_ID),
    teacher: testEnv.authenticatedContext('teacher-1', { role: 'teacher' }),
    admin: testEnv.authenticatedContext('admin-1', { role: 'admin' }),
  }
}
