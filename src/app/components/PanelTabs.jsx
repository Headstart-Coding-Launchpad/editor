import React from 'react'

// Generic tab switcher for "show one full-size pane at a time" compact layouts.
// Styled entirely by the existing `.ui-tabs`/`.ui-tab`/`[role="tab"]` rules in
// index.css (same visual language as the Python task picker in CodeFileWorkspace.jsx
// and the HTML file tabs in StudentWorkspaceBody.jsx) — no new visual style introduced.
//
// Keyboard: the ARIA tabs pattern — only the selected tab is in the Tab order, and the arrow
// keys (Home / End too) move to and select the neighbouring tab.
//
// - `idPrefix`: tab and panel ids are `${idPrefix}-tab-<id>` / `${idPrefix}-tabpanel-<id>`, so
//   two tab sets on one page don't clash (default 'panel').
// - a tab's optional `badge` ({ text, label }) shows a small count or marker beside its label
//   and adds `label` to its accessible name (the result pane's unread Console lines).
// - `trailing`: extra controls after the tabs (not tabs themselves).
export default function PanelTabs({
  tabs,
  activeId,
  onChange,
  label,
  style,
  highlightedIds,
  idPrefix = 'panel',
  className = '',
  tabClassName = '',
  trailing = null,
}) {
  function handleKeyDown(event) {
    if (event.target?.getAttribute?.('role') !== 'tab') return
    const index = tabs.findIndex((tab) => tab.id === activeId)
    let next = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = index + 1
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = index - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    if (next == null || !tabs.length) return
    event.preventDefault()
    const nextIndex = (next + tabs.length) % tabs.length
    const tab = tabs[nextIndex]
    if (tab.id !== activeId) onChange(tab.id)
    event.currentTarget.querySelectorAll('[role="tab"]')[nextIndex]?.focus()
  }

  return (
    <div
      className={`ui-tabs ${className}`.trim()}
      role="tablist"
      aria-label={label}
      style={style}
      onKeyDown={handleKeyDown}
    >
      {tabs.map((tab) => {
        const selected = tab.id === activeId
        return (
          <button
            key={tab.id}
            type="button"
            className={`ui-tab ${selected ? 'is-active' : ''} ${highlightedIds?.includes(tab.id) ? 'pane-highlight-pulse' : ''} ${tabClassName}`}
            role="tab"
            id={`${idPrefix}-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-tabpanel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            aria-label={tab.badge ? `${tab.label}, ${tab.badge.label}` : undefined}
            onClick={() => !selected && onChange(tab.id)}
          >
            {tab.label}
            {tab.badge && (
              <span
                className={`panel-tab-badge panel-tab-badge--${tab.badge.tone ?? 'info'}`}
                aria-hidden="true"
              >
                {tab.badge.text}
              </span>
            )}
          </button>
        )
      })}
      {trailing}
    </div>
  )
}

// Stays mounted regardless of which tab is active — switching tabs must not dispose
// a live Blockly workspace, interrupt a running Scratch script, or drop a live-view
// mirror's in-progress state. Inactive panels are hidden with `display: none` rather
// than unmounted.
export function PanelTabPanel({ id, activeId, children, style }) {
  const active = id === activeId
  return (
    <div
      role="tabpanel"
      id={`panel-tabpanel-${id}`}
      aria-labelledby={`panel-tab-${id}`}
      hidden={!active}
      style={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        flexDirection: 'column',
        ...style,
        display: active ? (style?.display ?? 'flex') : 'none',
      }}
    >
      {children}
    </div>
  )
}
