function splitTableRow(line) {
  const trimmed = line.trim()
  const withoutOuterPipes = trimmed.replace(/^\|/, '').replace(/\|$/, '')
  return withoutOuterPipes.split('|').map(cell => cell.trim())
}

function isTableSeparator(line) {
  const cells = splitTableRow(line)
  return cells.length > 1 && cells.every(cell => /^:?-{3,}:?$/.test(cell))
}

function getTableAlignment(separator) {
  return splitTableRow(separator).map(cell => {
    const left = cell.startsWith(':')
    const right = cell.endsWith(':')
    if (left && right) return 'center'
    if (right) return 'right'
    return 'left'
  })
}

function normalizeCells(cells, length) {
  return Array.from({ length }, (_, i) => cells[i] ?? '')
}

export function parseMarkdownTables(content) {
  const lines = String(content ?? '').split('\n')
  const blocks = []
  let markdown = []
  let i = 0

  const flushMarkdown = () => {
    if (!markdown.length) return
    blocks.push({ type: 'markdown', content: markdown.join('\n') })
    markdown = []
  }

  while (i < lines.length) {
    const line = lines[i]
    const next = lines[i + 1]
    if (line?.includes('|') && next && isTableSeparator(next)) {
      const headers = splitTableRow(line)
      const align = getTableAlignment(next)
      const rows = []
      i += 2
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        rows.push(normalizeCells(splitTableRow(lines[i]), headers.length))
        i += 1
      }
      flushMarkdown()
      blocks.push({
        type: 'table',
        headers: normalizeCells(headers, headers.length),
        align: normalizeCells(align, headers.length),
        rows,
      })
      continue
    }

    markdown.push(line)
    i += 1
  }

  flushMarkdown()
  return blocks
}
