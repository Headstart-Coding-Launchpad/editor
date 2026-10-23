// Turns a world pack's parts.json (Lesson Gen's art, copied to public/station/<world>/) into the
// plain data the station model uses: spots, parts, the catalogue order and, for the zoo, the
// enclosures. Node-safe: no JSX or DOM; art file paths live in ../art.js, never here.

const SCENE_W = 1600
const SCENE_H = 1000

const words = (slug) => {
  const text = String(slug).replace(/-/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const frozenSpot = (s) =>
  Object.freeze({
    id: s.id,
    x: s.x,
    y: s.y,
    w: s.w,
    h: s.h,
    cells: Object.freeze([...s.cells]),
    accepts: Object.freeze([...s.accepts]),
  })

// The pack's `file` ("ice-polar-bear.png") is the part id; its kind prefix is dropped for the label.
function frozenPart(p, lesson) {
  const id = p.file.replace(/\.png$/, '')
  const label = words(id.startsWith(`${p.kind}-`) ? id.slice(p.kind.length + 1) : id)
  return Object.freeze({
    id,
    label,
    kind: p.kind,
    lesson,
    cells: Object.freeze([...p.cells]),
    canHang: p.canHang === true,
    best: p.best === true,
    order: p.catalogueOrder ?? null,
  })
}

// A box in the pack is in pixels of the 1600 x 1000 picture; the model uses 0-1 fractions.
const fractionBox = (b) => ({
  x: b.x / SCENE_W,
  y: b.y / SCENE_H,
  w: b.w / SCENE_W,
  h: b.h / SCENE_H,
})

// `enclosureLabels` names each enclosure kind; `lesson` is the Mouse and Keyboard lesson the world
// belongs to (the zoo is Lesson 3's drag, the toy shop Lesson 4's scroll).
export function worldFromPack(id, label, pack, { lesson, enclosureLabels = {} }) {
  const spots = Object.freeze(pack.spots.map(frozenSpot))
  const parts = Object.freeze(pack.parts.map((p) => frozenPart(p, lesson)))
  // Parts in catalogue order (the toy shop's best toy last), else in the pack's order.
  const catalogue = Object.freeze(
    [...parts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((p) => p.id)
  )
  const enclosures = Object.freeze(
    (pack.enclosures ?? []).map((e) =>
      Object.freeze({
        kind: e.kind,
        label: enclosureLabels[e.kind] ?? words(e.kind),
        box: Object.freeze(fractionBox(e.box)),
      })
    )
  )
  return Object.freeze({
    id,
    label,
    lessons: Object.freeze([lesson]),
    spots,
    parts,
    catalogue,
    enclosures,
    best: parts.find((p) => p.best)?.id ?? null,
  })
}
