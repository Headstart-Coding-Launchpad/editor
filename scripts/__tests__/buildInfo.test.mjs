// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { getBuildInfo } from '../build-info.mjs'

const NOW = new Date('2026-09-29T14:30:00Z')

function fakeGit(answers) {
  return (command) => {
    if (!(command in answers)) throw new Error(`unexpected ${command}`)
    const answer = answers[command]
    if (answer instanceof Error) throw answer
    return answer
  }
}

describe('getBuildInfo', () => {
  it('uses MAJOR.MINOR from package.json and the commit count as the build number', () => {
    const run = fakeGit({
      'git rev-parse --is-shallow-repository': 'false',
      'git rev-list --count HEAD': '985',
      'git rev-parse --short HEAD': '7a69ce2',
    })
    expect(getBuildInfo({ packageVersion: '1.0.0', run, now: NOW })).toEqual({
      version: '1.0',
      build: 985,
      commit: '7a69ce2',
      builtAt: '2026-09-29T14:30:00.000Z',
    })
  })

  it('omits the build number in a shallow clone rather than reporting a tiny count', () => {
    const run = fakeGit({
      'git rev-parse --is-shallow-repository': 'true',
      'git rev-parse --short HEAD': '7a69ce2',
    })
    const info = getBuildInfo({ packageVersion: '1.2.0', run, now: NOW })
    expect(info.version).toBe('1.2')
    expect(info.build).toBeNull()
    expect(info.commit).toBe('7a69ce2')
  })

  it('still returns a version when git is unavailable', () => {
    const run = () => {
      throw new Error('git not found')
    }
    expect(getBuildInfo({ packageVersion: '1.0.0', run, now: NOW })).toEqual({
      version: '1.0',
      build: null,
      commit: null,
      builtAt: '2026-09-29T14:30:00.000Z',
    })
  })
})
