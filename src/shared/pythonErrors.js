// Python errors in plain words, with a hint ladder (Hub #225, Ryan 25 Oct; research note
// "How children learn from errors"): what happened and where first, then rungs a child opens
// one at a time: a nudge (where to look), the idea, a worked example with comments, and the
// exact fix last. The raw Python message stays in the output above, so nothing is hidden.
//
// Input is the error line the Python worker prints ("Line 3: NameError: name 'x' is not
// defined", see formatPythonError) or a bare "NameError: …". The student's code is optional and
// only sharpens a few fixes (a missing ':' or brackets after range). Unknown errors return null:
// the raw message is better than a wrong guess.
//
// Pure and Node-safe.

const ERROR_RE =
  /^(?:Line (\d+):\s*)?([A-Z][A-Za-z]*(?:Error|Exception)|KeyboardInterrupt|StopIteration)\b:?\s*(.*)$/

// The last error line in some output, or null.
export function findPythonError(output) {
  const lines = String(output ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(ERROR_RE)
    if (m) {
      return { line: m[1] ? Number(m[1]) : null, type: m[2], message: m[3] ?? '', text: lines[i] }
    }
  }
  return null
}

const codeLine = (code, line) =>
  line && typeof code === 'string' ? (code.split('\n')[line - 1] ?? '') : ''

// "line 3", or a phrase that still reads well when the error has no line.
const onLine = (err) => (err.line ? `line ${err.line}` : 'the line with the error')

const quoteName = (message) => message.match(/'([^']+)'/)?.[1] ?? null

const BLOCK_START = /^\s*(for|while|if|elif|else|def|class|try|except|finally|with)\b/

