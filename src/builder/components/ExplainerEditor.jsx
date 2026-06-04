import React, { useState, useRef, useEffect } from 'react'
import { MarkdownRenderer } from '../../shared/markdown'
import { findTopicSuggestion, searchTopics, useTopicLibrary } from '../../shared/topicLibrary'

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'])

const SCRATCH_BLOCK_CATEGORIES = [
  {
    label: 'Events',
    color: '#d97706',
    blocks: [
      'when green flag clicked',
      'when [space] key pressed',
      'when this sprite clicked',
      'broadcast [message1]',
    ],
  },
  {
    label: 'Motion',
    color: '#2563eb',
    blocks: [
      'move (10) steps',
      'turn (15) degrees',
      'go to x: (0) y: (0)',
      'set x to (0)',
      'set y to (0)',
      'change x by (10)',
      'change y by (10)',
    ],
  },
  {
    label: 'Looks',
    color: '#7c3aed',
    blocks: [
      'say (Hello!)',
      'say (Hello!) for (2) seconds',
      'think (Hmm...)',
      'set size to (100)',
      'show',
      'hide',
    ],
  },
  {
    label: 'Sound',
    color: '#9333ea',
    blocks: [
      'play sound (Meow)',
      'stop all sounds',
    ],
  },
  {
    label: 'Control',
    color: '#b45309',
    blocks: [
      'wait (1) seconds',
      'repeat (10)',
      'forever',
      'if <> then',
      'stop all',
    ],
  },
  {
    label: 'Sensing',
    color: '#0284c7',
    blocks: [
      "ask (What's your name?) and wait",
      'touching edge?',
      'mouse down?',
      'key [space] pressed?',
    ],
  },
  {
    label: 'Variables',
    color: '#ea580c',
    blocks: [
      'set [my variable] to (0)',
      'change [my variable] by (1)',
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
      '(1) = (2)',
      '(1) < (2)',
      '(1) > (2)',
    ],
  },
]

export default function ExplainerEditor({ title, value, onChange, lessonType, inlineCodeLanguages, assets, assetsPath, storageAssets }) {
  return (
    <MarkdownFieldEditor
      title={title}
      value={value}
      onChange={onChange}
      ariaLabel="Explainer editor views"
      placeholder="Write the task explainer in Markdown..."
      height={240}
      minHeight={180}
      showTitle
      lessonType={lessonType}
      inlineCodeLanguages={inlineCodeLanguages}
      assets={assets}
      assetsPath={assetsPath}
      storageAssets={storageAssets}
    />
  )
}

