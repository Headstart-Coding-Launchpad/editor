import React from 'react'
import { sideQuestKindMeta } from '../../../shared/sideQuests'

/**
 * The prompt inside a finished task: "You've finished! Try a side-quest", with one button per
 * side-quest (a ✓ on the ones marked Done). Shown above the workspace once the student passes a
 * task that has side-quests (src/shared/sideQuests.js).
 */
export default function SideQuestPrompt({ quests, isDone, onOpen }) {
  if (!quests?.length) return null
  return (
    <div style={s.bar} role="region" aria-label="Side-quests">
      <span style={s.text}>🎉 You’ve finished! Try a side-quest{quests.length > 1 ? ':' : ''}</span>
      <div style={s.buttons}>
        {quests.map((quest) => {
          const meta = sideQuestKindMeta(quest.kind)
          const done = isDone?.(quest.index)
          return (
            <button
              key={quest.index}
              type="button"
              className={done ? 'btn-ghost-outline' : 'btn-primary'}
              style={s.button}
              onClick={() => onOpen(quest.index)}
              title={`${meta.label}: ${quest.title}${done ? ' (done)' : ''}`}
            >
              {meta.icon} {quest.title}
              {done ? ' ✓' : ''}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const s = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
    padding: '6px 12px',
    fontSize: 13,
    fontWeight: 600,
    background: 'rgba(124, 58, 237, 0.08)',
    color: 'var(--colour-text)',
    borderBottom: '2px solid #7c3aed',
    flexShrink: 0,
  },
  text: { minWidth: 0 },
  buttons: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  button: { fontSize: 13, padding: '4px 12px' },
}
