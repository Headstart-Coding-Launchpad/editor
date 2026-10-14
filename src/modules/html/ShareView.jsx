// Read-only share viewer (`/share/:id`) for an HTML task: a sandboxed preview (scripts run, but
// the page can't reach the app: no same-origin) and the project's files.
import { useMemo, useState } from 'react'
import { ShareCode, SharePanel, shareStyles } from '../../shared/exportWork/ShareParts.jsx'
import { inlineHtmlFiles } from './inlineHtml.js'

function languageFor(name) {
  return /\.html?$/i.test(name) ? 'html' : /\.css$/i.test(name) ? 'css' : 'javascript'
}

export default function HtmlShareView({ payload }) {
  const files = useMemo(() => payload?.files ?? [], [payload])
  const page = useMemo(() => inlineHtmlFiles(files, payload?.entryFile), [files, payload])
  const [active, setActive] = useState(files[0]?.name ?? '')
  const activeFile = files.find((file) => file.name === active) ?? files[0]

  return (
    <div style={shareStyles.grid}>
      {page != null && (
        <SharePanel title="Preview">
          <iframe
            title="Preview"
            sandbox="allow-scripts"
            srcDoc={page}
            style={s.frame}
            referrerPolicy="no-referrer"
          />
        </SharePanel>
      )}
      <div>
        {files.length > 1 && (
          <div role="tablist" aria-label="Files" style={s.tabs}>
            {files.map((file) => (
              <button
                key={file.name}
                role="tab"
                aria-selected={file.name === activeFile?.name}
                className={`ui-tab${file.name === activeFile?.name ? ' is-active' : ''}`}
                onClick={() => setActive(file.name)}
              >
                {file.name}
              </button>
            ))}
          </div>
        )}
        {activeFile && (
          <ShareCode
            code={activeFile.content}
            language={languageFor(activeFile.name)}
            title={activeFile.name}
          />
        )}
      </div>
    </div>
  )
}

const s = {
  frame: {
    width: '100%',
    height: '60vh',
    minHeight: 320,
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: '#fff',
  },
  tabs: { display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
}
