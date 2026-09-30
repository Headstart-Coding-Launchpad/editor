import React from 'react'
import { Field } from '../../../activities/ui/BuilderField.jsx'
import {
  getBadgeDefinition,
  getHintableBadges,
  getRuleBackedBadges,
} from '../../../badges/registry'
import { listBadgeHints, patternBadgesFor, toggleBadgeHint } from '../../badgeHints'

/**
 * Builder "Badge hints" (a task's optional `badgeHints`, docs/authoring/badges.md): `suggest`
 * treats a real pass here as a pattern badge's trigger, and `suppress` stops a rule-backed badge
 * being suggested from this task. Only the ids lesson validation accepts are offered. Also shows,
 * read-only, which badges the task's taskActivity pattern already triggers.
 */
export default function BadgeHintsField({ task, onChange }) {
  const hints = task?.badgeHints
  const suggest = listBadgeHints(hints, 'suggest')
  const suppress = listBadgeHints(hints, 'suppress')
  const fromPattern = patternBadgesFor(task)

  function renderGroup(key, badges, label, selected) {
    return (
      <div style={s.group} role="group" aria-label={label}>
        <span style={s.groupLabel}>{label}</span>
        <div style={s.chips}>
          {badges.map((badge) => {
            const on = selected.includes(badge.id)
            return (
              <button
                key={badge.id}
                type="button"
                className={`te-browse-toggle-btn${on ? ' te-browse-toggle-btn--active' : ''}`}
                aria-pressed={on}
                title={badge.ruleText}
                onClick={() => onChange(toggleBadgeHint(hints, key, badge.id))}
              >
                <span aria-hidden="true">{badge.emoji}</span> {badge.title}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <Field
      label="Badge hints"
      hint="Optional. Tunes which live badges this task can suggest; students never see it."
    >
      <p style={s.pattern} data-testid="badge-hints-pattern">
        {fromPattern.length > 0
          ? `This task's activity pattern can trigger: ${fromPattern
              .map((id) => {
                const badge = getBadgeDefinition(id)
                return badge ? `${badge.emoji} ${badge.title}` : id
              })
              .join(', ')}.`
          : "This task's activity pattern triggers no pattern badge."}
      </p>
      {renderGroup('suggest', getHintableBadges(), 'Also suggest', suggest)}
      {renderGroup('suppress', getRuleBackedBadges(), 'Never suggest', suppress)}
    </Field>
  )
}

const s = {
  pattern: {
    margin: 0,
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: '#6b7280',
  },
  group: { display: 'flex', flexDirection: 'column', gap: 4 },
  groupLabel: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--colour-text)',
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
}
