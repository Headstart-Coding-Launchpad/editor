import { createPortal } from 'react-dom'

// The ring drawn over a highlighted control (./useControlHighlight.js). Portalled to <body> and
// click-through, so it never covers or blocks the control. CSS: .control-highlight-ring in
// src/index.css (a gentle finite pulse; a still outline under reduced motion). `announce` is
// read out once to screen readers, e.g. "Your tutor is pointing at the Green flag".
const PAD = 5

export default function ControlHighlightRing({ ring, announce }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <>
      {ring && (
        <div
          aria-hidden="true"
          data-testid="control-highlight-ring"
          className={`control-highlight-ring${ring.kind === 'reveal' ? ' control-highlight-ring--reveal' : ''}`}
          style={{
            left: ring.rect.left - PAD,
            top: ring.rect.top - PAD,
            width: ring.rect.right - ring.rect.left + PAD * 2,
            height: ring.rect.bottom - ring.rect.top + PAD * 2,
          }}
        />
      )}
      <div role="status" aria-live="polite" style={srOnly}>
        {announce ?? ''}
      </div>
    </>,
    document.body
  )
}

const srOnly = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}
