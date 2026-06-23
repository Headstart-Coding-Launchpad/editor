// Shared Scratch module: Blockly setup, block definitions, a small interpreter,
// check evaluation, and serialization helpers used by the app and builder.
// Pure check/state helpers are in scratchChecks.js; persistence helpers are in scratchPersistence.js.
// Re-exported here for backward compatibility.
import * as Blockly from 'blockly'

export { DEFAULT_SPRITES, createSpriteState, evaluateScratchCheck, partialEvaluateScratchCheck, compare } from './checks'
export { saveWorkspace, loadWorkspace, migrateBroadcastState, migrateVariableFields } from './scratchPersistence'

let _Blockly = null
let audioContext = null
let activeOscillators = []
let _currentSprites = []
let _currentBackdrops = []
let _currentCostumes = []
let _currentVariables = []

export function setSpriteContext(sprites) {
  _currentSprites = sprites ?? []
}

export function setBackdropContext(backdrops) {
  _currentBackdrops = backdrops ?? []
}

export function setCostumeContext(costumes) {
  _currentCostumes = costumes ?? []
}

// Human-readable dropdown option for a costume: a thumbnail image when one is
// available, otherwise the emoji (already visual) or plain name as a fallback.
const COSTUME_THUMB_SIZE = 20
function costumeDropdownLabel(c) {
  if (c.imageUrl) return { src: c.imageUrl, width: COSTUME_THUMB_SIZE, height: COSTUME_THUMB_SIZE, alt: c.name }
  if (c.emoji) return `${c.emoji} ${c.name}`
  return c.name
}

export function setVariableContext(variables) {
  _currentVariables = variables ?? []
}

export async function loadBlocklyModules() {
  if (!_Blockly) {
    _Blockly = Blockly
    registerScratchFieldExtensions(_Blockly)
    _Blockly.common.defineBlocks(SCRATCH_BLOCK_DEFINITIONS)
  }
  return { Blockly: _Blockly }
}

function registerScratchFieldExtensions(Blockly) {
  if (Blockly.Extensions.isRegistered('scratch_variable_field')) return
  // No-op: kept for compatibility with any serialized workspaces that reference this extension
  Blockly.Extensions.register('scratch_variable_field', function () {})
}

function numberInput(name, value = 0) {
  return {
    type: 'input_value',
    name,
    check: ['Number', 'String'],
  }
}

function stringInput(name, text = '') {
  return {
    type: 'input_value',
    name,
    check: ['String', 'Number'],
  }
}

function boolInput(name) {
  return { type: 'input_value', name, check: 'Boolean' }
}

const GREEN_FLAG_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 15 15"><rect x="1" y="0" width="2" height="15" rx=".5" fill="#374151"/><polygon points="3,1 14,6 3,11" fill="#22c55e"/></svg>'
const GREEN_FLAG_SRC = 'data:image/svg+xml,' + encodeURIComponent(GREEN_FLAG_SVG)

