// The `scratch` fence and inline `scratch:` text parser: the syntax authors write, read into
// lines, slots and a nested stack. blocklyStack.js turns the result into real Blockly blocks;
// looksLikeScratchBlocks() tells markdown.jsx when an untagged fence is Scratch.
// (The CSS block drawing that used to live beside this was retired on 14 Nov 2026; it is kept on
// the archive/old-scratch-blocks-renderer branch.)
import { findScratchBlock } from '../scratchBlockCatalog'

function fallbackInfo() {
  return { opcode: 'unknown', color: '#7c7c7c', shape: 'stack', category: 'Unknown' }
}

function findBalanced(text, start, open, close) {
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === open) depth++
    else if (text[i] === close) {
      if (
        open === '<' &&
        close === '>' &&
        /\s/.test(text[i - 1] ?? '') &&
        /\s/.test(text[i + 1] ?? '')
      ) {
        continue
      }
      depth--
      if (depth === 0) {
        return { content: text.slice(start + 1, i), end: i }
      }
    }
  }
  return null
}

function hostColorOf(hostInfo) {
  return typeof hostInfo === 'string' ? hostInfo : (hostInfo?.color ?? '#7c7c7c')
}

// Blocks whose `[...]` inputs are typed text, not menus: Scratch draws them as white ovals
// with no dropdown arrow. The arrow on `say [Hello!]` was something a real say block doesn't
// have (HSC Audit 08). As in scratchblocks syntax, `[... v]` still forces a dropdown.
const TEXT_INPUT_OPCODES = new Set([
  'looks_say',
  'looks_sayforsecs',
  'looks_think',
  'looks_thinkforsecs',
  'sensing_askandwait',
])

function squareSlot(content, hostInfo) {
  const forcedDropdown = /\s+v$/.exec(content)
  if (forcedDropdown) return { kind: 'dropdown', content: content.slice(0, forcedDropdown.index) }
  const opcode = typeof hostInfo === 'string' ? null : hostInfo?.opcode
  return { kind: TEXT_INPUT_OPCODES.has(opcode) ? 'value' : 'dropdown', content }
}

export function blockTextParts(text, depth = 0, hostInfo = fallbackInfo()) {
  const parts = []
  let buffer = ''
  const hostColor = hostColorOf(hostInfo)

  function flush() {
    if (buffer) {
      parts.push({ type: 'text', text: buffer })
      buffer = ''
    }
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '[') {
      const found = findBalanced(text, i, '[', ']')
      if (found) {
        flush()
        const slot = squareSlot(found.content, hostInfo)
        parts.push({
          type: 'slot',
          kind: slot.kind,
          content: slot.content,
          depth,
          hostColor,
          key: `slot-${i}`,
        })
        i = found.end
        continue
      }
    }
    if (char === '(') {
      const found = findBalanced(text, i, '(', ')')
      if (found) {
        flush()
        parts.push({
          type: 'slot',
          kind: 'value',
          content: found.content,
          depth,
          hostColor,
          key: `slot-${i}`,
        })
        i = found.end
        continue
      }
    }
    if (char === '<') {
      const found = findBalanced(text, i, '<', '>')
      if (found) {
        flush()
        parts.push({
          type: 'slot',
          kind: 'condition',
          content: found.content,
          depth,
          hostColor,
          key: `slot-${i}`,
        })
        i = found.end
        continue
      }
    }
    buffer += char
  }

  flush()
  return parts
}

export function parseScratchStack(code) {
  const roots = []
  const stack = []
  let id = 0

  function addNode(node) {
    const parent = stack[stack.length - 1]
    if (!parent) roots.push(node)
    else if (parent.branch === 'else') parent.node.elseChildren.push(node)
    else parent.node.children.push(node)
  }

  for (const line of String(code ?? '').split('\n')) {
    const text = line.trim()
    if (!text) continue
    const indent = Math.floor((line.length - line.trimStart().length) / 2)
    const lower = text.toLowerCase()

    if (lower === 'end') {
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
      continue
    }

    if (lower === 'else') {
      while (stack.length && stack[stack.length - 1].indent > indent) stack.pop()
      const targetIndex = stack.findLastIndex(
        (entry) => entry.indent === indent && entry.node.info.shape === 'c'
      )
      if (targetIndex >= 0) {
        stack.length = targetIndex + 1
        stack[targetIndex].node.hasElse = true
        stack[targetIndex].branch = 'else'
      }
      continue
    }

    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()

    const info = findScratchBlock(text)
    if (!info && /^[a-z_][\w -]*$/i.test(text)) continue
    const node = {
      id: id++,
      text,
      info: info ?? fallbackInfo(),
      children: [],
      elseChildren: [],
      hasElse: false,
    }
    addNode(node)

    if (node.info.shape === 'c') {
      stack.push({ indent, node, branch: 'children' })
    }
  }

  return roots
}

export function looksLikeScratchBlocks(code) {
  const lines = String(code ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  return (
    lines.length > 0 &&
    lines.every((line) => {
      const lower = line.toLowerCase()
      return lower === 'end' || lower === 'else' || Boolean(findScratchBlock(line))
    })
  )
}

// An inline `scratch:if <> then else` names the two-mouth block; as a fence that is the one-mouth
// text with an `else` line under it.
export function inlineScratchCode(text) {
  const value = String(text ?? '').trim()
  if (findScratchBlock(value)?.opcode !== 'control_if_else') return value
  return `${value.replace(/\s+else$/i, '')}\nelse`
}
