import TopBar from './TopBar'
import { MAIN_KITS, BLANK_KIT } from '../playgroundKits'

// The Python playground's first screen: "Pick a kit to start". Four kit cards and a Blank page
// button (5 controls), nothing hidden. `carryOnKitId` marks the kit the student used last
// ("Carry on", Blank page too); `onPick(kit)` opens it.
export default function PlaygroundKitChooser({ onPick, carryOnKitId = null }) {
  function card(kit) {
    const carryOn = kit.id === carryOnKitId
    return (
      <button
        key={kit.id}
        type="button"
        data-kit={kit.id}
        style={{ ...s.card, ...(carryOn ? s.cardCarryOn : null) }}
        onClick={() => onPick(kit)}
      >
        {carryOn && <span style={s.carryOn}>Carry on</span>}
        <span style={s.icon} aria-hidden="true">
          {kit.icon}
        </span>
        <span style={s.label}>{kit.label}</span>
        <span style={s.blurb}>{kit.blurb}</span>
      </button>
    )
  }

  return (
    <div style={s.page}>
      <TopBar lessonTitle="Python Playground" isSolo singleRow />
      <main style={s.main}>
        <section style={s.panel} aria-labelledby="kit-chooser-title">
          <h1 id="kit-chooser-title" style={s.title}>
            Pick a kit to start
          </h1>
          <div style={s.grid}>{MAIN_KITS.map(card)}</div>
          <button
            type="button"
            data-kit={BLANK_KIT.id}
            className="btn-ghost-outline"
            style={s.blank}
            onClick={() => onPick(BLANK_KIT)}
          >
            {BLANK_KIT.id === carryOnKitId && <span style={s.blankCarryOn}>Carry on</span>}
            Start with a blank page
          </button>
        </section>
      </main>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#f5f5f5',
  },
  main: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '28px 16px',
    overflowY: 'auto',
  },
  panel: {
    width: 'min(560px, 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 16,
  },
  title: {
    margin: 0,
    textAlign: 'center',
    color: 'var(--colour-primary)',
    fontFamily: 'var(--font-title)',
    fontSize: '1.5rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 14,
  },
  card: {
    position: 'relative',
    minHeight: 132,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: '16px 12px',
    border: '2px solid #ded1f3',
    borderRadius: 'var(--ui-radius, 12px)',
    background: 'var(--ui-surface, #fff)',
    boxShadow: 'var(--ui-shadow)',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    color: 'var(--colour-text)',
  },
  cardCarryOn: { borderColor: 'var(--colour-primary)' },
  carryOn: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: '2px 8px',
    borderRadius: 999,
    background: 'var(--colour-primary)',
    color: '#fff',
    fontSize: '0.72rem',
    fontWeight: 700,
  },
  icon: { fontSize: '2.4rem', lineHeight: 1 },
  label: { fontWeight: 700, fontSize: '1.1rem' },
  blurb: { fontSize: '0.85rem', color: 'var(--colour-muted)', textAlign: 'center' },
  blank: {
    alignSelf: 'center',
    minHeight: 44,
    padding: '8px 22px',
    fontSize: '0.95rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  },
  blankCarryOn: {
    padding: '2px 8px',
    borderRadius: 999,
    background: 'var(--colour-primary)',
    color: '#fff',
    fontSize: '0.72rem',
    fontWeight: 700,
  },
}
