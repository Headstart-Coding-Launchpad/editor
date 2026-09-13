import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// docs/authoring/validation-errors.md explains every validation message to lesson authors
// (mostly the CLI authoring agent). This keeps it complete: any errors.push()/warnings.push()
// message in the validators must appear in the doc, with `…` in place of each ${...}.

const VALIDATOR_FILES = [
  'cli/validate.mjs',
  'src/shared/checkAuthoringValidation.js',
  'src/shared/composedLesson.js',
  'src/shared/draftLesson.js',
  'src/shared/topicAudit.js',
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
  })

  it.each(validatorMessages())('documents "%s"', (message) => {
    // Rows may combine related messages ("… an operator / … a value"), so check the
    // distinctive tail of the message after its leading "Task …" placeholder.
    const tail = message.replace(/^(Task|Group) … /, '')
    expect(doc).toContain(tail)
  })
})