// Each entry: (error, code) => explanation or null. First match wins.
const EXPLAINERS = [
  // `for i in range 4:` — range needs brackets.
  (err, code) => {
    if (err.type !== 'SyntaxError') return null
    const src = codeLine(code, err.line)
    const m = src.match(/\brange\s+(\d+|[A-Za-z_]\w*)/)
    if (!m) return null
    return {
      title: 'range needs brackets around its number',
      rungs: [
        `Look at range on ${onLine(err)}. What comes straight after the word range?`,
        'range is a function, and functions take their values inside round brackets: range(4), never range 4.',
        '```python\n# count 0, 1, 2, 3\nfor i in range(4):   # brackets around the 4\n    print(i)\n```',
        `Change range ${m[1]} to range(${m[1]}) on ${onLine(err)}.`,
      ],
    }
  },
  // A block line (for, if, def...) without its colon.
  (err, code) => {
    if (err.type !== 'SyntaxError') return null
    const src = codeLine(code, err.line)
    const missing =
      /expected ':'/.test(err.message) || (BLOCK_START.test(src) && !/:\s*(#.*)?$/.test(src))
    if (!missing) return null
    const word = src.match(BLOCK_START)?.[1]
    return {
      title: 'A colon : is missing',
      rungs: [
        `Look at the end of ${onLine(err)}.`,
        'Lines that start a block (for, while, if, else, def) end with a colon. The colon says "the indented lines below belong to me".',
        '```python\nif score > 10:      # the colon starts the block\n    print("Well done")\n```',
        word
          ? `Add a : at the end of ${onLine(err)}, after the ${word} line.`
          : `Add a : at the end of ${onLine(err)}.`,
      ],
    }
  },
  (err) => {
    if (err.type !== 'SyntaxError') return null
    const open = err.message.match(/'([([{])' was never closed/)
    if (!open && !/unexpected EOF|unmatched/.test(err.message)) return null
    const unmatched = err.message.match(/unmatched '([)\]}])'/)
    return {
      title: unmatched
        ? `There is an extra ${unmatched[1]}`
        : 'A bracket was opened but never closed',
      rungs: [
        `Count the brackets on ${onLine(err)}. Every ( needs a ).`,
        'Brackets come in pairs. Python reads to the end of your code looking for the partner and gives up.',
        '```python\nprint("Hi")          # ( and ) are a pair\nprint(len("Hi"))     # two (, two )\n```',
        unmatched
          ? `Remove the extra ${unmatched[1]} on ${onLine(err)}, or add its partner before it.`
          : `Add the missing ${open ? { '(': ')', '[': ']', '{': '}' }[open[1]] : 'closing bracket'} on ${onLine(err)}.`,
      ],
    }
  },
  (err) => {
    if (
      err.type !== 'SyntaxError' ||
      !/unterminated (triple-quoted )?string|EOL while scanning/.test(err.message)
    )
      return null
    return {
      title: 'Some writing is missing its closing quote',
      rungs: [
        `Look for the quote marks on ${onLine(err)}.`,
        'Writing (a string) starts and ends with the same quote mark: "like this" or \'like this\'.',
        '```python\nprint("Hello")       # opens with " and closes with "\n```',
        `Add the closing quote on ${onLine(err)}, using the same kind as the opening one.`,
      ],
    }
  },
  (err) => {
    if (err.type !== 'IndentationError' && err.type !== 'TabError') return null
    const after = err.message.match(
      /expected an indented block after '?(\w+)'? statement on line (\d+)/
    )
    if (after || /expected an indented block/.test(err.message)) {
      return {
        title: 'The lines inside a block need to move in',
        rungs: [
          `Look at the line after ${after ? `the ${after[1]} on line ${after[2]}` : 'the line ending in :'}.`,
          'After a line that ends in a colon, the lines that belong to it are indented: pushed in with the Tab key.',
          '```python\nfor i in range(3):\n    print(i)         # pushed in: inside the loop\nprint("done")        # not pushed in: after the loop\n```',
          `Press Tab at the start of ${onLine(err)} to push it in.`,
        ],
      }
    }
    if (/unexpected indent/.test(err.message)) {
      return {
        title: 'This line is pushed in when it should not be',
        rungs: [
          `Look at the start of ${onLine(err)}.`,
          'Only the lines inside a block (after a line ending in :) are pushed in. Other lines start at the edge.',
          '```python\nname = "Ava"\nprint(name)          # both start at the edge\n```',
          `Press Shift+Tab on ${onLine(err)} to move it back to the edge.`,
        ],
      }
    }
    return {
      title: 'The lines in this block are not lined up',
      rungs: [
        `Look at how far ${onLine(err)} is pushed in, compared with the lines around it.`,
        'Lines in the same block must start at exactly the same place.',
        '```python\nif ready:\n    print("Go")      # same distance in\n    print("Now")     # as this one\n```',
        `Line up ${onLine(err)} with the lines in its block (Tab or Shift+Tab).`,
      ],
    }
  },
  (err) => {
    if (err.type !== 'SyntaxError') return null
    return {
      title: "Python can't read this line",
      rungs: [
        `Look closely at ${onLine(err)}, and the end of the line before it.`,
        'Python reads your code before it runs any of it. One mistyped symbol stops the whole program.',
        'Check for: a missing colon after for/if, a missing bracket or quote, or = where you meant ==.',
        err.message
          ? `Python says: ${err.message}.`
          : 'Compare the line with an example that works.',
      ],
    }
  },
  (err) => {
    if (err.type !== 'NameError') return null
    const name = quoteName(err.message)
    const suggest = err.message.match(/Did you mean: '([^']+)'/)?.[1]
    return {
      title: name ? `Python doesn't know the name ${name}` : "Python doesn't know a name",
      rungs: [
        `Check the spelling of ${name ?? 'each name'} on ${onLine(err)}.`,
        'Python only knows names you have made (with =) or that come with Python. If you meant some writing, it needs quotes.',
        '```python\nanimal = "cat"       # makes the name animal\nprint(animal)        # uses it\nprint("animal")      # quotes: prints the word\n```',
        suggest
          ? `Did you mean ${suggest}? Change ${name} to ${suggest}.`
          : name
            ? `Make ${name} first with ${name} = ..., or put quotes around it if it is writing.`
            : 'Make the name first, or put quotes around it if it is writing.',
      ],
    }
  },
  (err) => {
    if (err.type !== 'TypeError') return null
    if (
      /can only concatenate str|unsupported operand type\(s\) for \+: '(int|float)' and 'str'|'str' and '(int|float)'/.test(
        err.message
      )
    ) {
      return {
        title: "Writing and numbers can't be joined with +",
        rungs: [
          `Look at the + on ${onLine(err)}. Is one side a number?`,
          'Writing (a string) and a number are different kinds of thing. Turn the number into writing with str() first, or use a comma in print.',
          '```python\nscore = 5\nprint("Score: " + str(score))   # str() turns 5 into "5"\nprint("Score:", score)          # or use a comma\n```',
          `Wrap the number on ${onLine(err)} in str( ).`,
        ],
      }
    }
    if (/object is not callable/.test(err.message)) {
      return {
        title: 'Something that is not a function was used like one',
        rungs: [
          `Look for round brackets ( ) after a name on ${onLine(err)}.`,
          'Brackets after a name mean "run this function". A number or some writing can\'t be run.',
          '```python\ntotal = 5\nprint(total)         # fine\n# total(2) would fail: total is a number\n```',
          'Remove the brackets, or check you have not used a function name (like print) as a variable.',
        ],
      }
    }
    if (
      /takes \d+ positional argument|missing \d+ required|got an unexpected keyword/.test(
        err.message
      )
    ) {
      return {
        title: 'The function got the wrong number of values',
        rungs: [
          `Count the values in the brackets on ${onLine(err)}.`,
          'A function expects a set number of values. Too many or too few and it stops.',
          '```python\ndef greet(name):     # expects one value\n    print("Hi", name)\ngreet("Ava")         # gives one\n```',
          `Python says: ${err.message}. Give it exactly what it asks for.`,
        ],
      }
    }
    return null
  },
  (err) => {
    if (err.type !== 'ValueError' || !/invalid literal for int\(\)/.test(err.message)) return null
    return {
      title: "That writing can't become a whole number",
      rungs: [
        `Look at int( ) on ${onLine(err)}, and what was typed in.`,
        'int() turns writing like "12" into the number 12. Words, spaces or decimals like "3.5" can\'t become a whole number.',
        '```python\nage = int(input("Age? "))   # type 12, not twelve\n```',
        'Run it again and type a whole number, like 12.',
      ],
    }
  },
  (err) => {
    if (err.type !== 'ZeroDivisionError') return null
    return {
      title: "You can't divide by zero",
      rungs: [
        `Look at the / on ${onLine(err)}. What is the number after it?`,
        'Nothing can be split into zero groups, so Python stops.',
        '```python\nif count != 0:       # check first\n    print(total / count)\n```',
        `Make sure the number after / on ${onLine(err)} is not 0.`,
      ],
    }
  },
  (err) => {
    if (err.type !== 'IndexError') return null
    return {
      title: 'That position is past the end of the list',
      rungs: [
        `Look at the [ ] on ${onLine(err)}. How long is the list?`,
        'Positions start at 0, so a list of 3 things has positions 0, 1 and 2. Position 3 does not exist.',
        '```python\npets = ["cat", "dog", "fish"]\nprint(pets[0])       # cat (the first)\nprint(pets[2])       # fish (the last)\n```',
        'Use a smaller position, or len(list) - 1 for the last one.',
      ],
    }
  },
  (err) => {
    if (err.type !== 'KeyError') return null
    const key = quoteName(err.message) ?? err.message
    return {
      title: `The dictionary has no ${key}`,
      rungs: [
        `Check the spelling of ${key} on ${onLine(err)}, capital letters too.`,
        'A dictionary only has the keys you put in. Asking for any other key stops the program.',
        '```python\nages = {"Ava": 9}\nprint(ages["Ava"])   # fine\nprint(ages.get("Ben", 0))  # 0 if Ben is missing\n```',
        `Add ${key} to the dictionary first, or fix the spelling.`,
      ],
    }
  },
  (err) => {
    if (err.type !== 'AttributeError') return null
    const [kind, attr] = [...err.message.matchAll(/'([^']+)'/g)].map((m) => m[1])
    return {
      title: attr ? `${kind ?? 'This'} has no ${attr}` : 'That name after the dot does not exist',
      rungs: [
        `Check the word after the dot on ${onLine(err)}, spelling and capitals.`,
        'After a dot, you can only use what that kind of thing has. Writing has .upper(), lists have .append(), and so on.',
        '```python\nname = "ava"\nprint(name.upper())  # AVA\n```',
        attr
          ? `Check that ${attr} is spelled right and belongs to ${kind}.`
          : 'Check the spelling.',
      ],
    }
  },
  (err) => {
    if (err.type !== 'ModuleNotFoundError' && err.type !== 'ImportError') return null
    const mod = quoteName(err.message)
    return {
      title: mod ? `There is no module called ${mod} here` : "That module isn't available here",
      rungs: [
        `Check the spelling on the import line (${onLine(err)}).`,
        "LaunchPad has Python's own modules (like random and time) plus a few of ours (stage, beats). Others can't be installed.",
        '```python\nimport random\nprint(random.randint(1, 6))\n```',
        mod
          ? `Check ${mod} is spelled right, or ask your tutor which module to use.`
          : 'Ask your tutor which module to use.',
      ],
    }
  },
  (err) => {
    if (err.type !== 'RecursionError') return null
    return {
      title: 'A function kept calling itself and never stopped',
      rungs: [
        `Look at the function around ${onLine(err)}. Does it call itself?`,
        'A function that calls itself needs a stopping point, or it goes on until Python gives up.',
        '```python\ndef count(n):\n    if n == 0:       # the stopping point\n        return\n    count(n - 1)\n```',
        'Add a check that stops the calls.',
      ],
    }
  },
]

// The plain-words help for an error, or null when we have none.
// Returns { type, line, title, rungs: [nudge, concept, example, fix] }.
export function explainPythonError(errorOrOutput, { code } = {}) {
  const err =
    typeof errorOrOutput === 'object' && errorOrOutput?.type
      ? errorOrOutput
      : findPythonError(errorOrOutput)
  if (!err) return null
  for (const explain of EXPLAINERS) {
    const found = explain(err, code)
    if (found) return { type: err.type, line: err.line, ...found }
  }
  return null
}

export const ERROR_RUNG_LABELS = Object.freeze([
  'Where to look',
  'The idea',
  'An example',
  'The fix',
])