export const SCRATCH_BLOCK_DEFINITIONS = {
  event_whenflagclicked: {
    init() {
      this.jsonInit({
        type: 'event_whenflagclicked',
        message0: 'when %1 clicked',
        args0: [{ type: 'field_image', src: GREEN_FLAG_SRC, width: 15, height: 15, alt: 'green flag' }],
        nextStatement: null,
        colour: '#FFAB19',
      })
    },
  },
  event_whenkeypressed: {
    init() {
      this.jsonInit({
        type: 'event_whenkeypressed',
        message0: 'when %1 key pressed',
        args0: [{ type: 'field_dropdown', name: 'KEY_OPTION', options: KEY_OPTIONS }],
        nextStatement: null,
        colour: '#FFAB19',
      })
    },
  },
  event_whenthisspriteclicked: {
    init() {
      this.jsonInit({ type: 'event_whenthisspriteclicked', message0: 'when this sprite clicked', nextStatement: null, colour: '#FFAB19' })
    },
  },
  event_broadcast: {
    init() {
      this.jsonInit({
        type: 'event_broadcast',
        message0: 'broadcast %1',
        args0: [{ type: 'field_input', name: 'BROADCAST_INPUT', text: 'message1' }],
        previousStatement: null,
        nextStatement: null,
        colour: '#FFAB19',
      })
    },
  },
  event_broadcastandwait: {
    init() {
      this.jsonInit({
        type: 'event_broadcastandwait',
        message0: 'broadcast %1 and wait',
        args0: [{ type: 'field_input', name: 'BROADCAST_INPUT', text: 'message1' }],
        previousStatement: null,
        nextStatement: null,
        colour: '#FFAB19',
      })
    },
  },
  event_whenbroadcastreceived: {
    init() {
      this.jsonInit({
        type: 'event_whenbroadcastreceived',
        message0: 'when I receive %1',
        args0: [{ type: 'field_input', name: 'BROADCAST_OPTION', text: 'message1' }],
        nextStatement: null,
        colour: '#FFAB19',
      })
    },
  },

  motion_movesteps: blockStatement('motion_movesteps', 'move %1 steps', [numberInput('STEPS', 10)], '#4C97FF'),
  motion_turnright: blockStatement('motion_turnright', 'turn right %1 degrees', [numberInput('DEGREES', 15)], '#4C97FF'),
  motion_turnleft: blockStatement('motion_turnleft', 'turn left %1 degrees', [numberInput('DEGREES', 15)], '#4C97FF'),
  motion_gotoxy: blockStatement('motion_gotoxy', 'go to x: %1 y: %2', [numberInput('X', 0), numberInput('Y', 0)], '#4C97FF'),
  motion_goto: {
    init() {
      this.jsonInit({
        type: 'motion_goto',
        message0: 'go to %1',
        args0: [{ type: 'field_dropdown', name: 'TO', options: () => [
          ['random position', '_random_'],
          ['mouse pointer', '_mouse_'],
          ..._currentSprites.map(sp => [sp.name, sp.id]),
        ]}],
        previousStatement: null,
        nextStatement: null,
        colour: '#4C97FF',
      })
    },
  },
  motion_glidesecstoxy: blockStatement('motion_glidesecstoxy', 'glide %1 secs to x: %2 y: %3', [numberInput('SECS', 1), numberInput('X', 0), numberInput('Y', 0)], '#4C97FF'),
  motion_glideto: {
    init() {
      this.jsonInit({
        type: 'motion_glideto',
        message0: 'glide %1 secs to %2',
        args0: [
          numberInput('SECS', 1),
          { type: 'field_dropdown', name: 'TO', options: () => [
            ['random position', '_random_'],
            ['mouse pointer', '_mouse_'],
            ..._currentSprites.map(sp => [sp.name, sp.id]),
          ]},
        ],
        previousStatement: null,
        nextStatement: null,
        colour: '#4C97FF',
      })
    },
  },
  motion_pointindirection: blockStatement('motion_pointindirection', 'point in direction %1', [numberInput('DIRECTION', 90)], '#4C97FF'),
  motion_ifonedge_bounce: blockStatement('motion_ifonedge_bounce', 'if on edge, bounce', [], '#4C97FF'),
  motion_setx: blockStatement('motion_setx', 'set x to %1', [numberInput('X', 0)], '#4C97FF'),
  motion_sety: blockStatement('motion_sety', 'set y to %1', [numberInput('Y', 0)], '#4C97FF'),
  motion_changexby: blockStatement('motion_changexby', 'change x by %1', [numberInput('DX', 10)], '#4C97FF'),
  motion_changeyby: blockStatement('motion_changeyby', 'change y by %1', [numberInput('DY', 10)], '#4C97FF'),
  motion_xposition: reporter('motion_xposition', 'x position', 'Number', '#4C97FF'),
  motion_yposition: reporter('motion_yposition', 'y position', 'Number', '#4C97FF'),
  motion_direction: reporter('motion_direction', 'direction', 'Number', '#4C97FF'),
  motion_setrotationstyle: {
    init() {
      this.jsonInit({
        type: 'motion_setrotationstyle',
        message0: 'set rotation style %1',
        args0: [{ type: 'field_dropdown', name: 'STYLE', options: [['left-right', 'left-right'], ["don't rotate", "don't rotate"], ['all around', 'all around']] }],
        previousStatement: null,
        nextStatement: null,
        colour: '#4C97FF',
      })
    },
  },

  looks_sayforsecs: blockStatement('looks_sayforsecs', 'say %1 for %2 seconds', [stringInput('MESSAGE', 'Hello!'), numberInput('SECS', 2)], '#9966FF'),
  looks_say: blockStatement('looks_say', 'say %1', [stringInput('MESSAGE', 'Hello!')], '#9966FF'),
  looks_think: blockStatement('looks_think', 'think %1', [stringInput('MESSAGE', 'Hmm...')], '#9966FF'),
  looks_thinkforsecs: blockStatement('looks_thinkforsecs', 'think %1 for %2 seconds', [stringInput('MESSAGE', 'Hmm...'), numberInput('SECS', 2)], '#9966FF'),
  looks_show: blockStatement('looks_show', 'show', [], '#9966FF'),
  looks_hide: blockStatement('looks_hide', 'hide', [], '#9966FF'),
  looks_setsizeto: blockStatement('looks_setsizeto', 'set size to %1 %', [numberInput('SIZE', 100)], '#9966FF'),
  looks_changesizeby: blockStatement('looks_changesizeby', 'change size by %1', [numberInput('CHANGE', 10)], '#9966FF'),
  looks_switchcostumeto: {
    init() {
      this.jsonInit({
        type: 'looks_switchcostumeto',
        message0: 'switch costume to %1',
        args0: [{ type: 'field_dropdown', name: 'COSTUME', options: () =>
          _currentCostumes.length ? _currentCostumes.map(c => [costumeDropdownLabel(c), c.name]) : [['costume1', 'costume1']]
        }],
        previousStatement: null,
        nextStatement: null,
        colour: '#9966FF',
      })
    },
  },
  looks_nextcostume: blockStatement('looks_nextcostume', 'next costume', [], '#9966FF'),
  looks_costumenumber: reporter('looks_costumenumber', 'costume number', 'Number', '#9966FF'),
  looks_switchbackdropto: {
    init() {
      this.jsonInit({
        type: 'looks_switchbackdropto',
        message0: 'switch backdrop to %1',
        args0: [{ type: 'field_dropdown', name: 'BACKDROP', options: () =>
          _currentBackdrops.length ? _currentBackdrops.map(b => [b.name, b.name]) : [['Backdrop 1', 'Backdrop 1']]
        }],
        previousStatement: null,
        nextStatement: null,
        colour: '#9966FF',
      })
    },
  },
  looks_nextbackdrop: blockStatement('looks_nextbackdrop', 'next backdrop', [], '#9966FF'),
  event_whenbackdropswitchesto: {
    init() {
      this.jsonInit({
        type: 'event_whenbackdropswitchesto',
        message0: 'when backdrop switches to %1',
        args0: [{ type: 'field_dropdown', name: 'BACKDROP', options: () =>
          _currentBackdrops.length ? _currentBackdrops.map(b => [b.name, b.name]) : [['Backdrop 1', 'Backdrop 1']]
        }],
        nextStatement: null,
        colour: '#FFAB19',
      })
    },
  },

  sound_play: soundBlock('sound_play', 'start sound %1'),
  sound_playuntildone: soundBlock('sound_playuntildone', 'play sound %1 until done'),
  sound_stopallsounds: blockStatement('sound_stopallsounds', 'stop all sounds', [], '#CF63CF'),

  control_wait: blockStatement('control_wait', 'wait %1 seconds', [numberInput('DURATION', 1)], '#FFAB19'),
  control_repeat: {
    init() {
      this.jsonInit({
        type: 'control_repeat',
        message0: 'repeat %1',
        args0: [numberInput('TIMES', 10)],
        message1: '%1',
        args1: [{ type: 'input_statement', name: 'SUBSTACK' }],
        previousStatement: null,
        nextStatement: null,
        colour: '#FFAB19',
      })
    },
  },
  control_forever: {
    init() {
      this.jsonInit({
        type: 'control_forever',
        message0: 'forever',
        message1: '%1',
        args1: [{ type: 'input_statement', name: 'SUBSTACK' }],
        previousStatement: null,
        colour: '#FFAB19',
      })
    },
  },
  control_if: {
    init() {
      this.jsonInit({
        type: 'control_if',
        message0: 'if %1 then',
        args0: [boolInput('CONDITION')],
        message1: '%1',
        args1: [{ type: 'input_statement', name: 'SUBSTACK' }],
        previousStatement: null,
        nextStatement: null,
        colour: '#FFAB19',
      })
    },
  },
  control_if_else: {
    init() {
      this.jsonInit({
        type: 'control_if_else',
        message0: 'if %1 then',
        args0: [boolInput('CONDITION')],
        message1: '%1',
        args1: [{ type: 'input_statement', name: 'SUBSTACK' }],
        message2: 'else %1',
        args2: [{ type: 'input_statement', name: 'SUBSTACK2' }],
        previousStatement: null,
        nextStatement: null,
        colour: '#FFAB19',
      })
    },
  },
  control_stop: blockStop('control_stop', 'stop all'),

  control_create_clone_of: {
    init() {
      this.jsonInit({
        type: 'control_create_clone_of',
        message0: 'create a clone of %1',
        args0: [{ type: 'field_dropdown', name: 'CLONE_OPTION', options: () => [
          ['myself', '_myself_'],
          ..._currentSprites.map(sp => [sp.name, sp.id]),
        ]}],
        previousStatement: null,
        nextStatement: null,
        colour: '#FFAB19',
      })
    },
  },
  control_start_as_clone: {
    init() {
      this.jsonInit({ type: 'control_start_as_clone', message0: 'when I start as a clone', nextStatement: null, colour: '#FFAB19' })
    },
  },
  control_delete_this_clone: blockStop('control_delete_this_clone', 'delete this clone'),

  sensing_askandwait: blockStatement('sensing_askandwait', 'ask %1 and wait', [stringInput('QUESTION', "What's your name?")], '#5CB1D6'),
  sensing_answer: reporter('sensing_answer', 'answer', 'String', '#5CB1D6'),
  sensing_keypressed: {
    init() {
      this.jsonInit({
        type: 'sensing_keypressed',
        message0: 'key %1 pressed?',
        args0: [{ type: 'field_dropdown', name: 'KEY_OPTION', options: KEY_OPTIONS }],
        output: 'Boolean',
        colour: '#5CB1D6',
      })
    },
  },
  sensing_mousedown: reporter('sensing_mousedown', 'mouse down?', 'Boolean', '#5CB1D6'),
  sensing_touchingedge: reporter('sensing_touchingedge', 'touching edge?', 'Boolean', '#5CB1D6'),
  sensing_touchingobject: {
    init() {
      this.jsonInit({
        type: 'sensing_touchingobject',
        message0: 'touching %1?',
        args0: [{ type: 'field_dropdown', name: 'TOUCHINGOBJECTMENU', options: () => [
          ['mouse-pointer', '_mouse_'],
          ['edge', '_edge_'],
          ..._currentSprites.map(sp => [sp.name, sp.id]),
        ]}],
        output: 'Boolean',
        colour: '#5CB1D6',
      })
    },
  },

  operator_equals: operator('operator_equals', '%1 = %2', [stringInput('OPERAND1', ''), stringInput('OPERAND2', '')], 'Boolean'),
  operator_gt: operator('operator_gt', '%1 > %2', [numberInput('OPERAND1', 50), numberInput('OPERAND2', 0)], 'Boolean'),
  operator_lt: operator('operator_lt', '%1 < %2', [numberInput('OPERAND1', 0), numberInput('OPERAND2', 50)], 'Boolean'),
  operator_and: operator('operator_and', '%1 and %2', [boolInput('OPERAND1'), boolInput('OPERAND2')], 'Boolean'),
  operator_or: operator('operator_or', '%1 or %2', [boolInput('OPERAND1'), boolInput('OPERAND2')], 'Boolean'),
  operator_not: operator('operator_not', 'not %1', [boolInput('OPERAND')], 'Boolean'),
  operator_add: operator('operator_add', '%1 + %2', [numberInput('NUM1', 1), numberInput('NUM2', 1)], 'Number'),
  operator_subtract: operator('operator_subtract', '%1 - %2', [numberInput('NUM1', 1), numberInput('NUM2', 1)], 'Number'),
  operator_join: operator('operator_join', 'join %1 %2', [stringInput('STRING1', 'apple'), stringInput('STRING2', 'banana')], 'String'),
  operator_multiply: operator('operator_multiply', '%1 * %2', [numberInput('NUM1', 1), numberInput('NUM2', 1)], 'Number'),
  operator_divide: operator('operator_divide', '%1 / %2', [numberInput('NUM1', 1), numberInput('NUM2', 1)], 'Number'),
  operator_mod: operator('operator_mod', '%1 mod %2', [numberInput('NUM1', 1), numberInput('NUM2', 1)], 'Number'),
  operator_round: operator('operator_round', 'round %1', [numberInput('NUM', 0)], 'Number'),
  operator_random: operator('operator_random', 'pick random %1 to %2', [numberInput('FROM', 1), numberInput('TO', 10)], 'Number'),
  operator_mathop: {
    init() {
      this.jsonInit({
        type: 'operator_mathop',
        message0: '%1 of %2',
        args0: [
          { type: 'field_dropdown', name: 'OPERATOR', options: [
            ['abs', 'abs'], ['floor', 'floor'], ['ceiling', 'ceiling'], ['sqrt', 'sqrt'],
            ['sin', 'sin'], ['cos', 'cos'], ['tan', 'tan'],
            ['asin', 'asin'], ['acos', 'acos'], ['atan', 'atan'],
            ['ln', 'ln'], ['log', 'log'], ['e ^', 'e ^'], ['10 ^', '10 ^'],
          ]},
          numberInput('NUM', 10),
        ],
        output: 'Number',
        colour: '#59C059',
        inputsInline: true,
      })
    },
  },
  operator_letter_of: operator('operator_letter_of', 'letter %1 of %2', [numberInput('LETTER', 1), stringInput('STRING', 'world')], 'String'),
  operator_length: operator('operator_length', 'length of %1', [stringInput('STRING', 'world')], 'Number'),
  operator_contains: operator('operator_contains', '%1 contains %2?', [stringInput('STRING1', 'apple'), stringInput('STRING2', 'a')], 'Boolean'),

  control_wait_until: {
    init() {
      this.jsonInit({
        type: 'control_wait_until',
        message0: 'wait until %1',
        args0: [boolInput('CONDITION')],
        previousStatement: null,
        nextStatement: null,
        colour: '#FFAB19',
      })
    },
  },
  control_repeat_until: {
    init() {
      this.jsonInit({
        type: 'control_repeat_until',
        message0: 'repeat until %1',
        args0: [boolInput('CONDITION')],
        message1: '%1',
        args1: [{ type: 'input_statement', name: 'SUBSTACK' }],
        previousStatement: null,
        nextStatement: null,
        colour: '#FFAB19',
      })
    },
  },

  looks_seteffectto: {
    init() {
      this.jsonInit({
        type: 'looks_seteffectto',
        message0: 'set %1 effect to %2',
        args0: [
          { type: 'field_dropdown', name: 'EFFECT', options: [
            ['color', 'color'], ['fisheye', 'fisheye'], ['whirl', 'whirl'],
            ['pixelate', 'pixelate'], ['mosaic', 'mosaic'], ['brightness', 'brightness'], ['ghost', 'ghost'],
          ]},
          numberInput('VALUE', 0),
        ],
        previousStatement: null,
        nextStatement: null,
        colour: '#9966FF',
      })
    },
  },
  looks_changeeffectby: {
    init() {
      this.jsonInit({
        type: 'looks_changeeffectby',
        message0: 'change %1 effect by %2',
        args0: [
          { type: 'field_dropdown', name: 'EFFECT', options: [
            ['color', 'color'], ['fisheye', 'fisheye'], ['whirl', 'whirl'],
            ['pixelate', 'pixelate'], ['mosaic', 'mosaic'], ['brightness', 'brightness'], ['ghost', 'ghost'],
          ]},
          numberInput('VALUE', 25),
        ],
        previousStatement: null,
        nextStatement: null,
        colour: '#9966FF',
      })
    },
  },
  looks_cleargraphiceffects: blockStatement('looks_cleargraphiceffects', 'clear graphic effects', [], '#9966FF'),
  looks_costumenumbername: {
    init() {
      this.jsonInit({
        type: 'looks_costumenumbername',
        message0: 'costume %1',
        args0: [{ type: 'field_dropdown', name: 'WHICH', options: [['number', 'number'], ['name', 'name']] }],
        output: ['Number', 'String'],
        colour: '#9966FF',
      })
    },
  },
  looks_backdropnumbername: {
    init() {
      this.jsonInit({
        type: 'looks_backdropnumbername',
        message0: 'backdrop %1',
        args0: [{ type: 'field_dropdown', name: 'WHICH', options: [['number', 'number'], ['name', 'name']] }],
        output: ['Number', 'String'],
        colour: '#9966FF',
      })
    },
  },

  sensing_timer: reporter('sensing_timer', 'timer', 'Number', '#5CB1D6'),
  sensing_resettimer: blockStatement('sensing_resettimer', 'reset timer', [], '#5CB1D6'),
  sensing_distanceto: {
    init() {
      this.jsonInit({
        type: 'sensing_distanceto',
        message0: 'distance to %1',
        args0: [{ type: 'field_dropdown', name: 'DISTANCETOMENU', options: () => [
          ['mouse-pointer', '_mouse_'],
          ..._currentSprites.map(sp => [sp.name, sp.id]),
        ]}],
        output: 'Number',
        colour: '#5CB1D6',
      })
    },
  },

  data_variable: variableReporter(),
  data_setvariableto: variableStatement('data_setvariableto', 'set %1 to %2', stringInput('VALUE', 0)),
  data_changevariableby: variableStatement('data_changevariableby', 'change %1 by %2', numberInput('VALUE', 1)),
  data_showvariable: {
    init() {
      this.jsonInit({
        type: 'data_showvariable',
        message0: 'show variable %1',
        args0: [{ type: 'field_dropdown', name: 'VARIABLE', options: variableOptions }],
        previousStatement: null,
        nextStatement: null,
        colour: '#FF8C1A',
      })
    },
  },
  data_hidevariable: {
    init() {
      this.jsonInit({
        type: 'data_hidevariable',
        message0: 'hide variable %1',
        args0: [{ type: 'field_dropdown', name: 'VARIABLE', options: variableOptions }],
        previousStatement: null,
        nextStatement: null,
        colour: '#FF8C1A',
      })
    },
  },
}

