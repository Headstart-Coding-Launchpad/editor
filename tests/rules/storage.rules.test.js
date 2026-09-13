import { afterAll, beforeAll, describe, it } from 'vitest'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { contexts, createTestEnvironment } from './setup.js'

let testEnv
let as

beforeAll(async () => {
  testEnv = await createTestEnvironment()
  as = contexts(testEnv)
  await testEnv.withSecurityRulesDisabled((ctx) =>
    ctx.storage().ref('lessons/lesson-1/assets/cat.png').putString('png-bytes')
  )
})

afterAll(async () => {
  await testEnv?.cleanup()
})

const file = (ctx, path) => ctx.storage().ref(path)

describe('storage', () => {
  it('lets anyone read lesson assets', async () => {
    await assertSucceeds(file(as.anonymous, 'lessons/lesson-1/assets/cat.png').getDownloadURL())
  })

  it.each(['lessons/lesson-1/assets/new.png', 'shared/scratch/assets/new.png'])(
    'only lets admins upload %s',
    async (path) => {
      await assertFails(file(as.teacher, path).putString('x'))
      await assertFails(file(as.student, path).putString('x'))
      await assertSucceeds(file(as.admin, path).putString('x'))
    }
  )

  it('denies paths outside the asset folders', async () => {
    await assertFails(file(as.admin, 'lessons/lesson-1/private.txt').putString('x'))
    await assertFails(file(as.anonymous, 'anything/else.txt').getDownloadURL())
  })
})
