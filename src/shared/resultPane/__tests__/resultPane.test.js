import { describe, expect, it } from 'vitest'
import {
  chooseWorkspaceLayout,
  consoleBadge,
  countOutputLines,
  getTaskLayout,
  initialResultPane,
  paneAfterRun,
  runAnnouncement,
  stacksPictureAndTags,
  validateTaskLayout,
} from '../resultPane.js'

const ALL = ['picture', 'tags', 'console']

describe('chooseWorkspaceLayout', () => {
  it('keeps everything side by side before the workspace is measured', () => {
    expect(chooseWorkspaceLayout({ width: 0, height: 0, paneCount: 3, split: 58 })).toBe('side')
  })

  it('stacks the editor above the result pane on phones', () => {
    expect(chooseWorkspaceLayout({ isMobile: true, width: 0, height: 0 })).toBe('below')
  })

  it('stacks on portrait screens (768 × 1024 and 820 × 1180 tablets)', () => {
    expect(chooseWorkspaceLayout({ width: 560, height: 850, paneCount: 3, split: 58 })).toBe(
      'below'
    )
    expect(chooseWorkspaceLayout({ width: 600, height: 1000, paneCount: 2, split: 50 })).toBe(
      'below'
    )
  })

  it('uses tabs for three panes on a 1366 × 768 Chromebook in landscape', () => {
    // 1366 × 768: the explainer takes ~26%, the workspace is ~980 × 550.
    expect(chooseWorkspaceLayout({ width: 980, height: 550, paneCount: 3, split: 58 })).toBe('tabs')
    // Explainer folded away: wider, but still too short for three panes.
    expect(chooseWorkspaceLayout({ width: 1300, height: 560, paneCount: 3, split: 58 })).toBe(
      'tabs'
    )
  })

  it('never tabs the picture and the console alone in landscape (picture above console)', () => {
    expect(chooseWorkspaceLayout({ width: 980, height: 550, paneCount: 2, split: 58 })).toBe('side')
    expect(chooseWorkspaceLayout({ width: 740, height: 600, paneCount: 2, split: 50 })).toBe('side')
    expect(chooseWorkspaceLayout({ width: 980, height: 400, paneCount: 2, split: 50 })).toBe('side')
    // Portrait still puts the editor above the result pane.
    expect(chooseWorkspaceLayout({ width: 600, height: 1000, paneCount: 2, split: 50 })).toBe(
      'below'
    )
  })

  it('keeps a wide desktop (1920 × 1080) side by side', () => {
    expect(chooseWorkspaceLayout({ width: 1400, height: 820, paneCount: 3, split: 58 })).toBe(
      'side'
    )
  })

  it('never tabs a single pane (a plain console task) in landscape', () => {
    expect(chooseWorkspaceLayout({ width: 900, height: 500, paneCount: 1, split: 58 })).toBe('side')
  })
})

describe('getTaskLayout / validateTaskLayout', () => {
  it('reads firstPane and ignores anything else', () => {
    expect(getTaskLayout({ layout: { firstPane: 'tags' } })).toEqual({ firstPane: 'tags' })
    expect(getTaskLayout({ layout: { firstPane: 'nope' } })).toEqual({ firstPane: null })
    expect(getTaskLayout({ layout: 'uk' })).toBeNull()
    expect(getTaskLayout({})).toBeNull()
  })

  function validate(task) {
    const errors = []
    const warnings = []
    validateTaskLayout(task, 3, errors, warnings)
    return { errors, warnings }
  }

  it('accepts a valid hint and no hint', () => {
    expect(validate({})).toEqual({ errors: [], warnings: [] })
    expect(validate({ layout: { firstPane: 'console' } })).toEqual({ errors: [], warnings: [] })
    expect(validate({ layout: { firstPane: 'tags' }, showVariables: { mode: 'view' } })).toEqual({
      errors: [],
      warnings: [],
    })
  })

  it('rejects a layout that is not an object or an unknown pane', () => {
    expect(validate({ layout: 'picture' }).errors[0]).toMatch(/Task 3 layout must be an object/)
    expect(validate({ layout: { firstPane: 'stage' } }).errors[0]).toBe(
      'Task 3 layout.firstPane must be one of: picture, tags, console'
    )
  })

  it('warns about unknown fields and a Tags pane the task does not have', () => {
    expect(validate({ layout: { firstPane: 'picture', size: 2 } }).warnings[0]).toMatch(
      /layout has unknown fields \(size\)/
    )
    expect(validate({ layout: { firstPane: 'tags' } }).warnings[0]).toMatch(
      /no showVariables name-tag panel/
    )
  })
})

