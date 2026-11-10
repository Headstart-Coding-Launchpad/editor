import { useEffect, useRef } from 'react'
import CopyCodePanel from '../CopyCodePanel'
import SupportStagePanel from '../SupportStagePanel'
import { chooseChangeBase } from '../../../shared/stageChange'
import { starterCodeOf } from '../../../modules/moduleContract'
import { getModuleDefinition } from '../../../modules/definitions'
import { useLatestRef } from '../../hooks/useLatestRef'
import { formatCanSeeTime } from './studentCanSee'

// The StudentModal's "Student can see" strip (sketch OK'd 10 Nov 2026): one line under the action
// buttons with up to three fixed items (studentCanSee): Copy code, the Support stage on the
// student's screen and Complete. Green = the student can see it, dashed grey = not. A green item
// opens a read-only preview of exactly what the student sees: the Type this out box, or the stage
// reference (with a Support change view against the student's own code). Tutor-only; it reads
// logged data and never writes. The modal owns `openKey` so Escape closes the preview first.

function itemText(item) {
  const time = formatCanSeeTime(item.at)
  const who = item.by === 'tutor' ? 'revealed by you' : 'opened by student'
  const detail = time ? `${who} ${time}` : who
  if (item.key === 'copy') return { main: `Copy code: ${item.on ? 'on' : 'off'}` }
  if (item.key === 'support') {
    return item.on ? { main: `Support ${item.number}`, detail } : { main: 'Support: none' }
  }
  return item.on ? { main: 'Complete', detail } : { main: 'Complete: closed' }
}

const OFF_TITLES = {
  copy: 'The student has no Type this out code on this task',
  support: 'The student has not opened a Support stage on this task',
  complete: 'The student has not opened the Complete code on this task',
}

export default function CanSeeStrip({
  items,
  studentName,
  task,
  lessonType,
  studentCode,
  copyCode,
  openKey,
  onOpenChange,
}) {
  const rootRef = useRef(null)
  const onOpenChangeRef = useLatestRef(onOpenChange)

  // A click anywhere else closes the preview.
  useEffect(() => {
    if (!openKey) return undefined
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) onOpenChangeRef.current(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [openKey, onOpenChangeRef])

  if (!items.length) return null
  const open = items.find((item) => item.key === openKey && item.on) ?? null

  return (
    <div ref={rootRef} style={s.strip} data-testid="student-can-see-strip">
      <span style={s.label}>Student can see</span>
      {items.map((item) => {
        const { main, detail } = itemText(item)
        const isOpen = open?.key === item.key
        return (
          <button
            key={item.key}
            type="button"
            style={item.on ? (isOpen ? s.itemOpen : s.itemOn) : s.itemOff}
            disabled={!item.on}
            aria-expanded={item.on ? isOpen : undefined}
            title={item.on ? 'Preview what the student sees (read-only)' : OFF_TITLES[item.key]}
            data-testid={`can-see-${item.key}`}
            onClick={() => onOpenChange(isOpen ? null : item.key)}
          >
            {main}
            {detail && <span style={s.detail}>{detail}</span>}
          </button>
        )
      })}
      <span style={s.spacer} />
      {items.some((item) => item.on) && <span style={s.note}>click an item to preview</span>}
      {open && (
        <div
          style={s.popover}
          className="ui-popover"
          role="dialog"
          aria-label="What the student sees"
          data-testid="can-see-preview"
        >
          <div style={s.popoverHeader}>
            <span>
              {open.key === 'copy'
                ? 'Copy code'
                : open.key === 'support'
                  ? `Support stage ${open.number}`
                  : 'Complete'}{' '}
              - what {studentName} sees
            </span>
            <span style={s.readOnly}>Read-only</span>
          </div>
          <div style={s.popoverBody}>
            {open.key === 'copy' ? (
              <CopyCodePanel
                code={copyCode}
                language={getModuleDefinition(lessonType)?.meta?.language ?? 'python'}
                after={task?.copyAfter}
                before={task?.copyBefore}
                starter={starterCodeOf(task)}
              />
            ) : (
              <SupportStagePanel
                // A fresh panel per stage: the change view reads its base once, on reveal.
                key={`${task?.id}:${open.stageIndex}`}
                stage={open.stage}
                lessonType={lessonType}
                revealed
                changeBase={chooseChangeBase(
                  typeof studentCode === 'string' ? studentCode : '',
                  starterCodeOf(task)
                )}
              />
            )}
          </div>
          <div style={s.popoverFoot}>Same view the student has. Esc closes.</div>
        </div>
      )}
    </div>
  )
}

const pill = {
  height: 26,
  boxSizing: 'border-box',
  borderRadius: 999,
  padding: '0 11px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  flexShrink: 0,
  fontFamily: 'var(--font-body)',
  fontSize: 12.5,
  fontWeight: 700,
  whiteSpace: 'nowrap',
}

const s = {
  strip: {
    position: 'relative',
    height: 36,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 12px',
    background: '#faf7ff',
    borderBottom: '1px solid #e6e0f0',
    fontFamily: 'var(--font-body)',
  },
  label: {
    flexShrink: 0,
    fontSize: 12.5,
    fontWeight: 700,
    color: 'var(--colour-primary)',
    marginRight: 2,
  },
  itemOn: {
    ...pill,
    border: '1px solid #86efac',
    background: '#f0fdf4',
    color: '#166534',
    cursor: 'pointer',
  },
  itemOpen: {
    ...pill,
    border: '1.5px solid var(--colour-primary)',
    background: '#f0fdf4',
    color: '#166534',
    cursor: 'pointer',
    boxShadow: '0 0 0 2px #e9e2fb',
  },
  itemOff: {
    ...pill,
    border: '1px dashed #cbd5e1',
    background: '#fff',
    color: '#6b7280',
    cursor: 'default',
  },
  detail: { fontWeight: 500, fontSize: 11.5, color: '#15803d' },
  spacer: { flex: 1 },
  note: { flexShrink: 0, fontSize: 11.5, color: '#6b7280' },
  popover: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 140,
    zIndex: 210,
    width: 440,
    maxWidth: 'calc(100% - 160px)',
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    border: '1px solid #d9d0ee',
    borderRadius: 12,
    boxShadow: '0 16px 40px rgba(40,22,78,0.28)',
    overflow: 'hidden',
  },
  popoverHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '8px 12px',
    background: '#f3effc',
    color: 'var(--colour-primary)',
    fontSize: 13,
    fontWeight: 700,
  },
  readOnly: { flexShrink: 0, fontSize: 12 },
  popoverBody: { padding: '8px 10px 0', maxHeight: 320, overflow: 'auto' },
  popoverFoot: {
    padding: '6px 12px 8px',
    fontSize: 11.5,
    color: '#6b7280',
    borderTop: '1px solid #eee',
  },
}
