import React from 'react'
import StudentView from '../../app/views/StudentView'

export default function PreviewView({ lesson, onClose, initialTaskId = null }) {
  return (
    <div style={s.page}>
      <div style={s.banner}>
        <span style={s.bannerText}>This is a preview — changes are not saved</span>
        <button className="btn-secondary" style={s.backBtn} onClick={onClose}>
          Go back to Builder
        </button>
      </div>
      <div style={s.studentWrap}>
        <StudentView lesson={lesson} soloMode allowUnrestrictedTaskNavigation initialTaskId={initialTaskId} />
      </div>
    </div>
  )
}

const s = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  banner: {
    background: 'var(--colour-secondary)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    height: 40,
    flexShrink: 0,
    gap: 12,
  },
  bannerText: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
  },
  backBtn: {
    fontSize: 13,
    padding: '4px 14px',
    background: 'rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,255,255,0.4)',
    color: '#fff',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    cursor: 'pointer',
  },
  studentWrap: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
}
