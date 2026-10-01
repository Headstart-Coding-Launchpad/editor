// Stable content anchors for rendered Markdown (`data-md-anchor`).
//
// The same lesson Markdown renders to the same DOM on every screen, but at different sizes, so
// anything that must land on the same *content* across screens (the Presentation window's live
// pointer, ink and text highlights - see src/app/liveInk) names an element by its anchor and
// positions itself as fractions of that element's box.
//
// Anchors are derived from document order alone, so every client computes the same ones:
//   `b{n}`             one per parsed block (MarkdownRenderer splits the content around tables)
//   `b{n}.p{k}`        the k-th paragraph in block n
//   `b{n}.h{k}`        the k-th heading (any level)
//   `b{n}.li{k}`       the k-th list item (nested items count in document order)
//   `b{n}.img{k}`      the k-th image
//   `b{n}.q{k}`        the k-th blockquote / callout
//   `b{n}.pre{k}`      the k-th code block
//   `b{n}.th`          a table's header row, `b{n}.tr{k}` its k-th body row

export const MD_ANCHOR_ATTR = 'data-md-anchor'

const KIND_BY_TAG = Object.freeze({
  p: 'p',
  h1: 'h',
  h2: 'h',
  h3: 'h',
  h4: 'h',
  h5: 'h',
  h6: 'h',
  li: 'li',
  img: 'img',
  blockquote: 'q',
  pre: 'pre',
})

export function blockAnchor(blockIndex) {
  return `b${blockIndex}`
}

export function tableRowAnchor(blockIndex, rowIndex) {
  return rowIndex == null ? `b${blockIndex}.th` : `b${blockIndex}.tr${rowIndex}`
}

// rehype plugin: `[rehypeMarkdownAnchors, { prefix: 'b0' }]`. Sets the hast property
// `dataMdAnchor`, which react-markdown renders as the `data-md-anchor` attribute (the custom
// components in markdown.jsx forward it).
export function rehypeMarkdownAnchors(options = {}) {
  const prefix = options.prefix ?? 'b0'
  return (tree) => {
    const counts = {}
    const visit = (node) => {
      if (node?.type === 'element') {
        const kind = KIND_BY_TAG[node.tagName]
        if (kind) {
          const index = counts[kind] ?? 0
          counts[kind] = index + 1
          node.properties = {
            ...(node.properties ?? {}),
            dataMdAnchor: `${prefix}.${kind}${index}`,
          }
        }
      }
      if (Array.isArray(node?.children)) node.children.forEach(visit)
    }
    visit(tree)
  }
}

// Picks the anchor attribute out of a react-markdown component's props.
export function anchorProps(props) {
  const value = props?.[MD_ANCHOR_ATTR]
  return value ? { [MD_ANCHOR_ATTR]: value } : {}
}
