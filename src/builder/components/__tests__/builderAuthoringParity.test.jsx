import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getSandboxStarterSummary } from '../lesson-meta/SandboxStarterModal'
import { TaskFormatIcon } from '../task-editor/TaskEditorFields'
import { MODULE_TYPES } from '../../../modules/definitions'
import { legacySandboxStarterSummary } from '../../../modules/__tests__/helpers/legacyBuilderAuthoring.js'

vi.mock('../../../shared/useTypeAssets', () => ({
  useTypeAssets: () => ({ typeStorageAssets: [], defaultSprites: [], loading: false }),
}))

// Plan step 4.8: the Sandbox starter summary and the task-format icons no longer branch on
// lesson / task types. Both are compared against verbatim copies of the old code.

// Verbatim copy of the old task-editor/TaskEditorFields.jsx TaskFormatIcon.
function LegacyTaskFormatIcon({ type, size = 24 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }
  if (type === 'scratch')
    return (
      <svg {...common}>
        <rect x="2" y="2" width="9" height="9" rx="1.5" />
        <rect x="13" y="2" width="9" height="9" rx="1.5" />
        <rect x="2" y="13" width="9" height="9" rx="1.5" />
        <rect x="13" y="13" width="9" height="9" rx="1.5" />
      </svg>
    )
  if (type === 'information')
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
    )
  if (type === 'quiz')
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </svg>
    )
  if (type === 'activity')
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <circle cx="17.5" cy="6.5" r="3.5" />
        <path d="M6.5 14l3.5 7H3z" />
        <rect x="14" y="14" width="7" height="7" rx="3.5" />
      </svg>
    )
  return (
    <svg {...common}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}

const SANDBOX_LESSONS = [
  {},
  { sandboxStarter: 'a\nb\nc' },
  { sandboxStarter: '   ' },
  { sandboxStarter: '{"blocks":1}' },
  { sandboxStarterFiles: [{ name: 'index.html' }, { name: 'x.css' }] },
  { sandboxStarterFs: { '/': { type: 'dir' }, '/a.txt': { type: 'file' } } },
  { sandboxStarterFs: { '/': { type: 'dir' } } },
  { sandboxStarterCircuit: { components: [] } },
]

describe('Builder surfaces keep their old per-type output', () => {
  it('getSandboxStarterSummary matches the old per-type summary', () => {
    for (const type of [...MODULE_TYPES, 'nope', undefined]) {
      for (const fields of SANDBOX_LESSONS) {
        const lesson = { type, tasks: [], ...fields }
        expect(getSandboxStarterSummary(lesson)).toBe(legacySandboxStarterSummary(lesson))
      }
    }
  })

  it('TaskFormatIcon renders the same SVG for every icon id', () => {
    for (const type of [
      'scratch',
      'information',
      'quiz',
      'activity',
      'code',
      'code_arrange',
      'x',
    ]) {
      for (const size of [undefined, 16]) {
        const current = render(<TaskFormatIcon type={type} size={size} />)
        const legacy = render(<LegacyTaskFormatIcon type={type} size={size} />)
        expect(current.container.innerHTML).toBe(legacy.container.innerHTML)
        current.unmount()
        legacy.unmount()
      }
    }
  })
})
