// Builder conversion into the Arrange task format (moved unchanged from TaskEditor's
// handleTaskTypeChange). Keeps the task's module when it is a host module (python by
// default), drops the code-task fields an arrangement doesn't use, and seeds two empty
// single-blank lines and, for HTML, the entry file. Pure.
import { hostModuleFor } from './definition.js'

export function convertToCodeArrange(base) {
  const nextModuleType = hostModuleFor(base.moduleType)
  const {
    copyCode: _copyCode,
    codeStages: _codeStages,
    carryCodeFrom: _c1,
    carryBlocksFrom: _c2,
    carryFsFrom: _c3,
    carryCircuitFrom: _c4,
    ...rest
  } = base
  return {
    ...rest,
    taskType: 'code_arrange',
    moduleType: nextModuleType,
    moduleId: base.moduleId,
    lines: base.lines?.length
      ? base.lines
      : [
          { id: 'line-1', parts: [{ type: 'slot', id: 'line-1-slot-1', code: '' }] },
          { id: 'line-2', parts: [{ type: 'slot', id: 'line-2-slot-1', code: '' }] },
        ],
    distractors: base.distractors ?? [],
    ...(nextModuleType === 'html'
      ? {
          entryFile: base.entryFile ?? 'index.html',
          starterFiles: base.starterFiles?.length
            ? base.starterFiles
            : [{ name: base.entryFile ?? 'index.html', type: 'html', content: '' }],
        }
      : {}),
    check: null,
  }
}
