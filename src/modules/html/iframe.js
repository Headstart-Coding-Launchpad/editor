import { rememberPreviewFileName } from './inspector/previewFileNames.js'

// Relays console output to the parent, tagged with the load's id so a runtime error maps to
// its own buildIframeSrc() call (resolveIframeErrorLocation) and stale Runs are ignored.
function buildConsoleInterceptorScript(loadId) {
  return `<script>(function(){
  var __hscLoadId=${JSON.stringify(loadId)};
  function post(level,args,meta){
    try{window.parent.postMessage(Object.assign({source:'hsc-console',level:level,id:__hscLoadId,args:[].slice.call(args).map(function(x){
      if(x===null)return'null';if(x===undefined)return'undefined';
      try{return typeof x==='object'?JSON.stringify(x,null,2):String(x)}catch(e){return'[object]'}
    })},meta||{}),'*')}catch(e){}
  }
  ['log','info','warn','error'].forEach(function(m){
    var o=console[m].bind(console);
    console[m]=function(){o.apply(console,arguments);post(m,arguments)};
  });
  window.addEventListener('error',function(e){post('error',[e.message+(e.lineno?' (line '+e.lineno+')':'')],{filename:e.filename,lineno:e.lineno,colno:e.colno})},true);
  window.addEventListener('unhandledrejection',function(e){post('error',['Unhandled promise: '+(e.reason&&e.reason.message||String(e.reason))])});
})()</script>`
}

// The most recent load's id, so waitForIframeText matches that load's report.
let _lastLoadId = null

// Maps a runtime error in the most recent build back to the student's file and line.
let _lastErrorContext = null

// The preview runs in an opaque origin (sandbox without allow-same-origin), so the parent never
// touches its document. The page reports a snapshot instead (HTML after its scripts ran, input
// values, computed values of the checked style properties); html_* checks read it as `iframeDoc`.
let _lastDoc = null
export const getPreviewDoc = () => _lastDoc

function snapshotDoc({ html = '', styles = [], values = [] }) {
  const doc = new DOMParser().parseFromString('<!DOCTYPE html>' + html, 'text/html')
  const els = Array.from(doc.querySelectorAll('*'))
  els.forEach((el, i) => values[i] != null && (el.value = values[i]))
  const get = (el, p) => styles[els.indexOf(el)]?.[p] ?? ''
  const getComputedStyle = (el) => ({ getPropertyValue: (p) => get(el, p) })
  return Object.defineProperty(doc, 'defaultView', { value: { getComputedStyle } })
}

// Files → a Blob URL for the sandboxed preview: each file is a Blob, the entry's href/src to
// sibling files point at those, `assets` become `assetsPath + path`, `storageAssets` names
// their Firebase Storage URLs.
export function buildIframeSrc(
  files,
  entryFile = 'index.html',
  { assets = [], assetsPath = '', storageAssets = [], copyProtect = false, styleProps = [] } = {}
) {
  if (!files || files.length === 0) return null

  const editableFileNames = new Set(files.map((file) => file.name))
  const staticAssets = assets.filter((assetPath) => !editableFileNames.has(assetPath))
  const filteredStorageAssets = storageAssets.filter((a) => !editableFileNames.has(a.name))
  const resolvedFiles = files.map((file) => ({
    ...file,
    content: rewriteAssetReferences(file, staticAssets, assetsPath, filteredStorageAssets),
  }))

  // Build filename → Blob URL map for editable files
  const blobUrls = {}
  for (const file of resolvedFiles) {
    const mime = getMime(file.type || file.name)
    const blob = new Blob([file.content], { type: mime })
    blobUrls[file.name] = URL.createObjectURL(blob)
    rememberPreviewFileName(blobUrls[file.name], file.name)
  }

  // Find entry HTML file
  const entry =
    resolvedFiles.find((f) => f.name === entryFile) ??
    resolvedFiles.find((f) => f.type === 'html' || f.name.endsWith('.html'))
  if (!entry) return null

  // Rewrite href/src references to other editable files → Blob URLs
  let html = entry.content
  for (const [name, url] of Object.entries(blobUrls)) {
    if (name === entry.name) continue
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    html = html.replace(new RegExp(`(href|src)=["']${escaped}["']`, 'g'), `$1="${url}"`)
  }

  // Inject security (CSP + console interceptor + text reporter)
  const loadId = Math.random().toString(36).slice(2)
  _lastLoadId = loadId
  const injected = _injectSecurity(html, loadId, { copyProtect, styleProps })

  // Return new Blob URL for the rewritten HTML
  const rewrittenBlob = new Blob([injected.html], { type: 'text/html' })
  const src = URL.createObjectURL(rewrittenBlob)
  rememberPreviewFileName(src, entry.name)

  // Other files keep their own line numbers; the entry's live document is `src` (offset by
  // the injected lines), not its pre-injection blob.
  _lastErrorContext = {
    loadId,
    entrySrc: src,
    entryFileName: entry.name,
    entryOffsetLines: injected.offsetLines,
    fileBlobUrls: { ...blobUrls },
  }

  return src
}

