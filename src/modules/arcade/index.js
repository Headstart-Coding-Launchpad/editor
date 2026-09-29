import StudentWorkspace from './StudentWorkspace'
import BuilderWorkspace from './BuilderWorkspace'
import CheckEditor from './CheckEditor'
import TeacherLiveView from './TeacherLiveView'
import { scrollLayoutStyles } from '../sharedStyles'
import { defineUiModule } from '../defineModule.js'
import definition from './definition.js'

const { taskContentStyle, editorAreaStyle } = scrollLayoutStyles

// Pure data and hooks live in ./definition.js; this file adds the UI.
export default defineUiModule(definition, {
  StudentWorkspace,
  BuilderWorkspace,
  CheckEditor,
  TeacherLiveView,
  getLayoutStyles: () => ({ taskContentStyle, editorAreaStyle }),
  runtime: null,
})
