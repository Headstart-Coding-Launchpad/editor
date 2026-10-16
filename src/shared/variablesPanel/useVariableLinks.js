import { useState } from 'react'
import { getVariableLinks, linkFor } from './links.js'
import { getShowVariables } from './variablesPanel.js'

/**
 * Linked name tags for a workspace that shows the name-tag panel beside the code editor
 * (showVariables.link; ./links.js). Builds the links from the task and the run the panel shows,
 * and keeps which one is active: a tag the student is hovering, focusing or tapping wins over
 * the variable they point at in the code. Returns the props for both sides:
 * - `panel`: `{ links, activeLink, onLinkActive }` for TaskVariablesPanel / NameTagPanel
 * - `editor`: `{ links, active, onActive }` for the CodeEditor's `variableLinks`, or null
 * `enabled: false` (a view with no panel) links nothing.
 */
export function useVariableLinks(task, run, { enabled = true } = {}) {
  const [panelActive, setPanelActive] = useState(null)
  const [codeActive, setCodeActive] = useState(null)
  const links = enabled ? getVariableLinks(getShowVariables(task), run) : []
  const active = linkFor(links, panelActive ?? codeActive)?.name ?? null
  return {
    links,
    panel: { links, activeLink: active, onLinkActive: setPanelActive },
    editor: links.length > 0 ? { links, active, onActive: setCodeActive } : null,
  }
}
