import BuilderOutputPanel from '../BuilderOutputPanel'

export default function TaskTestResults({ output, runStatus, running, inputPrompt, onInputSubmit, checkResults, incorrectCheckResults, testResults }) {
  return (
    <BuilderOutputPanel
      output={output}
      runStatus={runStatus}
      running={running}
      inputPrompt={inputPrompt}
      onInputSubmit={onInputSubmit}
      checkResults={testResults !== null ? null : checkResults}
      incorrectCheckResults={testResults !== null ? null : incorrectCheckResults}
      testResults={testResults}
    />
  )
}
