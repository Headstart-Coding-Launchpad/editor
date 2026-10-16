import NameTagPanel from '../../../shared/variablesPanel/NameTagPanel.jsx'
import { getShowVariables } from '../../../shared/variablesPanel/variablesPanel.js'
import { stepChangedItems } from './recording.js'

const VIEW_CONFIG = Object.freeze({
  mode: 'view',
  at: 'end',
  hide: [],
  predict: [],
  target: {},
  visuals: true,
  stageLists: 'size',
})

/**
 * The name-tag panel during slow-mo playback: the variables after the step being shown, a pulse
 * on the ones that step changed, and their earlier values struck through. Shown when the task
 * has `showVariables` or `slowMo.showVariables`. A predict-mode panel shows plain tags while
 * stepping (its verdicts belong to the finished run); a target-mode panel keeps its targets.
 * Lists and dicts keep their visuals (the task's `visuals`), and the items a step changed pulse.
 */
export default function SlowMoNameTags({
  task,
  slowMo,
  links = null,
  activeLink = null,
  onLinkActive,
  style,
}) {
  const view = slowMo?.view
  if (!view) return null
  const taskConfig = getShowVariables(task)
  if (!taskConfig && !slowMo.config?.showVariables) return null
  const config = !taskConfig
    ? VIEW_CONFIG
    : taskConfig.mode === 'target'
      ? taskConfig
      : { ...taskConfig, mode: 'view', predict: [] }
  const { snapshot, changed, history } = view.variables
  const run = snapshot
    ? {
        taskId: task?.id ?? null,
        status: null,
        at: 'end',
        snapshots: [snapshot],
        index: 0,
        changed,
        changedItems: stepChangedItems(snapshot, changed, history),
      }
    : null
  const status = view.varsDropped
    ? 'The variables were too big to send, so only the lines show.'
    : view.position === 0
      ? 'Nothing has run yet.'
      : `After line ${view.line} ran (step ${view.position} of ${view.count})${
          snapshot?.scope ? `, inside ${snapshot.scope}()` : ''
        }.`
  return (
    <NameTagPanel
      config={config}
      run={run}
      readOnly
      history={history}
      status={status}
      pulseKey={view.position}
      pulse={slowMo.pulse}
      links={links}
      activeLink={activeLink}
      onLinkActive={onLinkActive}
      style={style}
    />
  )
}
