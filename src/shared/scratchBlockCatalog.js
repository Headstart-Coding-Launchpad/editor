import { escapeRegExp } from './textUtils.js'

export const SCRATCH_CATEGORY_COLOURS = {
  Events: '#FFAB19',
  Motion: '#4C97FF',
  Looks: '#9966FF',
  Sound: '#CF63CF',
  Control: '#FFAB19',
  Sensing: '#5CB1D6',
  Operators: '#59C059',
  Variables: '#FF8C1A',
}

function patternFromSample(sample) {
  sample = normalizeScratchBlockText(sample)
  let pattern = ''
  for (let i = 0; i < sample.length; i++) {
    const char = sample[i]
    if (char === '[') {
      const end = sample.indexOf(']', i + 1)
      if (end !== -1) {
        pattern += '\\[[^\\]]+\\]'
        i = end
        continue
      }
    }
    if (char === '(') {
      const end = sample.indexOf(')', i + 1)
      if (end !== -1) {
        pattern += '\\(.*\\)'
        i = end
        continue
      }
    }
    if (char === '<') {
      const end = sample.indexOf('>', i + 1)
      if (end !== -1) {
        pattern += '<.*>'
        i = end
        continue
      }
    }
    pattern += escapeRegExp(char)
  }
  return new RegExp(`^${pattern}$`)
}

