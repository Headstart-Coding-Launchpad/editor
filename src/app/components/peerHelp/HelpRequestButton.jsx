import React from 'react'
import DropdownMenu from '../student-modal/DropdownMenu'

/**
 * The student's ✋ Help control. Where peer help is possible it opens a small menu: ask the
 * teacher, or ask the teacher and say a classmate may help too (the opt-in). The teacher still
 * decides whether the work is offered to anyone.
 */
export default function HelpRequestButton({
  requested,
  peerHelpAvailable,
  onAskTeacher,
  onAskWithPeers,
  style,
}) {
  if (requested) {
    return (
      <button
        type="button"
        className="btn-danger"
        style={style}
        disabled
        title="Your teacher has been notified"
        aria-label="Help requested"
      >
        ✋ Help requested
      </button>
    )
  }
  if (!peerHelpAvailable) {
    return (
      <button
        type="button"
        className="btn-ghost"
        style={style}
        onClick={onAskTeacher}
        title="Ask your teacher for help"
        aria-label="Need Help"
      >
        ✋ Help
      </button>
    )
  }
  return (
    <DropdownMenu
      label="✋ Help"
      buttonStyle={style}
      ariaLabel="Need Help"
      title="Ask for help"
      panelStyle={s.panel}
    >
      {(close) => (
        <div style={s.menu}>
          <button
            type="button"
            style={s.option}
            onClick={() => {
              close()
              onAskTeacher()
            }}
          >
            ✋ Ask my teacher
          </button>
          <button
            type="button"
            style={s.option}
            onClick={() => {
              close()
              onAskWithPeers()
            }}
          >
            🤝 Ask my teacher, and a classmate can help too
          </button>
          <span style={s.note}>
            Your teacher checks first. Your name is never shown to the classmate.
          </span>
        </div>
      )}
    </DropdownMenu>
  )
}

const s = {
  panel: { right: 0, left: 'auto', minWidth: 260 },
  // The menu opens from the dark top bar, so its text colour is set here, not inherited.
  menu: { display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--colour-text)' },
  // The dropdown menus' item look (StudentModal's toolBtn).
  option: {
    width: '100%',
    padding: '7px 12px',
    background: 'rgba(98,34,204,0.06)',
    color: 'var(--colour-primary-dark)',
    border: '1px solid rgba(98,34,204,0.18)',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
    whiteSpace: 'normal',
  },
  note: { fontSize: 11, color: 'var(--colour-muted)', padding: '2px 10px 4px' },
}
