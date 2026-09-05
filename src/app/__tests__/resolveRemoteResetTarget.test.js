import { describe, expect, it } from 'vitest'
import { resolveRemoteResetTarget } from '../studentTaskContent'

// Stage 0 is the starter, stage 1 a support stage. `stage_1` should resolve to stage 1's
// content, `starter` to stage 0's, `complete` to the task's complete fields.
const pythonTask = {
  id: 't1',
  starterCode: 'legacy starter',
  completeCode: 'print("done")',
  codeStages: [
    { role: 'starter', code: 'print("start")' },
    { role: 'support', code: 'print("halfway")' },
  ],
}

describe('resolveRemoteResetTarget', () => {
  it('returns null without a task or action', () => {
    expect(resolveRemoteResetTarget(null, 'starter', 'python')).toBeNull()
    expect(resolveRemoteResetTarget(pythonTask, null, 'python')).toBeNull()
  })

  it('returns null for an unknown lesson type', () => {
    expect(resolveRemoteResetTarget(pythonTask, 'starter', 'quiz')).toBeNull()
  })

  describe('python', () => {
    it('resolves starter to the starter stage', () => {
      expect(resolveRemoteResetTarget(pythonTask, 'starter', 'python')).toEqual({
        code: 'print("start")',
      })
    })

    it('resolves complete to completeCode', () => {
      expect(resolveRemoteResetTarget(pythonTask, 'complete', 'python')).toEqual({
        code: 'print("done")',
      })
    })

    it('resolves stage_<n> to that stage', () => {
      expect(resolveRemoteResetTarget(pythonTask, 'stage_1', 'python')).toEqual({
        code: 'print("halfway")',
      })
    })

    it('falls back to the starter stage for an out-of-range stage', () => {
      expect(resolveRemoteResetTarget(pythonTask, 'stage_9', 'python')).toEqual({
        code: 'print("start")',
      })
    })

    it('falls back to legacy starterCode when there are no stages', () => {
      const legacy = { starterCode: 'legacy starter' }
      expect(resolveRemoteResetTarget(legacy, 'starter', 'python')).toEqual({
        code: 'legacy starter',
      })
    })

    it('treats arcade the same as python', () => {
      expect(resolveRemoteResetTarget(pythonTask, 'complete', 'arcade')).toEqual({
        code: 'print("done")',
      })
    })
  })

  describe('html', () => {
    const htmlTask = {
      entryFile: 'index.html',
      starterFiles: [{ name: 'index.html', content: '<p>start</p>' }],
      completeFiles: [{ name: 'index.html', content: '<p>done</p>' }],
      completeEntryFile: 'index.html',
      codeStages: [
        {
          role: 'support',
          files: [{ name: 'step.html', content: '<p>step</p>' }],
          entryFile: 'step.html',
        },
      ],
    }

    it('resolves starter files and entry file', () => {
      expect(resolveRemoteResetTarget(htmlTask, 'starter', 'html')).toEqual({
        files: htmlTask.starterFiles,
        entryFile: 'index.html',
      })
    })

    it('resolves complete files and entry file', () => {
      expect(resolveRemoteResetTarget(htmlTask, 'complete', 'html')).toEqual({
        files: htmlTask.completeFiles,
        entryFile: 'index.html',
      })
    })

    it('resolves a stage to its own files and entry file', () => {
      expect(resolveRemoteResetTarget(htmlTask, 'stage_0', 'html')).toEqual({
        files: htmlTask.codeStages[0].files,
        entryFile: 'step.html',
      })
    })
  })

  describe('scratch', () => {
    const scratchTask = {
      starterBlocks: { blocks: 'starter' },
      completeBlocks: { blocks: 'complete' },
      codeStages: [{ role: 'support', blocks: { blocks: 'stage' } }],
    }

    it('clears the active stage for starter and complete', () => {
      expect(resolveRemoteResetTarget(scratchTask, 'starter', 'scratch')).toEqual({
        blocks: { blocks: 'starter' },
        stageIndex: null,
      })
      expect(resolveRemoteResetTarget(scratchTask, 'complete', 'scratch')).toEqual({
        blocks: { blocks: 'complete' },
        stageIndex: null,
      })
    })

    it('makes the reset stage active for stage_<n>', () => {
      expect(resolveRemoteResetTarget(scratchTask, 'stage_0', 'scratch')).toEqual({
        blocks: { blocks: 'stage' },
        stageIndex: 0,
      })
    })

    it('leaves no stage active when the stage does not exist', () => {
      expect(resolveRemoteResetTarget(scratchTask, 'stage_4', 'scratch')).toEqual({
        blocks: { blocks: 'starter' },
        stageIndex: null,
      })
    })
  })

  describe('filesystem and electronics', () => {
    const defaults = { fs: { root: 'default-fs' }, circuit: { parts: 'default-circuit' } }

    it('falls back to the supplied defaults', () => {
      expect(resolveRemoteResetTarget({}, 'starter', 'filesystem', defaults)).toEqual({
        fs: defaults.fs,
      })
      expect(resolveRemoteResetTarget({}, 'complete', 'electronics', defaults)).toEqual({
        circuit: defaults.circuit,
      })
    })

    it('prefers the task fields over the defaults', () => {
      const fsTask = { starterFs: { root: 'start' }, completeFs: { root: 'done' } }
      expect(resolveRemoteResetTarget(fsTask, 'complete', 'filesystem', defaults)).toEqual({
        fs: { root: 'done' },
      })

      const circuitTask = { starterCircuit: { parts: 'start' } }
      expect(resolveRemoteResetTarget(circuitTask, 'starter', 'electronics', defaults)).toEqual({
        circuit: { parts: 'start' },
      })
    })

    it('falls back from complete to starter when no complete state is authored', () => {
      const fsTask = { starterFs: { root: 'start' } }
      expect(resolveRemoteResetTarget(fsTask, 'complete', 'filesystem', defaults)).toEqual({
        fs: { root: 'start' },
      })
    })
  })
})