function rewriteAssetReferences(file, assets, assetsPath, storageAssets = []) {
  const isHtml = file.type === 'html' || file.name.endsWith('.html')
  const isCss = file.type === 'css' || file.name.endsWith('.css')
  if (!isHtml && !isCss) return file.content

  let content = file.content

  if (assetsPath && assets.length > 0) {
    for (const assetPath of assets) {
      const escaped = assetPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const encodedAssetPath = assetPath.split('/').map(encodeURIComponent).join('/')
      const staticUrl = assetsPath + encodedAssetPath

      if (isHtml) {
        content = content.replace(
          new RegExp(`((?:href|src)\\s*=\\s*["'])${escaped}(["'])`, 'g'),
          `$1${staticUrl}$2`
        )
      }

      content = content.replace(
        new RegExp(`(url\\(\\s*["']?)${escaped}(["']?\\s*\\))`, 'g'),
        `$1${staticUrl}$2`
      )
    }
  }

  for (const { name, url } of storageAssets) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    if (isHtml) {
      content = content.replace(
        new RegExp(`((?:href|src)\\s*=\\s*["'])${escaped}(["'])`, 'g'),
        `$1${url}$2`
      )
    }

    content = content.replace(
      new RegExp(`(url\\(\\s*["']?)${escaped}(["']?\\s*\\))`, 'g'),
      `$1${url}$2`
    )
  }

  return content
}

// True only when a message came from the window of an <iframe> in this page,
// so another window or tab cannot forge the preview's reports.
function isFromPageIframe(source) {
  if (!source) return false
  return Array.from(document.querySelectorAll('iframe')).some((f) => f.contentWindow === source)
}

// Resolves to the page's body text once its reporter fires after DOMContentLoaded (matched
// to the latest buildIframeSrc load), keeping its snapshot for getPreviewDoc; '' on timeout.
export function waitForIframeText(timeout = 1500) {
  const expectedId = _lastLoadId
  _lastDoc = null
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', handler)
      resolve('')
    }, timeout)

    function handler(event) {
      if (
        event.data?.type === '__hsc_text__' &&
        event.data?.id === expectedId &&
        isFromPageIframe(event.source)
      ) {
        clearTimeout(timer)
        window.removeEventListener('message', handler)
        _lastDoc = snapshotDoc(event.data)
        resolve(event.data.text ?? '')
      }
    }

    window.addEventListener('message', handler)
  })
}

function getMime(typeOrName) {
  if (typeOrName === 'html' || typeOrName.endsWith('.html')) return 'text/html'
  if (typeOrName === 'css' || typeOrName.endsWith('.css')) return 'text/css'
  if (typeOrName === 'javascript' || typeOrName.endsWith('.js')) return 'application/javascript'
  return 'text/plain'
}

// A broadcast viewer's copy: no selecting, copying, dragging or right-click. A deterrent only.
const COPY_PROTECT_SNIPPET =
  '<style>*{-webkit-user-select:none!important;user-select:none!important}</style>' +
  "<script>['copy','cut','contextmenu','dragstart'].forEach(function(t){document.addEventListener(t,function(e){e.preventDefault()},true)})</script>"

