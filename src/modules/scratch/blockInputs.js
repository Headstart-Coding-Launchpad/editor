// Node-safe Scratch block input metadata: each block with value inputs and the shadow block
// (number/text) that fills each input by default. Kept free of Blockly so the lesson
// validator (moduleTaskValidation.js, also run by the CLI) can read the input names.
// Re-exported from scratch.js.

export function numberShadow(value) {
  return { type: 'math_number', field: 'NUM', value }
}

export function textShadow(value) {
  return { type: 'text', field: 'TEXT', value }
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