const KEY_OPTIONS = [['space', 'space'], ['up arrow', 'up arrow'], ['down arrow', 'down arrow'], ['left arrow', 'left arrow'], ['right arrow', 'right arrow'], ['any', 'any']]

function blockStatement(type, message0, args0, colour) {
  return {
    init() {
      this.jsonInit({ type, message0, args0, previousStatement: null, nextStatement: null, colour })
    },
  }
}

function reporter(type, message0, output, colour) {
  return {
    init() {
      this.jsonInit({ type, message0, output, colour })
    },
  }
}

function operator(type, message0, args0, output) {
  return {
    init() {
      this.jsonInit({ type, message0, args0, output, colour: '#59C059', inputsInline: true })
    },
  }
}

function soundBlock(type, message0) {
  return {
    init() {
      this.jsonInit({
        type,
        message0,
        args0: [{ type: 'field_dropdown', name: 'SOUND_MENU', options: [['pop', 'pop'], ['meow', 'meow'], ['click', 'click'], ['chime', 'chime']] }],
        previousStatement: null,
        nextStatement: null,
        colour: '#CF63CF',
      })
    },
  }
}

function blockStop(type, message0) {
  return {
    init() {
      this.jsonInit({ type, message0, previousStatement: null, colour: '#FFAB19' })
    },
  }
}

function variableOptions() {
  return _currentVariables.length
    ? _currentVariables.map(v => [v.name, v.name])
    : [['score', 'score']]
}

function variableReporter() {
  return {
    init() {
      this.jsonInit({
        type: 'data_variable',
        message0: '%1',
        args0: [{ type: 'field_dropdown', name: 'VARIABLE', options: variableOptions }],
        output: ['Number', 'String'],
        colour: '#FF8C1A',
      })
    },
  }
}

function variableStatement(type, message0, valueInput) {
  return {
    init() {
      this.jsonInit({
        type,
        message0,
        args0: [{ type: 'field_dropdown', name: 'VARIABLE', options: variableOptions }, valueInput],
        previousStatement: null,
        nextStatement: null,
        colour: '#FF8C1A',
      })
    },
  }
}

export const DEFAULT_TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category', name: 'Events', colour: '#FFAB19',
      contents: [
        { kind: 'block', type: 'event_whenflagclicked' },
        { kind: 'block', type: 'event_whenkeypressed' },
        { kind: 'block', type: 'event_whenthisspriteclicked' },
        { kind: 'block', type: 'event_whenbackdropswitchesto' },
        { kind: 'block', type: 'event_broadcast' },
        { kind: 'block', type: 'event_broadcastandwait' },
        { kind: 'block', type: 'event_whenbroadcastreceived' },
      ],
    },
    {
      kind: 'category', name: 'Motion', colour: '#4C97FF',
      contents: [
        { kind: 'block', type: 'motion_movesteps' },
        { kind: 'block', type: 'motion_turnright' },
        { kind: 'block', type: 'motion_turnleft' },
        { kind: 'block', type: 'motion_pointindirection' },
        { kind: 'block', type: 'motion_gotoxy' },
        { kind: 'block', type: 'motion_goto' },
        { kind: 'block', type: 'motion_glidesecstoxy' },
        { kind: 'block', type: 'motion_glideto' },
        { kind: 'block', type: 'motion_ifonedge_bounce' },
        { kind: 'block', type: 'motion_setx' },
        { kind: 'block', type: 'motion_sety' },
        { kind: 'block', type: 'motion_changexby' },
        { kind: 'block', type: 'motion_changeyby' },
        { kind: 'block', type: 'motion_xposition' },
        { kind: 'block', type: 'motion_yposition' },
        { kind: 'block', type: 'motion_direction' },
      ],
    },
    {
      kind: 'category', name: 'Looks', colour: '#9966FF',
      contents: [
        { kind: 'block', type: 'looks_sayforsecs' },
        { kind: 'block', type: 'looks_say' },
        { kind: 'block', type: 'looks_think' },
        { kind: 'block', type: 'looks_thinkforsecs' },
        { kind: 'block', type: 'looks_show' },
        { kind: 'block', type: 'looks_hide' },
        { kind: 'block', type: 'looks_setsizeto' },
        { kind: 'block', type: 'looks_changesizeby' },
        { kind: 'block', type: 'looks_switchcostumeto' },
        { kind: 'block', type: 'looks_nextcostume' },
        { kind: 'block', type: 'looks_costumenumber' },
        { kind: 'block', type: 'looks_costumenumbername' },
        { kind: 'block', type: 'looks_switchbackdropto' },
        { kind: 'block', type: 'looks_nextbackdrop' },
        { kind: 'block', type: 'looks_backdropnumbername' },
        { kind: 'block', type: 'looks_seteffectto' },
        { kind: 'block', type: 'looks_changeeffectby' },
        { kind: 'block', type: 'looks_cleargraphiceffects' },
      ],
    },
    {
      kind: 'category', name: 'Sound', colour: '#CF63CF',
      contents: [
        { kind: 'block', type: 'sound_play' },
        { kind: 'block', type: 'sound_playuntildone' },
        { kind: 'block', type: 'sound_stopallsounds' },
      ],
    },
    {
      kind: 'category', name: 'Control', colour: '#FFAB19',
      contents: [
        { kind: 'block', type: 'control_wait' },
        { kind: 'block', type: 'control_wait_until' },
        { kind: 'block', type: 'control_repeat' },
        { kind: 'block', type: 'control_repeat_until' },
        { kind: 'block', type: 'control_forever' },
        { kind: 'block', type: 'control_if' },
        { kind: 'block', type: 'control_if_else' },
        { kind: 'block', type: 'control_stop' },
        { kind: 'block', type: 'control_create_clone_of' },
        { kind: 'block', type: 'control_start_as_clone' },
        { kind: 'block', type: 'control_delete_this_clone' },
      ],
    },
    {
      kind: 'category', name: 'Sensing', colour: '#5CB1D6',
      contents: [
        { kind: 'block', type: 'sensing_askandwait' },
        { kind: 'block', type: 'sensing_answer' },
        { kind: 'block', type: 'sensing_keypressed' },
        { kind: 'block', type: 'sensing_mousedown' },
        { kind: 'block', type: 'sensing_touchingedge' },
        { kind: 'block', type: 'sensing_touchingobject' },
        { kind: 'block', type: 'sensing_distanceto' },
        { kind: 'block', type: 'sensing_timer' },
        { kind: 'block', type: 'sensing_resettimer' },
      ],
    },
    {
      kind: 'category', name: 'Operators', colour: '#59C059',
      contents: [
        { kind: 'block', type: 'operator_equals' },
        { kind: 'block', type: 'operator_gt' },
        { kind: 'block', type: 'operator_lt' },
        { kind: 'block', type: 'operator_and' },
        { kind: 'block', type: 'operator_or' },
        { kind: 'block', type: 'operator_not' },
        { kind: 'block', type: 'operator_add' },
        { kind: 'block', type: 'operator_subtract' },
        { kind: 'block', type: 'operator_multiply' },
        { kind: 'block', type: 'operator_divide' },
        { kind: 'block', type: 'operator_mod' },
        { kind: 'block', type: 'operator_round' },
        { kind: 'block', type: 'operator_mathop' },
        { kind: 'block', type: 'operator_random' },
        { kind: 'block', type: 'operator_join' },
        { kind: 'block', type: 'operator_letter_of' },
        { kind: 'block', type: 'operator_length' },
        { kind: 'block', type: 'operator_contains' },
      ],
    },
    {
      kind: 'category', name: 'Variables', colour: '#FF8C1A',
      contents: [
        { kind: 'block', type: 'data_variable' },
        { kind: 'block', type: 'data_setvariableto' },
        { kind: 'block', type: 'data_changevariableby' },
        { kind: 'block', type: 'data_showvariable' },
        { kind: 'block', type: 'data_hidevariable' },
      ],
    },
  ],
}

