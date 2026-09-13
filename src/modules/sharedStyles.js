export const scrollLayoutStyles = {
  taskContentStyle: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflow: 'visible',
  },
  editorAreaStyle: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
}

// Same shape as scrollLayoutStyles, plus flex:1/minHeight:0 for modules whose task
// content needs to fill and shrink within a flex parent (e.g. a canvas/board panel
// beside the editor) instead of scrolling with the page.
export const flexLayoutStyles = {
  taskContentStyle: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minHeight: 0,
    overflow: 'visible',
  },
  editorAreaStyle: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minHeight: 0,
  },
}