describe('initialResultPane', () => {
  it("uses the author's firstPane when the task has that tab", () => {
    expect(initialResultPane({ available: ALL, firstPane: 'console', tagsMode: 'predict' })).toBe(
      'console'
    )
    expect(initialResultPane({ available: ['console'], firstPane: 'picture' })).toBe('console')
  })

  it('opens on Tags in predict and target mode', () => {
    expect(initialResultPane({ available: ALL, tagsMode: 'predict' })).toBe('tags')
    expect(initialResultPane({ available: ALL, tagsMode: 'target', pictureGoal: true })).toBe(
      'tags'
    )
  })

  it('opens on the Picture with a picture goal or in a drawing module', () => {
    expect(initialResultPane({ available: ALL, tagsMode: 'view', pictureGoal: true })).toBe(
      'picture'
    )
    expect(initialResultPane({ available: ['picture', 'console'], preferPicture: true })).toBe(
      'picture'
    )
  })

  it('otherwise opens on Tags, then the Console', () => {
    expect(initialResultPane({ available: ALL, tagsMode: 'view' })).toBe('tags')
    expect(initialResultPane({ available: ['picture', 'console'] })).toBe('console')
  })
})

describe('paneAfterRun', () => {
  it('shows the Picture when the program drew', () => {
    expect(paneAfterRun({ available: ALL, drew: true, tagsMode: 'predict' })).toBe('picture')
  })

  it('shows the Picture for a picture goal even before anything is drawn', () => {
    expect(paneAfterRun({ available: ALL, pictureGoal: true })).toBe('picture')
  })

  it('shows Tags in predict / target mode when nothing was drawn', () => {
    expect(paneAfterRun({ available: ALL, tagsMode: 'target' })).toBe('tags')
  })

  it('shows the Console otherwise, and for an error before any drawing', () => {
    expect(paneAfterRun({ available: ALL, tagsMode: 'view' })).toBe('console')
    expect(paneAfterRun({ available: ALL, error: true, tagsMode: 'predict' })).toBe('console')
    expect(paneAfterRun({ available: ALL, error: true, drew: true })).toBe('picture')
  })

  it('shows the Picture (or Tags) during slow-mo', () => {
    expect(paneAfterRun({ available: ALL, slowMo: true })).toBe('picture')
    expect(paneAfterRun({ available: ['tags', 'console'], slowMo: true })).toBe('tags')
  })
})

describe('stacksPictureAndTags', () => {
  it('stacks during slow-mo when both panes exist', () => {
    expect(stacksPictureAndTags({ available: ALL, slowMo: true })).toBe(true)
    expect(stacksPictureAndTags({ available: ['picture', 'console'], slowMo: true })).toBe(false)
  })

  it('stacks in predict / target mode once there is a picture to see', () => {
    expect(stacksPictureAndTags({ available: ALL, tagsMode: 'predict' })).toBe(false)
    expect(stacksPictureAndTags({ available: ALL, tagsMode: 'predict', pictureShown: true })).toBe(
      true
    )
    expect(stacksPictureAndTags({ available: ALL, tagsMode: 'view', pictureShown: true })).toBe(
      false
    )
  })
})

describe('the Console badge', () => {
  it('counts output lines, ignoring a trailing newline', () => {
    expect(countOutputLines('')).toBe(0)
    expect(countOutputLines('a\nb\n')).toBe(2)
    expect(countOutputLines('a\n\nb')).toBe(3)
    expect(countOutputLines(null)).toBe(0)
  })

  it('shows unseen lines, an error marker, or nothing', () => {
    expect(consoleBadge({ total: 4, seen: 1 })).toEqual({
      text: '3',
      label: '3 new lines in the Console',
      tone: 'info',
    })
    expect(consoleBadge({ total: 1, seen: 0 }).label).toBe('1 new line in the Console')
    expect(consoleBadge({ total: 250, seen: 0 }).text).toBe('99+')
    expect(consoleBadge({ total: 2, seen: 2 })).toBeNull()
    expect(consoleBadge({ total: 2, seen: 2, error: true })).toMatchObject({
      text: '!',
      tone: 'error',
    })
  })

  it('announces the pane and any hidden console lines', () => {
    expect(runAnnouncement({ pane: 'picture', badge: consoleBadge({ total: 3, seen: 0 }) })).toBe(
      'Picture updated. 3 new lines in the Console'
    )
    expect(runAnnouncement({ pane: 'picture', stacked: true })).toBe('Picture and Tags updated')
    expect(runAnnouncement({ pane: 'console' })).toBe('Console updated')
  })
})
