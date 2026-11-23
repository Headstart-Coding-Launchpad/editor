import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StudentWorkspace from '../StudentWorkspace'

// The calm Arcade screen (sketch OK'd 23 Nov 2026): one big ▶ Play, Emoji and Blocks beside it,
// Reset and Topic library behind one "More", the Code / Sprites / Tilemaps tabs kept, and the
// assets behind one 🎨 Assets chip on the tab row.

vi.mock('../../python/PythonEditor', () => ({
  default: ({ calm }) => <div data-calm={String(!!calm)}>python-editor</div>,
}))
vi.mock('../ArcadePreview', () => ({
  default: ({ running }) => <div>{running ? 'game-running' : 'game-idle'}</div>,
}))
// Sprites or tilemaps the student drew (generatedArcadeAssets), per test.
const made = vi.hoisted(() => ({ assets: [] }))
vi.mock('../design', async (importOriginal) => ({
  ...(await importOriginal()),
  generatedArcadeAssets: () => made.assets,
}))
vi.mock('../ArcadeDesignStudio', () => ({ default: () => <div>arcade-design-studio</div> }))
vi.mock('../../../shared/AssetBrowser', () => ({ default: () => <div>asset-browser</div> }))
vi.mock('../../../shared/useLessonStorageAssets', () => ({
  useLessonStorageAssets: () => ({ storageAssets: [] }),
}))
vi.mock('../../../shared/useTypeAssets', () => ({
  useTypeAssets: () => ({ typeStorageAssets: [] }),
}))

const lesson = { id: 'lesson-1', tasks: [], storageAssets: [] }
const makeCs = () => ({
  code: 'from headstart_arcade import game\ngame.run()',
  arcadeDesign: {},
  handleCodeChange: vi.fn(),
  handleResetCode: vi.fn(),
  handleArcadeDesignChange: vi.fn(),
  handleArcadeRun: vi.fn(),
  readSavedTaskCode: vi.fn(),
})

function renderArcade({ task = { id: 1, arcadeTools: 'both' }, cs = makeCs(), ...props } = {}) {
  render(
    <StudentWorkspace
      task={task}
      lessonId="lesson-1"
      lesson={lesson}
      cs={cs}
      isMobile={false}
      isViewingPrev={false}
      isForcedTeacherLive={false}
      isTeacherEditing={false}
      {...props}
    />
  )
  return cs
}

describe('Arcade calm screen', () => {
  it('one big ▶ Play starts the game, then turns into Stop', () => {
    const cs = renderArcade()
    const play = screen.getByRole('button', { name: 'Play' })
    expect(play).toHaveClass('btn-primary', 'btn-primary--big')
    expect(play).toHaveAttribute('data-highlight-target', 'run stop')
    expect(screen.queryByRole('button', { name: 'Run game' })).toBeNull()
    fireEvent.click(play)
    expect(cs.handleArcadeRun).toHaveBeenCalledTimes(1)
    expect(screen.getByText('game-running')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(screen.getByText('game-idle')).toBeInTheDocument()
  })

  it('keeps the Code, Sprites and Tilemaps tabs, Emoji, Blocks and the calm key row', () => {
    renderArcade()
    const tabs = screen.getByRole('tablist', { name: 'Arcade workspace' })
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((tab) => tab.textContent)
    ).toEqual(['Code', 'Sprites', 'Tilemaps'])
    const row = screen.getByRole('group', { name: 'Code' })
    expect(within(row).getByRole('button', { name: 'Insert emoji' })).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Blocks' })).toBeInTheDocument()
    expect(screen.getByText('python-editor')).toHaveAttribute('data-calm', 'true')
  })

  it('puts Reset and Topic library behind More', () => {
    const onOpenTopicLibrary = vi.fn()
    const cs = renderArcade({ onOpenTopicLibrary })
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /More/ }))
    const menu = screen.getByRole('menu', { name: 'More' })
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(['↺ Reset code', '📚 Topic library'])
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Topic library/ }))
    expect(onOpenTopicLibrary).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: /More/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Reset code/ }))
    expect(cs.handleResetCode).toHaveBeenCalledTimes(1)
  })

  it('opens the assets from one 🎨 Assets chip on the tab row', () => {
    renderArcade()
    expect(screen.queryByText('asset-browser')).toBeNull()
    const chip = screen.getByRole('button', { name: /Assets/ })
    expect(chip).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(chip)
    expect(screen.getByText('asset-browser')).toBeInTheDocument()
    expect(chip).toHaveAttribute('aria-expanded', 'true')
  })

  it('styles the tabs with the shared tab classes, marking the open one', () => {
    renderArcade()
    expect(screen.getByRole('tablist', { name: 'Arcade workspace' })).toHaveClass('ui-tabs')
    expect(screen.getByRole('tab', { name: 'Code' })).toHaveClass('ui-tab', 'is-active')
    expect(screen.getByRole('tab', { name: 'Sprites' })).not.toHaveClass('is-active')
  })

  it('opens the assets by itself when the student has drawn sprites', () => {
    made.assets = [{ name: 'hero.png', url: 'data:image/png;base64,' }]
    renderArcade()
    expect(screen.getByRole('button', { name: /Insert hero.png/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Assets/ })).toHaveAttribute('aria-expanded', 'true')
    made.assets = []
  })

  it('the chip from another tab goes to Code with the assets open, never shut', () => {
    made.assets = [{ name: 'hero.png', url: 'data:image/png;base64,' }]
    renderArcade()
    fireEvent.click(screen.getByRole('tab', { name: 'Sprites' }))
    fireEvent.click(screen.getByRole('button', { name: /Assets/ }))
    expect(screen.getByRole('tab', { name: 'Code' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: /Insert hero.png/ })).toBeInTheDocument()
    // On the Code tab the chip folds them away again.
    fireEvent.click(screen.getByRole('button', { name: /Assets/ }))
    expect(screen.queryByRole('button', { name: /Insert hero.png/ })).toBeNull()
    made.assets = []
  })
})
