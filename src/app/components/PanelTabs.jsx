import React from 'react'

// Generic tab switcher for "show one full-size pane at a time" compact layouts.
// Styled entirely by the existing `.ui-tabs`/`.ui-tab`/`[role="tab"]` rules in
// index.css (same visual language as the Python task picker in CodeFileWorkspace.jsx
// and the HTML file tabs in StudentWorkspaceBody.jsx) — no new visual style introduced.
export default function PanelTabs({ tabs, activeId, onChange, label, style, highlightedIds }) {
  return (
    <div className="ui-tabs" role="tablist" aria-label={label} style={style}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`ui-tab ${tab.id === activeId ? 'is-active' : ''} ${highlightedIds?.includes(tab.id) ? 'pane-highlight-pulse' : ''}`}
          role="tab"
          id={`panel-tab-${tab.id}`}
          aria-selected={tab.id === activeId}
          aria-controls={`panel-tabpanel-${tab.id}`}
          onClick={() => tab.id !== activeId && onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
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
