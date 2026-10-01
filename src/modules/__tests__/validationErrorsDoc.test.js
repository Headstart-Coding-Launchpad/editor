import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// docs/authoring/validation-errors.md explains every validation message to lesson authors
// (mostly the CLI authoring agent). This keeps it complete: any errors.push()/warnings.push()
// message in the validators must appear in the doc, with `…` in place of each ${...}.
// The shared rules live in src/shared/lessonValidation.js and each module definition's
// validateTask; cli/validate.mjs and src/builder/lessonUtils.js hold only their own extras.

const MODULE_DEFINITION_FILES = readdirSync(resolve(process.cwd(), 'src/modules'), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
  .map((entry) => `src/modules/${entry.name}/definition.js`)
  .filter((file) => existsSync(resolve(process.cwd(), file)))

// Each activity's pure files (definition.js and its logic module, e.g. binary/binary.js) hold
// its validateTask messages. UI files (.jsx) are skipped.
const ACTIVITY_DEFINITION_FILES = readdirSync(resolve(process.cwd(), 'src/activities'), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_') && entry.name !== 'ui')
  .flatMap((entry) =>
    readdirSync(resolve(process.cwd(), 'src/activities', entry.name), { withFileTypes: true })
      .filter((file) => file.isFile() && file.name.endsWith('.js'))
      .map((file) => `src/activities/${entry.name}/${file.name}`)
  )

const VALIDATOR_FILES = [
  'cli/validate.mjs',
  'src/builder/lessonUtils.js',
  'src/shared/lessonValidation.js',
  'src/modules/moduleTaskValidation.js',
  'src/activities/legacyValidation.js',
  ...MODULE_DEFINITION_FILES,
  ...ACTIVITY_DEFINITION_FILES,
  'src/shared/checkAuthoringValidation.js',
  'src/shared/input/checks.js',
  'src/modules/python/checks.js',
  'src/shared/composedLesson.js',
  'src/shared/draftLesson.js',
  'src/shared/topicAudit.js',
  'src/badges/validation.js',
]

const normalize = (text) => text.replace(/\s+/g, ' ').trim()

function validatorMessages() {
  const messages = new Set()
  for (const file of VALIDATOR_FILES) {
    const source = readFileSync(resolve(process.cwd(), file), 'utf8')
    const pattern = /(?:errors|warnings)\.push\(\s*([`'"])([\s\S]*?)\1\s*\)/g
    let match
    while ((match = pattern.exec(source))) {
      messages.add(normalize(match[2].replace(/\$\{[^}]*\}/g, '…')))
    }
  }
  return [...messages]
}

describe('validation errors doc', () => {
  const doc = normalize(
    readFileSync(resolve(process.cwd(), 'docs/authoring/validation-errors.md'), 'utf8')
  )

  it('finds the validator messages it is meant to check', () => {
    expect(validatorMessages().length).toBeGreaterThan(80)
    expect(ACTIVITY_DEFINITION_FILES).toEqual(
      expect.arrayContaining([
        'src/activities/binary/binary.js',
        'src/activities/keyboard/keyboard.js',
        'src/activities/mouse/mouse.js',
        'src/activities/unknown/definition.js',
      ])
    )
  })

  it.each(validatorMessages())('documents "%s"', (message) => {
    // Rows may combine related messages ("… an operator / … a value"), so check the
    // distinctive tail of the message after its leading "Task …" placeholder.
    const tail = message.replace(/^(Task|Group) … /, '')
    expect(doc).toContain(tail)
  })
})
