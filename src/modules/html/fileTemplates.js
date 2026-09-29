// HTML file templates and file-type helpers shared by the Builder's file manager, the sandbox
// starter editor and the module's authoring hooks. Node-safe.

// The `type` of an HTML file in a task's `starterFiles` / `completeFiles` (a file type, not a
// lesson type; CSS files are 'css' and scripts 'javascript').
export const HTML_FILE_TYPE = 'html'

export function isHtmlFileType(file) {
  return file?.type === HTML_FILE_TYPE
}

// Files the entry-file picker offers: HTML by type or by name.
export function isHtmlEntryCandidate(file) {
  return isHtmlFileType(file) || file.name.endsWith('.html')
}

export const HTML_ONLY = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Page</title>
</head>
<body>

</body>
</html>`

export const HTML_WITH_CSS = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Page</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>

</body>
</html>`

export const HTML_WITH_CSS_JS = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Page</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>

  <script src="script.js"></script>
</body>
</html>`
