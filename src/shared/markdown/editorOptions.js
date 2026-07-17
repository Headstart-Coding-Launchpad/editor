export const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'])

export const SCRATCH_BLOCK_CATEGORIES = [
  {
    label: 'Events',
    color: '#d97706',
    blocks: [
      'when green flag clicked',
      'when [space] key pressed',
      'when this sprite clicked',
      'when backdrop switches to [backdrop1]',
      'when I receive [message1]',
      'broadcast [message1]',
      'broadcast [message1] and wait',
    ],
  },
  {
    label: 'Motion',
    color: '#2563eb',
    blocks: [
      'move (10) steps',
      'turn right (15) degrees',
      'turn left (15) degrees',
      'go to x: (0) y: (0)',
      'go to [random position]',
      'glide (1) secs to x: (0) y: (0)',
      'glide (1) secs to [random position]',
      'point in direction (90)',
      'set x to (0)',
      'set y to (0)',
      'change x by (10)',
      'change y by (10)',
      'if on edge, bounce',
      'set rotation style [left-right]',
      'x position',
      'y position',
      'direction',
    ],
  },
  {
    label: 'Looks',
    color: '#7c3aed',
    blocks: [
      'say [Hello!] for (2) seconds',
      'say [Hello!]',
      'think [Hmm...] for (2) seconds',
      'think [Hmm...]',
      'switch costume to [costume1]',
      'next costume',
      'switch backdrop to [backdrop1]',
      'next backdrop',
      'set size to (100) %',
      'change size by (10)',
      'set [color] effect to (0)',
      'change [color] effect by (25)',
      'clear graphic effects',
      'show',
      'hide',
      'costume [number]',
      'backdrop [name]',
    ],
  },
  {
    label: 'Sound',
    color: '#9333ea',
    blocks: [
      'play sound [meow] until done',
      'start sound [meow]',
      'stop all sounds',
    ],
  },
  {
    label: 'Control',
    color: '#b45309',
    blocks: [
      'wait (1) seconds',
      'wait until <>',
      'repeat (10)',
      'forever',
      'if <> then',
      'else',
      'repeat until <>',
      'stop all',
    ],
  },
  {
    label: 'Sensing',
    color: '#0284c7',
    blocks: [
      "ask [What's your name?] and wait",
      'answer',
      'touching [mouse-pointer]?',
      'touching edge?',
      'mouse down?',
      'key [space] pressed?',
      'distance to [mouse-pointer]',
      'timer',
      'reset timer',
    ],
  },
  {
    label: 'Operators',
    color: '#16a34a',
    blocks: [
      '(1) + (2)',
      '(1) - (2)',
      '(1) * (2)',
      '(1) / (2)',
      '(1) mod (2)',
      '(1) < (2)',
      '(1) > (2)',
      '(1) = (2)',
      'join [hello] [world]',
      'letter (1) of [hello]',
      'length of [hello]',
      '[apple] contains [a]?',
      'round (3.14)',
      'abs of (10)',
      '<> and <>',
      '<> or <>',
      'not <>',
    ],
  },
  {
    label: 'Variables',
    color: '#ea580c',
    blocks: [
      'set [score] to (0)',
      'change [score] by (1)',
      'show variable [score]',
      'hide variable [score]',
    ],
  },
]

export function isInsideScratchCodeBlock(text) {
  let inScratch = false
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!inScratch && t === '```scratch') inScratch = true
    else if (inScratch && t === '```') inScratch = false
  }
  return inScratch
}

export function getCodeBlockOptions(lessonType) {
  if (lessonType === 'python') return [{ label: 'Python', action: 'code-block:python' }]
  if (lessonType === 'html') {
    return [
      { label: 'HTML', action: 'code-block:html' },
      { label: 'CSS', action: 'code-block:css' },
      { label: 'JavaScript', action: 'code-block:javascript' },
    ]
  }
  if (lessonType === 'scratch') {
    return [
      { label: 'Scratch', action: 'code-block:scratch' },
      { label: 'HTML', action: 'code-block:html' },
      { label: 'CSS', action: 'code-block:css' },
      { label: 'JavaScript', action: 'code-block:javascript' },
    ]
  }
  return [{ label: 'Code block', action: 'code-block:' }]
}

export function getInlineCodeOptions(lessonType, inlineCodeLanguages) {
  const labels = {
    python: 'Python',
    html: 'HTML',
    css: 'CSS',
    javascript: 'JS',
    scratch: 'Scratch',
  }
  const fallback =
    lessonType === 'python'
      ? ['python']
      : lessonType === 'html'
      ? ['html', 'javascript', 'css']
      : lessonType === 'scratch'
      ? ['scratch']
      : []

  const languages = Array.isArray(inlineCodeLanguages) && inlineCodeLanguages.length
    ? inlineCodeLanguages
    : fallback

  const seen = new Set()
  return languages
    .map(lang => lang === 'js' ? 'javascript' : lang)
    .filter(lang => {
      if (!labels[lang] || seen.has(lang)) return false
      seen.add(lang)
      return true
    })
    .map(lang => ({ label: labels[lang], action: `inline-code:${lang}` }))
}
