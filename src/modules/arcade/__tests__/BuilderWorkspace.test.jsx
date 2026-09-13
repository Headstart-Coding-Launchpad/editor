import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BuilderWorkspace from '../BuilderWorkspace'

vi.mock('../../../shared/CodeEditor', () => ({
  CodeEditor: () => <div>code-editor</div>,
}))
vi.mock('../../../builder/components/task-editor/TaskEditorFields', () => ({
  CodeWorkspaceTabs: () => <div>code-workspace-tabs</div>,
  StageMetadataEditor: () => <div>stage-metadata-editor</div>,
}))
vi.mock('../ArcadePreview', () => ({
  default: ({ assets }) => <div>preview-assets:{assets.map((a) => a.name).join(',')}</div>,
}))
vi.mock('../ArcadeDesignStudio', () => ({
  default: ({ availableAssets }) => (
    <div>design-assets:{availableAssets.map((a) => a.name).join(',')}</div>
  ),
}))
vi.mock('../../../shared/useLessonStorageAssets', () => ({
  useLessonStorageAssets: () => ({
    storageAssets: [
      { name: 'shown.png', url: 'https://storage.test/shown.png', showInEditor: true },
      { name: 'hidden.png', url: 'https://storage.test/hidden.png', showInEditor: false },
    ],
  }),
}))
vi.mock('../../../shared/useTypeAssets', () => ({
  useTypeAssets: () => ({
    typeStorageAssets: [
      {
        name: 'shared-shown.png',
        url: 'https://storage.test/shared-shown.png',
        showInEditor: true,
      },
      {
        name: 'shared-hidden.png',
        url: 'https://storage.test/shared-hidden.png',
        showInEditor: false,
      },
    ],
  }),
}))

const lesson = { id: 'lesson-1', assets: [], storageAssets: [] }
const task = { starterCode: '', codeStages: [], arcadeTools: 'none' }

describe('Arcade BuilderWorkspace asset filtering', () => {
  it('only offers lesson and shared storage assets flagged for the web editor in the author preview', () => {
    render(
      <BuilderWorkspace
        task={task}
        lesson={lesson}
        onUpdate={vi.fn()}
        codeTab="stage_0"
        codeStages={[{ role: 'starter', code: '' }]}
        activePythonCode=""
        handleCodeTabChange={vi.fn()}
        handleAddStage={vi.fn()}
        handleRemoveStage={vi.fn()}
        resetToStarterBtn={null}
      />
    )

    const previewText = screen.getByText(/^preview-assets:/).textContent
    expect(previewText).toContain('shown.png')
    expect(previewText).toContain('shared-shown.png')
    expect(previewText).not.toContain('hidden.png')
    expect(previewText).not.toContain('shared-hidden.png')

    const designText = screen.getByText(/^design-assets:/).textContent
    expect(designText).toContain('shown.png')
    expect(designText).toContain('shared-shown.png')
    expect(designText).not.toContain('hidden.png')
    expect(designText).not.toContain('shared-hidden.png')
  })
})