// Returns { html, offsetLines }: the lines injected ahead of the student's markup.
function _injectSecurity(html, loadId, { copyProtect = false, styleProps = [] } = {}) {
  // CSP blocks outbound requests (fetch, XHR, WebSocket). The page's origin is opaque, so
  // 'self' matches nothing: the app's origin is named for lesson assets. blob: and
  // 'unsafe-inline'/'unsafe-eval' serve the virtual files and typical student code.
  const self = `'self' ${window.location.origin}`
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src ${self}; script-src ${self} 'unsafe-inline' 'unsafe-eval' blob:; style-src ${self} 'unsafe-inline' blob:; connect-src ${self} ws://localhost:5173; img-src ${self} data: blob: https://firebasestorage.googleapis.com;">`
  // Reporter: on DOMContentLoaded (and on '__hsc_snap__') posts the body text (output_contains
  // checks) and the snapshot behind getPreviewDoc and the Inspector's mirror.
  const textReporter = `<script>(function(){var P=${JSON.stringify(styleProps)};var s=function(){try{var e=document.querySelectorAll('*'),st=[],v=[];for(var i=0;i<e.length;i++){var c=getComputedStyle(e[i]),o={};P.forEach(function(p){o[p]=c.getPropertyValue(p)});st.push(o);v.push(/^(INPUT|TEXTAREA|SELECT)$/.test(e[i].tagName)?e[i].value:null)}window.parent.postMessage({type:'__hsc_text__',id:'${loadId}',text:document.body?document.body.innerText:'',html:document.documentElement.outerHTML,styles:st,values:v},'*')}catch(x){}};if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',s)}else{s()}addEventListener('message',function(m){if(m.data==='__hsc_snap__')s()})})()</script>`
  const consoleInterceptor = buildConsoleInterceptorScript(loadId)

  // Inject CSP + console interceptor right after <head> (or prepend if no <head>)
  const headMatch = html.match(/<head[^>]*>/i)
  let offsetLines
  if (headMatch) {
    const injected = csp + consoleInterceptor
    offsetLines = countNewlines(injected)
    const pos = headMatch.index + headMatch[0].length
    html = html.slice(0, pos) + injected + html.slice(pos)
  } else {
    const injected = '<head>' + csp + '</head>' + consoleInterceptor
    offsetLines = countNewlines(injected)
    html = injected + html
  }

  // Inject text reporter (and any copy protection) before </body> (or append if
  // no </body>) — this comes after any student script, so it never shifts a
  // script's own line numbers.
  const tail = textReporter + (copyProtect ? COPY_PROTECT_SNIPPET : '')
  if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, tail + '</body>')
  } else {
    html += tail
  }

  return { html, offsetLines }
}

function countNewlines(str) {
  return (str.match(/\n/g) || []).length
}

// Maps a preview runtime error (loadId = the 'hsc-console' message's id) to the student's
// { file, line }; null for a stale load, unknown file or out-of-range line (no highlight
// beats a wrong one).
export function resolveIframeErrorLocation(loadId, filename, lineno) {
  const ctx = _lastErrorContext
  if (!ctx || !loadId || ctx.loadId !== loadId) return null
  const parsedLine = Number(lineno)
  if (!Number.isFinite(parsedLine) || parsedLine < 1) return null

  if (filename === ctx.entrySrc) {
    const line = parsedLine - ctx.entryOffsetLines
    return line >= 1 ? { file: ctx.entryFileName, line } : null
  }

  for (const [name, url] of Object.entries(ctx.fileBlobUrls)) {
    if (name === ctx.entryFileName) continue // pre-injection blob, never the live document
    if (url === filename) return { file: name, line: parsedLine }
  }

  return null
}

/** Exposed for tests that need the loadId of the most recent buildIframeSrc() call. */
export function getLastLoadId() {
  return _lastLoadId
}
