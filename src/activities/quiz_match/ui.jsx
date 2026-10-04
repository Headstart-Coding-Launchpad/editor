import React from 'react'
import { MarkdownFieldEditor } from '../../shared/MarkdownFieldEditor'
import { Field } from '../ui/BuilderField.jsx'
import { QuizTypeIcon } from '../quiz/QuizTypeIcon.jsx'
import { switchQuizType } from '../quiz/quizBuilder.js'
import { QuizActivityStudentView, makeItemsCardSummary } from '../quiz/QuizActivityViews.jsx'
import definition from './definition.js'

// Builder editor (moved from src/builder/components/task-editor/QuizEditors.jsx, unchanged).
export function MatchPairsBuilder({ task, onUpdate, lessonType = null }) {
  const pairs = task.pairs?.length
    ? task.pairs
    : [
        { id: 'p1', prompt: '', answer: '' },
        { id: 'p2', prompt: '', answer: '' },
      ]

  function renumber(nextPairs) {
    return nextPairs.map((p, i) => ({ ...p, id: `p${i + 1}` }))
  }
  function updatePairs(nextPairs) {
    onUpdate({ ...task, pairs: renumber(nextPairs), _checkTested: false })
  }
  function updatePair(index, field, value) {
    updatePairs(pairs.map((p, i) => (i === index ? { ...p, [field]: value } : p)))
  }

  return (
    <Field label="Pairs (students match left to right)">
      <div className="te-quiz-answer-stack">
        {pairs.map((pair, index) => (
          <div key={pair.id || index} className="te-quiz-answer-card">
            <span className="te-quiz-answer-badge">{index + 1}</span>
            <div className="te-match-pair-row">
              <div className="te-quiz-answer-block">
                <span className="te-quiz-answer-label">Prompt</span>
                <MarkdownFieldEditor
                  height={132}
                  minHeight={118}
                  ariaLabel={`Match prompt ${index + 1} Markdown editor views`}
                  value={pair.prompt}
                  onChange={(value) => updatePair(index, 'prompt', value)}
                  placeholder={`Prompt ${index + 1} in Markdown`}
                  lessonType={lessonType}
                />
              </div>
              <span className="te-match-arrow">-</span>
              <div className="te-quiz-answer-block">
                <span className="te-quiz-answer-label">Answer</span>
                <MarkdownFieldEditor
                  height={132}
                  minHeight={118}
                  ariaLabel={`Match answer ${index + 1} Markdown editor views`}
                  value={pair.answer}
                  onChange={(value) => updatePair(index, 'answer', value)}
                  placeholder={`Correct answer ${index + 1} in Markdown`}
                  lessonType={lessonType}
                />
              </div>
            </div>
            <button
              type="button"
              className="te-remove-btn"
              onClick={() => updatePairs(pairs.filter((_, i) => i !== index))}
              disabled={pairs.length <= 2}
              title="Remove pair"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="te-add-check-btn"
          onClick={() => updatePairs([...pairs, { id: '', prompt: '', answer: '' }])}
        >
          + Add pair
        </button>
      </div>
    </Field>
  )
}

// The existing match component (via QuizTask), hosted as an activity.
export default {
  StudentView: QuizActivityStudentView,
  CardSummary: makeItemsCardSummary(definition),
  ownsLayout: true,
  BuilderEditor: MatchPairsBuilder,
  BuilderIcon: () => <QuizTypeIcon type="match" />,
  builderHint: 'Pair items',
  builderConvert: (task) => switchQuizType(task, 'match'),
}