const STAGE_EXCLUDED_CONTROL_BLOCKS = new Set(['control_start_as_clone', 'control_delete_this_clone'])

export const STAGE_TOOLBOX = {
  kind: 'categoryToolbox',
  contents: DEFAULT_TOOLBOX.contents
    .filter(c => c.name !== 'Motion')
    .map(c => c.name !== 'Control' ? c : { ...c, contents: c.contents.filter(item => !STAGE_EXCLUDED_CONTROL_BLOCKS.has(item.type)) }),
}

export const VALUE_INPUT_DEFAULTS = {
  motion_movesteps: { STEPS: numberShadow(10) },
  motion_turnright: { DEGREES: numberShadow(15) },
  motion_turnleft: { DEGREES: numberShadow(15) },
  motion_gotoxy: { X: numberShadow(0), Y: numberShadow(0) },
  motion_glidesecstoxy: { SECS: numberShadow(1), X: numberShadow(0), Y: numberShadow(0) },
  motion_glideto: { SECS: numberShadow(1) },
  motion_pointindirection: { DIRECTION: numberShadow(90) },
  motion_setx: { X: numberShadow(0) },
  motion_sety: { Y: numberShadow(0) },
  motion_changexby: { DX: numberShadow(10) },
  motion_changeyby: { DY: numberShadow(10) },
  looks_sayforsecs: { MESSAGE: textShadow('Hello!'), SECS: numberShadow(2) },
  looks_say: { MESSAGE: textShadow('Hello!') },
  looks_think: { MESSAGE: textShadow('Hmm...') },
  looks_thinkforsecs: { MESSAGE: textShadow('Hmm...'), SECS: numberShadow(2) },
  looks_setsizeto: { SIZE: numberShadow(100) },
  looks_changesizeby: { CHANGE: numberShadow(10) },
  control_wait: { DURATION: numberShadow(1) },
  control_repeat: { TIMES: numberShadow(10) },
  sensing_askandwait: { QUESTION: textShadow("What's your name?") },
  operator_equals: { OPERAND1: textShadow(''), OPERAND2: textShadow('') },
  operator_gt: { OPERAND1: numberShadow(50), OPERAND2: numberShadow(0) },
  operator_lt: { OPERAND1: numberShadow(0), OPERAND2: numberShadow(50) },
  operator_add: { NUM1: numberShadow(1), NUM2: numberShadow(1) },
  operator_subtract: { NUM1: numberShadow(1), NUM2: numberShadow(1) },
  operator_multiply: { NUM1: numberShadow(1), NUM2: numberShadow(1) },
  operator_divide: { NUM1: numberShadow(1), NUM2: numberShadow(1) },
  operator_mod: { NUM1: numberShadow(1), NUM2: numberShadow(1) },
  operator_round: { NUM: numberShadow(0) },
  operator_mathop: { NUM: numberShadow(0) },
  operator_random: { FROM: numberShadow(1), TO: numberShadow(10) },
  operator_join: { STRING1: textShadow('apple'), STRING2: textShadow('banana') },
  operator_letter_of: { LETTER: numberShadow(1), STRING: textShadow('world') },
  operator_length: { STRING: textShadow('world') },
  operator_contains: { STRING1: textShadow('apple'), STRING2: textShadow('a') },
  looks_seteffectto: { VALUE: numberShadow(0) },
  looks_changeeffectby: { VALUE: numberShadow(25) },
  data_setvariableto: { VALUE: textShadow(0) },
  data_changevariableby: { VALUE: numberShadow(1) },
}

// Message templates for blocks with value inputs. %N maps to inputOrder[N-1].
// Used by the builder to render inline block-like editors with embedded input fields.
export const BLOCK_DISPLAY_TEMPLATES = {
  motion_movesteps:        { message: 'move %1 steps',                  inputOrder: ['STEPS'] },
  motion_turnright:        { message: 'turn right %1 degrees',           inputOrder: ['DEGREES'] },
  motion_turnleft:         { message: 'turn left %1 degrees',            inputOrder: ['DEGREES'] },
  motion_gotoxy:           { message: 'go to x: %1 y: %2',              inputOrder: ['X', 'Y'] },
  motion_glidesecstoxy:    { message: 'glide %1 secs to x: %2 y: %3',  inputOrder: ['SECS', 'X', 'Y'] },
  motion_glideto:          { message: 'glide %1 secs to',               inputOrder: ['SECS'] },
  motion_pointindirection: { message: 'point in direction %1',           inputOrder: ['DIRECTION'] },
  motion_setx:             { message: 'set x to %1',                    inputOrder: ['X'] },
  motion_sety:             { message: 'set y to %1',                    inputOrder: ['Y'] },
  motion_changexby:        { message: 'change x by %1',                 inputOrder: ['DX'] },
  motion_changeyby:        { message: 'change y by %1',                 inputOrder: ['DY'] },
  looks_sayforsecs:        { message: 'say %1 for %2 seconds',          inputOrder: ['MESSAGE', 'SECS'] },
  looks_say:               { message: 'say %1',                         inputOrder: ['MESSAGE'] },
  looks_think:             { message: 'think %1',                       inputOrder: ['MESSAGE'] },
  looks_thinkforsecs:      { message: 'think %1 for %2 seconds',        inputOrder: ['MESSAGE', 'SECS'] },
  looks_setsizeto:         { message: 'set size to %1 %',               inputOrder: ['SIZE'] },
  looks_changesizeby:      { message: 'change size by %1',              inputOrder: ['CHANGE'] },
  control_wait:            { message: 'wait %1 seconds',                inputOrder: ['DURATION'] },
  control_repeat:          { message: 'repeat %1',                      inputOrder: ['TIMES'] },
  sensing_askandwait:      { message: 'ask %1 and wait',                inputOrder: ['QUESTION'] },
  operator_equals:         { message: '%1 = %2',                        inputOrder: ['OPERAND1', 'OPERAND2'] },
  operator_gt:             { message: '%1 > %2',                        inputOrder: ['OPERAND1', 'OPERAND2'] },
  operator_lt:             { message: '%1 < %2',                        inputOrder: ['OPERAND1', 'OPERAND2'] },
  operator_add:            { message: '%1 + %2',                        inputOrder: ['NUM1', 'NUM2'] },
  operator_subtract:       { message: '%1 - %2',                        inputOrder: ['NUM1', 'NUM2'] },
  operator_multiply:       { message: '%1 * %2',                        inputOrder: ['NUM1', 'NUM2'] },
  operator_divide:         { message: '%1 / %2',                        inputOrder: ['NUM1', 'NUM2'] },
  operator_mod:            { message: '%1 mod %2',                      inputOrder: ['NUM1', 'NUM2'] },
  operator_round:          { message: 'round %1',                       inputOrder: ['NUM'] },
  operator_mathop:         { message: '_ of %1',                        inputOrder: ['NUM'] },
  operator_random:         { message: 'pick random %1 to %2',           inputOrder: ['FROM', 'TO'] },
  operator_join:           { message: 'join %1 %2',                     inputOrder: ['STRING1', 'STRING2'] },
  operator_letter_of:      { message: 'letter %1 of %2',               inputOrder: ['LETTER', 'STRING'] },
  operator_length:         { message: 'length of %1',                   inputOrder: ['STRING'] },
  operator_contains:       { message: '%1 contains %2?',                inputOrder: ['STRING1', 'STRING2'] },
  looks_seteffectto:       { message: 'set effect to %1',               inputOrder: ['VALUE'] },
  looks_changeeffectby:    { message: 'change effect by %1',            inputOrder: ['VALUE'] },
  data_setvariableto:      { message: 'set variable to %1',             inputOrder: ['VALUE'] },
  data_changevariableby:   { message: 'change variable by %1',          inputOrder: ['VALUE'] },
}

function numberShadow(value) {
  return { type: 'math_number', field: 'NUM', value }
}

function textShadow(value) {
  return { type: 'text', field: 'TEXT', value }
}

export function buildAlwaysOpenToolbox(toolbox, options = {}) {
  if (!toolbox) return flattenJsonToolbox(DEFAULT_TOOLBOX, options)
  if (typeof toolbox === 'string') return flattenXmlToolbox(toolbox, options)
  if (toolbox.kind === 'categoryToolbox') return flattenJsonToolbox(toolbox, options)
  return toolbox
}

function flattenJsonToolbox(toolbox, options = {}) {
  const contents = []
  for (const item of toolbox.contents ?? []) {
    if (item.kind === 'category') {
      contents.push({ kind: 'label', text: item.name, 'web-class': 'scratch-toolbox-label' })
      contents.push(...(item.contents ?? []).map(item => withJsonInputDefaults(item, options)))
      contents.push({ kind: 'sep', gap: '16' })
    } else {
      contents.push(withJsonInputDefaults(item, options))
    }
  }
  return { kind: 'flyoutToolbox', contents }
}

