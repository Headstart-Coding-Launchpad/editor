import { buildJsonSpriteWorkspaces } from '../modules/scratch/jsonWorkspace.js'
import { getModuleDefinition } from '../modules/definitions.js'
import { findPeerHint, snapshotLineFiles } from '../shared/peerHelp'

// The module's `capabilities.peerHelp` ({ anchors, hints }), or null where a classmate can't
// help (the student keeps the plain ✋ Help).
export function peerHelpCapability(lessonType) {
  return getModuleDefinition(lessonType)?.capabilities?.peerHelp ?? null
}

export function supportsPeerHelp(lessonType) {
  return peerHelpCapability(lessonType) != null
}

// What a helper can point at in a classmate's work, and what the stuck student sees the
// feedback attached to. Every anchor is a { file, line } pair, the shape the rules accept:
//   code (Python, Turtle, HTML): a line of a file (file '' for single-file code);
//   Scratch: a script, as the sprite's name and the script's position (1-based).
// `editable` anchors are code lines, which suggested edits may change.

const HAT_LABELS = {
  event_whenflagclicked: 'when green flag clicked',
  event_whenkeypressed: 'when key pressed',
  event_whenthisspriteclicked: 'when this sprite clicked',
  event_whenbroadcastreceived: 'when I receive',
  event_whenbackdropswitchesto: 'when backdrop switches to',
  control_start_as_clone: 'when I start as a clone',
}

export function describeScratchBlock(type) {
  if (HAT_LABELS[type]) return HAT_LABELS[type]
  const tail = String(type ?? 'block').replace(/^[a-z]+_/, '')
  return tail.replace(/_/g, ' ')
}

function countBlocks(block) {
  if (!block) return 0
  let count = 0
  for (let current = block; current; current = current.getNextBlock()) count += 1
  return count
}

function scratchAnchors(snapshot, task) {
  let sprites = []
  try {
    sprites = buildJsonSpriteWorkspaces(task, snapshot?.code || null)
  } catch {
    return []
  }
  return sprites.flatMap((sprite) =>
    sprite.workspace.getTopBlocks().map((block, index) => {
      const name = sprite.name === '__stage__' ? 'Stage' : sprite.name
      const blocks = countBlocks(block)
      return {
        key: `${sprite.name}:${index + 1}`,
        file: sprite.name,
        line: index + 1,
        label: `${name} · script ${index + 1}`,
        text: `${describeScratchBlock(block.type)} (${blocks} block${blocks === 1 ? '' : 's'})`,
        editable: false,
      }
    })
  )
}

function codeAnchors(snapshot) {
  const files = snapshotLineFiles(snapshot)
  const named = files.length > 1 || files[0]?.name
  return files.flatMap(({ name, lines }) =>
    lines.map((text, index) => ({
      key: `${name}:${index + 1}`,
      file: name,
      line: index + 1,
      label: named ? `${name} · line ${index + 1}` : `Line ${index + 1}`,
      text,
      editable: true,
    }))
  )
}

export function peerHelpAnchors(snapshot, lessonType, task) {
  if (!snapshot) return []
  const capability = peerHelpCapability(lessonType)
  if (!capability) return []
  return capability.anchors === 'scripts' ? scratchAnchors(snapshot, task) : codeAnchors(snapshot)
}

export function findAnchor(anchors, file, line) {
  return anchors.find((a) => a.file === (file ?? '') && a.line === line) ?? null
}

// One line describing a peer help item, for the helper, the stuck student and the teacher.
export function describeItem(item, lessonType, task) {
  if (item.kind === 'mark') return item.verdict === 'up' ? '👍 Good!' : '👎 Look again'
  if (item.kind === 'hint') {
    const hint = findPeerHint(item.hintId, peerHelpCapability(lessonType)?.hints, task)
    return hint ? `${hint.emoji ?? '💡'} ${hint.text}` : '💡 A hint'
  }
  if (item.kind === 'note') return `💬 “${item.text ?? ''}”`
  if (item.kind === 'edit') return '✏️ A change to try'
  return item.kind
}
