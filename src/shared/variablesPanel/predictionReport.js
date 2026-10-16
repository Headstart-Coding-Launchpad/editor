// Session-report hook-up for name-tag panel predictions (showVariables mode: predict). Kept out
// of lessonReport.js so that file only spreads these in. Shapes: docs/authoring/session-reports.md.
import { getShowVariables } from './variablesPanel.js'
import { summarizeVariablePredictions, variablePredictionReportFields } from './predictions.js'

export { summarizeVariablePredictions }

/**
 * A student's prediction fields for one task (`{ predictions }`, from
 * students/{id}/predictionLog/{taskId}), or `{}` for a task that isn't in predict mode or a
 * student who never revealed a prediction.
 */
export function taskPredictionFields(task, studentNode) {
  const config = getShowVariables(task)
  if (config?.mode !== 'predict') return {}
  return variablePredictionReportFields(task, studentNode, config.predict, config.predictType)
}
