import ScratchWorkspace from './StudentWorkspace.jsx'
import { SPRITE_TYPES } from './ScratchWorkspace.jsx'
import BuilderWorkspace from './BuilderWorkspace.jsx'
import CheckEditor from './CheckEditor.jsx'
import ScratchTeacherLiveView from './TeacherLiveView.jsx'
import { DEFAULT_SPRITES } from './checks'
import { flexLayoutStyles } from '../sharedStyles.js'
import { defineUiModule } from '../defineModule.js'
import definition from './definition.js'

export { DEFAULT_SPRITES, SPRITE_TYPES }

const { taskContentStyle, editorAreaStyle } = flexLayoutStyles

// Pure data and hooks live in ./definition.js; this file adds the UI.
const scratchModule = defineUiModule(definition, {
  StudentWorkspace: ScratchWorkspace,
  BuilderWorkspace,
  CheckEditor,
  FeedbackCheckEditor: CheckEditor,

  // ── Teacher-side editor ──────────────────────────────────────────────────────
  TeacherLiveView: ScratchTeacherLiveView,

  // ── Layout ───────────────────────────────────────────────────────────────────
  getLayoutStyles: () => ({ taskContentStyle, editorAreaStyle }),

  // ── Runtime ──────────────────────────────────────────────────────────────────
  runtime: null,
})

export default scratchModule
