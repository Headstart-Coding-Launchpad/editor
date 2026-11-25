import { createElement as h } from 'react'
import { render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { RUN_ERROR, guardDecision, readShotVerdict } from './lesson-ready-run.mjs'
import CheckFeedbackBanner from '../src/app/components/CheckFeedbackBanner.jsx'
import OutputPanel from '../src/app/components/OutputPanel.jsx'
import { SETUP_ERROR_TEXT } from '../src/shared/puzzle/setupCode.js'

const read = () => readShotVerdict([SETUP_ERROR_TEXT, RUN_ERROR.source])

afterEach(cleanup)

// `lessons ready` reads the verdict from what the child sees. These render the real components
// it reads, so a UI change that would make it misread a run fails here, not in a lesson check.
describe('readShotVerdict reads the real check banner and output panel', () => {
  it('reads a pass', () => {
    render(h(CheckFeedbackBanner, { passed: true }))
    expect(read()).toMatchObject({ verdict: 'passed', hintShown: null })
  })

  it('reads a fail and the hint the child sees', () => {
    render(h(CheckFeedbackBanner, { passed: false, suggestion: 'Print the word **hello**.' }))
    const seen = read()
    expect(seen.verdict).toBe('failed')
    expect(seen.hintShown).toContain('Print the word hello.')
  })

  it('reads the docked (calm screen) banner too', () => {
    render(
      h(CheckFeedbackBanner, {
        passed: false,
        docked: true,
        settled: true,
        suggestion: 'Try a loop.',
      })
    )
    expect(read()).toMatchObject({ verdict: 'failed', hintShown: 'Try a loop.' })
  })

  it('has no verdict without a banner', () => {
    render(h('div', { role: 'status' }, 'Getting Python ready…'))
    expect(read().verdict).toBeNull()
  })

  it('reads the output, a run error and a setup error', async () => {
    render(
      h(OutputPanel, {
        output: `Traceback (most recent call last):\nNameError: name 'x' is not defined\n${SETUP_ERROR_TEXT}`,
        runStatus: 'error',
        collapsible: false,
      })
    )
    await waitFor(() => expect(read().setupError).toBe(true))
    const seen = read()
    expect(seen.runError).toBe(true)
    expect(seen.output).toContain('NameError')
    expect(seen.output.startsWith('Output')).toBe(false)
  })

  it('reads a run error from the status word when no traceback shows', async () => {
    render(
      h(OutputPanel, { output: 'turtle has no Turtle', runStatus: 'error', collapsible: false })
    )
    await waitFor(() => expect(read().output).toContain('turtle has no Turtle'))
    expect(read()).toMatchObject({ runError: true, setupError: false })
  })

  it('a program that prints "Error:" on purpose did not error', async () => {
    render(
      h(OutputPanel, {
        output: 'Error: wrong password\n',
        runStatus: 'success',
        collapsible: false,
      })
    )
    await waitFor(() => expect(read().output).toContain('wrong password'))
    expect(read().runError).toBe(false)
  })

  it('a clean run has no error', async () => {
    render(h(OutputPanel, { output: 'hello\n', runStatus: 'success', collapsible: false }))
    await waitFor(() => expect(read().output).toContain('hello'))
    expect(read()).toMatchObject({ runError: false, setupError: false })
  })
})

describe('guardDecision', () => {
  it('blocks every Firebase request that could write', () => {
    for (const url of [
      'https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel',
      'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel',
      'https://hsc-default-rtdb.europe-west1.firebasedatabase.app/.json',
      'https://hsc.firebaseio.com/.lp',
      'https://identitytoolkit.googleapis.com/v1/accounts:signUp',
      'https://securetoken.googleapis.com/v1/token',
      'https://europe-west2-hsc.cloudfunctions.net/createAccount',
    ]) {
      expect(guardDecision(url, 'POST'), url).toBe('block')
    }
    expect(guardDecision('https://firebasestorage.googleapis.com/v0/b/x/o', 'POST')).toBe('block')
  })

  it('allows Storage reads and everything else', () => {
    expect(guardDecision('https://firebasestorage.googleapis.com/v0/b/x/o/cat.png', 'GET')).toBe(
      'allow'
    )
    expect(guardDecision('https://cdn.jsdelivr.net/pyodide/v0.26.0/full/pyodide.js')).toBe('allow')
    expect(guardDecision('https://headstart-coding-launchpad.github.io/editor/')).toBe('allow')
  })
})
