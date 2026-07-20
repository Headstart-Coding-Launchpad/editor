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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
  { opcode: 'event_whenflagclicked', category: 'Events', label: 'when green flag clicked', sample: 'when green flag clicked', shape: 'hat' },
  { opcode: 'event_whenkeypressed', category: 'Events', label: 'when key pressed', sample: 'when [space] key pressed', shape: 'hat' },
  { opcode: 'event_whenthisspriteclicked', category: 'Events', label: 'when sprite clicked', sample: 'when this sprite clicked', shape: 'hat' },
  { opcode: 'event_whenbackdropswitchesto', category: 'Events', label: 'when backdrop switches to', sample: 'when backdrop switches to [backdrop1]', shape: 'hat' },
  { opcode: 'event_broadcast', category: 'Events', label: 'broadcast', sample: 'broadcast [message1]', shape: 'stack' },
  { opcode: 'event_broadcastandwait', category: 'Events', label: 'broadcast and wait', sample: 'broadcast [message1] and wait', shape: 'stack' },
  { opcode: 'event_whenbroadcastreceived', category: 'Events', label: 'when I receive', sample: 'when I receive [message1]', shape: 'hat' },

  { opcode: 'motion_movesteps', category: 'Motion', label: 'move steps', sample: 'move (10) steps', shape: 'stack' },
  { opcode: 'motion_turnright', category: 'Motion', label: 'turn right', sample: 'turn right (15) degrees', shape: 'stack', aliases: ['turn (15) degrees'] },
  { opcode: 'motion_turnleft', category: 'Motion', label: 'turn left', sample: 'turn left (15) degrees', shape: 'stack' },
  { opcode: 'motion_pointindirection', category: 'Motion', label: 'point in direction', sample: 'point in direction (90)', shape: 'stack' },
  { opcode: 'motion_gotoxy', category: 'Motion', label: 'go to x/y', sample: 'go to x: (0) y: (0)', shape: 'stack' },
  { opcode: 'motion_goto', category: 'Motion', label: 'go to', sample: 'go to [random position]', shape: 'stack' },
  { opcode: 'motion_glidesecstoxy', category: 'Motion', label: 'glide secs to x/y', sample: 'glide (1) secs to x: (0) y: (0)', shape: 'stack' },
  { opcode: 'motion_glideto', category: 'Motion', label: 'glide to', sample: 'glide (1) secs to [random position]', shape: 'stack' },
  { opcode: 'motion_ifonedge_bounce', category: 'Motion', label: 'if on edge, bounce', sample: 'if on edge, bounce', shape: 'stack' },
  { opcode: 'motion_setx', category: 'Motion', label: 'set x', sample: 'set x to (0)', shape: 'stack' },
  { opcode: 'motion_sety', category: 'Motion', label: 'set y', sample: 'set y to (0)', shape: 'stack' },
  { opcode: 'motion_changexby', category: 'Motion', label: 'change x', sample: 'change x by (10)', shape: 'stack' },
  { opcode: 'motion_changeyby', category: 'Motion', label: 'change y', sample: 'change y by (10)', shape: 'stack' },
  { opcode: 'motion_setrotationstyle', category: 'Motion', label: 'set rotation style', sample: 'set rotation style [left-right]', shape: 'stack' },
  { opcode: 'motion_xposition', category: 'Motion', label: 'x position', sample: 'x position', shape: 'reporter' },
  { opcode: 'motion_yposition', category: 'Motion', label: 'y position', sample: 'y position', shape: 'reporter' },
  { opcode: 'motion_direction', category: 'Motion', label: 'direction', sample: 'direction', shape: 'reporter' },

  { opcode: 'looks_sayforsecs', category: 'Looks', label: 'say for seconds', sample: 'say [Hello!] for (2) seconds', shape: 'stack' },
  { opcode: 'looks_say', category: 'Looks', label: 'say', sample: 'say [Hello!]', shape: 'stack' },
  { opcode: 'looks_think', category: 'Looks', label: 'think', sample: 'think [Hmm...]', shape: 'stack' },
  { opcode: 'looks_thinkforsecs', category: 'Looks', label: 'think for seconds', sample: 'think [Hmm...] for (2) seconds', shape: 'stack' },
  { opcode: 'looks_show', category: 'Looks', label: 'show', sample: 'show', shape: 'stack' },
  { opcode: 'looks_hide', category: 'Looks', label: 'hide', sample: 'hide', shape: 'stack' },
  { opcode: 'looks_setsizeto', category: 'Looks', label: 'set size', sample: 'set size to (100) %', shape: 'stack', aliases: ['set size to (100)%'] },
  { opcode: 'looks_changesizeby', category: 'Looks', label: 'change size', sample: 'change size by (10)', shape: 'stack' },
  { opcode: 'looks_switchcostumeto', category: 'Looks', label: 'switch costume to', sample: 'switch costume to [costume1]', shape: 'stack' },
  { opcode: 'looks_nextcostume', category: 'Looks', label: 'next costume', sample: 'next costume', shape: 'stack' },
  { opcode: 'looks_costumenumber', category: 'Looks', label: 'costume number', sample: 'costume number', shape: 'reporter' },
  { opcode: 'looks_costumenumbername', category: 'Looks', label: 'costume number/name', sample: 'costume [number]', shape: 'reporter' },
  { opcode: 'looks_switchbackdropto', category: 'Looks', label: 'switch backdrop to', sample: 'switch backdrop to [backdrop1]', shape: 'stack' },
  { opcode: 'looks_nextbackdrop', category: 'Looks', label: 'next backdrop', sample: 'next backdrop', shape: 'stack' },
  { opcode: 'looks_backdropnumbername', category: 'Looks', label: 'backdrop number/name', sample: 'backdrop [name]', shape: 'reporter' },
  { opcode: 'looks_seteffectto', category: 'Looks', label: 'set effect to', sample: 'set [color] effect to (0)', shape: 'stack' },
  { opcode: 'looks_changeeffectby', category: 'Looks', label: 'change effect by', sample: 'change [color] effect by (25)', shape: 'stack' },
  { opcode: 'looks_cleargraphiceffects', category: 'Looks', label: 'clear graphic effects', sample: 'clear graphic effects', shape: 'stack' },

  { opcode: 'sound_play', category: 'Sound', label: 'start sound', sample: 'start sound [meow]', shape: 'stack', aliases: ['play sound [meow]'] },
  { opcode: 'sound_playuntildone', category: 'Sound', label: 'play sound until done', sample: 'play sound [meow] until done', shape: 'stack' },
  { opcode: 'sound_stopallsounds', category: 'Sound', label: 'stop all sounds', sample: 'stop all sounds', shape: 'stack' },

  { opcode: 'control_wait', category: 'Control', label: 'wait', sample: 'wait (1) seconds', shape: 'stack' },
  { opcode: 'control_wait_until', category: 'Control', label: 'wait until', sample: 'wait until <>', shape: 'stack' },
  { opcode: 'control_repeat', category: 'Control', label: 'repeat', sample: 'repeat (10)', shape: 'c', mouths: ['SUBSTACK'] },
  { opcode: 'control_repeat_until', category: 'Control', label: 'repeat until', sample: 'repeat until <>', shape: 'c', mouths: ['SUBSTACK'] },
  { opcode: 'control_forever', category: 'Control', label: 'forever', sample: 'forever', shape: 'c', mouths: ['SUBSTACK'] },
  { opcode: 'control_if', category: 'Control', label: 'if then', sample: 'if <> then', shape: 'c', mouths: ['SUBSTACK'] },
  { opcode: 'control_if_else', category: 'Control', label: 'if then else', sample: 'if <> then else', shape: 'c', mouths: ['SUBSTACK', 'SUBSTACK2'] },
  { opcode: 'control_stop', category: 'Control', label: 'stop all', sample: 'stop all', shape: 'cap' },
  { opcode: 'control_create_clone_of', category: 'Control', label: 'create a clone of', sample: 'create a clone of [myself]', shape: 'stack' },
  { opcode: 'control_start_as_clone', category: 'Control', label: 'when I start as a clone', sample: 'when I start as a clone', shape: 'hat' },
  { opcode: 'control_delete_this_clone', category: 'Control', label: 'delete this clone', sample: 'delete this clone', shape: 'cap' },

  { opcode: 'sensing_askandwait', category: 'Sensing', label: 'ask and wait', sample: "ask [What's your name?] and wait", shape: 'stack' },
  { opcode: 'sensing_answer', category: 'Sensing', label: 'answer', sample: 'answer', shape: 'reporter' },
  { opcode: 'sensing_keypressed', category: 'Sensing', label: 'key pressed?', sample: 'key [space] pressed?', shape: 'boolean' },
  { opcode: 'sensing_mousedown', category: 'Sensing', label: 'mouse down?', sample: 'mouse down?', shape: 'boolean' },
  { opcode: 'sensing_touchingedge', category: 'Sensing', label: 'touching edge?', sample: 'touching edge?', shape: 'boolean' },
  { opcode: 'sensing_touchingobject', category: 'Sensing', label: 'touching object?', sample: 'touching [mouse-pointer]?', shape: 'boolean' },
  { opcode: 'sensing_distanceto', category: 'Sensing', label: 'distance to', sample: 'distance to [mouse-pointer]', shape: 'reporter' },
  { opcode: 'sensing_timer', category: 'Sensing', label: 'timer', sample: 'timer', shape: 'reporter' },
  { opcode: 'sensing_resettimer', category: 'Sensing', label: 'reset timer', sample: 'reset timer', shape: 'stack' },

  { opcode: 'operator_equals', category: 'Operators', label: 'equals', sample: '(1) = (2)', shape: 'boolean' },
  { opcode: 'operator_gt', category: 'Operators', label: 'greater than', sample: '(1) > (2)', shape: 'boolean' },
  { opcode: 'operator_lt', category: 'Operators', label: 'less than', sample: '(1) < (2)', shape: 'boolean' },
  { opcode: 'operator_and', category: 'Operators', label: 'and', sample: '<> and <>', shape: 'boolean' },
  { opcode: 'operator_or', category: 'Operators', label: 'or', sample: '<> or <>', shape: 'boolean' },
  { opcode: 'operator_not', category: 'Operators', label: 'not', sample: 'not <>', shape: 'boolean' },
  { opcode: 'operator_add', category: 'Operators', label: 'add', sample: '(1) + (2)', shape: 'reporter' },
  { opcode: 'operator_subtract', category: 'Operators', label: 'subtract', sample: '(1) - (2)', shape: 'reporter' },
  { opcode: 'operator_multiply', category: 'Operators', label: 'multiply', sample: '(1) * (2)', shape: 'reporter' },
  { opcode: 'operator_divide', category: 'Operators', label: 'divide', sample: '(1) / (2)', shape: 'reporter' },
  { opcode: 'operator_mod', category: 'Operators', label: 'mod', sample: '(1) mod (2)', shape: 'reporter' },
  { opcode: 'operator_round', category: 'Operators', label: 'round', sample: 'round (3.14)', shape: 'reporter' },
  { opcode: 'operator_mathop', category: 'Operators', label: 'math operation', sample: 'abs of (10)', shape: 'reporter', aliases: ['floor of (10)', 'ceiling of (10)', 'sqrt of (10)', 'sin of (10)', 'cos of (10)', 'tan of (10)', 'asin of (10)', 'acos of (10)', 'atan of (10)', 'ln of (10)', 'log of (10)', 'e ^ of (10)', '10 ^ of (10)'] },
  { opcode: 'operator_random', category: 'Operators', label: 'pick random', sample: 'pick random (1) to (10)', shape: 'reporter' },
  { opcode: 'operator_join', category: 'Operators', label: 'join', sample: 'join [hello] [world]', shape: 'reporter' },
  { opcode: 'operator_letter_of', category: 'Operators', label: 'letter of', sample: 'letter (1) of [hello]', shape: 'reporter' },
  { opcode: 'operator_length', category: 'Operators', label: 'length of', sample: 'length of [hello]', shape: 'reporter' },
  { opcode: 'operator_contains', category: 'Operators', label: 'contains', sample: '[apple] contains [a]?', shape: 'boolean' },

  { opcode: 'data_variable', category: 'Variables', label: 'variable', sample: '[score]', shape: 'reporter' },
  { opcode: 'data_setvariableto', category: 'Variables', label: 'set variable', sample: 'set [score] to (0)', shape: 'stack' },
  { opcode: 'data_changevariableby', category: 'Variables', label: 'change variable', sample: 'change [score] by (1)', shape: 'stack' },
  { opcode: 'data_showvariable', category: 'Variables', label: 'show variable', sample: 'show variable [score]', shape: 'stack' },
  { opcode: 'data_hidevariable', category: 'Variables', label: 'hide variable', sample: 'hide variable [score]', shape: 'stack' },
]

