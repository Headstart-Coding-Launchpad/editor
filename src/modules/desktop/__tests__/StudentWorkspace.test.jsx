import React, { useCallback, useRef, useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StudentWorkspace from '../StudentWorkspace.jsx'
import { makeDefaultDesktop } from '../desktopState.js'
import { evaluateCheck } from '../../checks.js'
import desktopDefinition from '../definition.js'

const lesson = { id: 'lesson-1', tasks: [], assets: [] }
const task = { id: 1, availableApps: ['fileManager'] }

function makeCs(overrides = {}) {
  return {
    handleDesktopChange: vi.fn(),
    handleDesktopInteraction: vi.fn(),
    readSavedTaskDesktop: vi.fn(() => null),
    desktopInteraction: { currentDir: '/', openFile: null },
    ...overrides,
  }
}

describe('Desktop StudentWorkspace', () => {
  it('renders a desktop icon that requests a File Manager window be opened', () => {
    const cs = makeCs()
    render(
      <StudentWorkspace
        lesson={lesson}
        task={task}
        cs={cs}
        viewingTaskId={null}
        currentTaskId={1}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        displayDesktop={{ fs: { '/': { type: 'dir' } }, recycleBin: [], windows: [] }}
      />
    )

    expect(screen.queryByLabelText('Search files')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /File Manager/i }))
    expect(cs.handleDesktopChange).toHaveBeenCalledTimes(1)
    const nextState = cs.handleDesktopChange.mock.calls[0][0]
    expect(nextState.windows).toHaveLength(1)
    expect(nextState.windows[0]).toMatchObject({ appId: 'fileManager', minimized: false })
  })

  it('routes file manager changes through cs.handleDesktopChange with the full desktop state', () => {
    const cs = makeCs()
    render(
      <StudentWorkspace
        lesson={lesson}
        task={task}
        cs={cs}
        viewingTaskId={null}
        currentTaskId={1}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        displayDesktop={makeDefaultDesktop(['fileManager'])}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /New Folder/i }))
    const input = screen.getByPlaceholderText('Folder name…')
    fireEvent.change(input, { target: { value: 'Homework' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(cs.handleDesktopChange).toHaveBeenCalled()
    const nextState = cs.handleDesktopChange.mock.calls[0][0]
    expect(nextState.fs['/Homework/']).toEqual({ type: 'dir' })
    expect(nextState).toHaveProperty('recycleBin')
    expect(nextState).toHaveProperty('windows')
  })

  it('disables interaction when viewing a previous task', () => {
    const cs = makeCs({ readSavedTaskDesktop: vi.fn(() => makeDefaultDesktop(['fileManager'])) })
    render(
      <StudentWorkspace
        lesson={lesson}
        task={task}
        cs={cs}
        viewingTaskId={1}
        currentTaskId={2}
        isViewingPrev
        isForcedTeacherLive={false}
        displayDesktop={makeDefaultDesktop(['fileManager'])}
      />
    )
    expect(screen.queryByRole('button', { name: /New Folder/i })).not.toBeInTheDocument()
    expect(cs.handleDesktopChange).not.toHaveBeenCalled()
  })
})

// ─── input_* checks: HOW the student did it ────────────────────────────────────
// A stand-in for useStudentCodeState's work slot: it keeps the latest desktop and interaction
// in refs (as the hook does) and re-evaluates the task check through the Desktop definition's
// checking.buildContext on every change or interaction, recording each result.
const INPUT_FS = {
  '/': { type: 'dir' },
  '/Homework/': { type: 'dir' },
  '/notes.txt': { type: 'file', content: 'hi' },
}

