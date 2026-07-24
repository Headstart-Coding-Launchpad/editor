import StudentWorkspace from './StudentWorkspace'
import BuilderWorkspace from './BuilderWorkspace'
import CheckEditor from './CheckEditor'
import TeacherLiveView from './TeacherLiveView'
import { scrollLayoutStyles } from '../sharedStyles'

const { taskContentStyle, editorAreaStyle } = scrollLayoutStyles
export default {
  type: 'arcade', StudentWorkspace, BuilderWorkspace, CheckEditor, TeacherLiveView,
  getDisplayState: (task, stage, liveState, tab) => tab === 'complete' ? (task?.completeCode ?? '') : tab?.startsWith('stage_') ? (stage?.code ?? '') : liveState,
  getLayoutStyles: () => ({ taskContentStyle, editorAreaStyle }),
  makeCodeTaskFields: task => ({ starterCode: task.starterCode ?? 'from headstart_arcade import game, Sprite, keys\n\n# Write update() and draw(), then call game.run().\n\ngame.run()\n', carryCodeFrom: task.carryCodeFrom ?? null }),
  makeNewStage: (task, existing) => ({ label: `Stage ${existing.length + 1}`, role: 'support', code: task.starterCode ?? '' }),
  initCompleteTab: (task, { onUpdate }) => { if (task.completeCode == null) onUpdate({ ...task, completeCode: task.starterCode ?? '' }) }, initStageTab: null,
  defaultCheck: () => [{ type: 'code_contains', value: '' }],
  carryThroughField: 'carryCodeFrom', carryThroughLabel: 'Carry code from task', getCarryThroughUpdates: source => ({ starterCode: source.completeCode ?? source.starterCode ?? '' }), getNewStarterUpdates: () => ({ starterCode: '' }),
  supportsInteractionMode: false, supportsIncorrectChecks: true, supportsTests: false, supportsVariableChecks: false, supportsDomChecks: false, supportsCopyCode: true,
  stageLabels: { starterLabel: 'Starter', completeLabel: 'Complete' }, explainerInlineCodeLanguages: ['python'],
  defaultState: '', initialState: task => task.starterCode ?? '', serializeState: state => state, deserializeState: raw => typeof raw === 'string' ? raw : '',
  getSandboxState: (lesson, task) => lesson?.sandboxStarter ?? task?.starterCode ?? '', runtime: null,
}
