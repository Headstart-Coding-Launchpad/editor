import React from 'react'
import { render, waitFor, act } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import ScratchWorkspace from '../ScratchWorkspace.jsx'
import { loadBlocklyModules } from '../scratch.js'

// jsdom gaps (same environment shims as StudentViewModules.test.jsx): canvas 2D context.
const originalGetContext = HTMLCanvasElement.prototype.getContext
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = function getContext(kind) {
    return kind === '2d'
      ? new Proxy(
          { canvas: this },
          {
            get: (t, p) => (p in t ? t[p] : p === 'measureText' ? () => ({ width: 0 }) : () => {}),
            set: (t, p, v) => ((t[p] = v), true),
          }
        )
      : null
  }
})
afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext
})

const sprite = (id, extra = {}) => ({ id, name: id, type: 'cat', x: 0, y: 0, ...extra })
const sprites = [
  sprite('a'),
  sprite('b'),
  sprite('c'),
  ...['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((id) => sprite(id, { studentEditable: false })),
]

const svgs = (c) => c.querySelectorAll('.injectionDiv').length
// Real Blockly in jsdom builds a workspace slowly, so wait until the count stops moving.
const stable = (c) =>
  act(async () => {
    let last = -1
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 500))
      const n = svgs(c)
      if (n > 0 && n === last) return
      last = n
    }
  }, 60000)

describe('Scratch workspace mount cost', () => {
  it('builds no Blockly workspace for sprites the student cannot select (and that carry no blocks)', async () => {
    const { container } = render(
      <ScratchWorkspace
        task={{ id: 't1', sprites }}

        respectStudentEditable
        initialStates={{}}
      />
    )
    await stable(container)
    expect(svgs(container)).toBe(3)
  }, 60000)

  it('still builds a non-editable sprite that carries blocks (it runs)', async () => {
    const hat = { type: 'event_whenflagclicked', id: 'h1', x: 0, y: 0 }
    const { container } = render(
      <ScratchWorkspace
        task={{ id: 't1', sprites }}
        respectStudentEditable
        initialStates={{ p1: { blocks: { languageVersion: 0, blocks: [hat] } } }}
      />
    )
    await stable(container)
    expect(svgs(container)).toBe(4)
  }, 60000)

  it('still builds every sprite when not restricted to student-editable ones (tutor views)', async () => {
    const { container } = render(
      <ScratchWorkspace task={{ id: 't1', sprites }} initialStates={{}} />
    )
    await stable(container)
    expect(svgs(container)).toBe(9)
  }, 60000)

  it('does not rebuild every toolbox again when the workspaces become ready', async () => {
    const { Blockly } = await loadBlocklyModules()
    const spy = vi.spyOn(Blockly.WorkspaceSvg.prototype, 'updateToolbox')
    const { container } = render(
      <ScratchWorkspace task={{ id: 't1', sprites }} initialStates={{}} />
    )
    await stable(container)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  }, 60000)
})