function InputHarness({ task, results, interactions }) {
  const [desktop, setDesktop] = useState(() => ({
    ...makeDefaultDesktop(['fileManager']),
    fs: INPUT_FS,
  }))
  const [interaction, setInteraction] = useState({ currentDir: '/', openFile: null })
  const desktopRef = useRef(desktop)
  const interactionRef = useRef(interaction)
  const evaluate = () =>
    results.push(
      evaluateCheck(
        task.check,
        null,
        desktopDefinition.checking.buildContext(desktopRef.current, interactionRef.current)
      )
    )
  const handleDesktopInteraction = useCallback((next) => {
    interactions.push(next)
    interactionRef.current = next
    setInteraction(next)
    evaluate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const cs = {
    desktopInteraction: interaction,
    readSavedTaskDesktop: () => null,
    handleDesktopChange: (next) => {
      desktopRef.current = next
      setDesktop(next)
      evaluate()
    },
    handleDesktopInteraction,
  }
  return (
    <StudentWorkspace
      lesson={lesson}
      task={task}
      cs={cs}
      viewingTaskId={null}
      currentTaskId={task.id}
      isViewingPrev={false}
      isForcedTeacherLive={false}
      displayDesktop={desktop}
    />
  )
}

function renderInputTask(check) {
  const results = []
  const interactions = []
  const inputTask = { id: 7, availableApps: ['fileManager'], check }
  render(<InputHarness task={inputTask} results={results} interactions={interactions} />)
  const fileManager = () => screen.getByRole('dialog', { name: 'File Manager' })
  const item = (name) => within(fileManager()).getAllByText(name).at(-1).closest('[data-input-id]')
  return { results, interactions, item, fileManager, passed: () => results.at(-1) === true }
}

// The context menu renders after the toolbar, whose buttons share its labels.
const menuItem = (name) => screen.getAllByRole('button', { name }).at(-1)

function fakeDataTransfer() {
  const data = {}
  return {
    setData: (type, value) => {
      data[type] = value
    },
    getData: (type) => data[type] ?? '',
  }
}

describe('Desktop StudentWorkspace input checks', () => {
  it('tags files and folders with their semantic input kind', () => {
    const { item } = renderInputTask({ type: 'input_gesture', gesture: 'double_click' })
    expect(item('notes.txt')).toHaveAttribute('data-input-kind', 'file')
    expect(item('Homework')).toHaveAttribute('data-input-kind', 'folder')
    expect(screen.getByRole('dialog', { name: 'File Manager' })).toHaveAttribute(
      'data-input-kind',
      'window'
    )
  })

  it('passes an input_gesture double-click check only once a file is double-clicked', () => {
    const { item, passed, results, fileManager } = renderInputTask({
      type: 'input_gesture',
      gesture: 'double_click',
      targetKind: 'file',
    })
    // A single click opens the file too — the outcome is the same, the method isn't.
    fireEvent.click(item('notes.txt'))
    expect(results.length).toBeGreaterThan(0)
    expect(passed()).toBe(false)
    // Double-clicking the folder is the right gesture on the wrong kind of target (and opens
    // it, so go back up to the file).
    fireEvent.doubleClick(item('Homework'))
    expect(passed()).toBe(false)
    fireEvent.click(within(fileManager()).getAllByText('/ (root)')[0])

    fireEvent.doubleClick(item('notes.txt'))
    expect(passed()).toBe(true)
  })

  it('passes a drag check only when the file is dragged onto a folder, not cut and pasted', () => {
    const { item, passed, fileManager } = renderInputTask([
      { type: 'fs_path', operator: 'exists', itemType: 'file', path: '/Homework/notes.txt' },
      { type: 'input_gesture', gesture: 'drag', targetKind: 'file', dropTargetKind: 'folder' },
    ])
    // Cut + paste into the folder: the outcome without the method.
    fireEvent.contextMenu(item('notes.txt'))
    fireEvent.click(menuItem(/Cut/))
    fireEvent.doubleClick(item('Homework'))
    fireEvent.contextMenu(within(fileManager()).getByText('Folder is empty'))
    fireEvent.click(menuItem(/Paste/))
    expect(passed()).toBe(false)

    // Back to the root, then drag it in properly (a move back out first, so it can move in).
    fireEvent.click(within(fileManager()).getAllByText('/ (root)')[0])
    const dataTransfer = fakeDataTransfer()
    dataTransfer.setData('text/plain', '/Homework/notes.txt')
    fireEvent.drop(within(fileManager()).getAllByText('/ (root)')[0], { dataTransfer })
    expect(passed()).toBe(false)
    const drag = fakeDataTransfer()
    fireEvent.dragStart(item('notes.txt'), { dataTransfer: drag })
    fireEvent.drop(item('Homework'), { dataTransfer: drag })
    fireEvent.dragEnd(item('Homework'), { dataTransfer: drag })
    expect(passed()).toBe(true)
  })

  it('tells Ctrl+C from the context-menu Copy', () => {
    const { item, passed, interactions } = renderInputTask({
      type: 'input_shortcut',
      combo: 'ctrl+c',
      via: 'keyboard',
    })
    fireEvent.contextMenu(item('notes.txt'))
    fireEvent.click(menuItem(/Copy/))
    expect(passed()).toBe(false)
    expect(interactions.at(-1).input.shortcuts).toEqual({ 'mod+c': { menu: 1 } })

    fireEvent.keyDown(item('notes.txt'), { key: 'c', code: 'KeyC', ctrlKey: true })
    expect(passed()).toBe(true)
    // The summary keeps the interaction's own fields alongside it.
    expect(interactions.at(-1)).toMatchObject({ currentDir: '/' })
  })

  it('records nothing for tasks without input checks', () => {
    const { item, interactions } = renderInputTask({
      type: 'fs_path',
      operator: 'exists',
      path: '/notes.txt',
    })
    fireEvent.doubleClick(item('Homework'))
    expect(interactions.length).toBeGreaterThan(0)
    expect(interactions.every((interaction) => interaction.input === undefined)).toBe(true)
  })
})
