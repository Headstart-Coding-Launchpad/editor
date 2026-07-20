import React from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkBreaks from 'remark-breaks'
import hljs from 'highlight.js/lib/core'
import hljsPython from 'highlight.js/lib/languages/python'
import hljsXml from 'highlight.js/lib/languages/xml'
import hljsCss from 'highlight.js/lib/languages/css'
import hljsJs from 'highlight.js/lib/languages/javascript'
import { expandTopicLinks, parseTopicHref, useTopicLibrary } from './topicLibrary'
import { TopicLibraryDialog, TopicReference } from './TopicLibraryView'
import { InlineScratchBlock, ScratchBlocks, looksLikeScratchBlocks } from './markdown/ScratchBlocks'
import { parseMarkdownTables } from './markdown/tableParser'

hljs.registerLanguage('python', hljsPython)
hljs.registerLanguage('xml', hljsXml)
hljs.registerLanguage('css', hljsCss)
hljs.registerLanguage('javascript', hljsJs)

const INLINE_LANG_MAP = { python: 'python', html: 'xml', css: 'css', js: 'javascript' }
const CODE_FONT_STYLE = {
  fontFamily: "'JetBrains Mono', monospace",
  fontVariantLigatures: 'none',
  fontFeatureSettings: '"liga" 0, "calt" 0',
}