function withJsonInputDefaults(item, options = {}) {
  if (item?.kind !== 'block' || !VALUE_INPUT_DEFAULTS[item.type]) return item
  const inputs = {}
  for (const [name, shadow] of Object.entries(inputDefaultsForBlock(item.type, options))) {
    inputs[name] = {
      shadow: {
        type: shadow.type,
        fields: { [shadow.field]: String(shadow.value) },
      },
    }
  }
  // item.inputs wins over defaults so predefined blocks keep their custom values
  return { ...item, inputs: { ...inputs, ...(item.inputs ?? {}) } }
}

export function createScratchBlockStack(type, inputValues = {}) {
  const inputs = {}
  const shadowDefaults = VALUE_INPUT_DEFAULTS[type] ?? {}
  for (const [name, val] of Object.entries(inputValues ?? {})) {
    const shadow = shadowDefaults[name] ?? (typeof val === 'number'
      ? { type: 'math_number', field: 'NUM' }
      : { type: 'text', field: 'TEXT' })
    inputs[name] = { shadow: { type: shadow.type, fields: { [shadow.field]: String(val) } } }
  }
  return Object.keys(inputs).length ? { type, inputs } : { type }
}

export function predefinedBlockToStack(pb) {
  if (!pb?.type) return null
  return {
    id: pb.id,
    label: pb.label,
    stack: createScratchBlockStack(pb.type, pb.inputs),
  }
}

function cloneBlockForToolbox(block) {
  if (!block?.type) return null
  const clone = JSON.parse(JSON.stringify(block))
  stripBlockRuntimeFields(clone)
  return clone
}

function stripBlockRuntimeFields(block) {
  if (!block || typeof block !== 'object') return
  delete block.id
  delete block.x
  delete block.y
  delete block.deletable
  delete block.movable
  delete block.editable
  for (const input of Object.values(block.inputs ?? {})) {
    if (input.block) stripBlockRuntimeFields(input.block)
    if (input.shadow) stripBlockRuntimeFields(input.shadow)
  }
  if (block.next?.block) stripBlockRuntimeFields(block.next.block)
}

function normalizePrebuiltStacks(prebuiltStacks = [], predefinedBlocks = []) {
  const legacyStacks = (predefinedBlocks ?? []).map(predefinedBlockToStack).filter(Boolean)
  return [...legacyStacks, ...(prebuiltStacks ?? [])]
    .map(entry => cloneBlockForToolbox(entry?.stack))
    .filter(Boolean)
}

function xmlBlockFromSerialized(doc, block, tagName = 'block') {
  const el = doc.createElement(tagName)
  el.setAttribute('type', block.type)

  for (const [name, value] of Object.entries(block.fields ?? {})) {
    const fieldEl = doc.createElement('field')
    fieldEl.setAttribute('name', name)
    fieldEl.textContent = typeof value === 'object' ? String(value.name ?? value.id ?? '') : String(value)
    el.appendChild(fieldEl)
  }

  for (const [name, input] of Object.entries(block.inputs ?? {})) {
    const inputEl = doc.createElement(name.startsWith('SUBSTACK') ? 'statement' : 'value')
    inputEl.setAttribute('name', name)
    if (input.shadow) inputEl.appendChild(xmlBlockFromSerialized(doc, input.shadow, 'shadow'))
    if (input.block) inputEl.appendChild(xmlBlockFromSerialized(doc, input.block, 'block'))
    el.appendChild(inputEl)
  }

  if (block.next?.block) {
    const nextEl = doc.createElement('next')
    nextEl.appendChild(xmlBlockFromSerialized(doc, block.next.block, 'block'))
    el.appendChild(nextEl)
  }

  return el
}

function appendStacksToXmlToolbox(toolbox, stacks) {
  if (typeof DOMParser === 'undefined') return toolbox
  const doc = new DOMParser().parseFromString(toolbox, 'text/xml')
  if (doc.querySelector('parsererror')) return toolbox

  for (const stack of stacks) {
    const category = Array.from(doc.querySelectorAll('category')).find(cat =>
      Array.from(cat.querySelectorAll('block')).some(b => b.getAttribute('type') === stack.type)
    )
    if (!category) continue
    category.appendChild(xmlBlockFromSerialized(doc, stack))
  }

  return new XMLSerializer().serializeToString(doc)
}

function appendStacksToJsonToolbox(toolbox, stacks) {
  if (toolbox?.kind !== 'categoryToolbox') return toolbox

  const typeToCategory = {}
  for (const [ci, cat] of (toolbox.contents ?? []).entries()) {
    if (cat.kind !== 'category') continue
    for (const item of cat.contents ?? []) {
      if (item.kind === 'block') typeToCategory[item.type] = ci
    }
  }

  const newContents = toolbox.contents.map(cat => ({ ...cat, contents: cat.contents ? [...cat.contents] : [] }))
  for (const stack of stacks) {
    const ci = typeToCategory[stack.type]
    if (ci == null) continue
    newContents[ci].contents.push({ kind: 'block', ...stack })
  }

  return { ...toolbox, contents: newContents }
}

// Takes a JSON or XML toolbox and visual prebuilt stack entries.
// Legacy predefinedBlocks are accepted and converted to one-block stacks.
export function addPrebuiltStacksToToolbox(toolbox, prebuiltStacks = [], predefinedBlocks = []) {
  const stacks = normalizePrebuiltStacks(prebuiltStacks, predefinedBlocks)
  if (!stacks.length) return toolbox
  const base = toolbox || DEFAULT_TOOLBOX

  // Handle XML string toolboxes (produced by the toolbox picker)
  if (typeof base === 'string') {
    return appendStacksToXmlToolbox(base, stacks)
  }

  return appendStacksToJsonToolbox(base, stacks)
}

// Legacy wrapper kept for existing lessons/tests.
export function addPredefinedBlocksToToolbox(toolbox, predefinedBlocks) {
  return addPrebuiltStacksToToolbox(toolbox, [], predefinedBlocks)
}

function flattenXmlToolbox(toolbox, options = {}) {
  if (typeof DOMParser === 'undefined') return toolbox
  const source = new DOMParser().parseFromString(toolbox, 'text/xml')
  if (source.querySelector('parsererror')) return toolbox
  const doc = document.implementation.createDocument('', '', null)
  const root = doc.createElement('xml')
  doc.appendChild(root)
  const categories = Array.from(source.documentElement?.children ?? []).filter(el => el.tagName.toLowerCase() === 'category')
  if (!categories.length) return toolbox
  for (const category of categories) {
    const label = doc.createElement('label')
    label.setAttribute('text', category.getAttribute('name') ?? '')
    label.setAttribute('web-class', 'scratch-toolbox-label')
    root.appendChild(label)
    for (const child of Array.from(category.children)) {
      const imported = doc.importNode(child, true)
      if (imported.tagName?.toLowerCase() === 'block') addXmlInputDefaults(doc, imported, options)
      root.appendChild(imported)
    }
    const sep = doc.createElement('sep')
    sep.setAttribute('gap', '16')
    root.appendChild(sep)
  }
  return new XMLSerializer().serializeToString(root)
}

function addXmlInputDefaults(doc, blockEl, options = {}) {
  const type = blockEl.getAttribute('type')
  const defaults = inputDefaultsForBlock(type, options)
  if (!defaults) return

  for (const [name, shadow] of Object.entries(defaults)) {
    const existing = Array.from(blockEl.children).find(child =>
      child.tagName?.toLowerCase() === 'value' && child.getAttribute('name') === name
    )
    if (existing) continue

    const value = doc.createElement('value')
    value.setAttribute('name', name)
    const shadowEl = doc.createElement('shadow')
    shadowEl.setAttribute('type', shadow.type)
    const field = doc.createElement('field')
    field.setAttribute('name', shadow.field)
    field.textContent = String(shadow.value)
    shadowEl.appendChild(field)
    value.appendChild(shadowEl)
    blockEl.appendChild(value)
  }
}

function inputDefaultsForBlock(type, options = {}) {
  const defaults = VALUE_INPUT_DEFAULTS[type]
  const position = options.position
  if (!defaults || !position) return defaults

  const x = Math.round(Number(position.x ?? 0))
  const y = Math.round(Number(position.y ?? 0))
  if (type === 'motion_gotoxy') return { X: numberShadow(x), Y: numberShadow(y) }
  if (type === 'motion_glidesecstoxy') return { ...defaults, X: numberShadow(x), Y: numberShadow(y) }
  if (type === 'motion_setx') return { X: numberShadow(x) }
  if (type === 'motion_sety') return { Y: numberShadow(y) }
  return defaults
}

export function createRunSignal() {
  return {
    stopped: false, keysPressed: new Set(), mouseDown: false, mouseX: 0, mouseY: 0, answer: '', ask: null,
    backdrop: null, backdrops: [], onBackdropChange: null, executedBlocks: new Set(), timerStart: Date.now(),
    onCloneCreated: null, onCloneUpdated: null, onCloneDeleted: null, deletedClones: new Set(), cloneCount: 0, cloneSeq: 0,
    clones: new Map(),
  }
}

export async function runWorkspace(workspace, spriteState, onUpdate, signal) {
  const context = createRunContext(workspace, spriteState, onUpdate, signal, null, [], 'sprite')
  const hats = workspace.getBlocksByType('event_whenflagclicked', false)
  await Promise.all(hats.map(hat => runChain(hat.getNextBlock(), context)))
}

export async function runSingleBlock(block, spriteState, onUpdate, signal) {
  const context = createRunContext(block?.workspace, spriteState, onUpdate, signal, null, [], 'sprite')
  await runChain(block, context)
}

