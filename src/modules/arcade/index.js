import StudentWorkspace from './StudentWorkspace'
import BuilderWorkspace from './BuilderWorkspace'
import CheckEditor from './CheckEditor'
import TeacherLiveView from './TeacherLiveView'
import { scrollLayoutStyles } from '../sharedStyles'
import { cloneArcadeDesign } from './design'

const { taskContentStyle, editorAreaStyle } = scrollLayoutStyles
export default {
  type: 'arcade', StudentWorkspace, BuilderWorkspace, CheckEditor, TeacherLiveView,
  getDisplayState: (task, stage, liveState, tab) => tab === 'complete' ? (task?.completeCode ?? '') : tab?.startsWith('stage_') ? (stage?.code ?? '') : typeof liveState === 'string' ? liveState : (task?.starterCode ?? ''),
  getLayoutStyles: () => ({ taskContentStyle, editorAreaStyle }),
  makeCodeTaskFields: task => {
    const starterCode = task.starterCode ?? 'from headstart_arcade import game, Sprite, keys\n\n# Write update() and draw(), then call game.run().\n\ngame.run()\n'
    return {
      starterCode,
      carryCodeFrom: task.carryCodeFrom ?? null,
      codeStages: task.codeStages ?? [{ label: 'Starter', role: 'starter', code: starterCode, arcadeDesign: cloneArcadeDesign(task.arcadeDesign) }],
    }
  },
  makeNewStage: (task, existing) => existing.length === 0
    ? { label: 'Starter', role: 'starter', code: task.starterCode ?? '', arcadeDesign: cloneArcadeDesign(task.arcadeDesign) }
    : { label: `Support ${existing.filter(stage => stage.role === 'support').length + 1}`, role: 'support', code: '' },
  initCompleteTab: (task, { onUpdate }) => { if (task.completeCode == null) onUpdate({ ...task, completeCode: task.starterCode ?? '' }) }, initStageTab: null,
  defaultCheck: () => [{ type: 'code_contains', value: '' }],
  carryThroughField: 'carryCodeFrom', carryThroughLabel: 'Carry code from task', getCarryThroughUpdates: source => ({ starterCode: source.completeCode ?? source.starterCode ?? '' }), getNewStarterUpdates: () => ({ starterCode: '' }),
  supportsInteractionMode: false, supportsIncorrectChecks: true, supportsTests: false, supportsVariableChecks: false, supportsDomChecks: false, supportsCopyCode: true,
  stageLabels: { starterLabel: 'Starter', completeLabel: 'Complete' }, explainerInlineCodeLanguages: ['python'],
  defaultState: '', initialState: task => task.starterCode ?? '', serializeState: state => state, deserializeState: raw => typeof raw === 'string' ? raw : '',
  getSandboxState: (lesson, task) => lesson?.sandboxStarter ?? task?.starterCode ?? '', runtime: null,
}