function InlineHighlightedCode({ lang, code }) {
  const hljsLang = INLINE_LANG_MAP[lang]
  let highlighted
  try {
    highlighted = hljs.highlight(code, { language: hljsLang }).value
  } catch {
    highlighted = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
  return (
    <code
      className={`language-${hljsLang}`}
      style={{
        ...CODE_FONT_STYLE,
        fontSize: '0.88em',
        background: '#fafafa',
        color: '#1f2937',
        border: '1px solid #e5e7eb',
        padding: '2px 6px',
        borderRadius: '4px',
        display: 'inline',
      }}
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  )
}

// ── Markdown components ───────────────────────────────────────────────────────

const BlockCodeContext = React.createContext(false)
const MarkdownScaleContext = React.createContext(1)
const MarkdownInheritColorContext = React.createContext(false)

// InlineMarkdown only allows inline elements (see allowedElements below) — headings,
// lists, blockquotes, and thematic breaks are never meant to render here. But short
// literal answers like "-", ">", "==", or "1." are common in quiz tiles/blanks, and
// each of those is also valid CommonMark syntax for an empty/near-empty block element
// (bullet list, blockquote, heading, ordered list). Once parsed as a block, the marker
// character is consumed as syntax and disappears instead of showing as text. Escape
// leading block-marker syntax per line so these render as plain text.
function escapeInlineBlockSyntax(text) {
  return String(text ?? '').split('\n').map(line => {
    const [, leading, rest] = line.match(/^( {0,3})(.*)$/s)

    // Thematic break: 3+ of the same -, _, or * (optionally space-separated)
    if (/^([-*_])( *\1){2,}$/.test(rest)) {
      return leading + rest.replace(/[-*_]/g, m => `\\${m}`)
    }
    // ATX heading: 1-6 '#' followed by a space or end of line
    if (/^#{1,6}(\s|$)/.test(rest)) return leading + '\\' + rest
    // Blockquote marker
    if (rest.startsWith('>')) return leading + '\\' + rest
    // Bullet list marker: -, +, or * followed by a space or end of line
    if (/^[-+*](\s|$)/.test(rest)) return leading + '\\' + rest
    // Ordered list marker: digits followed by '.' or ')' then a space or end of line
    const ordered = rest.match(/^(\d{1,9})([.)])(\s|$)/)
    if (ordered) return leading + ordered[1] + '\\' + rest.slice(ordered[1].length)

    return line
  }).join('\n')
}

export function InlineMarkdown({ content, topicType = null }) {
  const topicEnabled = String(content ?? '').includes('[[') || String(content ?? '').includes('#topic/')
  const { topics } = useTopicLibrary(topicType, topicEnabled)
  const [libraryOpen, setLibraryOpen] = React.useState(false)
  const [selectedTopicId, setSelectedTopicId] = React.useState('')
  const inlineComponents = {
    ...components,
    a({ href, children }) {
      const topicId = parseTopicHref(href)
      const topic = topicId && topics.find(item => item.id === topicId)
      if (!topic) return <span>{children}</span>
      return (
        <TopicReference
          topic={topic}
          label={children}
          renderSummary={InlineMarkdown}
          onOpen={id => {
            setSelectedTopicId(id)
            setLibraryOpen(true)
          }}
        />
      )
    },
  }

  return (
    <>
      <ReactMarkdown
        remarkPlugins={[remarkBreaks]}
        components={inlineComponents}
        allowedElements={['strong', 'em', 'code', 'br', 'span', 'a']}
        unwrapDisallowed
      >
        {escapeInlineBlockSyntax(topicEnabled ? expandTopicLinks(content, topics) : content)}
      </ReactMarkdown>
      {libraryOpen && (
        <TopicLibraryDialog
          topics={topics}
          initialTopicId={selectedTopicId}
          renderMarkdown={MarkdownRenderer}
          topicType={topicType}
          onClose={() => setLibraryOpen(false)}
        />
      )}
    </>
  )
}

function MarkdownTable({ headers, align, rows }) {
  return (
    <div style={tableStyles.scroll}>
      <table style={tableStyles.table}>
        <thead>
          <tr>
            {headers.map((header, i) => (
              <th key={i} style={{ ...tableStyles.th, textAlign: align[i] }}>
                <InlineMarkdown content={header} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, i) => (
                <td key={i} style={{ ...tableStyles.td, textAlign: align[i] }}>
                  <InlineMarkdown content={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const headingBase = {
  fontFamily: 'var(--font-title)',
  fontWeight: 700,
  lineHeight: 1.25,
}

const tableStyles = {
  scroll: {
    overflowX: 'auto',
    margin: '10px 0',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '320px',
    fontSize: '0.92em',
  },
  th: {
    background: '#f7f2ff',
    color: 'var(--colour-primary-dark)',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    padding: '8px 10px',
    borderBottom: '1px solid #e5e7eb',
    verticalAlign: 'top',
  },
  td: {
    padding: '8px 10px',
    borderTop: '1px solid #f0f0f0',
    verticalAlign: 'top',
  },
}

const CALLOUT_VARIANTS = {
  warning: {
    border: '#f59e0b',
    background: '#fffbeb',
    color: '#78350f',
  },
  error: {
    border: '#ef4444',
    background: '#fef2f2',
    color: '#7f1d1d',
  },
  success: {
    border: '#22c55e',
    background: '#f0fdf4',
    color: '#14532d',
  },
  info: {
    border: '#3b82f6',
    background: '#eff6ff',
    color: '#1e3a8a',
  },
  default: {
    border: 'var(--colour-secondary)',
    background: '#fffaf0',
    color: 'var(--colour-text)',
  },
}

const CALLOUT_MARKER_PATTERN = /^\s*>?:(warning|error|success|info)\b\s*/i

function getTextFromChildren(children) {
  return React.Children.toArray(children).map(child => {
    if (typeof child === 'string' || typeof child === 'number') return String(child)
    if (React.isValidElement(child)) return getTextFromChildren(child.props.children)
    return ''
  }).join('')
}

function removeCalloutMarker(children) {
  let removed = false
  return React.Children.toArray(children).map(child => {
    if (removed || !React.isValidElement(child)) return child
    const text = getTextFromChildren(child.props.children)
    const match = text.match(CALLOUT_MARKER_PATTERN)
    if (!match) return child

    removed = true
    const nextChildren = React.Children.toArray(child.props.children).map((nested, index) => {
      if (index !== 0 || typeof nested !== 'string') return nested
      return nested.replace(CALLOUT_MARKER_PATTERN, '')
    }).filter(nested => nested !== '')

    if (!nextChildren.length) return null
    return React.cloneElement(child, child.props, nextChildren)
  }).filter(Boolean)
}

const components = {
  h1({ children }) {
    const scale = React.useContext(MarkdownScaleContext)
    const inheritColor = React.useContext(MarkdownInheritColorContext)
    const color = inheritColor ? 'inherit' : 'var(--colour-primary-dark)'
    return <h1 style={{ ...headingBase, color, fontSize: `${1.45 * scale}rem`, margin: '4px 0 10px' }}>{children}</h1>
  },
  h2({ children }) {
    const scale = React.useContext(MarkdownScaleContext)
    const inheritColor = React.useContext(MarkdownInheritColorContext)
    const color = inheritColor ? 'inherit' : 'var(--colour-primary-dark)'
    return <h2 style={{ ...headingBase, color, fontSize: `${1.22 * scale}rem`, margin: '4px 0 8px' }}>{children}</h2>
  },
  h3({ children }) {
    const scale = React.useContext(MarkdownScaleContext)
    const inheritColor = React.useContext(MarkdownInheritColorContext)
    const color = inheritColor ? 'inherit' : 'var(--colour-primary-dark)'
    return <h3 style={{ ...headingBase, color, fontSize: `${1.05 * scale}rem`, margin: '8px 0 6px' }}>{children}</h3>
  },
  h4({ children }) {
    const scale = React.useContext(MarkdownScaleContext)
    const inheritColor = React.useContext(MarkdownInheritColorContext)
    const color = inheritColor ? 'inherit' : 'var(--colour-primary-dark)'
    return <h4 style={{ ...headingBase, color, fontSize: `${0.95 * scale}rem`, margin: '8px 0 4px' }}>{children}</h4>
  },
  code({ node, className, children, ...props }) {
    const isInBlock = React.useContext(BlockCodeContext)
    const isInline = !isInBlock && !className
    if (isInline) {
      const text = String(children)
      if (text.startsWith('scratch:')) {
        return <InlineScratchBlock text={text.slice('scratch:'.length).trim()} />
      }
      const langMatch = text.match(/^(python|html|css|js):(.*)$/s)
      if (langMatch) {
        return <InlineHighlightedCode lang={langMatch[1]} code={langMatch[2]} />
      }
      const inheritColor = React.useContext(MarkdownInheritColorContext)
      return (
        <code
          style={{
            ...CODE_FONT_STYLE,
            fontSize: '0.88em',
            background: inheritColor ? 'rgba(0,0,0,0.2)' : '#f0eafa',
            color: inheritColor ? 'inherit' : '#4e1aa3',
            padding: '2px 6px',
            borderRadius: '4px',
          }}
          {...props}
        >
          {children}
        </code>
      )
    }
    if (className?.includes('language-scratch')) {
      return <ScratchBlocks code={String(children).replace(/\n$/, '')} />
    }
    return (
      <code className={className} style={CODE_FONT_STYLE} {...props}>
        {children}
      </code>
    )
  },
  pre({ children }) {
    const scale = React.useContext(MarkdownScaleContext)
    // Pass through without pre styling when the child is a scratch block
    const child = React.Children.toArray(children)[0]
    if (child?.props?.className?.includes('language-scratch')) {
      return <>{children}</>
    }
    const className = child?.props?.className
    const isPlainCodeBlock = child?.type === 'code' && !className
    const plainCode = isPlainCodeBlock ? String(child.props.children ?? '') : null
    if (plainCode && looksLikeScratchBlocks(plainCode)) {
      return <ScratchBlocks code={plainCode.replace(/\n$/, '')} />
    }
    return (
      <BlockCodeContext.Provider value={true}>
      <pre
        style={{
          background: '#fafafa',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '12px 14px',
          overflowX: 'auto',
          ...CODE_FONT_STYLE,
          fontSize: `${14 * scale}px`,
          margin: '10px 0',
          lineHeight: 1.6,
        }}
      >
        {isPlainCodeBlock
          ? (
            <code style={CODE_FONT_STYLE}>
              {plainCode}
            </code>
          )
          : children}
      </pre>
      </BlockCodeContext.Provider>
    )
  },
  p({ children }) {
    return <p style={{ margin: '6px 0', lineHeight: 1.65 }}>{children}</p>
  },
  ul({ children }) {
    return <ul style={{ margin: '6px 0 8px 20px', lineHeight: 1.55 }}>{children}</ul>
  },
  ol({ children }) {
    return <ol style={{ margin: '6px 0 8px 22px', lineHeight: 1.55 }}>{children}</ol>
  },
  li({ children }) {
    return <li style={{ margin: '3px 0' }}>{children}</li>
  },
  blockquote({ children }) {
    const markerText = getTextFromChildren(children)
    const markerMatch = markerText.match(CALLOUT_MARKER_PATTERN)
    const variant = markerMatch ? markerMatch[1].toLowerCase() : 'default'
    const style = CALLOUT_VARIANTS[variant]
    const renderedChildren = markerMatch ? removeCalloutMarker(children) : children

    return (
      <blockquote
        style={{
          margin: '10px 0',
          padding: '8px 12px',
          borderLeft: `4px solid ${style.border}`,
          background: style.background,
          color: style.color,
          borderRadius: '0 8px 8px 0',
        }}
      >
        {renderedChildren}
      </blockquote>
    )
  },
  strong({ children }) {
    const inheritColor = React.useContext(MarkdownInheritColorContext)
    const color = inheritColor ? 'inherit' : 'var(--colour-primary)'
    return <strong style={{ fontWeight: 700, color }}>{children}</strong>
  },
  em({ children }) {
    return <em>{children}</em>
  },
  img({ src, alt }) {
    return (
      <img
        src={src}
        alt={alt ?? ''}
        style={{
          maxWidth: '100%',
          maxHeight: 'min(420px, 60vh)',
          height: 'auto',
          objectFit: 'contain',
          borderRadius: 6,
          display: 'block',
          margin: '10px 0',
        }}
      />
    )
  },
}

export function MarkdownRenderer({ content, title, style, textScale = 1, inheritColor = false, topicType = null, showLibrary = false, onTopicOpen, onTopicClose, openTopicId, disableCopy = false }) {
  const topicEnabled = showLibrary || String(content ?? '').includes('[[') || String(content ?? '').includes('#topic/')
  const { topics, loading } = useTopicLibrary(topicType, topicEnabled)
  const [libraryOpen, setLibraryOpen] = React.useState(false)
  const [selectedTopicId, setSelectedTopicId] = React.useState('')
  const blocks = parseMarkdownTables(topicEnabled ? expandTopicLinks(content, topics) : content)
  const heading = String(title ?? '').trim()

  React.useEffect(() => {
    if (!openTopicId) return
    setSelectedTopicId(openTopicId)
    setLibraryOpen(true)
    onTopicOpen?.(openTopicId)
  // openTopicId is the external trigger; only re-run when it changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTopicId])

  function handleTopicLinkOpen(id) {
    setSelectedTopicId(id)
    setLibraryOpen(true)
    onTopicOpen?.(id)
  }

  function handleDialogClose() {
    setLibraryOpen(false)
    onTopicClose?.()
  }

  const markdownComponents = {
    ...components,
    a({ href, children }) {
      const topicId = parseTopicHref(href)
      if (!topicId) return <a href={href}>{children}</a>
      const topic = topics.find(item => item.id === topicId)
      if (!topic) return <span>{children}</span>
      return (
        <TopicReference
          topic={topic}
          label={children}
          renderSummary={InlineMarkdown}
          onOpen={handleTopicLinkOpen}
        />
      )
    },
  }

  return (
    <MarkdownInheritColorContext.Provider value={inheritColor}>
    <MarkdownScaleContext.Provider value={textScale}>
      <div
        style={{
          fontFamily: "'Quicksand', sans-serif",
          color: inheritColor ? 'inherit' : 'var(--colour-text)',
          fontSize: `${15 * textScale}px`,
          lineHeight: 1.65,
          ...(disableCopy ? {
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
          } : {}),
          ...style,
        }}
        {...(disableCopy ? {
          onCopy: e => e.preventDefault(),
          onCut: e => e.preventDefault(),
          onDragStart: e => e.preventDefault(),
          onContextMenu: e => e.preventDefault(),
        } : {})}
      >
        {showLibrary && (
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            style={{
              float: 'right',
              margin: '0 0 8px 10px',
              padding: '5px 10px',
              border: '1px solid #ded1f3',
              borderRadius: 999,
              background: '#f7f2ff',
              color: 'var(--colour-primary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: '0.78rem',
            }}
          >
            {loading ? 'Loading library...' : 'Topic library'}
          </button>
        )}
        {blocks.map((block, i) => block.type === 'table'
          ? <MarkdownTable key={i} headers={block.headers} align={block.align} rows={block.rows} />
          : (
            <ReactMarkdown
               key={i}
               remarkPlugins={[remarkBreaks]}
               rehypePlugins={[rehypeHighlight]}
               components={markdownComponents}
               allowedElements={[
                 'h1', 'h2', 'h3', 'h4',
                 'p', 'strong', 'em', 'code', 'pre', 'br', 'span',
                 'ul', 'ol', 'li', 'blockquote', 'img', 'a',
               ]}
               unwrapDisallowed
             >
              {block.content}
            </ReactMarkdown>
             ))}
      </div>
      {libraryOpen && (
        <TopicLibraryDialog
          topics={topics}
          initialTopicId={selectedTopicId}
          renderMarkdown={MarkdownRenderer}
          topicType={topicType}
          onClose={handleDialogClose}
          onTopicSelect={onTopicOpen}
        />
      )}
    </MarkdownScaleContext.Provider>
    </MarkdownInheritColorContext.Provider>
  )
}
