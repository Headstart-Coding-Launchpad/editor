import React from 'react'
import IframePreview from './IframePreview'
import { AnimatedPanelShell, CollapsedPanelRail, CollapseTabButton } from './CollapsiblePanelControls'

export default function CollapsibleIframePreview({ src, iframeRef, fill = true, collapsed, onToggle, animate = false, onConsoleError }) {
  if (collapsed) {
    return (
      <CollapsedPanelRail
        onClick={onToggle}
        label="Preview"
        direction="left"
        title="Show Preview"
        ariaLabel="Show Preview"
      />
    )
  }

  const preview = (
    <IframePreview
      src={src}
      iframeRef={iframeRef}
      fill={fill}
      onConsoleError={onConsoleError}
      leadingActions={
        <CollapseTabButton
          onClick={onToggle}
          direction="right"
          title="Collapse Preview"
          ariaLabel="Collapse Preview"
        />
      }
    />
  )

  return (
    <AnimatedPanelShell animate={animate}>
      {preview}
    </AnimatedPanelShell>
  )
}