const blockEntries = [
  {
    opcode: 'event_whenflagclicked',
    category: 'Events',
    icon: '🟢',
    label: 'when green flag clicked',
    sample: 'when green flag clicked',
    shape: 'hat',
  },
  {
    opcode: 'event_whenkeypressed',
    category: 'Events',
    icon: '⌨️',
    label: 'when key pressed',
    sample: 'when [space] key pressed',
    shape: 'hat',
  },
  {
    opcode: 'event_whenthisspriteclicked',
    category: 'Events',
    icon: '👆',
    label: 'when sprite clicked',
    sample: 'when this sprite clicked',
    shape: 'hat',
  },
  {
    opcode: 'event_whenbackdropswitchesto',
    category: 'Events',
    icon: '🖼️',
    label: 'when backdrop switches to',
    sample: 'when backdrop switches to [backdrop1]',
    shape: 'hat',
  },
  {
    opcode: 'event_broadcast',
    category: 'Events',
    icon: '📣',
    label: 'broadcast',
    sample: 'broadcast [message1]',
    shape: 'stack',
  },
  {
    opcode: 'event_broadcastandwait',
    category: 'Events',
    icon: '📣⏳',
    badgeIcon: '⏳',
    label: 'broadcast and wait',
    sample: 'broadcast [message1] and wait',
    shape: 'stack',
  },
  {
    opcode: 'event_whenbroadcastreceived',
    category: 'Events',
    icon: '📥',
    label: 'when I receive',
    sample: 'when I receive [message1]',
    shape: 'hat',
  },

  {
    opcode: 'motion_movesteps',
    category: 'Motion',
    icon: '👣',
    label: 'move steps',
    sample: 'move (10) steps',
    shape: 'stack',
  },
  {
    opcode: 'motion_turnright',
    category: 'Motion',
    icon: '↪️',
    label: 'turn right',
    sample: 'turn right (15) degrees',
    shape: 'stack',
    aliases: ['turn (15) degrees'],
  },
  {
    opcode: 'motion_turnleft',
    category: 'Motion',
    icon: '↩️',
    label: 'turn left',
    sample: 'turn left (15) degrees',
    shape: 'stack',
  },
  {
    opcode: 'motion_pointindirection',
    category: 'Motion',
    icon: '🧭',
    label: 'point in direction',
    sample: 'point in direction (90)',
    shape: 'stack',
  },
  {
    opcode: 'motion_gotoxy',
    category: 'Motion',
    icon: '🎯',
    label: 'go to x/y',
    sample: 'go to x: (0) y: (0)',
    shape: 'stack',
  },
  {
    opcode: 'motion_goto',
    category: 'Motion',
    icon: '📍',
    label: 'go to',
    sample: 'go to [random position]',
    shape: 'stack',
  },
  {
    opcode: 'motion_glidesecstoxy',
    category: 'Motion',
    icon: '🛝',
    label: 'glide secs to x/y',
    sample: 'glide (1) secs to x: (0) y: (0)',
    shape: 'stack',
  },
  {
    opcode: 'motion_glideto',
    category: 'Motion',
    icon: '🛝',
    label: 'glide to',
    sample: 'glide (1) secs to [random position]',
    shape: 'stack',
  },
  {
    opcode: 'motion_ifonedge_bounce',
    category: 'Motion',
    icon: '↩️',
    label: 'if on edge, bounce',
    sample: 'if on edge, bounce',
    shape: 'stack',
  },
  {
    opcode: 'motion_setx',
    category: 'Motion',
    icon: '↔️',
    label: 'set x',
    sample: 'set x to (0)',
    shape: 'stack',
  },
  {
    opcode: 'motion_sety',
    category: 'Motion',
    icon: '↕️',
    label: 'set y',
    sample: 'set y to (0)',
    shape: 'stack',
  },
  {
    opcode: 'motion_changexby',
    category: 'Motion',
    icon: '➡️',
    label: 'change x',
    sample: 'change x by (10)',
    shape: 'stack',
  },
  {
    opcode: 'motion_changeyby',
    category: 'Motion',
    icon: '⬆️',
    label: 'change y',
    sample: 'change y by (10)',
    shape: 'stack',
  },
  {
    opcode: 'motion_setrotationstyle',
    category: 'Motion',
    icon: '🔄',
    label: 'set rotation style',
    sample: 'set rotation style [left-right]',
    shape: 'stack',
  },
  {
    opcode: 'motion_xposition',
    category: 'Motion',
    icon: '↔️',
    label: 'x position',
    sample: 'x position',
    shape: 'reporter',
  },
  {
    opcode: 'motion_yposition',
    category: 'Motion',
    icon: '↕️',
    label: 'y position',
    sample: 'y position',
    shape: 'reporter',
  },
  {
    opcode: 'motion_direction',
    category: 'Motion',
    icon: '🧭',
    label: 'direction',
    sample: 'direction',
    shape: 'reporter',
  },

  {
    opcode: 'looks_sayforsecs',
    category: 'Looks',
    icon: '💬',
    label: 'say for seconds',
    sample: 'say [Hello!] for (2) seconds',
    shape: 'stack',
  },
  {
    opcode: 'looks_say',
    category: 'Looks',
    icon: '💬',
    label: 'say',
    sample: 'say [Hello!]',
    shape: 'stack',
  },
  {
    opcode: 'looks_think',
    category: 'Looks',
    icon: '💭',
    label: 'think',
    sample: 'think [Hmm...]',
    shape: 'stack',
  },
  {
    opcode: 'looks_thinkforsecs',
    category: 'Looks',
    icon: '💭',
    label: 'think for seconds',
    sample: 'think [Hmm...] for (2) seconds',
    shape: 'stack',
  },
  {
    opcode: 'looks_show',
    category: 'Looks',
    icon: '👁️',
    label: 'show',
    sample: 'show',
    shape: 'stack',
  },
  {
    opcode: 'looks_hide',
    category: 'Looks',
    icon: '🚫👁️',
    badgeIcon: '🚫',
    label: 'hide',
    sample: 'hide',
    shape: 'stack',
  },
  {
    opcode: 'looks_setsizeto',
    category: 'Looks',
    icon: '🔍',
    label: 'set size',
    sample: 'set size to (100) %',
    shape: 'stack',
    aliases: ['set size to (100)%'],
  },
  {
    opcode: 'looks_changesizeby',
    category: 'Looks',
    icon: '📏',
    label: 'change size',
    sample: 'change size by (10)',
    shape: 'stack',
  },
  {
    opcode: 'looks_switchcostumeto',
    category: 'Looks',
    icon: '🎭',
    label: 'switch costume to',
    sample: 'switch costume to [costume1]',
    shape: 'stack',
  },
  {
    opcode: 'looks_nextcostume',
    category: 'Looks',
    icon: '🎭',
    label: 'next costume',
    sample: 'next costume',
    shape: 'stack',
  },
  {
    opcode: 'looks_costumenumber',
    category: 'Looks',
    icon: '#️⃣',
    label: 'costume number',
    sample: 'costume number',
    shape: 'reporter',
  },
  {
    opcode: 'looks_costumenumbername',
    category: 'Looks',
    icon: '🏷️',
    label: 'costume number/name',
    sample: 'costume [number]',
    shape: 'reporter',
  },
  {
    opcode: 'looks_switchbackdropto',
    category: 'Looks',
    icon: '🖼️',
    label: 'switch backdrop to',
    sample: 'switch backdrop to [backdrop1]',
    shape: 'stack',
  },
  {
    opcode: 'looks_nextbackdrop',
    category: 'Looks',
    icon: '🖼️',
    label: 'next backdrop',
    sample: 'next backdrop',
    shape: 'stack',
  },
  {
    opcode: 'looks_backdropnumbername',
    category: 'Looks',
    icon: '🏷️',
    label: 'backdrop number/name',
    sample: 'backdrop [name]',
    shape: 'reporter',
  },
  {
    opcode: 'looks_seteffectto',
    category: 'Looks',
    icon: '✨',
    label: 'set effect to',
    sample: 'set [color] effect to (0)',
    shape: 'stack',
  },
  {
    opcode: 'looks_changeeffectby',
    category: 'Looks',
    icon: '✨',
    label: 'change effect by',
    sample: 'change [color] effect by (25)',
    shape: 'stack',
  },
  {
    opcode: 'looks_cleargraphiceffects',
    category: 'Looks',
    icon: '🧽',
    label: 'clear graphic effects',
    sample: 'clear graphic effects',
    shape: 'stack',
  },

  {
    opcode: 'sound_play',
    category: 'Sound',
    icon: '🔊',
    label: 'start sound',
    sample: 'start sound [meow]',
    shape: 'stack',
    aliases: ['play sound [meow]'],
  },
  {
    opcode: 'sound_playuntildone',
    category: 'Sound',
    icon: '▶️🔊',
    badgeIcon: '▶️',
    label: 'play sound until done',
    sample: 'play sound [meow] until done',
    shape: 'stack',
  },
  {
    opcode: 'sound_stopallsounds',
    category: 'Sound',
    icon: '🔇',
    label: 'stop all sounds',
    sample: 'stop all sounds',
    shape: 'stack',
  },

  {
    opcode: 'control_wait',
    category: 'Control',
    icon: '⏳',
    label: 'wait',
    sample: 'wait (1) seconds',
    shape: 'stack',
  },
  {
    opcode: 'control_wait_until',
    category: 'Control',
    icon: '⏱️',
    label: 'wait until',
    sample: 'wait until <>',
    shape: 'stack',
  },
  {
    opcode: 'control_repeat',
    category: 'Control',
    icon: '🔁',
    label: 'repeat',
    sample: 'repeat (10)',
    shape: 'c',
    mouths: ['SUBSTACK'],
  },
  {
    opcode: 'control_repeat_until',
    category: 'Control',
    icon: '🔁⏱️',
    badgeIcon: '⏱️',
    label: 'repeat until',
    sample: 'repeat until <>',
    shape: 'c',
    mouths: ['SUBSTACK'],
  },
  {
    opcode: 'control_forever',
    category: 'Control',
    icon: '♾️',
    label: 'forever',
    sample: 'forever',
    shape: 'c',
    mouths: ['SUBSTACK'],
  },
  {
    opcode: 'control_if',
    category: 'Control',
    icon: '❓',
    label: 'if then',
    sample: 'if <> then',
    shape: 'c',
    mouths: ['SUBSTACK'],
  },
  {
    opcode: 'control_if_else',
    category: 'Control',
    icon: '🔀',
    label: 'if then else',
    sample: 'if <> then else',
    shape: 'c',
    mouths: ['SUBSTACK', 'SUBSTACK2'],
  },
  {
    opcode: 'control_stop',
    category: 'Control',
    icon: '🛑',
    label: 'stop all',
    sample: 'stop all',
    shape: 'cap',
  },
  {
    opcode: 'control_create_clone_of',
    category: 'Control',
    icon: '➕',
    label: 'create a clone of',
    sample: 'create a clone of [myself]',
    shape: 'stack',
  },
  {
    opcode: 'control_start_as_clone',
    category: 'Control',
    icon: '🆕',
    label: 'when I start as a clone',
    sample: 'when I start as a clone',
    shape: 'hat',
  },
  {
    opcode: 'control_delete_this_clone',
    category: 'Control',
    icon: '🗑️',
    label: 'delete this clone',
    sample: 'delete this clone',
    shape: 'cap',
  },

  {
    opcode: 'sensing_askandwait',
    category: 'Sensing',
    icon: '❔',
    label: 'ask and wait',
    sample: "ask [What's your name?] and wait",
    shape: 'stack',
  },
  {
    opcode: 'sensing_answer',
    category: 'Sensing',
    icon: '💬',
    label: 'answer',
    sample: 'answer',
    shape: 'reporter',
  },
  {
    opcode: 'sensing_keypressed',
    category: 'Sensing',
    icon: '⌨️',
    label: 'key pressed?',
    sample: 'key [space] pressed?',
    shape: 'boolean',
  },
  {
    opcode: 'sensing_mousedown',
    category: 'Sensing',
    icon: '🖱️',
    label: 'mouse down?',
    sample: 'mouse down?',
    shape: 'boolean',
  },
  {
    opcode: 'sensing_touchingedge',
    category: 'Sensing',
    icon: '🧱',
    label: 'touching edge?',
    sample: 'touching edge?',
    shape: 'boolean',
  },
  {
    opcode: 'sensing_touchingobject',
    category: 'Sensing',
    icon: '✋',
    label: 'touching object?',
    sample: 'touching [mouse-pointer]?',
    shape: 'boolean',
  },
  {
    opcode: 'sensing_distanceto',
    category: 'Sensing',
    icon: '📏',
    label: 'distance to',
    sample: 'distance to [mouse-pointer]',
    shape: 'reporter',
  },
  {
    opcode: 'sensing_timer',
    category: 'Sensing',
    icon: '⏱️',
    label: 'timer',
    sample: 'timer',
    shape: 'reporter',
  },
  {
    opcode: 'sensing_resettimer',
    category: 'Sensing',
    icon: '🔄⏱️',
    badgeIcon: '🔄',
    label: 'reset timer',
    sample: 'reset timer',
    shape: 'stack',
  },

  {
    opcode: 'operator_equals',
    category: 'Operators',
    icon: '🟰',
    label: 'equals',
    sample: '(1) = (2)',
    shape: 'boolean',
  },
  {
    opcode: 'operator_gt',
    category: 'Operators',
    icon: '🔼',
    label: 'greater than',
    sample: '(1) > (2)',
    shape: 'boolean',
  },
  {
    opcode: 'operator_lt',
    category: 'Operators',
    icon: '🔽',
    label: 'less than',
    sample: '(1) < (2)',
    shape: 'boolean',
  },
  {
    opcode: 'operator_and',
    category: 'Operators',
    icon: '🔗',
    label: 'and',
    sample: '<> and <>',
    shape: 'boolean',
  },
  {
    opcode: 'operator_or',
    category: 'Operators',
    icon: '🔀',
    label: 'or',
    sample: '<> or <>',
    shape: 'boolean',
  },
  {
    opcode: 'operator_not',
    category: 'Operators',
    icon: '🚫',
    label: 'not',
    sample: 'not <>',
    shape: 'boolean',
  },
  {
    opcode: 'operator_add',
    category: 'Operators',
    icon: '➕',
    label: 'add',
    sample: '(1) + (2)',
    shape: 'reporter',
  },
  {
    opcode: 'operator_subtract',
    category: 'Operators',
    icon: '➖',
    label: 'subtract',
    sample: '(1) - (2)',
    shape: 'reporter',
  },
  {
    opcode: 'operator_multiply',
    category: 'Operators',
    icon: '✖️',
    label: 'multiply',
    sample: '(1) * (2)',
    shape: 'reporter',
  },
  {
    opcode: 'operator_divide',
    category: 'Operators',
    icon: '➗',
    label: 'divide',
    sample: '(1) / (2)',
    shape: 'reporter',
  },
  {
    opcode: 'operator_mod',
    category: 'Operators',
    icon: '🧮',
    label: 'mod',
    sample: '(1) mod (2)',
    shape: 'reporter',
  },
  {
    opcode: 'operator_round',
    category: 'Operators',
    icon: '🎯',
    label: 'round',
    sample: 'round (3.14)',
    shape: 'reporter',
  },
  {
    opcode: 'operator_mathop',
    category: 'Operators',
    icon: '🧮',
    label: 'math operation',
    sample: 'abs of (10)',
    shape: 'reporter',
    aliases: [
      'floor of (10)',
      'ceiling of (10)',
      'sqrt of (10)',
      'sin of (10)',
      'cos of (10)',
      'tan of (10)',
      'asin of (10)',
      'acos of (10)',
      'atan of (10)',
      'ln of (10)',
      'log of (10)',
      'e ^ of (10)',
      '10 ^ of (10)',
    ],
  },
  {
    opcode: 'operator_random',
    category: 'Operators',
    icon: '🎲',
    label: 'pick random',
    sample: 'pick random (1) to (10)',
    shape: 'reporter',
  },
  {
    opcode: 'operator_join',
    category: 'Operators',
    icon: '🧩',
    label: 'join',
    sample: 'join [hello] [world]',
    shape: 'reporter',
  },
  {
    opcode: 'operator_letter_of',
    category: 'Operators',
    icon: '🔤',
    label: 'letter of',
    sample: 'letter (1) of [hello]',
    shape: 'reporter',
  },
  {
    opcode: 'operator_length',
    category: 'Operators',
    icon: '📏',
    label: 'length of',
    sample: 'length of [hello]',
    shape: 'reporter',
  },
  {
    opcode: 'operator_contains',
    category: 'Operators',
    icon: '🔎',
    label: 'contains',
    sample: '[apple] contains [a]?',
    shape: 'boolean',
  },

  {
    opcode: 'data_variable',
    category: 'Variables',
    icon: '📦',
    label: 'variable',
    sample: '[score]',
    shape: 'reporter',
  },
  {
    opcode: 'data_setvariableto',
    category: 'Variables',
    icon: '📝',
    label: 'set variable',
    sample: 'set [score] to (0)',
    shape: 'stack',
  },
  {
    opcode: 'data_changevariableby',
    category: 'Variables',
    icon: '🔁',
    label: 'change variable',
    sample: 'change [score] by (1)',
    shape: 'stack',
  },
  {
    opcode: 'data_showvariable',
    category: 'Variables',
    icon: '👁️',
    label: 'show variable',
    sample: 'show variable [score]',
    shape: 'stack',
  },
  {
    opcode: 'data_hidevariable',
    category: 'Variables',
    icon: '🚫👁️',
    badgeIcon: '🚫',
    label: 'hide variable',
    sample: 'hide variable [score]',
    shape: 'stack',
  },
]

