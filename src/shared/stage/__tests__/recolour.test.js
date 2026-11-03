// @vitest-environment node
// Image Lab's recolour(picture, old, new) (authoring request 2026-11-03, Python L1 L9 Secret spy
// photo): the stage module's own Python, run in a real Python with a stand-in for the worker.
// The stand-in answers colour names with the real bridge's answers (stagePictureBridge.colour),
// worked out here in JS first, so name ↔ hex matching and the plain-words messages are the app's.
//
// Needs a local `python3`/`python` (CI's ubuntu runners have one); skipped where there is none.
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { createStagePictureBridge } from '../../../modules/python/stagePictureBridge.js'
import { STAGE_MODULE_PY } from '../stagePy.js'

function findPython() {
  const names = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python']
  for (const name of names) {
    const probe = spawnSync(name, ['-c', 'import sys; print(sys.version_info >= (3, 8))'], {
      encoding: 'utf8',
      timeout: 15000,
    })
    if (probe.status === 0 && probe.stdout.trim() === 'True') return name
  }
  return null
}

const PYTHON = findPython()

// Every string the scripts below give recolour() as a colour, answered as the worker would.
const COLOUR_WORDS = [
  'orange',
  'royalblue',
  'blue',
  'white',
  'black',
  'Orange',
  '#FFA500',
  'blu',
  'transparent',
  'spy',
]

function workerAnswers() {
  const bridge = createStagePictureBridge()
  const answers = {}
  for (const word of COLOUR_WORDS) {
    answers[word] = bridge.colour('recolour', JSON.stringify({ args: [word], kwargs: {} }))
  }
  return answers
}

// Runs `script` after `from stage import *`; returns its printed lines (or the error line).
function runPython(script) {
  const harness = `
import json, sys, types
_answers = json.loads(sys.stdin.readline())
_fake = types.ModuleType('js')
def _colour(fn, payload):
    value = json.loads(payload)['args'][0]
    return _answers.get(value, 'ValueError|not in the test stand-in: ' + str(value))
_fake.__hsStageColour = _colour
_fake.__hsStageCall = lambda name, payload: ''
sys.modules['js'] = _fake
stage = types.ModuleType('stage')
exec(compile(json.loads(sys.stdin.readline()), '<stage>', 'exec'), stage.__dict__)
sys.modules['stage'] = stage
from stage import *
try:
    exec(compile(json.loads(sys.stdin.readline()), '<student>', 'exec'))
except Exception as error:
    print(type(error).__name__ + ': ' + str(error))
`
  const input =
    [JSON.stringify(workerAnswers()), JSON.stringify(STAGE_MODULE_PY), JSON.stringify(script)].join(
      '\n'
    ) + '\n'
  const result = spawnSync(PYTHON, ['-I', '-c', harness], {
    input,
    encoding: 'utf8',
    timeout: 30000,
  })
  if (result.status !== 0) throw new Error(result.stderr || 'python failed')
  return result.stdout.replace(/\r/g, '').trimEnd().split('\n')
}

// A small pixel_fox as load_image() hands it over: pixel-art colours as names, others as hex.
const FOX = `spy = ['orange', 'white', 'orange', '#123456', 'black', 'orange', 'white', 'orange']
original = list(spy)
`

