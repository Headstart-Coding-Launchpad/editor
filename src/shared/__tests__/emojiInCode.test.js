// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  canDetectEmojiIn,
  codeHasEmoji,
  containsEmoji,
  htmlContentText,
  pythonStringText,
  stripCLikeComments,
} from '../emojiInCode.js'

describe('containsEmoji', () => {
  it('finds pictographic emoji, flags and keycaps', () => {
    expect(containsEmoji('hi 😀')).toBe(true)
    expect(containsEmoji('❤️')).toBe(true)
    expect(containsEmoji('🇬🇧')).toBe(true)
    expect(containsEmoji('1️⃣')).toBe(true)
    expect(containsEmoji('👩‍💻')).toBe(true)
  })

  it('ignores digits, # and *, plain text and © ® ™', () => {
    expect(containsEmoji('0123456789 # *')).toBe(false)
    expect(containsEmoji('Hello, world!')).toBe(false)
    expect(containsEmoji('© 2026 Acme® Widget™')).toBe(false)
    expect(containsEmoji('')).toBe(false)
    expect(containsEmoji(null)).toBe(false)
  })
})

describe('pythonStringText', () => {
  it('keeps string contents and drops comments and code', () => {
    const code = "name = 'Sam'  # 'not this'\nprint(\"Hi \" + name)\n"
    expect(pythonStringText(code)).toBe('Sam\nHi ')
  })

  it('handles escapes, prefixes and triple quotes', () => {
    expect(pythonStringText("a = 'it\\'s'")).toBe("it\\'s")
    expect(pythonStringText("f'{n} 🎉'")).toBe('{n} 🎉')
    expect(pythonStringText('x = """line 1\n# still text\n"""')).toBe('line 1\n# still text\n')
  })

  it('keeps a # inside a string', () => {
    expect(pythonStringText('print("# 1")  # comment')).toBe('# 1')
  })

  it('ends an unterminated string at the end of its line', () => {
    expect(pythonStringText('print("oops\n# 😀')).toBe('oops')
  })
})

describe('stripCLikeComments', () => {
  it('removes block comments, and line comments when asked', () => {
    expect(stripCLikeComments('a /* x */ b // y')).toBe('a  b // y')
    expect(stripCLikeComments('a /* x */ b // y', { lineComments: true })).toBe('a  b ')
  })

  it('keeps quoted text whole', () => {
    expect(stripCLikeComments('let u = "http://x" // c', { lineComments: true })).toBe(
      'let u = "http://x" '
    )
    expect(stripCLikeComments("content: '/* keep */'")).toBe("content: '/* keep */'")
  })
})

describe('htmlContentText', () => {
  it('drops HTML comments and the comments inside style and script', () => {
    const html =
      '<!-- 😀 --><p>Hi</p><style>/* 🎨 */ p { color: red }</style><script>// 🚀\nlet a = 1</script>'
    const text = htmlContentText(html)
    expect(containsEmoji(text)).toBe(false)
    expect(text).toContain('<p>Hi</p>')
    expect(text).toContain('let a = 1')
  })

  it('keeps text and attribute values', () => {
    expect(containsEmoji(htmlContentText('<img alt="🐱">'))).toBe(true)
    expect(containsEmoji(htmlContentText('<h1>Pets 🐶</h1>'))).toBe(true)
  })
})

describe('codeHasEmoji', () => {
  it('reads Python code by its strings', () => {
    expect(codeHasEmoji('print("Hello 👋")', 'python')).toBe(true)
    expect(codeHasEmoji('# 👋\nprint("Hello")', 'python')).toBe(false)
    expect(codeHasEmoji('print("Score: 10 #1 *")', 'python')).toBe(false)
  })

  it('reads an HTML project file by file, by extension', () => {
    const files = [
      { name: 'index.html', content: '<!-- 🌟 --><p>Hello</p>' },
      { name: 'style.css', content: '/* 🌟 */ p { color: red }' },
      { name: 'script.js', content: '// 🌟\nconsole.log("hi")' },
    ]
    expect(codeHasEmoji(files, 'html')).toBe(false)
    expect(
      codeHasEmoji([...files, { name: 'about.html', content: '<p>About 🌟</p>' }], 'html')
    ).toBe(true)
    expect(
      codeHasEmoji([{ name: 'style.css', content: 'p::before { content: "⭐" }' }], 'html')
    ).toBe(true)
    expect(codeHasEmoji({ 'index.html': '<button title="Go 🚀">Go</button>' }, 'html')).toBe(true)
  })

  it('never scans a language it cannot read', () => {
    expect(canDetectEmojiIn('python')).toBe(true)
    expect(canDetectEmojiIn('html')).toBe(true)
    expect(canDetectEmojiIn(null)).toBe(false)
    expect(codeHasEmoji('😀', null)).toBe(false)
    expect(codeHasEmoji('😀', 'toString')).toBe(false)
    expect(codeHasEmoji(null, 'python')).toBe(false)
  })
})
