// Shared fixtures for the Phase 0 characterisation tests that pin how quiz
// tasks (every quizType) and code_arrange tasks behave today, before they move
// onto the Activity plugin contract (docs/architecture/modular-activities-plan.md,
// step 0.3). Test-only: never imported by app code.
//
// Exports are shared plain objects, so tests must clone before mutating (use
// `structuredClone`). Task ids are stable and unique across the whole set so
// the tasks can be combined into one lesson (see legacyActivityLesson).

export const MULTIPLE_CHOICE_TASK = {
  id: 1,
  title: 'Pick the output function',
  taskType: 'quiz',
  quizType: 'multiple_choice',
  explainer: 'Which function shows text on the screen?',
  options: [
    { id: 'a', text: 'print()', feedback: 'Yes - print shows text.' },
    { id: 'b', text: 'input()', feedback: 'input() asks the user a question.' },
    { id: 'c', text: 'len()' },
  ],
  check: { type: 'answer_equals', value: 'a', hint: 'Think about showing text.' },
}

export const MATCH_TASK = {
  id: 2,
  title: 'Match each function',
  taskType: 'quiz',
  quizType: 'match',
  explainer: 'Match each function to what it does.',
  feedback: 'Check each pair again.',
  pairs: [
    { id: 'p1', prompt: 'print()', answer: 'Shows text' },
    { id: 'p2', prompt: 'input()', answer: 'Asks a question' },
    { id: 'p3', prompt: 'len()', answer: 'Counts items' },
  ],
}

export const FILL_BLANK_DRAG_TASK = {
  id: 3,
  title: 'Fill the gaps (drag)',
  taskType: 'quiz',
  quizType: 'fill_blank',
  mode: 'drag',
  text: 'Use ___ to show text and ___ to ask a question.',
  blanks: [
    { id: 'b1', answer: 'print' },
    { id: 'b2', answer: 'input' },
  ],
  distractors: [{ id: 'd1', text: 'len' }],
}

export const FILL_BLANK_TYPE_TASK = {
  id: 4,
  title: 'Fill the gap (typed)',
  taskType: 'quiz',
  quizType: 'fill_blank',
  mode: 'type',
  text: 'A ___ repeats code.',
  blanks: [{ id: 't1', answer: 'Loop' }],
}

export const SHORT_ANSWER_TASK = {
  id: 5,
  title: 'Explain print',
  taskType: 'quiz',
  quizType: 'short_answer',
  explainer: 'What does print() do?',
  check: { type: 'answer_contains', value: 'text', hint: 'Mention what print shows.' },
}

export const OPEN_SHORT_ANSWER_TASK = {
  id: 6,
  title: 'Reflect',
  taskType: 'quiz',
  quizType: 'short_answer',
  explainer: 'What did you learn today?',
}

export const CONFIDENCE_TASK = {
  id: 7,
  title: 'How confident are you?',
  taskType: 'quiz',
  quizType: 'confidence',
  explainer: 'Rate how confident you feel about print().',
}

export const PYTHON_CODE_ARRANGE_TASK = {
  id: 8,
  title: 'Print the first five even numbers',
  taskType: 'code_arrange',
  moduleType: 'python',
  explainer: 'Arrange the lines to print 0 2 4 6 8.',
  lines: [
    {
      id: 'L1',
      parts: [
        { type: 'text', text: 'for i in range(' },
        { type: 'slot', id: 'S1', code: '5' },
        { type: 'text', text: '):' },
      ],
    },
    { id: 'L2', parts: [{ type: 'slot', id: 'L2', code: '    print(i * 2)' }] },
  ],
  distractors: [
    { id: 'S1d1', code: '10' },
    { id: 'D1', code: '    print(i + 2)' },
  ],
  check: { type: 'output', operator: 'equals', value: '0\n2\n4\n6\n8' },
}

export const HTML_CODE_ARRANGE_TASK = {
  id: 9,
  title: 'Arrange a heading and paragraph',
  taskType: 'code_arrange',
  moduleType: 'html',
  explainer: 'Build the page by arranging the lines.',
  entryFile: 'index.html',
  starterFiles: [
    { name: 'index.html', type: 'html', content: '' },
    { name: 'style.css', type: 'css', content: 'h1 { color: navy; }' },
  ],
  lines: [
    { id: 'L1', parts: [{ type: 'slot', id: 'L1', code: '<h1>Hello</h1>' }] },
    { id: 'L2', parts: [{ type: 'slot', id: 'L2', code: '<p>Welcome to my page.</p>' }] },
  ],
  distractors: [{ id: 'D1', code: '<h2>Hello</h2>' }],
  check: { type: 'html_element', operator: 'exists', selector: 'h1' },
}

export const LEGACY_QUIZ_TASKS = {
  multiple_choice: MULTIPLE_CHOICE_TASK,
  match: MATCH_TASK,
  fill_blank_drag: FILL_BLANK_DRAG_TASK,
  fill_blank_type: FILL_BLANK_TYPE_TASK,
  short_answer: SHORT_ANSWER_TASK,
  short_answer_open: OPEN_SHORT_ANSWER_TASK,
  confidence: CONFIDENCE_TASK,
}

export const LEGACY_CODE_ARRANGE_TASKS = {
  python: PYTHON_CODE_ARRANGE_TASK,
  html: HTML_CODE_ARRANGE_TASK,
}

export const ALL_LEGACY_ACTIVITY_TASKS = {
  ...LEGACY_QUIZ_TASKS,
  code_arrange_python: PYTHON_CODE_ARRANGE_TASK,
  code_arrange_html: HTML_CODE_ARRANGE_TASK,
}