export async function runEvent(workspace, eventType, spriteState, onUpdate, signal, option = null) {
  const context = createRunContext(workspace, spriteState, onUpdate, signal, null, [], 'sprite')
  let hats = workspace.getBlocksByType(eventType, false)
  if (eventType === 'event_whenkeypressed') {
    hats = hats.filter(hat => keyMatches(hat.getFieldValue('KEY_OPTION'), option))
  } else if (eventType === 'event_whenbroadcastreceived') {
    hats = hats.filter(hat => String(hat.getFieldValue('BROADCAST_OPTION') ?? '') === String(option ?? ''))
  }
  await Promise.all(hats.map(hat => runChain(hat.getNextBlock(), context)))
}

// Multi-sprite: run all green-flag hats across every sprite concurrently.
// spriteWorkspaces: Array of { id, workspace, state, costumes, onUpdate }
export async function runAllSprites(spriteWorkspaces, signal) {
  signal.variables ??= {}
  await Promise.all(spriteWorkspaces.map(sp => {
    const context = createRunContext(sp.workspace, sp.state, sp.onUpdate, signal, spriteWorkspaces, sp.costumes ?? [], sp.id)
    const hats = sp.workspace.getBlocksByType('event_whenflagclicked', false)
    return Promise.all(hats.map(hat => runChain(hat.getNextBlock(), context)))
  }))
}

export async function runAllSpritesEvent(spriteWorkspaces, eventType, signal, option = null, allSpritesContext = null) {
  const broadcastSprites = allSpritesContext ?? spriteWorkspaces
  signal.variables ??= {}
  await Promise.all(spriteWorkspaces.map(sp => {
    const context = createRunContext(sp.workspace, sp.state, sp.onUpdate, signal, broadcastSprites, sp.costumes ?? [], sp.id)
    let hats = sp.workspace.getBlocksByType(eventType, false)
    if (eventType === 'event_whenkeypressed') {
      hats = hats.filter(hat => keyMatches(hat.getFieldValue('KEY_OPTION'), option))
    } else if (eventType === 'event_whenbroadcastreceived') {
      hats = hats.filter(hat => String(hat.getFieldValue('BROADCAST_OPTION') ?? '') === String(option ?? ''))
    }
    return Promise.all(hats.map(hat => runChain(hat.getNextBlock(), context)))
  }))
}

// Run a single clicked block within the full multi-sprite context so broadcasts propagate.
export async function runBlockInContext(block, spriteWorkspaces, targetSpriteId, signal) {
  if (!block) return
  const sp = spriteWorkspaces.find(s => s.id === targetSpriteId)
  if (!sp) return
  signal.variables ??= {}
  const context = createRunContext(sp.workspace, sp.state, sp.onUpdate, signal, spriteWorkspaces, sp.costumes ?? [], sp.id)
  await runChain(block, context)
}

function createRunContext(workspace, state, onUpdate, signal, allSprites = null, costumes = [], spriteId = null) {
  signal.variables ??= {}
  return { workspace, state, onUpdate, signal, allSprites, costumes, spriteId }
}

// A chain is active while the run hasn't been globally stopped, and — if it belongs to a
// clone — while that specific clone hasn't deleted itself (delete this clone must not halt
// other sprites'/clones' scripts, so it can't use the shared signal.stopped flag).
function isActive(context) {
  return !context.signal.stopped && !(context.spriteId && context.signal.deletedClones?.has(context.spriteId))
}

async function runChain(block, context) {
  while (block && isActive(context)) {
    await runBlock(block, context)
    block = block.getNextBlock()
  }
}

