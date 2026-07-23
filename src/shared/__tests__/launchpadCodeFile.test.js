import { describe, expect, it } from 'vitest'
import {
  LAUNCHPAD_CODE_FILE_FORMAT,
  LAUNCHPAD_CODE_FILE_VERSION,
  createLaunchpadCodeFile,
  makeLaunchpadFilename,
  parseLaunchpadCodeFile,
} from '../launchpadCodeFile'

describe('LaunchPad code files', () => {
  it('creates one consistent Python file shape for one or many tasks', () => {
    const file = createLaunchpadCodeFile([
      { id: 3, title: 'Draw a square', code: 'print("square")' },
      { id: 4, title: 'Final challenge', code: 'print("done")' },
    ], { exportedAt: '2026-07-22T12:00:00.000Z' })

    expect(file).toEqual({
      format: LAUNCHPAD_CODE_FILE_FORMAT,
      version: LAUNCHPAD_CODE_FILE_VERSION,
      language: 'python',
      exportedAt: '2026-07-22T12:00:00.000Z',
      tasks: [
        { id: 3, title: 'Draw a square', code: 'print("square")' },
        { id: 4, title: 'Final challenge', code: 'print("done")' },
      ],
    })
  })

  it('validates and restores exported files', () => {
    const source = createLaunchpadCodeFile([{ id: 1, title: 'One', code: 'print(1)' }])
    expect(parseLaunchpadCodeFile(JSON.stringify(source))).toMatchObject({
      language: 'python',
      tasks: [{ id: 1, title: 'One', code: 'print(1)' }],
    })
  })

  it('rejects malformed or incompatible files', () => {
    expect(() => parseLaunchpadCodeFile('not json')).toThrow(/valid LaunchPad/i)
    expect(() => parseLaunchpadCodeFile(JSON.stringify({ format: 'other', tasks: [] }))).toThrow(/supported/i)
    expect(() => parseLaunchpadCodeFile(JSON.stringify({
      format: LAUNCHPAD_CODE_FILE_FORMAT,
      version: LAUNCHPAD_CODE_FILE_VERSION,
      language: 'python',
      tasks: [],
    }))).toThrow(/does not contain/i)
  })

  it('uses the same .launchpad extension for every export', () => {
    expect(makeLaunchpadFilename('Draw a square')).toBe('draw-a-square.launchpad')
    expect(makeLaunchpadFilename()).toBe('my-python-code.launchpad')
  })
})
