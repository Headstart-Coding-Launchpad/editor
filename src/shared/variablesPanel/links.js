// Linked name tags (a task's `showVariables.link`, on by default): each tag the panel shows and
// that variable's name in the code editor share a colour AND a small number, so a student can
// match the `small` tag to the `small` on line 3 without reading every name (never colour
// alone, for colour-blind students and projectors). Pure and Node-safe: the workspaces build
// the links once and hand them to the panel (NameTagPanel.jsx) and the editor
// (../variableLinksEditor.js).
import { VARIABLE_NAME_PATTERN, currentSnapshot, visibleVars } from './variablesPanel.js'

// Six clearly different colours, each dark enough for white text on the tag's number badge.
// Up to 3 predicted tags is the authoring norm, so six covers a task's tags with room to spare.
export const VARIABLE_LINK_COLOURS = Object.freeze([
  '#0b63c4', // blue
  '#c2410c', // orange
  '#047857', // green
  '#be185d', // pink
  '#6d28d9', // purple
  '#8a5a00', // brown
])

export const MAX_VARIABLE_LINKS = VARIABLE_LINK_COLOURS.length

/**
 * The linked tags, in the panel's order: `[{ name, number (1–6), colour }]`. Featured tags come
 * first (predict mode's `predict` names, target mode's target names), then the other variables
 * the shown run left (view mode has tags only after a run). At most six; later tags are not
 * linked. Empty when the task has no panel or turns `link` off.
 * - `config`: getShowVariables(task)
 * - `run`: the run state the panel shows (panelRunForTask), or null before any run
 */
export function getVariableLinks(config, run = null) {
  if (!config || config.link === false) return []
  const featured =
    config.mode === 'predict'
      ? config.predict
      : config.mode === 'target'
        ? Object.keys(config.target ?? {})
        : []
  const names = []
  const add = (name) => {
    if (typeof name !== 'string' || !VARIABLE_NAME_PATTERN.test(name)) return
    if (names.includes(name) || names.length >= MAX_VARIABLE_LINKS) return
    names.push(name)
  }
  featured.forEach(add)
  for (const entry of visibleVars(currentSnapshot(run), config.hide)) add(entry.n)
  return names.map((name, index) => ({
    name,
    number: index + 1,
    colour: VARIABLE_LINK_COLOURS[index],
  }))
}

/** The link for `name` in a getVariableLinks list, or null. */
export function linkFor(links, name) {
  return (Array.isArray(links) ? links : []).find((link) => link.name === name) ?? null
}

/** A stable key for a links list (callers rebuild it each render; the editor compares keys). */
export function variableLinksKey(links) {
  return (Array.isArray(links) ? links : []).map((link) => link.name).join(',')
}
