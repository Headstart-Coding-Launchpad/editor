import React, { useEffect } from 'react'
import { sideQuestKindMeta } from '../../../shared/sideQuests'
import { useSideQuestOffer } from '../../hooks/useSideQuestOffer'

/**
 * The one-time bonus quest card: "Nice! You finished. Want a bonus quest?", one filled
 * "Try it: <quest>" per side-quest (at most 3) and a quiet "Not now". Not a modal: no dim, no
 * focus trap; it sits in the page flow under the workspace, so it never covers the code or the
 * Run output. When it shows is decided by useSideQuestOffer; it is local to the student and
 * writes nothing (the quest it opens logs as usual).
 */
export default function SideQuestOfferCard({ quests, onTry, onNotNow }) {
  if (!quests?.length) return null
  return (
    <div
      className="motion-rise-in"
      style={s.card}
      role="region"
      aria-label="Bonus quest"
      aria-live="polite"
      data-testid="side-quest-offer"
    >
      <span style={s.text}>
        <span aria-hidden="true">🎉 </span>Nice! You finished. Want a bonus quest?
      </span>
      <div style={s.buttons}>
        {quests.map((quest) => (
          <button
            key={quest.index}
            type="button"
            className="btn-primary"
            style={s.tryButton}
            onClick={() => onTry(quest.index)}
          >
            Try it: <span aria-hidden="true">{sideQuestKindMeta(quest.kind).icon} </span>
            {quest.title}
          </button>
        ))}
        <button type="button" className="btn-ghost" style={s.notNow} onClick={onNotNow}>
          Not now
        </button>
      </div>
    </div>
  )
}

const s = {
  card: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px 16px',
    flexWrap: 'wrap',
    margin: '0 16px 8px',
    padding: '8px 14px',
    borderRadius: 12,
    border: '2px solid #7c3aed',
    background: '#f5f3ff',
    boxShadow: '0 6px 18px rgba(76, 29, 149, 0.16)',
    color: 'var(--colour-text)',
    flexShrink: 0,
  },
  text: { fontSize: 17, fontWeight: 700, minWidth: 0 },
  buttons: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  tryButton: { minHeight: 44, fontSize: 16, fontWeight: 700, padding: '8px 18px' },
  notNow: { minHeight: 44, fontSize: 15, padding: '8px 14px' },
}

/**
 * Where StudentView places the card: runs useSideQuestOffer (always mounted on the lesson page,
 * so it sees the pass happen) and tells the page while the card is up, so the pass banner can
 * step aside rather than stack with it.
 */
export function SideQuestOffer({ onVisibleChange, ...offerArgs }) {
  const offer = useSideQuestOffer(offerArgs)
  useEffect(() => {
    onVisibleChange?.(offer.visible)
  }, [offer.visible, onVisibleChange])
  if (!offer.visible) return null
  return (
    <SideQuestOfferCard quests={offerArgs.quests} onTry={offer.tryQuest} onNotNow={offer.dismiss} />
  )
}