export const SCRATCH_BLOCK_CATALOG = blockEntries.map(entry => ({
  ...entry,
  color: SCRATCH_CATEGORY_COLOURS[entry.category],
  patterns: [entry.sample, ...(entry.aliases ?? [])].map(patternFromSample),
}))

export const SCRATCH_BLOCK_BY_OPCODE = Object.fromEntries(
  SCRATCH_BLOCK_CATALOG.map(block => [block.opcode, block]),
)

export const SCRATCH_TOOLBOX_GROUPS = Object.keys(SCRATCH_CATEGORY_COLOURS).map(name => ({
  name,
  colour: SCRATCH_CATEGORY_COLOURS[name],
  blocks: SCRATCH_BLOCK_CATALOG
    .filter(block => block.category === name)
    .map(block => [block.opcode, block.label]),
}))

export const SCRATCH_MARKDOWN_BLOCK_CATEGORIES = SCRATCH_TOOLBOX_GROUPS.map(group => ({
  label: group.name,
  color: group.colour,
  blocks: group.blocks.map(([opcode]) => SCRATCH_BLOCK_BY_OPCODE[opcode].sample),
}))

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
  return SCRATCH_BLOCK_CATALOG.find(block =>
    block.patterns.some(pattern => pattern.test(normalized))
  ) ?? null
}

export function isKnownScratchBlock(text) {
  return Boolean(findScratchBlock(text))
}