export function MarkdownFieldEditor({
  title,
  value,
  onChange,
  ariaLabel = 'Markdown editor views',
  placeholder = 'Write in Markdown...',
  height = 150,
  minHeight = 120,
  showTitle = false,
  lessonType = null,
  inlineCodeLanguages = null,
  assets = null,
  assetsPath = '',
  storageAssets = null,
}) {
  const [tab, setTab] = useState('entry')
  const textareaRef = useRef(null)
  const content = value ?? ''
  const { topics } = useTopicLibrary(lessonType)
  const topicSuggestion = findTopicSuggestion(content, topics)

  function applyFormat(action) {
    const el = textareaRef.current
    if (!el) return

    const start = el.selectionStart
    const end = el.selectionEnd
    const val = content
    const selected = val.slice(start, end)
    const before = val.slice(0, start)
    const after = val.slice(end)

    let newVal = val
    let cursorStart = start
    let cursorEnd = end

    if (action === 'bold') {
      const inner = selected || 'bold text'
      newVal = before + `**${inner}**` + after
      cursorStart = start + 2
      cursorEnd = start + 2 + inner.length
    } else if (action === 'italic') {
      const inner = selected || 'italic text'
      newVal = before + `_${inner}_` + after
      cursorStart = start + 1
      cursorEnd = start + 1 + inner.length
    } else if (action === 'inline-code' || action.startsWith('inline-code:')) {
      const lang = action.startsWith('inline-code:') ? action.slice('inline-code:'.length) : ''
      const prefixes = {
        python: 'python:',
        html: 'html:',
        css: 'css:',
        javascript: 'js:',
        scratch: 'scratch:',
      }
      const examples = {
        python: 'print()',
        html: '<h1>',
        css: 'color: red;',
        javascript: 'console.log()',
        scratch: 'move (10) steps',
      }
      const prefix = prefixes[lang] ?? ''
      const example = selected || examples[lang] || 'code'
      const inner = prefix + example
      newVal = before + '`' + inner + '`' + after
      cursorStart = start + 1 + prefix.length
      cursorEnd = start + 1 + inner.length
    } else if (action.startsWith('code-block:')) {
      const lang = action.slice('code-block:'.length)
      const inner = selected || ''
      const fenceOpen = '```' + lang + '\n'
      const fenceClose = '\n```'
      newVal = before + fenceOpen + inner + fenceClose + after
      cursorStart = start + fenceOpen.length
      cursorEnd = cursorStart + inner.length
    } else if (action === 'h1' || action === 'h2' || action === 'h3') {
      const prefix = action === 'h1' ? '# ' : action === 'h2' ? '## ' : '### '
      const lineStart = val.lastIndexOf('\n', start - 1) + 1
      const nlIdx = val.indexOf('\n', start)
      const lineEnd = nlIdx === -1 ? val.length : nlIdx
      const line = val.slice(lineStart, lineEnd)
      const stripped = line.replace(/^#{1,4}\s*/, '')
      const newLine = prefix + stripped
      newVal = val.slice(0, lineStart) + newLine + val.slice(lineEnd)
      cursorStart = lineStart + prefix.length
      cursorEnd = lineStart + newLine.length
    } else if (action === 'quote') {
      const lineStart = val.lastIndexOf('\n', start - 1) + 1
      const nlIdx = val.indexOf('\n', start)
      const lineEnd = nlIdx === -1 ? val.length : nlIdx
      const line = val.slice(lineStart, lineEnd)
      const newLine = '> ' + line
      newVal = val.slice(0, lineStart) + newLine + val.slice(lineEnd)
      cursorStart = start + 2
      cursorEnd = end + 2
    } else if (action === 'table') {
      const needNewline = start > 0 && val[start - 1] !== '\n'
      const tableText = (needNewline ? '\n' : '') + '| Header | Header |\n| --- | --- |\n| Cell | Cell |\n'
      newVal = before + tableText + after
      cursorStart = start + tableText.length
      cursorEnd = cursorStart
    } else if (action === 'indent') {
      const firstLineStart = val.lastIndexOf('\n', start - 1) + 1
      const lastNlIdx = end > start ? val.indexOf('\n', end - 1) : val.indexOf('\n', start)
      const regionEnd = lastNlIdx === -1 ? val.length : lastNlIdx
      const region = val.slice(firstLineStart, regionEnd)
      const lines = region.split('\n')
      const indented = lines.map(line => '  ' + line).join('\n')
      newVal = val.slice(0, firstLineStart) + indented + val.slice(regionEnd)
      cursorStart = start + 2
      cursorEnd = end + 2 * lines.length
    } else if (action.startsWith('topic:')) {
      const id = action.slice('topic:'.length)
      const toInsert = selected ? `[[${id}|${selected}]]` : `[[${id}]]`
      newVal = before + toInsert + after
      cursorStart = start + toInsert.length
      cursorEnd = cursorStart
    } else if (action.startsWith('scratch:')) {
      const blockText = action.slice('scratch:'.length)
      const toInsert = '`scratch:' + blockText + '`'
      newVal = before + toInsert + after
      cursorStart = start + toInsert.length
      cursorEnd = cursorStart
    } else if (action.startsWith('image-url:')) {
      const url = action.slice('image-url:'.length)
      const toInsert = `![Image](${url})`
      newVal = before + toInsert + after
      cursorStart = start + toInsert.length
      cursorEnd = cursorStart
    } else if (action.startsWith('image:')) {
      const path = action.slice('image:'.length)
      const base = assetsPath ? assetsPath.replace(/\/$/, '') : ''
      const url = base ? base + '/' + path.replace(/^\//, '') : path
      const toInsert = `![Image](${url})`
      newVal = before + toInsert + after
      cursorStart = start + toInsert.length
      cursorEnd = cursorStart
    }

    if (newVal !== val) {
      onChange(newVal)
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          textareaRef.current.setSelectionRange(cursorStart, cursorEnd)
        }
      })
    }
  }

  function applyTopicSuggestion() {
    if (!topicSuggestion) return
    const { topic, start, end, label } = topicSuggestion
    const nextValue = content.slice(0, start) + `[[${topic.id}|${label}]]` + content.slice(end)
    onChange(nextValue)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  return (
    <div style={{ ...s.wrap, height, minHeight }}>
      <div style={s.tabs} className="ui-tabs" role="tablist" aria-label={ariaLabel}>
        <button
          type="button"
          className="ui-tab"
          role="tab"
          aria-selected={tab === 'entry'}
          style={tab === 'entry' ? { ...s.tab, ...s.tabActive } : s.tab}
          onClick={() => setTab('entry')}
        >
          Entry
        </button>
        <button
          type="button"
          className="ui-tab"
          role="tab"
          aria-selected={tab === 'preview'}
          style={tab === 'preview' ? { ...s.tab, ...s.tabActive } : s.tab}
          onClick={() => setTab('preview')}
        >
          Preview
        </button>
      </div>

      {tab === 'entry' && (
        <MarkdownToolbar
          lessonType={lessonType}
          inlineCodeLanguages={inlineCodeLanguages}
          onAction={applyFormat}
          imageAssets={(assets ?? []).filter(p => IMAGE_EXTS.has(p.split('.').pop().toLowerCase()))}
          storageImageAssets={(storageAssets ?? []).filter(a => IMAGE_EXTS.has(a.name.split('.').pop().toLowerCase()))}
          topics={topics}
        />
      )}

      {tab === 'entry' && topicSuggestion && (
        <div style={s.topicSuggestion}>
          <span>
            Link <strong>{topicSuggestion.label}</strong> to the topic library?
          </span>
          <button type="button" style={s.topicSuggestionButton} onClick={applyTopicSuggestion}>
            Link to {topicSuggestion.topic.title}
          </button>
        </div>
      )}

      <div style={s.pane}>
        {tab === 'entry' ? (
          <textarea
            ref={textareaRef}
            style={s.textarea}
            value={content}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            spellCheck
          />
        ) : (
          <div style={s.preview}>
            {content || (showTitle && title)
              ? <MarkdownRenderer title={showTitle ? title : undefined} content={content} topicType={lessonType} showLibrary />
              : <span style={s.empty}>Preview will appear here...</span>}
          </div>
        )}
      </div>
    </div>
  )
}

