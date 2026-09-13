import { describe, expect, it } from 'vitest'
import { DEFAULT_TOOLBOX } from '../scratch.js'
import { SCRATCH_BLOCK_CATALOG } from '../../../shared/scratchBlockCatalog.js'

function toolboxOpcodes(toolbox) {
  const out = []
  const walk = (items) =>
    (items ?? []).forEach((item) => {
      if (item.kind === 'block') out.push(item.type)
      if (item.contents) walk(item.contents)
    })
  walk(toolbox.contents)
  return out
}

describe('default toolbox and block catalog', () => {
  it('lists the same opcodes', () => {
    const toolbox = new Set(toolboxOpcodes(DEFAULT_TOOLBOX))
    const catalog = new Set(SCRATCH_BLOCK_CATALOG.map((b) => b.opcode))
    expect([...catalog].filter((op) => !toolbox.has(op))).toEqual([])
    expect([...toolbox].filter((op) => !catalog.has(op))).toEqual([])
  })
})