async function runBlock(block, context) {
  const { state, onUpdate, signal, workspace } = context
  if (!isActive(context)) return
  signal.executedBlocks ??= new Set()
  signal.executedBlocks.add(block.type)

  switch (block.type) {
    case 'motion_movesteps': {
      const steps = numberValue(block, 'STEPS', context, 10)
      const rad = (state.direction - 90) * (Math.PI / 180)
      state.x += Math.cos(rad) * steps
      state.y -= Math.sin(rad) * steps
      clampSprite(state)
      onUpdate({ ...state })
      await tick()
      break
    }
    case 'motion_turnright':
      state.direction = (state.direction + numberValue(block, 'DEGREES', context, 15)) % 360
      onUpdate({ ...state }); await tick(); break
    case 'motion_turnleft':
      state.direction = (state.direction - numberValue(block, 'DEGREES', context, 15) + 360) % 360
      onUpdate({ ...state }); await tick(); break
    case 'motion_gotoxy':
      state.x = numberValue(block, 'X', context, 0)
      state.y = numberValue(block, 'Y', context, 0)
      onUpdate({ ...state }); await tick(); break
    case 'motion_setx':
      state.x = numberValue(block, 'X', context, 0)
      onUpdate({ ...state }); await tick(); break
    case 'motion_sety':
      state.y = numberValue(block, 'Y', context, 0)
      onUpdate({ ...state }); await tick(); break
    case 'motion_changexby':
      state.x += numberValue(block, 'DX', context, 10)
      clampSprite(state); onUpdate({ ...state }); await tick(); break
    case 'motion_changeyby':
      state.y += numberValue(block, 'DY', context, 10)
      clampSprite(state); onUpdate({ ...state }); await tick(); break
    case 'motion_setrotationstyle':
      state.rotationStyle = block.getFieldValue('STYLE') ?? 'all around'
      onUpdate({ ...state }); await tick(); break
    case 'motion_ifonedge_bounce':
      bounceIfNeeded(state)
      onUpdate({ ...state }); await tick(); break
    case 'motion_goto': {
      const to = block.getFieldValue('TO')
      if (to === '_random_') {
        state.x = Math.round(Math.random() * 480 - 240)
        state.y = Math.round(Math.random() * 360 - 180)
      } else if (to === '_mouse_') {
        state.x = signal.mouseX ?? 0
        state.y = signal.mouseY ?? 0
      } else {
        const target = context.allSprites?.find(sp => sp.id === to)
        if (target) { state.x = target.state.x; state.y = target.state.y }
      }
      clampSprite(state)
      onUpdate({ ...state }); await tick(); break
    }
    case 'motion_glidesecstoxy': {
      const secs = numberValue(block, 'SECS', context, 1)
      const targetX = numberValue(block, 'X', context, 0)
      const targetY = numberValue(block, 'Y', context, 0)
      await glide(state, targetX, targetY, secs, onUpdate, signal)
      break
    }
    case 'motion_glideto': {
      const secs = numberValue(block, 'SECS', context, 1)
      const to = block.getFieldValue('TO')
      let targetX, targetY
      if (to === '_random_') {
        targetX = Math.round(Math.random() * 480 - 240)
        targetY = Math.round(Math.random() * 360 - 180)
      } else if (to === '_mouse_') {
        targetX = signal.mouseX ?? 0
        targetY = signal.mouseY ?? 0
      } else {
        const target = context.allSprites?.find(sp => sp.id === to)
        targetX = target ? target.state.x : state.x
        targetY = target ? target.state.y : state.y
      }
      await glide(state, targetX, targetY, secs, onUpdate, signal)
      break
    }
    case 'motion_pointindirection':
      state.direction = numberValue(block, 'DIRECTION', context, 90)
      onUpdate({ ...state }); await tick(); break

    case 'looks_sayforsecs':
      state.bubble = stringValue(block, 'MESSAGE', context)
      state.bubbleType = 'say'
      onUpdate({ ...state })
      await sleep(numberValue(block, 'SECS', context, 2) * 1000, signal)
      state.bubble = ''
      onUpdate({ ...state })
      break
    case 'looks_say':
      state.bubble = stringValue(block, 'MESSAGE', context)
      state.bubbleType = 'say'
      onUpdate({ ...state }); await tick(); break
    case 'looks_think':
      state.bubble = stringValue(block, 'MESSAGE', context)
      state.bubbleType = 'think'
      onUpdate({ ...state }); await tick(); break
    case 'looks_thinkforsecs':
      state.bubble = stringValue(block, 'MESSAGE', context)
      state.bubbleType = 'think'
      onUpdate({ ...state })
      await sleep(numberValue(block, 'SECS', context, 2) * 1000, signal)
      state.bubble = ''
      onUpdate({ ...state })
      break
    case 'looks_show':
      state.visible = true; onUpdate({ ...state }); await tick(); break
    case 'looks_hide':
      state.visible = false; onUpdate({ ...state }); await tick(); break
    case 'looks_setsizeto':
      state.size = Math.max(0, numberValue(block, 'SIZE', context, 100))
      onUpdate({ ...state }); await tick(); break
    case 'looks_changesizeby':
      state.size = Math.max(0, state.size + numberValue(block, 'CHANGE', context, 10))
      onUpdate({ ...state }); await tick(); break
    case 'looks_switchcostumeto': {
      const name = block.getFieldValue('COSTUME')
      if (name) state.costume = name
      onUpdate({ ...state })
      await tick()
      break
    }
    case 'looks_nextcostume': {
      const costumes = context.costumes ?? []
      if (costumes.length > 0) {
        const idx = costumes.findIndex(c => c.name === state.costume)
        const next = costumes[(idx + 1) % costumes.length]
        if (next) state.costume = next.name
      }
      onUpdate({ ...state })
      await tick()
      break
    }
    case 'looks_switchbackdropto': {
      const name = block.getFieldValue('BACKDROP')
      switchBackdrop(name, context)
      await tick()
      break
    }
    case 'looks_nextbackdrop': {
      const bds = context.signal.backdrops ?? []
      if (bds.length) {
        const idx = bds.findIndex(b => b.name === context.signal.backdrop)
        const next = bds[(idx + 1) % bds.length]
        if (next) switchBackdrop(next.name, context)
      }
      await tick()
      break
    }
    case 'looks_seteffectto': {
      const effect = block.getFieldValue('EFFECT') ?? 'color'
      state[`effect_${effect}`] = numberValue(block, 'VALUE', context, 0)
      onUpdate({ ...state }); await tick(); break
    }
    case 'looks_changeeffectby': {
      const effect = block.getFieldValue('EFFECT') ?? 'color'
      state[`effect_${effect}`] = (state[`effect_${effect}`] ?? 0) + numberValue(block, 'VALUE', context, 0)
      onUpdate({ ...state }); await tick(); break
    }
    case 'looks_cleargraphiceffects': {
      for (const e of ['color', 'fisheye', 'whirl', 'pixelate', 'mosaic', 'brightness', 'ghost']) state[`effect_${e}`] = 0
      onUpdate({ ...state }); await tick(); break
    }

    case 'sound_play':
      playSound(block.getFieldValue('SOUND_MENU') ?? 'pop')
      await tick()
      break
    case 'sound_playuntildone':
      await playSound(block.getFieldValue('SOUND_MENU') ?? 'pop')
      break
    case 'sound_stopallsounds':
      stopAllSounds()
      await tick()
      break

    case 'control_wait':
      await sleep(numberValue(block, 'DURATION', context, 1) * 1000, signal)
      break
    case 'control_wait_until':
      while (!booleanValue(block, 'CONDITION', context) && isActive(context)) await tick()
      break
    case 'control_repeat_until': {
      const inner = block.getInputTargetBlock('SUBSTACK')
      while (!booleanValue(block, 'CONDITION', context) && isActive(context)) {
        await runChain(inner, context)
        await tick()
      }
      break
    }
    case 'control_repeat': {
      const times = Math.max(0, Math.floor(numberValue(block, 'TIMES', context, 10)))
      const inner = block.getInputTargetBlock('SUBSTACK')
      for (let i = 0; i < times && isActive(context); i++) await runChain(inner, context)
      break
    }
    case 'control_forever': {
      const inner = block.getInputTargetBlock('SUBSTACK')
      while (isActive(context)) {
        await runChain(inner, context)
        await tick()
      }
      break
    }
    case 'control_if':
      if (booleanValue(block, 'CONDITION', context)) await runChain(block.getInputTargetBlock('SUBSTACK'), context)
      break
    case 'control_if_else':
      await runChain(block.getInputTargetBlock(booleanValue(block, 'CONDITION', context) ? 'SUBSTACK' : 'SUBSTACK2'), context)
      break
    case 'control_stop':
      signal.stopped = true
      stopAllSounds()
      break

    case 'control_create_clone_of': {
      const option = block.getFieldValue('CLONE_OPTION') ?? '_myself_'
      let source
      if (option === '_myself_') {
        source = { id: context.spriteId, workspace, state, costumes: context.costumes }
      } else {
        source = context.allSprites?.find(sp => sp.id === option)
      }
      if (source && source.workspace) {
        signal.cloneCount = signal.cloneCount ?? 0
        if (signal.cloneCount < 300) {
          signal.cloneCount++
          signal.cloneSeq = (signal.cloneSeq ?? 0) + 1
          const cloneId = `${source.id}__clone${signal.cloneSeq}`
          const rootBaseId = source.id.includes('__clone') ? source.id.split('__clone')[0] : source.id
          const cloneState = { ...source.state }
          signal.onCloneCreated?.({ id: cloneId, baseId: source.id, state: { ...cloneState }, costumes: source.costumes ?? [] })
          signal.clones ??= new Map()
          signal.clones.set(cloneId, { id: cloneId, baseId: rootBaseId, workspace: source.workspace, state: cloneState, costumes: source.costumes ?? [] })
          const cloneContext = createRunContext(
            source.workspace, cloneState, s => signal.onCloneUpdated?.(cloneId, s),
            signal, context.allSprites, source.costumes ?? [], cloneId,
          )
          const hats = source.workspace.getBlocksByType('control_start_as_clone', false)
          // fire-and-forget: the clone's scripts run concurrently, the creator continues immediately
          Promise.all(hats.map(hat => runChain(hat.getNextBlock(), cloneContext))).catch(() => {})
        }
      }
      break
    }
    case 'control_delete_this_clone': {
      if (context.spriteId && context.spriteId.includes('__clone')) {
        signal.deletedClones ??= new Set()
        signal.deletedClones.add(context.spriteId)
        signal.clones?.delete(context.spriteId)
        signal.onCloneDeleted?.(context.spriteId)
      }
      break
    }

    case 'event_broadcast': {
      const msg = stringValue(block, 'BROADCAST_INPUT', context)
      context.signal.onBroadcast?.(msg)
      const targets = context.allSprites ?? [{ workspace: context.workspace, state: context.state, onUpdate: context.onUpdate }]
      // fire-and-forget: receivers run concurrently, sender continues immediately
      Promise.all(targets.map(sp => {
        const ctx = createRunContext(sp.workspace, sp.state, sp.onUpdate, context.signal, context.allSprites, sp.costumes ?? [])
        const hats = sp.workspace.getBlocksByType('event_whenbroadcastreceived', false)
          .filter(hat => String(hat.getFieldValue('BROADCAST_OPTION') ?? '') === String(msg ?? ''))
        return Promise.all(hats.map(hat => runChain(hat.getNextBlock(), ctx)))
      })).catch(() => {})
      break
    }
    case 'event_broadcastandwait': {
      const msg = stringValue(block, 'BROADCAST_INPUT', context)
      context.signal.onBroadcast?.(msg)
      const targets = context.allSprites ?? [{ workspace: context.workspace, state: context.state, onUpdate: context.onUpdate }]
      await Promise.all(targets.map(sp => {
        const ctx = createRunContext(sp.workspace, sp.state, sp.onUpdate, context.signal, context.allSprites, sp.costumes ?? [])
        const hats = sp.workspace.getBlocksByType('event_whenbroadcastreceived', false)
          .filter(hat => String(hat.getFieldValue('BROADCAST_OPTION') ?? '') === String(msg ?? ''))
        return Promise.all(hats.map(hat => runChain(hat.getNextBlock(), ctx)))
      }))
      break
    }

    case 'sensing_askandwait':
      state.bubble = stringValue(block, 'QUESTION', context)
      onUpdate({ ...state })
      signal.answer = await askQuestion(state.bubble, signal)
      state.bubble = ''
      onUpdate({ ...state })
      break

    case 'data_setvariableto':
      setVariable(block, evaluateInput(block, 'VALUE', context), signal)
      signal.onVariablesChange?.({ ...signal.variables })
      await tick()
      break
    case 'data_changevariableby': {
      const name = variableName(block)
      const current = Number(signal.variables[name] ?? 0)
      signal.variables[name] = current + numberValue(block, 'VALUE', context, 1)
      signal.onVariablesChange?.({ ...signal.variables })
      await tick()
      break
    }
    case 'data_showvariable': {
      const name = variableName(block)
      signal.variableVisibility ??= {}
      signal.variableVisibility[name] = true
      signal.onVariablesChange?.({ ...signal.variables })
      await tick()
      break
    }
    case 'data_hidevariable': {
      const name = variableName(block)
      signal.variableVisibility ??= {}
      signal.variableVisibility[name] = false
      signal.onVariablesChange?.({ ...signal.variables })
      await tick()
      break
    }
    case 'sensing_resettimer':
      signal.timerStart = Date.now()
      await tick()
      break
    default:
      break
  }
}

function evaluateInput(block, inputName, context) {
  const child = block.getInputTargetBlock(inputName)
  if (!child) return block.getFieldValue(inputName) ?? ''
  return evaluateReporter(child, context)
}

