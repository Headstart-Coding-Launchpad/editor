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
// touches its document. A build with `snapshot` has the page report one (HTML after its scripts,
// each element tagged with its index, input values, computed values of `styleProps`), on
// DOMContentLoaded and again on load; html_* checks read it as `iframeDoc` (getPreviewDoc(src)).
let _lastSrc = null
const _docs = new Map()
export const getPreviewDoc = (src) => _docs.get(src) ?? null

function snapshotDoc({ html, styles, values }) {
  if (typeof html !== 'string') return null
  const doc = new DOMParser().parseFromString('<!DOCTYPE html>' + html, 'text/html')
  const style = new Map()
  for (const el of doc.querySelectorAll('[data-hsc-i]')) {
    const i = Number(el.getAttribute('data-hsc-i'))
    el.removeAttribute('data-hsc-i')
    style.set(el, (Array.isArray(styles) && styles[i]) || {})
    if (Array.isArray(values) && values[i] != null) el.value = values[i]
  }
  const getComputedStyle = (el) => ({ getPropertyValue: (p) => style.get(el)?.[p] ?? '' })
  return Object.defineProperty(doc, 'defaultView', { value: { getComputedStyle } })
}

const safeSnapshotDoc = (data) => {
  try {
    return snapshotDoc(data ?? {})
  } catch {
    return null
  }
}

// The Inspector's script-less same-origin copy: the student's CSP/refresh/base tags (and noscript,
// never shown live) go and the app's CSP comes first, so it loads nothing the preview couldn't.
export function snapshotMirrorHtml(data) {
  const doc = safeSnapshotDoc(data)
  doc?.querySelectorAll('meta[http-equiv], base, noscript').forEach((el) => el.remove())
  return doc && `<!DOCTYPE html>${cspMeta()}${doc.documentElement.outerHTML}`
}

// Files → a Blob URL for the sandboxed preview: each file is a Blob, the entry's href/src to
// sibling files point at those, `assets` become `assetsPath + path`, `storageAssets` names
// their Firebase Storage URLs.
export function buildIframeSrc(
  files,
  entryFile = 'index.html',
  { assets = [], assetsPath = '', storageAssets = [], copyProtect, styleProps = [], snapshot } = {}
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
    // A data: URL: the opaque-origin page cannot load the app's own blob: URLs.
    blobUrls[file.name] = `data:${mime};charset=utf-8,${encodeURIComponent(file.content)}`
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
  const injected = _injectSecurity(html, loadId, { copyProtect, styleProps, snapshot })

  // Return new Blob URL for the rewritten HTML
  const rewrittenBlob = new Blob([injected.html], { type: 'text/html' })
  const src = URL.createObjectURL(rewrittenBlob)
  _lastSrc = src
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

// Asset names → URLs in the file's href/src attributes (HTML) and url(...) values (HTML, CSS).
function rewriteAssetReferences(file, assets, assetsPath, storageAssets = []) {
  const isHtml = file.type === 'html' || file.name.endsWith('.html')
  if (!isHtml && file.type !== 'css' && !file.name.endsWith('.css')) return file.content
  const staticUrl = (path) => assetsPath + path.split('/').map(encodeURIComponent).join('/')
  const targets = [
    ...(assetsPath ? assets.map((path) => ({ name: path, url: staticUrl(path) })) : []),
    ...storageAssets,
  ]
  let content = file.content
  for (const { name, url } of targets) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const attr = new RegExp(`((?:href|src)\\s*=\\s*["'])${escaped}(["'])`, 'g')
    const cssUrl = new RegExp(`(url\\(\\s*["']?)${escaped}(["']?\\s*\\))`, 'g')
    if (isHtml) content = content.replace(attr, `$1${url}$2`)
    content = content.replace(cssUrl, `$1${url}$2`)
  }
  return content
}

// True only when a message came from the window of an <iframe> in this page,
// so another window or tab cannot forge the preview's reports.
function isFromPageIframe(source) {
  if (!source) return false
  return Array.from(document.querySelectorAll('iframe')).some((f) => f.contentWindow === source)
}

