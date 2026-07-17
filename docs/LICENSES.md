# LICENSES.md — Third-Party Library Licenses

This file lists all third-party open-source libraries used in this project, their versions, and their licenses.

**Maintained rule:** Update this file whenever a library is added, removed, or upgraded to a new major version. See [AGENTS.md](../AGENTS.md) Doc Hygiene section.

---

## License Summary

| License      | Libraries                                                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| MIT          | CodeMirror 6 (all packages), React, React DOM, React Router DOM, react-markdown, rehype-highlight, remark-breaks, js-yaml, Vite, @vitejs/plugin-react, Vitest (+ @vitest/coverage-v8, @vitest/ui), Playwright, Testing Library (React, jest-dom, user-event), jsdom, yargs |
| Apache-2.0   | Firebase, Blockly, firebase-admin                                                                                                            |
| BSD-3-Clause | highlight.js                                                                                                                                 |
| BSD-2-Clause | dotenv                                                                                                                                       |
| MPL-2.0      | Pyodide (CDN)                                                                                                                                |

---

## Production Dependencies (npm)

### CodeMirror 6

| Package | Version | License |
|---|---|---|
| `codemirror` | 6.0.2 | MIT |
| `@codemirror/autocomplete` | 6.20.2 | MIT |
| `@codemirror/commands` | 6.10.3 | MIT |
| `@codemirror/lang-css` | 6.3.1 | MIT |
| `@codemirror/lang-html` | 6.4.11 | MIT |
| `@codemirror/lang-javascript` | 6.2.5 | MIT |
| `@codemirror/lang-python` | 6.2.1 | MIT |
| `@codemirror/language` | 6.12.3 | MIT |
| `@codemirror/state` | 6.6.0 | MIT |
| `@codemirror/view` | 6.43.0 | MIT |

Homepage: https://codemirror.net/
License text: https://github.com/codemirror/codemirror/blob/main/LICENSE

---

### React

| Package | Version | License |
|---|---|---|
| `react` | 18.3.1 | MIT |
| `react-dom` | 18.3.1 | MIT |

Homepage: https://reactjs.org/
License text: https://github.com/facebook/react/blob/main/LICENSE

---

### React Router

| Package | Version | License |
|---|---|---|
| `react-router-dom` | 6.30.3 | MIT |

Homepage: https://reactrouter.com/
License text: https://github.com/remix-run/react-router/blob/main/LICENSE.md

---

### Firebase

| Package | Version | License |
|---|---|---|
| `firebase` | 10.14.1 | Apache-2.0 |

Homepage: https://firebase.google.com/
License text: https://github.com/firebase/firebase-js-sdk/blob/master/LICENSE

---

### Blockly / scratch-blocks

| Package | Version | License |
|---|---|---|
| `blockly` | 12.5.1 | Apache-2.0 |

Blockly homepage: https://developers.google.com/blockly/
License text: https://github.com/google/blockly/blob/master/LICENSE

---

### Markdown rendering

| Package | Version | License |
|---|---|---|
| `react-markdown` | 9.1.0 | MIT |
| `rehype-highlight` | 7.0.2 | MIT |
| `remark-breaks` | 4.0.0 | MIT |

react-markdown: https://github.com/remarkjs/react-markdown
rehype-highlight: https://github.com/rehypejs/rehype-highlight
remark-breaks: https://github.com/remarkjs/remark-breaks

---

### highlight.js

| Package | Version | License |
|---|---|---|
| `highlight.js` | 11.11.1 | BSD-3-Clause |

Homepage: https://highlightjs.org/
License text: https://github.com/highlightjs/highlight.js/blob/main/LICENSE

---

### js-yaml

| Package | Version | License |
|---|---|---|
| `js-yaml` | 4.1.0 | MIT |

Used for lesson/topic/report YAML conversion (`src/shared/lessonReport.js`, `cli/yaml-converter.mjs`).

Homepage: https://github.com/nodeca/js-yaml
License text: https://github.com/nodeca/js-yaml/blob/master/LICENSE

---

## Dev Dependencies (npm)

| Package | Version | License |
|---|---|---|
| `vite` | 5.4.21 | MIT |
| `@vitejs/plugin-react` | 4.7.0 | MIT |
| `vitest` | 4.1.7 | MIT |
| `@vitest/coverage-v8` | 4.1.7 | MIT |
| `@vitest/ui` | 4.1.7 | MIT |
| `@playwright/test` | 1.60.0 | Apache-2.0 |
| `@testing-library/react` | 16.3.2 | MIT |
| `@testing-library/jest-dom` | 6.9.1 | MIT |
| `@testing-library/user-event` | 14.6.1 | MIT |
| `jsdom` | 29.1.1 | MIT |

Vite homepage: https://vite.dev/
License text: https://github.com/vitejs/vite/blob/main/LICENSE

Vitest homepage: https://vitest.dev/ · Playwright homepage: https://playwright.dev/ · Testing Library homepage: https://testing-library.com/

---

## CLI Sub-package (`cli/package.json`)

The `cli/` sub-package is a separate Node.js package (`npm install` run inside `cli/`), not part of the root app bundle.

| Package | Version | License |
|---|---|---|
| `firebase-admin` | 13.10.0 | Apache-2.0 |
| `js-yaml` | 4.1.0 | MIT |
| `yargs` | 17.7.2 | MIT |
| `dotenv` | 16.4.5 | BSD-2-Clause |

firebase-admin homepage: https://github.com/firebase/firebase-admin-node
yargs homepage: https://yargs.js.org/
dotenv homepage: https://github.com/motdotla/dotenv

---

## Runtime CDN Dependencies

These libraries are loaded at runtime from a CDN and are not installed via npm.

### Pyodide

| | |
|---|---|
| **Version** | 0.26.4 |
| **License** | Mozilla Public License 2.0 (MPL-2.0) |
| **Loaded from** | `https://cdn.jsdelivr.net/pyodide/v0.26.4/full/` |
| **Usage** | Python execution in a Web Worker (`src/modules/python/pyodide.worker.js`) |

Homepage: https://pyodide.org/
License text: https://github.com/pyodide/pyodide/blob/main/LICENSE

---

*Last updated: July 2026*
