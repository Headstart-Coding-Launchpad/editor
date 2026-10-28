// Counts the controls on an activity's default screen the way the layout briefs do (Layout
// briefs 2026-10-28, "How controls are counted"): one control is one thing to decide or press.
// A button, link-button, text box, select or [role=switch|radio|checkbox] counts 1, except that
// everything inside an element marked data-act-control="group" (a chip row, a stepper, a
// segmented switch, the rating grid, the drawing pad) counts 1 for the whole group. Anything
// hidden, aria-hidden or inside a closed fold is left out (closed folds do not render their
// body, so their controls are simply absent).
const SELECTOR =
  'button, input, select, textarea, [role="switch"], [role="radio"], [role="checkbox"]'

const hidden = (el) =>
  !!el.closest('[hidden], [aria-hidden="true"]') || el.getAttribute('type') === 'hidden'

export function countControls(root) {
  const seen = new Set()
  let count = 0
  for (const el of root.querySelectorAll(SELECTOR)) {
    if (hidden(el)) continue
    const group = el.closest('[data-act-control="group"]')
    if (group) {
      if (seen.has(group)) continue
      seen.add(group)
    }
    count += 1
  }
  return count
}