function MarkdownToolbar({ lessonType, inlineCodeLanguages, onAction, imageAssets = [], storageImageAssets = [], topics = [] }) {
  const [openDropdown, setOpenDropdown] = useState(null)
  const [topicQuery, setTopicQuery] = useState('')
  const toolbarRef = useRef(null)

  useEffect(() => {
    function handleMouseDown(e) {
      if (!toolbarRef.current?.contains(e.target)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const codeBlockOptions =
    lessonType === 'python'
      ? [{ label: 'Python', action: 'code-block:python' }]
      : lessonType === 'html'
      ? [
          { label: 'HTML', action: 'code-block:html' },
          { label: 'CSS', action: 'code-block:css' },
          { label: 'JavaScript', action: 'code-block:javascript' },
        ]
      : lessonType === 'scratch'
      ? [
          { label: 'Scratch', action: 'code-block:scratch' },
          { label: 'HTML', action: 'code-block:html' },
          { label: 'CSS', action: 'code-block:css' },
          { label: 'JavaScript', action: 'code-block:javascript' },
        ]
      : [{ label: 'Code block', action: 'code-block:' }]

  const singleCodeBlock = codeBlockOptions.length === 1
  const inlineCodeOptions = getInlineCodeOptions(lessonType, inlineCodeLanguages)
  const matchingTopics = searchTopics(topics, topicQuery)

  return (
    <div style={s.toolbar} ref={toolbarRef}>

      {/* Headings */}
      <div style={s.toolbarGroup}>
        <button
          type="button"
          title="Heading"
          style={s.toolbarBtn}
          onMouseDown={e => {
            e.preventDefault()
            setOpenDropdown(d => d === 'heading' ? null : 'heading')
          }}
        >
          H ▾
        </button>
        {openDropdown === 'heading' && (
          <div style={s.dropdown}>
            {[
              { action: 'h1', label: '# Heading 1' },
              { action: 'h2', label: '## Heading 2' },
              { action: 'h3', label: '### Heading 3' },
            ].map(({ action, label }) => (
              <button
                key={action}
                type="button"
                style={s.dropdownItem}
                onMouseDown={e => {
                  e.preventDefault()
                  onAction(action)
                  setOpenDropdown(null)
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <span style={s.sep} />

      {/* Bold */}
      <button
        type="button"
        title="Bold"
        style={{ ...s.toolbarBtn, fontWeight: 700 }}
        onMouseDown={e => { e.preventDefault(); onAction('bold') }}
      >
        B
      </button>

      {/* Italic */}
      <button
        type="button"
        title="Italic"
        style={{ ...s.toolbarBtn, fontStyle: 'italic' }}
        onMouseDown={e => { e.preventDefault(); onAction('italic') }}
      >
        I
      </button>

      <span style={s.sep} />

      {/* Inline code */}
      {inlineCodeOptions.map(({ label, action }) => (
        <button
          key={action}
          type="button"
          title={`Inline ${label} code`}
          style={{ ...s.toolbarBtn, fontFamily: "'JetBrains Mono', monospace" }}
          onMouseDown={e => { e.preventDefault(); onAction(action) }}
        >
          `{label}`
        </button>
      ))}

      {/* Code block */}
      <div style={s.toolbarGroup}>
        <button
          type="button"
          title="Code block"
          style={s.toolbarBtn}
          onMouseDown={e => {
            e.preventDefault()
            if (singleCodeBlock) {
              onAction(codeBlockOptions[0].action)
            } else {
              setOpenDropdown(d => d === 'codeblock' ? null : 'codeblock')
            }
          }}
        >
          {singleCodeBlock ? '{ }' : '{ } ▾'}
        </button>
        {openDropdown === 'codeblock' && (
          <div style={s.dropdown}>
            {codeBlockOptions.map(({ label, action }) => (
              <button
                key={action}
                type="button"
                style={s.dropdownItem}
                onMouseDown={e => {
                  e.preventDefault()
                  onAction(action)
                  setOpenDropdown(null)
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <span style={s.sep} />

      <div style={s.toolbarGroup}>
        <button
          type="button"
          title="Insert topic library link"
          style={s.toolbarBtn}
          onMouseDown={event => {
            event.preventDefault()
            setOpenDropdown(value => value === 'topic' ? null : 'topic')
          }}
        >
          Topic ▾
        </button>
        {openDropdown === 'topic' && (
          <div style={{ ...s.dropdown, width: 260, maxHeight: 310, overflowY: 'auto' }}>
            <input
              type="search"
              value={topicQuery}
              placeholder="Search topics..."
              style={s.topicSearch}
              onChange={event => setTopicQuery(event.target.value)}
              onMouseDown={event => event.stopPropagation()}
            />
            {matchingTopics.map(topic => (
              <button
                key={topic.id}
                type="button"
                style={s.dropdownItem}
                onMouseDown={event => {
                  event.preventDefault()
                  onAction(`topic:${topic.id}`)
                  setOpenDropdown(null)
                  setTopicQuery('')
                }}
              >
                {topic.title}
              </button>
            ))}
            {matchingTopics.length === 0 && <div style={s.topicEmpty}>No matching topics</div>}
          </div>
        )}
      </div>

      <span style={s.sep} />

      {/* Blockquote */}
      <button
        type="button"
        title="Blockquote"
        style={s.toolbarBtn}
        onMouseDown={e => { e.preventDefault(); onAction('quote') }}
      >
        "
      </button>

      {/* Table */}
      <button
        type="button"
        title="Insert table"
        style={s.toolbarBtn}
        onMouseDown={e => { e.preventDefault(); onAction('table') }}
      >
        ⊞
      </button>

      {/* Indent */}
      <button
        type="button"
        title="Indent lines"
        style={s.toolbarBtn}
        onMouseDown={e => { e.preventDefault(); onAction('indent') }}
      >
        ⇥
      </button>

      {/* Scratch blocks — only for scratch lessons */}
      {lessonType === 'scratch' && (
        <>
          <span style={s.sep} />
          <div style={s.toolbarGroup}>
            <button
              type="button"
              title="Insert Scratch block reference"
              style={{ ...s.toolbarBtn, color: '#b45309' }}
              onMouseDown={e => {
                e.preventDefault()
                setOpenDropdown(d => d === 'scratch' ? null : 'scratch')
              }}
            >
              Blocks ▾
            </button>
            {openDropdown === 'scratch' && (
              <div style={{ ...s.dropdown, width: 230, maxHeight: 280, overflowY: 'auto' }}>
                {SCRATCH_BLOCK_CATEGORIES.map(cat => (
                  <div key={cat.label}>
                    <div style={{ ...s.dropdownCategory, color: cat.color }}>
                      {cat.label}
                    </div>
                    {cat.blocks.map(block => (
                      <button
                        key={block}
                        type="button"
                        style={s.dropdownItem}
                        onMouseDown={e => {
                          e.preventDefault()
                          onAction('scratch:' + block)
                          setOpenDropdown(null)
                        }}
                      >
                        {block}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Image assets — shown when the lesson has static or Firebase Storage image assets */}
      {(imageAssets.length > 0 || storageImageAssets.length > 0) && (
        <>
          <span style={s.sep} />
          <div style={s.toolbarGroup}>
            <button
              type="button"
              title="Insert image"
              style={s.toolbarBtn}
              onMouseDown={e => {
                e.preventDefault()
                setOpenDropdown(d => d === 'image' ? null : 'image')
              }}
            >
              Image ▾
            </button>
            {openDropdown === 'image' && (
              <div style={{ ...s.dropdown, width: 220, maxHeight: 260, overflowY: 'auto' }}>
                {imageAssets.length > 0 && storageImageAssets.length > 0 && (
                  <div style={s.dropdownCategory}>Local assets</div>
                )}
                {imageAssets.map(path => {
                  const name = path.split('/').pop()
                  return (
                    <button
                      key={path}
                      type="button"
                      style={s.dropdownItem}
                      onMouseDown={e => {
                        e.preventDefault()
                        onAction('image:' + path)
                        setOpenDropdown(null)
                      }}
                    >
                      {name}
                    </button>
                  )
                })}
                {storageImageAssets.length > 0 && (
                  <div style={s.dropdownCategory}>Firebase Storage</div>
                )}
                {storageImageAssets.map(asset => (
                  <button
                    key={asset.url}
                    type="button"
                    style={s.dropdownItem}
                    onMouseDown={e => {
                      e.preventDefault()
                      onAction('image-url:' + asset.url)
                      setOpenDropdown(null)
                    }}
                  >
                    {asset.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function getInlineCodeOptions(lessonType, inlineCodeLanguages) {
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

const s = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
  },
  tabs: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: 4,
    border: '1px solid #e5e7eb',
    borderBottom: 'none',
    borderRadius: '8px 8px 0 0',
    background: '#f7f7f7',
    flexShrink: 0,
  },
  tab: {
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    color: '#6b7280',
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    fontWeight: 700,
    padding: '6px 12px',
    cursor: 'pointer',
  },
  tabActive: {
    background: '#ffffff',
    color: 'var(--colour-primary-dark)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 1,
    padding: '3px 6px',
    background: '#fafafa',
    borderLeft: '1px solid #e5e7eb',
    borderRight: '1px solid #e5e7eb',
    borderBottom: '1px solid #e5e7eb',
    flexShrink: 0,
  },
  toolbarGroup: {
    position: 'relative',
  },
  toolbarBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid transparent',
    borderRadius: 4,
    background: 'none',
    color: 'var(--colour-text)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.77rem',
    fontWeight: 600,
    padding: '2px 7px',
    cursor: 'pointer',
    lineHeight: '16px',
    height: 24,
    whiteSpace: 'nowrap',
  },
  sep: {
    display: 'inline-block',
    width: 1,
    height: 14,
    background: '#d1d5db',
    margin: '0 4px',
    flexShrink: 0,
    alignSelf: 'center',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    zIndex: 200,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
    minWidth: 140,
    overflow: 'hidden',
    marginTop: 2,
  },
  dropdownItem: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    border: 'none',
    background: 'none',
    padding: '6px 10px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.79rem',
    color: 'var(--colour-text)',
    cursor: 'pointer',
    lineHeight: 1.4,
  },
  dropdownCategory: {
    padding: '6px 10px 2px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.68rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderTop: '1px solid #f3f4f6',
  },
  topicSearch: {
    boxSizing: 'border-box',
    width: 'calc(100% - 16px)',
    margin: 8,
    padding: '7px 8px',
    border: '1px solid #d1d5db',
    borderRadius: 5,
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
  },
  topicEmpty: {
    padding: '8px 10px',
    color: '#6b7280',
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
  },
  topicSuggestion: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '6px 10px',
    borderLeft: '1px solid #e5e7eb',
    borderRight: '1px solid #e5e7eb',
    background: '#f7f2ff',
    color: 'var(--colour-text)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.79rem',
  },
  topicSuggestionButton: {
    border: '1px solid #ded1f3',
    borderRadius: 999,
    padding: '4px 10px',
    background: '#fff',
    color: 'var(--colour-primary)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.76rem',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  pane: {
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #e5e7eb',
    borderRadius: '0 0 8px 8px',
    overflow: 'hidden',
    minHeight: 0,
    flex: 1,
  },
  textarea: {
    flex: 1,
    border: 'none',
    outline: 'none',
    resize: 'none',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '13px',
    padding: '10px',
    color: 'var(--colour-text)',
    lineHeight: 1.6,
  },
  preview: {
    flex: 1,
    padding: '10px 12px',
    overflowY: 'auto',
  },
  empty: {
    color: '#9ca3af',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
  },
}
