// A deliberately simple, local word filter for peer-help notes (no dependency, no server).
//
// It is NOT the safeguard: every note is still reviewed by the teacher before the stuck
// student sees it, and notes are off unless the teacher turns them on. The filter only stops
// the obvious things being sent at all, and the blocked attempt is kept for the teacher.
//
// Matching is on whole words after normalising look-alike characters and repeated letters,
// so "sh1t", "SHIIIT" and "s.h.i.t" all match while "Scunthorpe" or "class" do not.

const BLOCKED_WORDS = [
  // Swearing
  'arse',
  'arsehole',
  'ass',
  'asshole',
  'bastard',
  'bitch',
  'bloody',
  'bollocks',
  'bugger',
  'cock',
  'crap',
  'cunt',
  'damn',
  'dick',
  'dickhead',
  'fck',
  'fuck',
  'fucker',
  'fucking',
  'fuk',
  'knob',
  'minge',
  'piss',
  'pissed',
  'prick',
  'shit',
  'shite',
  'shitty',
  'slag',
  'slut',
  'twat',
  'wanker',
  'whore',
  'wtf',
  // Unkind words aimed at a person
  'dumb',
  'dumbo',
  'freak',
  'hate',
  'idiot',
  'loser',
  'moron',
  'pathetic',
  'retard',
  'stupid',
  'ugly',
  'useless',
  'weirdo',
  'kill',
  'die',
]

// Phrases checked against the normalised, space-joined text.
const BLOCKED_PHRASES = ['shut up', 'go away', 'nobody likes', 'no one likes', 'kys']

const LOOKALIKES = {
  0: 'o',
  1: 'i',
  3: 'e',
  4: 'a',
  5: 's',
  7: 't',
  8: 'b',
  '@': 'a',
  $: 's',
  '!': 'i',
}

function normaliseWord(word) {
  const mapped = [...word.toLowerCase()].map((ch) => LOOKALIKES[ch] ?? ch).join('')
  // Collapse runs of the same letter ("shiiit" → "shit") but keep the original too, so words
  // with real double letters ("bollocks") still match.
  const letters = mapped.replace(/[^a-z]/g, '')
  return [letters, letters.replace(/(.)\1+/g, '$1')]
}

// A collapsed form shorter than four letters is left out: collapsing "ass" gives "as".
const BLOCKED_SET = new Set(
  BLOCKED_WORDS.flatMap((w) => {
    const [full, collapsed] = normaliseWord(w)
    return collapsed.length >= 4 ? [full, collapsed] : [full]
  })
)

// Contact details and links never belong in a note to a classmate.
const CONTACT_PATTERNS = [
  /https?:\/\//i,
  /www\./i,
  /\b[\w.+-]+@[\w-]+\.[\w.]+\b/,
  /(?:\d[\s-]?){9,}/, // phone numbers
  /\b(snap(chat)?|insta(gram)?|tiktok|whatsapp|discord|roblox)\b/i,
]

// Splits on whitespace and punctuation between words. Dots, dashes and asterisks inside a word
// are dropped later by normaliseWord, so "s.h.i.t" and "f*ck" are caught.
function wordsOf(text) {
  return String(text ?? '')
    .split(/[\s,;:?()[\]{}"'`<>/\\|+=^~]+/)
    .filter(Boolean)
}

/**
 * Returns the reason a note is blocked ('language' | 'contact'), or null when it may be sent
 * on to the teacher for review.
 */
export function findBlockedContent(text) {
  const raw = String(text ?? '')
  if (CONTACT_PATTERNS.some((re) => re.test(raw))) return 'contact'
  const words = wordsOf(raw)
  for (const word of words) {
    if (normaliseWord(word).some((w) => w && BLOCKED_SET.has(w))) return 'language'
  }
  const joined = words
    .map((w) => normaliseWord(w)[0])
    .filter(Boolean)
    .join(' ')
  if (BLOCKED_PHRASES.some((p) => ` ${joined} `.includes(` ${p} `))) return 'language'
  return null
}
