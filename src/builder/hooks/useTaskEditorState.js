import { useState, useEffect, useRef } from 'react'
import { getLessonModule } from '../../modules/registry'
import { evaluateFeedbackCheckResults, evaluateSingleCheck, normalizeChecks, resolveTestCheck } from '../../modules/checks'
import { resolveAssetsPath } from '../../shared/assetPaths'

export function useTaskEditorState({ task, lesson, activePythonCode, activeFiles, activeEntryFile, isPython, isScratch, set, iframeStorageAssets = null }) {
  const pythonMod = getLessonModule('python')
  const htmlMod = getLessonModule('html')
  const [output, setOutput] = useState('')
  const [runStatus, setRunStatus] = useState(null)
  const [running, setRunning] = useState(false)
  const [runningTests, setRunningTests] = useState(false)
  const [pyodideStatus, setPyodideStatus] = useState(pythonMod.runtime.isReady() ? 'ready' : 'idle')
  const [inputPrompt, setInputPrompt] = useState(null)
  const [iframeSrc, setIframeSrc] = useState(null)
  const [checkResult, setCheckResult] = useState(null)
  const [checkResults, setCheckResults] = useState(null)
  const [incorrectCheckResults, setIncorrectCheckResults] = useState(null)
  const [testResults, setTestResults] = useState(null)
  const [htmlPreviewOpen, setHtmlPreviewOpen] = useState(false)
  const [quizSelectedAnswer, setQuizSelectedAnswer] = useState('')
  const iframeRef = useRef(null)
  const appendOutputRef = useRef(null)

  useEffect(() => {
    if (!isPython && !isScratch) setHtmlPreviewOpen(false)
  }, [task.id, lesson.type])

  function resetRunState() {
    setOutput('')
    setRunStatus(null)
    setCheckResult(null)
    setCheckResults(null)
    setIncorrectCheckResults(null)
    setTestResults(null)
    setIframeSrc(null)
    setHtmlPreviewOpen(false)
  }

  function handleStop() {
    pythonMod.runtime.stop()
  }

  async function ensurePyodideReady() {
    if (pythonMod.runtime.isReady()) return
    // No progress callback — nothing displays the raw progress text, and passing
    // one previously clobbered pyodideStatus's enum with progress strings mid-load.
    setPyodideStatus('loading')
    await pythonMod.runtime.init()
    setPyodideStatus('ready')
  }

  async function handleRunTests() {
    if (runningTests) return
    const tests = task.tests ?? []
    if (tests.length === 0) return
    setRunningTests(true)
    setTestResults(null)
    setOutput('')
    setRunStatus(null)
    setCheckResults(null)
    setIncorrectCheckResults(null)

    const results = []
    try {
      await ensurePyodideReady()

      for (const test of tests) {
        const inputQueue = (test.inputs ?? []).map(inp => inp.value ?? '')
        let accumulated = ''
        const result = await pythonMod.runtime.run(activePythonCode, task, {
          onOutput: text => { accumulated += text },
          onInputRequired: () => { pythonMod.runtime.provideInput(inputQueue.shift() ?? '') },
        })
        const resolvedCheck = resolveTestCheck(test.check, test.inputs ?? [])
        const checkContext = { status: result.status, code: activePythonCode, variables: result.variables ?? {} }
        const checks = normalizeChecks(resolvedCheck)
        const passed = checks.length > 0 && checks.every(c => evaluateSingleCheck(c, accumulated, checkContext))
        results.push({ id: test.id, name: test.name || `Test ${results.length + 1}`, passed, output: accumulated, status: result.status })
        if (result.status === 'stopped') break
      }

      setTestResults(results)
      const displayedOutput = results.find(r => !r.passed)?.output ?? results[results.length - 1]?.output ?? ''
      setOutput(displayedOutput)
      setRunStatus(results.some(r => r.status === 'error') ? 'error' : results.some(r => r.status === 'stopped') ? 'stopped' : 'success')
    } catch {
      pythonMod.runtime.stop()
      setRunStatus('error')
    } finally {
      setRunningTests(false)
    }
  }

  async function handleRun() {
    if (running) return
    setRunning(true)
    setOutput('')
    setRunStatus(null)
    setCheckResult(null)
    setCheckResults(null)
    setIncorrectCheckResults(null)
    setTestResults(null)
    setIframeSrc(null)

    if (isPython) {
      try {
        await ensurePyodideReady()

        let accumulated = ''
        const echoOutput = text => { accumulated += text; setOutput(accumulated) }
        appendOutputRef.current = echoOutput
        const result = await pythonMod.runtime.run(activePythonCode, task, {
          onOutput: echoOutput,
          onInputRequired: p => setInputPrompt(p),
        })
        setInputPrompt(null)

        if (result.status === 'stopped') return

        setRunStatus(result.status)

        const checksToEval = normalizeChecks(task.check)
        if (checksToEval.length > 0) {
          const checkContext = { status: result.status, code: activePythonCode, variables: result.variables ?? {} }
          const results = checksToEval.map(c => ({ ...c, passed: evaluateSingleCheck(c, accumulated, checkContext) }))
          setCheckResults(results)
          set('_checkTested', true)
          const feedbackResults = evaluateFeedbackCheckResults(task, accumulated, checkContext)
          if (feedbackResults.length > 0) {
            setIncorrectCheckResults(feedbackResults)
          }
        }
      } catch {
        pythonMod.runtime.stop()
        setRunStatus('error')
      } finally {
        setRunning(false)
      }
      return
    }

    if (!isScratch) {
      setHtmlPreviewOpen(true)
      const src = htmlMod.runtime.buildPreviewSrc(
        { files: activeFiles, entryFile: activeEntryFile },
        task,
        {
          assets: lesson.assets ?? [],
          assetsPath: resolveAssetsPath(lesson.assetsPath),
          storageAssets: iframeStorageAssets ?? (lesson.storageAssets ?? []).filter(a => a.showInEditor),
        }
      )
      setIframeSrc(src)
      setRunStatus('success')

      const checksToEval = normalizeChecks(task.check)
      if (checksToEval.length > 0) {
        const codeStr = activeFiles.map(f => f.content).join('\n')
        htmlMod.runtime.waitForPreviewText().then(text => {
          setOutput(text)
          const iframeDoc = iframeRef.current?.contentDocument ?? null
          const results = checksToEval.map(c => ({ ...c, passed: evaluateSingleCheck(c, text, { code: codeStr, iframeDoc }) }))
          setCheckResults(results)
          set('_checkTested', true)
          const feedbackResults = evaluateFeedbackCheckResults(task, text, { code: codeStr, iframeDoc })
          if (feedbackResults.length > 0) {
            setIncorrectCheckResults(feedbackResults)
          }
        }).catch(err => {
          console.error('Failed to read HTML preview output for check evaluation', err)
          setRunStatus('error')
        })
      }
    }
    setRunning(false)
  }

  function handleTestChecks() {
    const checksToEval = normalizeChecks(task.check)
    if (checksToEval.length === 0) return
    const codeStr = isPython ? activePythonCode : activeFiles.map(f => f.content).join('\n')
    const results = checksToEval.map(c => ({ ...c, passed: evaluateSingleCheck(c, '', { code: codeStr }) }))
    setCheckResults(results)
    setIncorrectCheckResults(null)
    set('_checkTested', true)
    const feedbackResults = evaluateFeedbackCheckResults(task, '', { code: codeStr })
    if (feedbackResults.length > 0) {
      setIncorrectCheckResults(feedbackResults)
    }
  }

  function handleQuizPreviewSelect(answer, passedOverride) {
    if (passedOverride === null) {
      setQuizSelectedAnswer(answer)
      return
    }
    const passed =
      typeof passedOverride === 'boolean'
        ? passedOverride
        : task.check
          ? evaluateSingleCheck(task.check, answer, { answer: typeof answer === 'string' ? answer : '' })
          : false
    setQuizSelectedAnswer(answer)
    setRunStatus('submitted')
    setCheckResults([{ type: 'quiz_result', passed }])
    if (task.check || typeof passedOverride === 'boolean') set('_checkTested', true)
  }

  function handleInputSubmit(v) {
    appendOutputRef.current?.(v + '\n')
    setInputPrompt(null)
    pythonMod.runtime.provideInput(v)
  }

  return {
    output, runStatus, running, runningTests, pyodideStatus, inputPrompt, iframeSrc,
    checkResult, checkResults, incorrectCheckResults, testResults, htmlPreviewOpen, quizSelectedAnswer,
    iframeRef,
    setCheckResults, setRunStatus, setCheckResult, setIframeSrc, setHtmlPreviewOpen, setQuizSelectedAnswer,
    handleRun, handleRunTests, handleStop, handleTestChecks, handleQuizPreviewSelect, handleInputSubmit,
    resetRunState,
  }
}