// A lesson envelope accepted by both validators (the CLI also needs a
// description). Composed, so python and html code_arrange tasks can share it.
export function legacyActivityLesson(tasks, overrides = {}) {
  return {
    id: 'legacy-activities',
    title: 'Legacy activities',
    description: 'Characterisation fixture lesson',
    type: 'composed',
    tasks: structuredClone(tasks),
    ...overrides,
  }
}

function withoutKeys(task, keys) {
  const next = structuredClone(task)
  for (const key of keys) delete next[key]
  return next
}

// Invalid variants, each meant to be validated alone as Task 1 of
// legacyActivityLesson([task]).
export const INVALID_LEGACY_ACTIVITY_TASKS = {
  mc_one_option_no_answer: {
    ...withoutKeys(MULTIPLE_CHOICE_TASK, ['check']),
    options: [{ id: 'a', text: 'print()' }],
  },
  mc_empty_option_text: {
    ...structuredClone(MULTIPLE_CHOICE_TASK),
    options: [
      { id: 'a', text: 'print()' },
      { id: 'b', text: '   ' },
    ],
  },
  mc_wrong_check_type: {
    ...structuredClone(MULTIPLE_CHOICE_TASK),
    check: { type: 'answer_contains', value: 'a' },
  },
  mc_default_quiz_type_no_options: withoutKeys(MULTIPLE_CHOICE_TASK, [
    'quizType',
    'options',
    'check',
  ]),
  match_one_pair: {
    ...structuredClone(MATCH_TASK),
    pairs: [{ id: 'p1', prompt: 'print()', answer: 'Shows text' }],
  },
  match_empty_answer: {
    ...structuredClone(MATCH_TASK),
    pairs: [
      { id: 'p1', prompt: 'print()', answer: '' },
      { id: 'p2', prompt: '  ', answer: 'Asks a question' },
    ],
  },
  fill_blank_no_marker: { ...structuredClone(FILL_BLANK_DRAG_TASK), text: 'No gaps here.' },
  fill_blank_no_blanks: { ...structuredClone(FILL_BLANK_DRAG_TASK), blanks: [] },
  fill_blank_empty_answer: {
    ...structuredClone(FILL_BLANK_TYPE_TASK),
    blanks: [{ id: 't1', answer: ' ' }],
  },
  short_answer_empty_check_value: {
    ...structuredClone(SHORT_ANSWER_TASK),
    check: { type: 'answer_contains', value: '  ' },
  },
  short_answer_non_answer_check: {
    ...structuredClone(SHORT_ANSWER_TASK),
    check: { type: 'output_contains', value: 'text' },
  },
  quiz_missing_title: withoutKeys(CONFIDENCE_TASK, ['title']),
  code_arrange_wrong_module: {
    ...withoutKeys(PYTHON_CODE_ARRANGE_TASK, ['check']),
    moduleType: 'scratch',
    lines: [],
  },
  code_arrange_bad_parts: {
    ...structuredClone(PYTHON_CODE_ARRANGE_TASK),
    lines: [
      {
        parts: [
          { type: 'slot', code: '' },
          { type: 'bogus', text: 'x' },
        ],
      },
      { id: 'L2', parts: [] },
    ],
    distractors: [],
  },
  code_arrange_no_blanks: {
    ...structuredClone(PYTHON_CODE_ARRANGE_TASK),
    lines: [{ id: 'L1', parts: [{ type: 'text', text: 'x = 1' }] }],
  },
  code_arrange_duplicate_ids: {
    ...structuredClone(PYTHON_CODE_ARRANGE_TASK),
    lines: [
      { id: 'L1', parts: [{ type: 'slot', id: 'S1', code: 'print(1)' }] },
      { id: 'L1', parts: [{ type: 'slot', id: 'S2', code: 'print(2)' }] },
    ],
    distractors: [{ id: 'S1', code: 'print(3)' }],
  },
  code_arrange_bad_distractors: {
    ...structuredClone(PYTHON_CODE_ARRANGE_TASK),
    distractors: [{ code: 'print(3)' }, { id: 'D2', code: '  ' }],
  },
  code_arrange_html_no_files: withoutKeys(HTML_CODE_ARRANGE_TASK, ['starterFiles', 'entryFile']),
  code_arrange_html_no_entry: {
    ...structuredClone(HTML_CODE_ARRANGE_TASK),
    starterFiles: [
      { name: 'style.css', type: 'css', content: '' },
      { name: 'style.css', type: 'css', content: '' },
    ],
  },
}

// code_arrange indent mode (arrangeMode: indent), the authoring request's example: two locked set-up lines, then a nested if the student lines up.
export const INDENT_CODE_ARRANGE_TASK = {
  id: 1,
  title: 'Line Up the Warmer Check',
  taskType: 'code_arrange',
  moduleType: 'python',
  arrangeMode: 'indent',
  explainer: 'Slide each line so "Heating up!" only prints when the mode is warmer.',
  lines: [
    { id: 'L1', code: 'guess = 15', depth: 0, locked: true },
    { id: 'L2', code: 'mode = "warmer"', depth: 0, locked: true },
    { id: 'L3', code: 'if guess < 20:', depth: 0 },
    { id: 'L4', code: 'print("Too low")', depth: 1 },
    { id: 'L5', code: 'if mode == "warmer":', depth: 1 },
    { id: 'L6', code: 'print("Heating up!")', depth: 2 },
    { id: 'L7', code: 'print("Round over")', depth: 0 },
  ],
  check: { type: 'output', operator: 'equals', value: 'Too low\nHeating up!\nRound over' },
}
