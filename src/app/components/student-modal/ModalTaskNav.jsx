import TipButton from '../TipButton'

// Prev/next arrows and the "n/total" counter at the left of the Student View Modal header.
// Fixed width (2 x 30 buttons + 44 count) so the arrows never move with the student's name.
export default function ModalTaskNav({ hasPrev, hasNext, onPrev, onNext, position, total }) {
  return (
    <div style={styles.nav} data-testid="student-modal-nav">
      <TipButton
        style={{ ...styles.btn, opacity: hasPrev ? 1 : 0.35 }}
        disabled={!hasPrev}
        onClick={onPrev}
        label="Previous student"
      >
        ‹
      </TipButton>
      {position != null && total != null && (
        <span style={styles.count}>
          {position}/{total}
        </span>
      )}
      <TipButton
        style={{ ...styles.btn, opacity: hasNext ? 1 : 0.35 }}
        disabled={!hasNext}
        onClick={onNext}
        label="Next student"
      >
        ›
      </TipButton>
    </div>
  )
}

const styles = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    width: 104,
    justifyContent: 'center',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  btn: {
    width: 30,
    height: 34,
    border: 'none',
    background: 'transparent',
    color: '#fff',
    fontSize: 18,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  count: { fontWeight: 600, fontSize: 12.5, width: 44, textAlign: 'center' },
}