function patternSources(entry) {
  const sources = [entry.sample, ...(entry.aliases ?? [])]
  return [...sources, ...sources.map((sample) => `${entry.icon} ${sample}`)]
}

export const SCRATCH_BLOCK_CATALOG = blockEntries.map((entry) => ({
  ...entry,
  color: SCRATCH_CATEGORY_COLOURS[entry.category],
  patterns: patternSources(entry).map(patternFromSample),
}))

export const SCRATCH_BLOCK_BY_OPCODE = Object.fromEntries(
  SCRATCH_BLOCK_CATALOG.map((block) => [block.opcode, block])
)

export const SCRATCH_TOOLBOX_GROUPS = Object.keys(SCRATCH_CATEGORY_COLOURS).map((name) => ({
  name,
  colour: SCRATCH_CATEGORY_COLOURS[name],
  blocks: SCRATCH_BLOCK_CATALOG.filter((block) => block.category === name).map((block) => [
    block.opcode,
    scratchBlockDisplayLabel(block),
  ]),
}))

export const SCRATCH_MARKDOWN_BLOCK_CATEGORIES = SCRATCH_TOOLBOX_GROUPS.map((group) => ({
  label: group.name,
  color: group.colour,
  blocks: group.blocks.map(([opcode]) => scratchBlockDisplaySample(opcode)),
}))

