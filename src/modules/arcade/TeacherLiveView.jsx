import PythonEditor from '../python/PythonEditor'
import ArcadeDesignStudio from './ArcadeDesignStudio'
import { allowsArcadeTool, designForCodeTab } from './design'

export default function TeacherLiveView({
  task,
  student,
  displayState,
  design: designProp,
  readOnly,
  onChange,
  onDesignChange,
  onActivity,
  activeWorkspace = 'code',
  onWorkspaceChange,
}) {
  const design = designProp ?? student?.currentArcadeDesign ?? designForCodeTab(task, 'starter')
  const canDrawSprites = allowsArcadeTool(task, 'sprites')
  const canDrawMaps = allowsArcadeTool(task, 'tilemaps')
  const editable = !readOnly && !!onWorkspaceChange
  const selectWorkspace = (workspace) => onWorkspaceChange?.(workspace)

  if (editable) {
    return (
      <div style={s.wrap}>
        <div style={s.tabs} role="tablist" aria-label="Arcade workspace">
          <button
            type="button"
            role="tab"
            aria-selected={activeWorkspace === 'code'}
            onClick={() => selectWorkspace('code')}
            style={{ ...s.tab, ...(activeWorkspace === 'code' ? s.tabActive : {}) }}
          >
            Code
          </button>
          {canDrawSprites && (
            <button
              type="button"
              role="tab"
              aria-selected={activeWorkspace === 'sprites'}
              onClick={() => selectWorkspace('sprites')}
              style={{ ...s.tab, ...(activeWorkspace === 'sprites' ? s.tabActive : {}) }}
            >
              Sprites
            </button>
          )}
          {canDrawMaps && (
            <button
              type="button"
              role="tab"
              aria-selected={activeWorkspace === 'tilemaps'}
              onClick={() => selectWorkspace('tilemaps')}
              style={{ ...s.tab, ...(activeWorkspace === 'tilemaps' ? s.tabActive : {}) }}
            >
              Tilemaps
            </button>
          )}
        </div>
        {activeWorkspace === 'code' ? (
          <div style={s.editor}>
            <PythonEditor
              code={displayState ?? ''}
              readOnly={false}
              onChange={onChange}
              onActivity={onActivity}
              pyodideStatus="ready"
            />
          </div>
        ) : (
          <div style={s.workspace}>
            <ArcadeDesignStudio
              task={{ ...task, arcadeTools: activeWorkspace }}
              design={design}
              readOnly={false}
              onChange={onDesignChange}
              title={activeWorkspace === 'sprites' ? 'Student sprites' : 'Student tilemaps'}
              layout="builder"
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={s.wrap}>
      <div style={s.editor}>
        <PythonEditor
          code={displayState ?? ''}
          readOnly={readOnly}
          onChange={onChange}
          onActivity={onActivity}
          pyodideStatus="ready"
        />
      </div>
      <details style={s.design} open>
        <summary>Student game art &amp; map</summary>
        <ArcadeDesignStudio
          task={task}
          design={design}
          readOnly={readOnly}
          onChange={onDesignChange}
          title="Current student design"
          layout="builder"
        />
      </details>
    </div>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 },
  editor: { flex: '1 1 220px', minHeight: 0 },
  design: {
    flex: '0 1 auto',
    overflow: 'auto',
    borderTop: '1px solid #e2e8f0',
    padding: 8,
    fontFamily: 'var(--font-body)',
    fontSize: 12,
  },
  workspace: { flex: '1 1 auto', minHeight: 0, overflow: 'auto', padding: 8 },
  tabs: {
    display: 'flex',
    flexShrink: 0,
    gap: 3,
    padding: '6px 8px 0',
    background: '#f8fafc',
    borderBottom: '1px solid #e5e7eb',
  },
  tab: {
    padding: '7px 12px',
    border: '1px solid transparent',
    borderBottom: 0,
    borderRadius: '7px 7px 0 0',
    background: 'transparent',
    color: '#64748b',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
  },
  tabActive: { background: '#fff', borderColor: '#c4b5fd', color: '#5b21b6', marginBottom: -1 },
}