function evaluateReporter(block, context) {
  const { state, signal, allSprites } = context
  switch (block.type) {
    case 'math_number':
      return Number(block.getFieldValue('NUM') ?? 0)
    case 'text':
      return block.getFieldValue('TEXT') ?? ''
    case 'data_variable':
      return signal.variables[variableName(block)] ?? 0
    case 'motion_xposition':
      return state.x
    case 'motion_yposition':
      return state.y
    case 'motion_direction':
      return state.direction
    case 'looks_costumenumber': {
      const costumes = context.costumes ?? []
      const idx = costumes.findIndex(c => c.name === state.costume)
      return idx >= 0 ? idx + 1 : 1
    }
    case 'sensing_answer':
      return signal.answer ?? ''
    case 'sensing_keypressed':
      return keyMatches(block.getFieldValue('KEY_OPTION'), null, signal.keysPressed)
    case 'sensing_mousedown':
      return !!signal.mouseDown
    case 'sensing_touchingedge':
      return isTouchingEdge(state)
    case 'sensing_touchingobject': {
      const target = block.getFieldValue('TOUCHINGOBJECTMENU')
      if (target === '_mouse_') return isTouchingMouse(state, signal.mouseX ?? 0, signal.mouseY ?? 0)
      if (target === '_edge_') return isTouchingEdge(state)
      const targetSprite = allSprites?.find(sp => sp.id === target)
      if (targetSprite && isTouchingSprite(state, targetSprite.state)) return true
      if (signal.clones) {
        for (const clone of signal.clones.values()) {
          if (clone.baseId === target && clone.id !== context.spriteId && isTouchingSprite(state, clone.state)) return true
        }
      }
      return false
    }
    case 'operator_equals':
      return String(evaluateInput(block, 'OPERAND1', context)) === String(evaluateInput(block, 'OPERAND2', context))
    case 'operator_gt':
      return Number(evaluateInput(block, 'OPERAND1', context)) > Number(evaluateInput(block, 'OPERAND2', context))
    case 'operator_lt':
      return Number(evaluateInput(block, 'OPERAND1', context)) < Number(evaluateInput(block, 'OPERAND2', context))
    case 'operator_and':
      return Boolean(evaluateInput(block, 'OPERAND1', context)) && Boolean(evaluateInput(block, 'OPERAND2', context))
    case 'operator_or':
      return Boolean(evaluateInput(block, 'OPERAND1', context)) || Boolean(evaluateInput(block, 'OPERAND2', context))
    case 'operator_not':
      return !Boolean(evaluateInput(block, 'OPERAND', context))
    case 'operator_add':
      return Number(evaluateInput(block, 'NUM1', context)) + Number(evaluateInput(block, 'NUM2', context))
    case 'operator_subtract':
      return Number(evaluateInput(block, 'NUM1', context)) - Number(evaluateInput(block, 'NUM2', context))
    case 'operator_join':
      return `${evaluateInput(block, 'STRING1', context)}${evaluateInput(block, 'STRING2', context)}`
    case 'operator_multiply':
      return Number(evaluateInput(block, 'NUM1', context)) * Number(evaluateInput(block, 'NUM2', context))
    case 'operator_divide': {
      const divisor = Number(evaluateInput(block, 'NUM2', context))
      return divisor === 0 ? Infinity : Number(evaluateInput(block, 'NUM1', context)) / divisor
    }
    case 'operator_mod':
      return Number(evaluateInput(block, 'NUM1', context)) % Number(evaluateInput(block, 'NUM2', context))
    case 'operator_round':
      return Math.round(Number(evaluateInput(block, 'NUM', context)))
    case 'operator_random': {
      const from = Number(evaluateInput(block, 'FROM', context))
      const to = Number(evaluateInput(block, 'TO', context))
      const lo = Math.min(from, to)
      const hi = Math.max(from, to)
      if (Number.isInteger(from) && Number.isInteger(to)) {
        return Math.floor(Math.random() * (hi - lo + 1)) + lo
      }
      return Math.random() * (hi - lo) + lo
    }
    case 'operator_mathop': {
      const op = block.getFieldValue('OPERATOR') ?? 'abs'
      const n = Number(evaluateInput(block, 'NUM', context))
      const ops = {
        abs: Math.abs,
        floor: Math.floor,
        ceiling: Math.ceil,
        sqrt: Math.sqrt,
        sin: x => Math.sin(x * Math.PI / 180),
        cos: x => Math.cos(x * Math.PI / 180),
        tan: x => Math.tan(x * Math.PI / 180),
        asin: x => Math.asin(x) * 180 / Math.PI,
        acos: x => Math.acos(x) * 180 / Math.PI,
        atan: x => Math.atan(x) * 180 / Math.PI,
        ln: Math.log,
        log: x => Math.log10(x),
        'e ^': x => Math.exp(x),
        '10 ^': x => Math.pow(10, x),
      }
      return ops[op]?.(n) ?? 0
    }
    case 'operator_letter_of': {
      const s = String(evaluateInput(block, 'STRING', context))
      const idx = Number(evaluateInput(block, 'LETTER', context)) - 1
      return s[idx] ?? ''
    }
    case 'operator_length':
      return String(evaluateInput(block, 'STRING', context)).length
    case 'operator_contains':
      return String(evaluateInput(block, 'STRING1', context)).toLowerCase()
        .includes(String(evaluateInput(block, 'STRING2', context)).toLowerCase())
    case 'looks_costumenumbername': {
      const costumes = context.costumes ?? []
      const which = block.getFieldValue('WHICH') ?? 'number'
      if (which === 'name') return state.costume ?? ''
      const idx = costumes.findIndex(c => c.name === state.costume)
      return idx >= 0 ? idx + 1 : 1
    }
    case 'looks_backdropnumbername': {
      const bds = context.signal.backdrops ?? []
      const which = block.getFieldValue('WHICH') ?? 'number'
      if (which === 'name') return context.signal.backdrop ?? ''
      const idx = bds.findIndex(b => b.name === context.signal.backdrop)
      return idx >= 0 ? idx + 1 : 1
    }
    case 'sensing_timer':
      return (Date.now() - (context.signal.timerStart ?? Date.now())) / 1000
    case 'sensing_distanceto': {
      const target = block.getFieldValue('DISTANCETOMENU')
      if (target === '_mouse_') return Math.hypot(state.x - (signal.mouseX ?? 0), state.y - (signal.mouseY ?? 0))
      const sp = allSprites?.find(s => s.id === target)
      return sp ? Math.hypot(state.x - sp.state.x, state.y - sp.state.y) : 0
    }
    default:
      return ''
  }
}

function numberValue(block, inputName, context, fallback = 0) {
  const value = Number(evaluateInput(block, inputName, context))
  return Number.isFinite(value) ? value : fallback
}

function stringValue(block, inputName, context) {
  return String(evaluateInput(block, inputName, context) ?? '')
}

function booleanValue(block, inputName, context) {
  return Boolean(evaluateInput(block, inputName, context))
}

function variableName(block) {
  return block.getFieldValue('VARIABLE') ?? 'score'
}

function setVariable(block, value, signal) {
  signal.variables[variableName(block)] = value
}

function keyMatches(expected, pressedKey, keysPressed = null) {
  if (expected === 'any') return keysPressed ? keysPressed.size > 0 : !!pressedKey
  const normalized = normalizeKey(pressedKey)
  if (keysPressed) return keysPressed.has(expected)
  return normalized === expected
}

export function normalizeKey(key) {
  if (!key) return ''
  if (key === ' ') return 'space'
  if (key === 'ArrowUp') return 'up arrow'
  if (key === 'ArrowDown') return 'down arrow'
  if (key === 'ArrowLeft') return 'left arrow'
  if (key === 'ArrowRight') return 'right arrow'
  return String(key).toLowerCase()
}

function askQuestion(question, signal) {
  if (signal.ask) return signal.ask(question)
  return Promise.resolve(window.prompt(question, '') ?? '')
}

function playSound(name) {
  if (typeof window === 'undefined') return Promise.resolve()
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)()
  const ctx = audioContext
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const sound = {
    pop: { frequency: 660, duration: 0.18, type: 'sine' },
    meow: { frequency: 440, duration: 0.42, type: 'sawtooth' },
    click: { frequency: 880, duration: 0.08, type: 'square' },
    chime: { frequency: 1046, duration: 0.35, type: 'triangle' },
  }[name] ?? { frequency: 660, duration: 0.18, type: 'sine' }

  osc.type = sound.type
  osc.frequency.setValueAtTime(sound.frequency, ctx.currentTime)
  if (name === 'meow') osc.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + sound.duration)
  gain.gain.setValueAtTime(0.001, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + sound.duration)
  osc.connect(gain).connect(ctx.destination)
  activeOscillators.push(osc)
  osc.start()
  osc.stop(ctx.currentTime + sound.duration + 0.03)
  return new Promise(resolve => {
    osc.onended = () => {
      activeOscillators = activeOscillators.filter(item => item !== osc)
      resolve()
    }
  })
}

function stopAllSounds() {
  for (const osc of activeOscillators) {
    try { osc.stop() } catch {}
  }
  activeOscillators = []
}

function switchBackdrop(name, context) {
  context.signal.backdrop = name
  context.signal.onBackdropChange?.(name)
  const targets = context.allSprites ?? [{ workspace: context.workspace, state: context.state, onUpdate: context.onUpdate }]
  for (const sp of targets) {
    const ctx = createRunContext(sp.workspace, sp.state, sp.onUpdate, context.signal, context.allSprites, sp.costumes ?? [])
    const hats = sp.workspace.getBlocksByType('event_whenbackdropswitchesto', false)
      .filter(hat => hat.getFieldValue('BACKDROP') === name)
    for (const hat of hats) {
      runChain(hat.getNextBlock(), ctx).catch(() => {})
    }
  }
}

function tick() {
  return new Promise(r => requestAnimationFrame(r))
}

function sleep(ms, signal) {
  return new Promise(r => {
    const start = Date.now()
    function check() {
      if (signal?.stopped || Date.now() - start >= ms) return r()
      requestAnimationFrame(check)
    }
    check()
  })
}

async function glide(state, targetX, targetY, secs, onUpdate, signal) {
  const startX = state.x
  const startY = state.y
  const duration = Math.max(0, secs) * 1000
  if (duration === 0) {
    state.x = targetX
    state.y = targetY
    clampSprite(state)
    onUpdate({ ...state })
    await tick()
    return
  }
  const start = Date.now()
  while (!signal.stopped) {
    const elapsed = Date.now() - start
    if (elapsed >= duration) break
    const t = elapsed / duration
    state.x = startX + (targetX - startX) * t
    state.y = startY + (targetY - startY) * t
    onUpdate({ ...state })
    await tick()
  }
  if (!signal.stopped) {
    state.x = targetX
    state.y = targetY
    clampSprite(state)
    onUpdate({ ...state })
    await tick()
  }
}

function clampSprite(state) {
  state.x = Math.max(-240, Math.min(240, state.x))
  state.y = Math.max(-180, Math.min(180, state.y))
}

function isTouchingEdge(state) {
  const half = (state.size / 100) * 24
  return state.x + half >= 240 || state.x - half <= -240 || state.y + half >= 180 || state.y - half <= -180
}

function isTouchingMouse(state, mouseX, mouseY) {
  const r = (state.size / 100) * 24
  return Math.hypot(state.x - mouseX, state.y - mouseY) <= r
}

function isTouchingSprite(stateA, stateB) {
  if (!stateB?.visible) return false
  const rA = (stateA.size / 100) * 24
  const rB = (stateB.size / 100) * 24
  return Math.hypot(stateA.x - stateB.x, stateA.y - stateB.y) < rA + rB
}

function bounceIfNeeded(state) {
  const half = (state.size / 100) * 24
  if (state.x + half > 240 || state.x - half < -240) {
    state.direction = (360 - state.direction) % 360
    state.x = Math.max(-240 + half, Math.min(240 - half, state.x))
  }
  if (state.y + half > 180 || state.y - half < -180) {
    state.direction = (180 - state.direction + 360) % 360
    state.y = Math.max(-180 + half, Math.min(180 - half, state.y))
  }
}