describe.skipIf(!PYTHON)('recolour(picture, old, new) — the Secret spy photo', () => {
  it('disguises the real colour, then puts it back on the right password (the Fun moment)', () => {
    const out = runPython(`${FOX}
same_list = spy
recolour(spy, 'orange', 'royalblue')
print(spy.count('orange'), spy.count('royalblue'))
unlocked = True
if unlocked:
    recolour(spy, 'royalblue', 'orange')
print(spy == original, spy is same_list)
`)
    expect(out).toEqual(['0 4', 'True True'])
  })

  it('changes the picture in place, so a following grid() draws the new colours', () => {
    const out = runPython(`${FOX}
recolour(spy, 'orange', 'royalblue')
grid(spy, width=4)
import stage
print(stage._hs_drawn[-1][0] is spy, stage._hs_drawn[-1][0][0])
`)
    expect(out).toEqual(['True royalblue'])
  })

  it('matches the same colour however it is written (name, hex, any case, rgb tuple)', () => {
    const out = runPython(`${FOX}
recolour(spy, '#FFA500', 'blue')
print(spy.count('blue'))
recolour(spy, (0, 0, 255), 'Orange')
print(spy.count('Orange'))
recolour(spy, 'orange', (0, 0, 255))
print(spy.count('#0000ff'))
recolour(spy, rgb(18, 52, 86), 'white')
print(spy.count('#123456'), spy.count('white'))
`)
    expect(out).toEqual(['4', '4', '4', '0 3'])
  })

  it('leaves the picture unchanged when nothing is that colour', () => {
    const out = runPython(`${FOX}
recolour(spy, 'blue', 'white')
print(spy == original)
`)
    expect(out).toEqual(['True'])
  })

  it('works on a picture made of rows (a 2D list) too', () => {
    const out = runPython(`rows = [['orange', 'white'], ['white', 'orange']]
recolour(rows, 'orange', 'black')
print(rows)
`)
    expect(out).toEqual(["[['black', 'white'], ['white', 'black']]"])
  })

  it('takes palette numbers the way grid() does: whole numbers from 0, never mixed with colours', () => {
    const tries = [
      'recolour(rows, 1, 2)',
      'recolour(rows, 7.5, 2)',
      'recolour(rows, 1, -3)',
      "recolour(rows, 1, 'blue')",
      'recolour(spy, 3, 4)',
      "recolour(rows, 'orange', 'blue')",
    ]
    const out = runPython(
      `rows = [[0, 1, 1], [1, 0, 0]]
${FOX}
` +
        tries
          .map(
            (line) =>
              `try:
    ${line}
except Exception as e:
    print(type(e).__name__ + ': ' + str(e))
`
          )
          .join('') +
        'print(rows, spy == original)\n'
    )
    expect(out).toEqual([
      'TypeError: recolour(): old should be a colour, or a whole number from 0 for a palette, like recolour(rows, 1, 2), not 7.5',
      'ValueError: recolour(): new is -3, but palette numbers start at 0, like recolour(rows, 1, 2)',
      "TypeError: recolour(): old is a palette number but new is a colour. Use two colours, like recolour(spy, 'orange', 'blue'), or two numbers, like recolour(rows, 1, 2)",
      "TypeError: recolour(): spy is made of colours, not palette numbers, so old should be a colour, like recolour(spy, 'orange', 'blue')",
      'TypeError: recolour(): rows is made of palette numbers, not colours, so old should be a number, like recolour(rows, 1, 2)',
      '[[0, 2, 2], [2, 0, 0]] True',
    ])
  })

  it('recolours rows that are tuples too, as grid() draws them (rebuilt in the picture)', () => {
    const out = runPython(`rows = [('orange', 'white'), ['white', 'orange'], ('white', 'white')]
row0 = rows[0]
recolour(rows, 'orange', 'black')
print(rows)
print(row0, rows[2] is not None)
pixels = [(255, 165, 0), (1, 2, 3)]
recolour(pixels, 'orange', 'white')
print(pixels)
`)
    expect(out).toEqual([
      "[('black', 'white'), ['white', 'black'], ('white', 'white')]",
      "('orange', 'white') True",
      "['white', (1, 2, 3)]",
    ])
  })

  it('explains a value given twice in plain words', () => {
    const out = runPython(`${FOX}
try:
    recolour(spy, 'orange', old='blue')
except Exception as e:
    print(type(e).__name__ + ': ' + str(e))
`)
    expect(out).toEqual([
      "TypeError: recolour(): old is given twice, once in its place and once as old=. Give it once, like recolour(spy, 'orange', 'blue')",
    ])
  })

  it('explains wrong values in plain words, naming recolour()', () => {
    const tries = [
      "recolour(spy, 'blu', 'white')",
      "recolour(spy, 'orange', 7.5j)",
      "recolour('spy', 'orange', 'blue')",
      "recolour(tuple(spy), 'orange', 'blue')",
      "recolour(spy, 'orange')",
      "recolour(spy, 'orange', 'blue', colour='red')",
      "recolour(spy, None, 'blue')",
    ]
    const out = runPython(
      `${FOX}\n` +
        tries
          .map(
            (line) =>
              `try:\n    ${line}\nexcept Exception as e:\n    print(type(e).__name__ + ': ' + str(e))\n`
          )
          .join('') +
        'print(spy == original)\n'
    )
    expect(out).toEqual([
      "ValueError: recolour(): 'blu' isn't a colour I know. Try '#ff8800', 'orange' or rgb(255, 136, 0)",
      "TypeError: recolour(): new should be a colour, like 'orange', '#ff8800' or rgb(255, 136, 0), not a complex",
      "TypeError: recolour(): picture should be a list of colours, like spy = load_image(\"pixel_fox\", size=16), not the text 'spy'. Use the picture's name without quotes, like recolour(spy, ...)",
      "TypeError: recolour(): picture is a tuple, which can't be changed. Make it a list first, like spy = list(spy)",
      "TypeError: recolour() needs three things: the picture, the colour to find and the colour to put instead, like recolour(spy, 'orange', 'blue')",
      "TypeError: recolour() has no colour= — it takes picture, old and new, like recolour(spy, 'orange', 'blue')",
      "TypeError: recolour(): old should be a colour, like 'orange', '#ff8800' or rgb(255, 136, 0), not None",
      'True',
    ])
  })
})
