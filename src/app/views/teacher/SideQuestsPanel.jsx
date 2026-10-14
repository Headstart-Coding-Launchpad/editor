import React, { useEffect, useMemo, useState } from 'react'
import { MarkdownRenderer } from '../../../shared/markdown'
import { findTaskById } from '../../../shared/taskUtils'
import { getEffectiveLessonForTask } from '../../../shared/composedLesson'
import {
  getSideQuests,
  sideQuestKindMeta,
  summariseSideQuestClass,
  supportsSideQuests,
} from '../../../shared/sideQuests'

// How often the counts re-check "no Run for five minutes" while nothing else changes.
const TICK_MS = 30 * 1000

const COUNTS = [
  { key: 'onIt', label: 'On it now', title: 'Online with this side-quest open now' },
  { key: 'done', label: 'Done', title: 'Marked it done (self-reported, never checked)' },
  {
    key: 'stuck',
    label: 'Probably stuck',
    title: 'On it, and the last 2 Runs hit an error, or no Run for 5 minutes',
  },
]

/**
 * The class's current task's side-quests for the tutor (src/shared/sideQuests.js), under the
 * task in TeacherView's centre column: each side-quest's title, kind, explainer and starter
 * code, with how many students are on it now, done, and probably stuck. Clicking a count lists
 * those students; clicking a student opens their StudentModal on the side-quest view
 * (`onOpenStudent(id)`). Renders nothing when the task has no side-quests a student can open.
 */
export default function SideQuestsPanel({ lesson, session, onOpenStudent }) {
  const task = findTaskById(lesson?.tasks, session?.currentTaskId)
  const moduleType = getEffectiveLessonForTask(lesson, task)?.type ?? null
  const quests = useMemo(
    () => (supportsSideQuests(moduleType) ? getSideQuests(task) : []),
    [task, moduleType]
  )
  const [open, setOpen] = useState(false)
  // `${index}:${countKey}`: the count whose students are listed.
  const [listed, setListed] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (quests.length === 0) return undefined
    const timer = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(timer)
  }, [quests.length])
  useEffect(() => setListed(null), [task?.id])

  if (quests.length === 0) return null
  const summary = summariseSideQuestClass({ session, task, quests, now })
  const totals = summary.reduce(
    (acc, entry) => ({
      onIt: acc.onIt + entry.onIt.length,
      done: acc.done + entry.done.length,
      stuck: acc.stuck + entry.stuck.length,
    }),
    { onIt: 0, done: 0, stuck: 0 }
  )
  const nameOf = (id) => session?.students?.[id]?.displayName ?? 'A student'

  return (
    <section style={s.wrap} aria-label="Side-quests" data-testid="side-quests-panel">
      <button
        type="button"
        style={s.header}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span style={s.title}>
          🗺️ Side-quests ({quests.length}){task?.title ? ` — ${task.title}` : ''}
        </span>
        <span style={s.headerCounts}>
          {totals.onIt > 0 && <span>{totals.onIt} on one</span>}
          {totals.stuck > 0 && <span style={s.stuckText}>{totals.stuck} stuck?</span>}
          <span style={s.chevron}>{open ? '▲' : '▼'}</span>
        </span>
      </button>
      {open && (
        <div style={s.body}>
          {quests.map((quest) => {
            const meta = sideQuestKindMeta(quest.kind)
            const entry = summary.find((item) => item.index === quest.index)
            return (
              <div key={quest.index} style={s.quest} data-testid={`side-quest-${quest.index}`}>
                <div style={s.questHead}>
                  <span style={s.badge}>{quest.index + 1}</span>
                  <span style={s.questTitle}>{quest.title}</span>
                  <span style={s.kind}>
                    {meta.icon} {meta.label}
                  </span>
                </div>
                <div style={s.counts} role="group" aria-label={`Students on ${quest.title}`}>
                  {COUNTS.map((countDef) => {
                    const ids = entry?.[countDef.key] ?? []
                    const key = `${quest.index}:${countDef.key}`
                    const on = listed === key
                    return (
                      <button
                        key={countDef.key}
                        type="button"
                        style={{
                          ...s.count,
                          ...(countDef.key === 'stuck' && ids.length > 0 ? s.countStuck : null),
                          ...(on ? s.countOn : null),
                        }}
                        title={countDef.title}
                        aria-pressed={on}
                        disabled={ids.length === 0}
                        onClick={() => setListed(on ? null : key)}
                      >
                        {countDef.label} <strong>{ids.length}</strong>
                      </button>
                    )
                  })}
                </div>
                {listed?.startsWith(`${quest.index}:`) && (
                  <div style={s.names}>
                    {(entry?.[listed.split(':')[1]] ?? []).map((id) => (
                      <button
                        key={id}
                        type="button"
                        className="btn-ghost-outline"
                        style={s.name}
                        onClick={() => onOpenStudent?.(id)}
                        title="Open their side-quest"
                      >
                        {nameOf(id)}
                      </button>
                    ))}
                  </div>
                )}
                {quest.explainer && (
                  <div style={s.explainer}>
                    <MarkdownRenderer content={quest.explainer} topicType={moduleType} />
                  </div>
                )}
                {quest.starter && (
                  <details style={s.starter}>
                    <summary style={s.starterSummary}>Starter code</summary>
                    <pre style={s.code}>{quest.starter}</pre>
                  </details>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

const s = {
  wrap: {
    flexShrink: 0,
    background: 'var(--colour-surface, #fff)',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  header: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '9px 14px',
    background: '#f9fafb',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  },
  title: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.8rem',
    letterSpacing: '0.03em',
    color: 'var(--colour-primary)',
    minWidth: 0,
  },
  headerCounts: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--colour-muted)',
    flexShrink: 0,
  },
  stuckText: { color: '#b45309' },
  chevron: { fontSize: '0.65rem', color: '#9ca3af' },
  body: { display: 'flex', flexDirection: 'column', maxHeight: 420, overflowY: 'auto' },
  quest: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '8px 14px',
    borderTop: '1px solid #f3f4f6',
    fontSize: '0.82rem',
  },
  questHead: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: {
    background: '#7c3aed',
    color: '#fff',
    borderRadius: 4,
    fontWeight: 700,
    fontSize: '0.7rem',
    padding: '1px 6px',
    flexShrink: 0,
  },
  questTitle: { fontWeight: 700, color: 'var(--colour-text)' },
  kind: { fontSize: '0.75rem', color: 'var(--colour-muted)' },
  counts: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  count: {
    fontSize: 12,
    padding: '3px 10px',
    borderRadius: 999,
    border: '1px solid #d1d5db',
    background: '#fff',
    color: 'var(--colour-text)',
    cursor: 'pointer',
  },
  countStuck: { borderColor: '#d97706', background: '#fffbeb', color: '#92400e' },
  countOn: { borderColor: '#7c3aed', background: 'rgba(124, 58, 237, 0.1)' },
  names: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 12, padding: '3px 10px' },
  explainer: { fontSize: '0.82rem' },
  starter: { fontSize: '0.78rem' },
  starterSummary: { cursor: 'pointer', fontWeight: 600, color: 'var(--colour-muted)' },
  code: {
    margin: '4px 0 0',
    padding: '6px 8px',
    background: '#f3f4f6',
    borderRadius: 6,
    fontFamily: 'var(--font-code)',
    fontSize: '0.78rem',
    whiteSpace: 'pre-wrap',
    overflowX: 'auto',
  },
}