// Resolves to the page's body text from its latest report for the latest buildIframeSrc load
// (the load-time one, or whatever came before the timeout; '' if none), keeping its snapshot.
export function waitForIframeText(timeout = 1500) {
  const expectedId = _lastLoadId
  const src = _lastSrc
  return new Promise((resolve) => {
    let latest = null
    const timer = setTimeout(finish, timeout)
    function finish() {
      clearTimeout(timer)
      window.removeEventListener('message', handler)
      _docs.delete(src)
      _docs.set(src, safeSnapshotDoc(latest))
      if (_docs.size > 8) _docs.delete(_docs.keys().next().value)
      resolve(typeof latest?.text === 'string' ? latest.text : '')
    }
    function handler(event) {
      const data = event.data
      if (data?.type !== '__hsc_text__' || data.id !== expectedId) return
      if (!isFromPageIframe(event.source)) return
      latest = data
      if (data.final) finish()
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

// CSP blocks outbound requests (fetch, XHR, WebSocket). The page's origin is opaque, so 'self'
// matches nothing: the app's origin is named for lesson assets. blob:/data: and
// 'unsafe-inline'/'unsafe-eval' serve the virtual files and typical student code.
function cspMeta() {
  const self = `'self' ${window.location.origin}`
  return `<meta http-equiv="Content-Security-Policy" content="default-src ${self}; script-src ${self} 'unsafe-inline' 'unsafe-eval' blob: data:; style-src ${self} 'unsafe-inline' blob: data:; connect-src ${self} ws://localhost:5173; img-src ${self} data: blob: https://firebasestorage.googleapis.com;">`
}

// The page's report: body text (output_contains checks) on DOMContentLoaded, on load (`final`)
// and on '__hsc_snap__'; with `snapshot`, also what snapshotDoc needs.
function reporterScript(loadId, styleProps, snapshot) {
  const snap = `var e=document.querySelectorAll('*'),c=document.documentElement.cloneNode(true),k=[c].concat([].slice.call(c.querySelectorAll('*'))),st=[],v=[];for(var i=0;i<e.length;i++){var g=getComputedStyle(e[i]),o={};P.forEach(function(p){o[p]=g.getPropertyValue(p)});st.push(o);v.push(/^(INPUT|TEXTAREA|SELECT)$/.test(e[i].tagName)?e[i].value:null);if(k[i])k[i].setAttribute('data-hsc-i',i)}m.html=c.outerHTML;m.styles=st;m.values=v;`
  return `<script>(function(){var P=${JSON.stringify(styleProps)};var s=function(f){try{var m={type:'__hsc_text__',id:'${loadId}',final:f,text:document.body?document.body.innerText:''};${snapshot ? snap : ''}window.parent.postMessage(m,'*')}catch(x){}};document.addEventListener('DOMContentLoaded',function(){s(false)});addEventListener('load',function(){s(true)});addEventListener('message',function(m){if(m.data==='__hsc_snap__')s(true)})})()</script>`
}

// Returns { html, offsetLines }: the lines injected ahead of the student's markup.
function _injectSecurity(html, loadId, { copyProtect, styleProps = [], snapshot } = {}) {
  const csp = cspMeta()
  const textReporter = reporterScript(loadId, styleProps, snapshot)
  const consoleInterceptor = buildConsoleInterceptorScript(loadId)

  // CSP + console interceptor right after <head> (or a new <head> first); the reporter (and any
  // copy protection) before </body>, after every student script, so no line numbers shift.
  const headMatch = html.match(/<head[^>]*>/i)
  const head = headMatch ? csp + consoleInterceptor : `<head>${csp}</head>${consoleInterceptor}`
  const pos = headMatch ? headMatch.index + headMatch[0].length : 0
  html = html.slice(0, pos) + head + html.slice(pos)
  const tail = textReporter + (copyProtect ? COPY_PROTECT_SNIPPET : '')
  html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, tail + '</body>') : html + tail
  return { html, offsetLines: (head.match(/\n/g) || []).length }
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
