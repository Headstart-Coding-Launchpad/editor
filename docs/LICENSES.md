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
| CC0 / public domain | Image Lab pictures (`public/image-lab/`, see below) |
| Matplotlib License (PSF-based) | matplotlib (Pyodide package from the CDN, loaded only when a program imports it), with its Pyodide dependencies (numpy, Pillow, fonttools, kiwisolver, …; BSD / MIT style) |

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

### matplotlib (Pyodide package)

| | |
|---|---|
| **Version** | as shipped with Pyodide 0.26.4 |
| **License** | Matplotlib License (PSF-based, BSD-compatible); its bundled DejaVu fonts under the Bitstream Vera / DejaVu licence |
| **Loaded from** | `https://cdn.jsdelivr.net/pyodide/v0.26.4/full/` with `pyodide.loadPackage`, only when a student's program imports matplotlib |
| **Usage** | Real charts on the Python Stage (`src/shared/stage/charts.js`, `chartsPy.js`) |

Homepage: https://matplotlib.org/
License text: https://matplotlib.org/stable/project/license.html

---

## Image Lab pictures (`public/image-lab/`)

The Python Stage's picture library (`load_image()`, [stage.md](authoring/stage.md#10-image-lab-pictures-are-lists)).
Every photo is public domain or CC0, from Wikimedia Commons (most of them NASA, U.S. government or
author-released works), cropped and shrunk to 64 × 64. The pixel art and the green-screen
astronaut were drawn for Headstart Coding and are released as CC0. `public/image-lab/manifest.json`
holds the same list. No attribution is required for any of them; it is kept here so each source
can be checked.

| Picture | Author | Licence | Source |
|---|---|---|---|
| `fox` | U.S. Fish and Wildlife Service | Public domain | https://commons.wikimedia.org/wiki/File:Red_fox_face_mammal_vulpes_vulpes.jpg |
| `tiger` | Dcoetzee | CC0 | https://commons.wikimedia.org/wiki/File:Orange_bengal_tiger_at_Cougar_Mountain_Zoological_Park_headshot_2.jpg |
| `parrot` | Adrian Pingstone | Public domain | https://commons.wikimedia.org/wiki/File:Parrot.red.macaw.1.arp.750pix.jpg |
| `frog` | Careyjamesbalboa (Carey James Balboa) | Public domain | https://commons.wikimedia.org/wiki/File:Red_eyed_tree_frog_edit2.jpg |
| `jellyfish` | Miguel Angel Omaña Rojas | CC0 | https://commons.wikimedia.org/wiki/File:Jellyfish_from_Corpus_Christi.jpg |
| `earth` | Harrison Schmitt / Apollo 17 | Public domain | https://commons.wikimedia.org/wiki/File:The_Blue_Marble,_AS17-148-22727.jpg |
| `moon` | NASA/JPL/USGS | Public domain | https://commons.wikimedia.org/wiki/File:Full_moon.jpeg |
| `saturn` | NASA / JPL-Caltech / SSI / color composite by Gordan Ugarkovic | Public domain | https://commons.wikimedia.org/wiki/File:Saturn_global_view_from_Cassini,_rings_open_Better_Colour.png |
| `mars` | NASA and The Hubble Heritage Team (STScI/AURA) | Public domain | https://commons.wikimedia.org/wiki/File:Mars_Hubble.jpg |
| `rocket` | NASA | Public domain | https://commons.wikimedia.org/wiki/File:Space_Shuttle_Columbia_launching.jpg |
| `car` | Leon Brooks | Public domain | https://commons.wikimedia.org/wiki/File:Red_sports_coupe_car.jpg |
| `eiffel_tower` | Benh LIEU SONG | Public domain | https://commons.wikimedia.org/wiki/File:Tour_Eiffel_Wikimedia_Commons.jpg |
| `pyramids` | Walkerssk | CC0 | https://commons.wikimedia.org/wiki/File:Pyramids_in_Giza_-_Egypt.jpg |
| `pizza` | Kurt Kaiser | CC0 | https://commons.wikimedia.org/wiki/File:Pizza_14.jpg |
| `strawberries` | Kimberly Lewers | Public domain | https://commons.wikimedia.org/wiki/File:Strawberries_(Image_Number_D1194-1)_by_Kimberly_Lewers.jpg |
| `donut` | Evan-Amos | Public domain | https://commons.wikimedia.org/wiki/File:Dunkin-Donuts-Chocolate-Sprinkled.jpg |
| `moon_surface` | Eugene A. Cernan (NASA), photomontage by User:Grunpfnul; cropped to the right-hand side, no astronaut | Public domain | https://commons.wikimedia.org/wiki/File:Apollo_17_Harrison_H._Schmitt_and_Tracy%27s_Rock_-_AS17-140-21493%2BAS17-140-21497_2025.jpg |
| `mars_surface` | NASA/JPL-Caltech/MSSS | Public domain | https://commons.wikimedia.org/wiki/File:NASA%E2%80%99s_Curiosity_Views_a_Sand-Capped_Butte_(PIA26730).png |
| `nebula` | NASA | Public domain | https://commons.wikimedia.org/wiki/File:A_New_View_of_the_Tarantula_Nebula.jpg |
| `beach` | Willem V | CC0 | https://commons.wikimedia.org/wiki/File:Another_Day_At_The_Beach_(250445667).jpeg |
| `astronaut_green` | Headstart Coding | CC0 | Drawn for Headstart Coding (Image Lab build script) |
| `pixel_fox` | Headstart Coding | CC0 | Drawn for Headstart Coding (Image Lab build script) |
| `alien` | Headstart Coding | CC0 | Drawn for Headstart Coding (Image Lab build script) |
| `spaceship` | Headstart Coding | CC0 | Drawn for Headstart Coding (Image Lab build script) |
| `robot` | Headstart Coding | CC0 | Drawn for Headstart Coding (Image Lab build script) |
| `gem` | Headstart Coding | CC0 | Drawn for Headstart Coding (Image Lab build script) |
| `sword` | Headstart Coding | CC0 | Drawn for Headstart Coding (Image Lab build script) |

---

*Last updated: October 2026*
