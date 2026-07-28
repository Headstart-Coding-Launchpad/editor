import StudentWorkspace from './StudentWorkspace.jsx'
import BuilderWorkspace from './BuilderWorkspace.jsx'
import CheckEditor from './CheckEditor.jsx'
import TeacherLiveView from './TeacherLiveView.jsx'
import { DEFAULT_AVAILABLE_COMPONENTS, DEFAULT_CIRCUIT, applyMicrocontrollerGpioValues, cloneCircuit, evaluateElectronicsCheck, getMicrocontrollerCode, getMicrocontrollerInputValues, parseCircuit, serializeCircuit } from './circuit'
import { initPyodide, isPyodideReady, runPython, stopPython, provideInput } from '../python/pyodide'
import { scrollLayoutStyles } from '../sharedStyles.js'

const { taskContentStyle, editorAreaStyle } = scrollLayoutStyles

const MICROPYTHON_SHIM = [
  'import sys, types, time as _py_time',
  'try:',
  '    import js',
  'except Exception:',
  '    js = None',
  '',
  'def _read_gpio(name):',
  '    if js is None:',
  '        return None',
  '    try:',
  '        value = js.__hsGpioRead(str(name))',
  '    except Exception:',
  '        return None',
  '    if value is None:',
  '        return None',
  '    return 1 if value else 0',
  '',
  'def _write_gpio(name, value):',
  '    normalized = 1 if value else 0',
  '    if js is not None:',
  '        try:',
  '            js.__hsGpioWrite(str(name), normalized)',
  '            return',
  '        except Exception:',
  '            pass',
  '    print(f"[pin {name}] {normalized}")',
  '',
  'def _configure_gpio(name, mode, pull):',
  '    if js is None:',
  '        return',
  '    try:',
  '        js.__hsGpioConfigure(str(name), int(mode), pull)',
  '    except Exception:',
  '        pass',
  '',
  'class _Pin:',
  '    IN = 0',
  '    OUT = 1',
  '    PULL_UP = 2',
  '    PULL_DOWN = 3',
  '    def __init__(self, name, mode=IN, pull=None):',
  '        self.name = str(name)',
  '        self.mode = mode',
  '        self.pull = pull',
  '        self._value = 0',
  '        _configure_gpio(self.name, self.mode, self.pull)',
  '    def value(self, next_value=None):',
  '        if next_value is None:',
  '            if self.mode == self.OUT:',
  '                return self._value',
  '            reading = _read_gpio(self.name)',
  '            if reading is None:',
  '                return 1 if self.pull == self.PULL_UP else 0',
  '            return reading',
  '        self._value = 1 if next_value else 0',
  '        _write_gpio(self.name, self._value)',
  '        return self._value',
  '    def on(self):',
  '        return self.value(1)',
  '    def off(self):',
  '        return self.value(0)',
  '    def toggle(self):',
  '        return self.value(0 if self._value else 1)',
  '',
  'machine = types.ModuleType("machine")',
  'machine.Pin = _Pin',
  'sys.modules["machine"] = machine',
  '',
  'async def _sleep(seconds):',
  '    seconds = max(0, float(seconds))',
  '    if js is not None:',
  '        try:',
  '            await js.__hsGpioSleep(seconds)',
  '            return',
  '        except Exception:',
  '            pass',
  '    _py_time.sleep(seconds)',
  '',
  'async def _sleep_ms(ms):',
  '    await _sleep(max(0, int(ms)) / 1000)',
  '',
  'time = types.ModuleType("time")',
  'time.sleep = _sleep',
  'sys.modules["time"] = time',
  '',
  'utime = types.ModuleType("utime")',
  'utime.sleep_ms = _sleep_ms',
  'utime.sleep = _sleep',
  'sys.modules["utime"] = utime',
].join('\n')

export function buildMicroPythonProgram(code) {
  return [
    `exec(${JSON.stringify(MICROPYTHON_SHIM)}, globals())`,
    '',
    code,
  ].join('\n')
}

const PIN_OUTPUT_RE = /\[pin\s+([^\]]+)\]\s+([01])/g
const PIN_OUTPUT_LINE_RE = /^\[pin\s+[^\]]+\]\s+[01]\s*(?:\r?\n)?/gm
const PIN_MODE_OUT = 1

function collectPinWrites(text, pinValues) {
  let changed = false
  if (!text) return false
  for (const match of text.matchAll(PIN_OUTPUT_RE)) {
    const nextValue = Number(match[2])
    if (pinValues[match[1]] !== nextValue) changed = true
    pinValues[match[1]] = nextValue
  }
  return changed
}

function stripPinWriteLines(text) {
  return String(text ?? '').replace(PIN_OUTPUT_LINE_RE, '')
}

function clearMicrocontrollerGpioValues(circuitLike) {
  const next = parseCircuit(circuitLike, DEFAULT_CIRCUIT)
  const microcontroller = next.components.find(component => component.type === 'microcontroller')
  if (!microcontroller) return next
  const control = { ...(next.controls?.[microcontroller.id] ?? {}) }
  delete control.gpio
  next.controls = {
    ...(next.controls ?? {}),
    [microcontroller.id]: control,
  }
  return next
}

