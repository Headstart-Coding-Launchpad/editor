import PanelTabs from '../../app/components/PanelTabs.jsx'
import { RESULT_PANE_LABELS } from './resultPane.js'

/**
 * One result pane for Python and Turtle tasks on smaller screens: tabs Picture · Tags · Console
 * (only the panes the task has), state from useResultPane. Every pane stays mounted in the same
 * place — inactive ones are hidden — so a playing turtle drawing, the Stage and the console keep
 * their state when the student switches tabs, and a tab appearing (the Picture after the first
 * drawing) doesn't remount the others. With `stacked` the Picture and Tags show together, one
 * above the other, under a single "Picture + Tags" tab (slow-mo; predict / target mode). With one
 * pane there are no tabs: just a labelled region.
 *
 * - `panes`: [{ id: 'picture' | 'tags' | 'console', content }] in display order;
 * - `idPrefix`: makes the tab ids unique on the page;
 * - `trailing`: controls after the tabs (e.g. Python's collapse button).
 */
export default function ResultPane({
  panes,
  active,
  onSelect,
  stacked = false,
  badges = {},
  announcement = '',
  idPrefix = 'result',
  label = 'Result',
  trailing = null,
  style,
}) {
  const ids = panes.map((pane) => pane.id)
  const stack = stacked && ids.includes('picture') && ids.includes('tags')
  const inStack = (id) => stack && (id === 'picture' || id === 'tags')
  const shownTab = inStack(active) ? 'picture' : active
  const tabs = panes
    .filter((pane) => !(stack && pane.id === 'tags'))
    .map((pane) => ({
      id: pane.id,
      label: inStack(pane.id) ? 'Picture + Tags' : RESULT_PANE_LABELS[pane.id],
      badge: badges[pane.id] ?? null,
    }))
  const tabbed = panes.length > 1

  return (
    <section
      className="result-pane"
      aria-label={tabbed ? label : RESULT_PANE_LABELS[panes[0]?.id]}
      style={{ ...s.root, ...style }}
      data-testid="result-pane"
    >
      {tabbed && (
        <PanelTabs
          tabs={tabs}
          activeId={shownTab}
          onChange={onSelect}
          label={`${label} panes`}
          idPrefix={idPrefix}
          className="result-pane__tabs"
          tabClassName="result-pane__tab"
          trailing={trailing}
        />
      )}
      <div style={s.body}>
        {panes.map((pane) => {
          const visible = !tabbed || pane.id === active || (inStack(pane.id) && inStack(active))
          const labelTab = inStack(pane.id) ? 'picture' : pane.id
          return (
            <div
              key={pane.id}
              role={tabbed ? 'tabpanel' : undefined}
              id={tabbed ? `${idPrefix}-tabpanel-${pane.id}` : undefined}
              aria-labelledby={tabbed ? `${idPrefix}-tab-${labelTab}` : undefined}
              hidden={!visible}
              data-pane={pane.id}
              style={{
                ...(inStack(pane.id) ? s.stacked[pane.id] : s.panel),
                display: visible ? 'flex' : 'none',
              }}
            >
              {pane.content}
            </div>
          )
        })}
      </div>
      <p className="result-pane__sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </section>
  )
}

const s = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    position: 'relative',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    gap: 8,
    paddingTop: 8,
  },
  panel: { flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0 },
  stacked: {
    picture: { flexDirection: 'column', flex: '1 1 55%', minHeight: 140, minWidth: 0 },
    tags: { flexDirection: 'column', flex: '1 1 45%', minHeight: 0, minWidth: 0, overflow: 'auto' },
  },
}