export function scratchBlockDisplayLabel(opcodeOrBlock) {
  const block =
    typeof opcodeOrBlock === 'string' ? SCRATCH_BLOCK_BY_OPCODE[opcodeOrBlock] : opcodeOrBlock
  if (!block) return ''
  return `${block.icon} ${block.label}`
}

export function scratchBlockBadgeIcon(opcodeOrBlock) {
  const block =
    typeof opcodeOrBlock === 'string' ? SCRATCH_BLOCK_BY_OPCODE[opcodeOrBlock] : opcodeOrBlock
  return block?.badgeIcon ?? block?.icon ?? ''
}

export function scratchBlockDisplaySample(opcodeOrBlock) {
  const block =
    typeof opcodeOrBlock === 'string' ? SCRATCH_BLOCK_BY_OPCODE[opcodeOrBlock] : opcodeOrBlock
  if (!block) return ''
  return `${block.icon} ${block.sample}`
}

export function scratchBlockDisplayMessage(opcode, message) {
  const block = SCRATCH_BLOCK_BY_OPCODE[opcode]
  return block?.icon ? `${block.icon} ${message}` : message
}

export function scratchBlockTextWithIcon(text, block) {
  if (!block?.icon) return String(text ?? '')
  const value = String(text ?? '')
  return normalizeScratchBlockText(value).startsWith(normalizeScratchBlockText(block.icon))
    ? value
    : `${block.icon} ${value}`
}

export function scratchBlockTextWithoutIcon(text, block) {
  if (!block?.icon) return String(text ?? '')
  const value = String(text ?? '')
  return normalizeScratchBlockText(value).startsWith(normalizeScratchBlockText(block.icon))
    ? value.replace(block.icon, '').trimStart()
    : value
}

export function normalizeScratchBlockText(text) {
  return String(text ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s+([?:,%])/g, '$1')
    .toLowerCase()
}

export function findScratchBlock(text) {
  const normalized = normalizeScratchBlockText(text)
  if (!normalized || normalized === 'else' || normalized === 'end') return null
  return (
    SCRATCH_BLOCK_CATALOG.find((block) =>
      block.patterns.some((pattern) => pattern.test(normalized))
    ) ?? null
  )
}

export function isKnownScratchBlock(text) {
  return Boolean(findScratchBlock(text))
}