const electronicsModule = {
  type: 'electronics',
  StudentWorkspace,
  BuilderWorkspace,
  CheckEditor,
  FeedbackCheckEditor: CheckEditor,
  TeacherLiveView,

  getDisplayState: (task, stage, liveState, tab) => {
    if (tab === 'complete') return serializeCircuit(task?.completeCircuit ?? task?.starterCircuit ?? DEFAULT_CIRCUIT)
    if (tab?.startsWith('stage_')) return serializeCircuit(stage?.circuit ?? task?.starterCircuit ?? DEFAULT_CIRCUIT)
    return liveState
  },

  getLayoutStyles: () => ({ taskContentStyle, editorAreaStyle }),

  makeCodeTaskFields: (task) => ({
    starterCircuit: cloneCircuit(task.starterCircuit ?? DEFAULT_CIRCUIT),
    availableComponents: task.availableComponents ?? [...DEFAULT_AVAILABLE_COMPONENTS],
    carryCircuitFrom: task.carryCircuitFrom ?? null,
    microcontroller: task.microcontroller ?? { enabled: false, boardType: null, starterCode: '' },
    codeStages: task.codeStages ?? [{
      label: 'Starter',
      role: 'starter',
      circuit: cloneCircuit(task.starterCircuit ?? DEFAULT_CIRCUIT),
    }],
  }),

  makeNewStage: (task, existing) => existing.length === 0
    ? { label: 'Starter', role: 'starter', circuit: cloneCircuit(task.starterCircuit ?? DEFAULT_CIRCUIT) }
    : { label: `Support ${existing.filter(stage => stage.role === 'support').length + 1}`, role: 'support', revealable: true, code: '' },

  initCompleteTab: (task, { onUpdate }) => {
    if (!task.completeCircuit) onUpdate({ ...task, completeCircuit: cloneCircuit(task.starterCircuit ?? DEFAULT_CIRCUIT) })
  },

  initStageTab: null,
  defaultCheck: () => [{ type: 'circuit_no_short' }],

  carryThroughField: 'carryCircuitFrom',
  carryThroughLabel: 'Carry circuit from task',
  getCarryThroughUpdates: (sourceTask) => ({
    starterCircuit: cloneCircuit(sourceTask.completeCircuit ?? sourceTask.starterCircuit ?? DEFAULT_CIRCUIT),
  }),
  getNewStarterUpdates: () => ({ starterCircuit: cloneCircuit(DEFAULT_CIRCUIT) }),

  supportsInteractionMode: false,
  supportsIncorrectChecks: true,
  supportsTests: false,
  supportsVariableChecks: false,
  supportsDomChecks: false,

  stageLabels: { starterLabel: 'Starter board', completeLabel: 'Complete board' },
  explainerInlineCodeLanguages: ['python'],

  defaultState: serializeCircuit(DEFAULT_CIRCUIT),
  initialState: (task) => serializeCircuit(task.starterCircuit ?? DEFAULT_CIRCUIT),
  serializeState: (state) => typeof state === 'string' ? state : serializeCircuit(state),
  deserializeState: (raw) => serializeCircuit(parseCircuit(raw, DEFAULT_CIRCUIT)),

  getSandboxState: (lesson, task) => serializeCircuit(lesson?.sandboxStarterCircuit ?? task?.starterCircuit ?? DEFAULT_CIRCUIT),

  runtime: {
    init: initPyodide,
    isReady: isPyodideReady,
    stop: stopPython,
    provideInput,
    run: (circuitLike, _task, callbacks) => {
      const circuit = parseCircuit(circuitLike, DEFAULT_CIRCUIT)
      const pinValues = {}
      const currentCircuit = () => {
        const latest = callbacks?.getRuntimeCode?.()
        return parseCircuit(typeof latest === 'string' ? latest : circuit, DEFAULT_CIRCUIT)
      }
      const currentCircuitWithOutputs = () => applyMicrocontrollerGpioValues(clearMicrocontrollerGpioValues(currentCircuit()), pinValues)
      const publishGpioValues = () => {
        callbacks?.onCodeUpdate?.(serializeCircuit(currentCircuitWithOutputs()))
      }
      return runPython(buildMicroPythonProgram(getMicrocontrollerCode(circuit)), {
        ...callbacks,
        asyncNames: ['sleep', 'sleep_ms'],
        gpioInputs: getMicrocontrollerInputValues(currentCircuitWithOutputs()),
        getGpioInputs: () => getMicrocontrollerInputValues(currentCircuitWithOutputs()),
        onGpioConfigure: (pin, mode) => {
          const normalizedMode = Number(mode)
          if (normalizedMode === PIN_MODE_OUT) {
            if (pinValues[pin] !== undefined) return
            pinValues[pin] = 0
          } else if (pinValues[pin] !== undefined) {
            delete pinValues[pin]
          } else {
            return
          }
          publishGpioValues()
        },
        onGpioWrite: (pin, value) => {
          if (pinValues[pin] === (value ? 1 : 0)) return
          pinValues[pin] = value ? 1 : 0
          publishGpioValues()
        },
        onOutput: (text, kind) => {
          if (collectPinWrites(text, pinValues)) {
            publishGpioValues()
          }
          const visibleText = stripPinWriteLines(text)
          if (visibleText) callbacks?.onOutput?.(visibleText, kind)
        },
      }).then(result => ({
        ...result,
        updatedCode: serializeCircuit(currentCircuitWithOutputs()),
      }))
    },
    buildPreviewSrc: null,
    waitForPreviewText: null,
  },

  evaluateCheck: evaluateElectronicsCheck,
}

export default electronicsModule
