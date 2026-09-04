import React from 'react'
import { InlineMarkdown, MarkdownRenderer } from '../../../shared/markdown'
import CheckFeedbackBanner from '../CheckFeedbackBanner'
import {
  baseStyles as s,
  fitScratchQuizScale,
  normalizeQuizAnswerText,
  OPTION_COLOURS,
  OPTION_VERDICT_COLOURS,
  QuestionPanel,
  shrinkToFit,
} from './quizUtils'

export default function MultipleChoiceQuiz({
  task,
  selectedAnswer,
  onSelectAnswer,
  submitted,
  checkPassed,
  disabled,
  showQuestion,
  showResult,
  showCorrectAnswer,
}) {
  const options = task?.options ?? []
  const correctId = task?.check?.type === 'answer_equals' ? task.check.value : null
  const revealAnswers = showCorrectAnswer && submitted && disabled && correctId
  const locked = disabled || (submitted && checkPassed)
  const optionsFrameRef = React.useRef(null)
  const optionsGridRef = React.useRef(null)
  const [optionsScale, setOptionsScale] = React.useState(1)

  // Options render in the order the lesson author wrote them. They are shuffled once, by
  // the authoring agent, when the lesson is written; shuffling again per mount gave every
  // student in the room a different order, which is why neither the colour nor the letter
  // could be used to refer to an answer out loud.
  const displayedOptions = options

  React.useLayoutEffect(() => {
    const container = optionsFrameRef.current
    const content = optionsGridRef.current
    if (!container || !content) return undefined

    const run = () =>
      shrinkToFit({
        setScale: (scale) => {
          content.style.setProperty('--quiz-option-scale', String(scale))
          setOptionsScale(scale)
        },
        isOverflowing: () =>
          content.scrollHeight > container.clientHeight + 1 ||
          content.scrollWidth > container.clientWidth + 1,
      })

    run()
    if (typeof ResizeObserver === 'undefined') return undefined
    // Only observe the frame, not the grid itself: the grid is what we resize,
    // and font-size changes (unlike transform: scale) affect layout, so
    // observing it here would re-trigger this same observer on our own writes.
    const observer = new ResizeObserver(run)
    observer.observe(container)
    return () => observer.disconnect()
  }, [displayedOptions])

  return (
    <div style={s.wrap}>
      {showQuestion && <QuestionPanel task={task} />}
      <div ref={optionsFrameRef} style={s.optionsFrame}>
        <div
          ref={optionsGridRef}
          style={s.options}
          role="radiogroup"
          aria-label={task?.title ?? 'Quiz options'}
        >
          {displayedOptions.map((option, index) => {
            const active = selectedAnswer === option.id
            const isCorrect = revealAnswers && option.id === correctId
            const isWrong = revealAnswers && active && option.id !== correctId
            // Decoration by position; a verdict only once the answer has been submitted.
            // OPTION_COLOURS holds no success or error hue, so a selected card can never
            // be mistaken for a judged one.
            const colour = OPTION_COLOURS[index % OPTION_COLOURS.length]
            const verdict = isCorrect
              ? OPTION_VERDICT_COLOURS.correct
              : isWrong
                ? OPTION_VERDICT_COLOURS.wrong
                : null

            const bg = verdict ? verdict.background : active ? colour.active : colour.background
            const border = verdict ? verdict.border : colour.border
            const textColour = verdict ? verdict.text : active ? '#fff' : colour.text
            const optionText = normalizeQuizAnswerText(option.text)
            const usesBlockMarkdown = hasFencedCodeBlock(optionText)
            const usesScratchMarkdown = isScratchMarkdown(optionText)
            const chooseOption = () => {
              if (!locked) onSelectAnswer?.(option.id)
            }

            return (
              <div
                key={option.id}
                role="radio"
                aria-checked={active}
                aria-disabled={locked || undefined}
                tabIndex={locked ? -1 : 0}
                style={{
                  ...s.option,
                  background: bg,
                  borderColor: border,
                  color: textColour,
                  ...(active || isCorrect || isWrong ? s.optionActive : {}),
                }}
                onClick={chooseOption}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    chooseOption()
                  }
                }}
              >
                <span
                  style={{
                    ...s.optionId,
                    background:
                      active || isCorrect || isWrong ? 'rgba(255,255,255,0.22)' : colour.active,
                    color: '#fff',
                  }}
                >
                  {option.id}
                </span>
                <div
                  style={{ ...s.optionText, ...(usesScratchMarkdown ? s.scratchOptionText : {}) }}
                >
                  {usesScratchMarkdown ? (
                    <ScratchQuizOptionContent kind={usesBlockMarkdown ? 'stack' : 'inline'}>
                      {usesBlockMarkdown ? (
                        <MarkdownRenderer
                          content={optionText}
                          textScale={1.2}
                          inheritColor={active || isCorrect || isWrong}
                        />
                      ) : (
                        <span style={active || isCorrect || isWrong ? s.markdownOnDark : undefined}>
                          <InlineMarkdown content={optionText} />
                        </span>
                      )}
                    </ScratchQuizOptionContent>
                  ) : usesBlockMarkdown ? (
                    <MarkdownRenderer
                      content={optionText}
                      textScale={1.2 * optionsScale}
                      inheritColor={active || isCorrect || isWrong}
                    />
                  ) : (
                    <span style={active || isCorrect || isWrong ? s.markdownOnDark : undefined}>
                      <InlineMarkdown content={optionText} />
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {revealAnswers && !checkPassed && (
        <div style={s.correctAnswerNote}>
          Correct answer:{' '}
          <span style={s.correctAnswerText}>
            <InlineMarkdown
              content={normalizeQuizAnswerText(
                options.find((o) => o.id === correctId)?.text ?? correctId
              )}
            />
          </span>
        </div>
      )}
      {showResult && submitted && (
        <CheckFeedbackBanner
          passed={checkPassed}
          failureMessage="Wrong answer, try again."
          suggestion={getMultipleChoiceSuggestion(task, selectedAnswer)}
        />
      )}
    </div>
  )
}

function hasFencedCodeBlock(content) {
  return /(^|\n)```/.test(content)
}

function isScratchMarkdown(content) {
  return /`scratch:|```scratch\b/i.test(content)
}

function ScratchQuizOptionContent({ kind, children }) {
  const preferredScale = 1.5
  const frameRef = React.useRef(null)
  const contentRef = React.useRef(null)
  const scaleRef = React.useRef(preferredScale)
  const [scale, setScale] = React.useState(preferredScale)
  scaleRef.current = scale

  React.useLayoutEffect(() => {
    const measure = () => {
      const frame = frameRef.current
      const content = contentRef.current
      if (!frame || !content) return

      const rect = content.getBoundingClientRect()
      const currentScale = scaleRef.current || 1
      const contentWidth = rect.width / currentScale
      const contentHeight = rect.height / currentScale
      const nextScale = fitScratchQuizScale({
        preferredScale,
        availableWidth: frame.clientWidth,
        availableHeight: frame.parentElement?.parentElement?.clientHeight ?? 0,
        contentWidth,
        contentHeight,
      })
      setScale((current) => (Math.abs(current - nextScale) < 0.01 ? current : nextScale))
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    if (frameRef.current) observer.observe(frameRef.current)
    if (contentRef.current) observer.observe(contentRef.current)
    if (frameRef.current?.parentElement) observer.observe(frameRef.current.parentElement)
    return () => observer.disconnect()
  }, [preferredScale])

  return (
    <div ref={frameRef} style={s.scratchOptionText}>
      <div
        ref={contentRef}
        style={{
          ...s.scratchOptionScale,
          // Inline Scratch uses an em-based font while fenced blocks use 13px.
          // Normalise the quiz wrapper so both forms share the same base size
          // before the responsive scale is applied.
          ...(kind === 'inline' ? { fontSize: `${13 / 0.82}px` } : {}),
          transform: `scale(${scale})`,
        }}
        data-scratch-quiz-scale={kind}
      >
        {children}
      </div>
    </div>
  )
}

function getMultipleChoiceSuggestion(task, selectedAnswer) {
  if (checkPassedFromTask(task, selectedAnswer)) return ''
  const option = task?.options?.find((o) => o.id === selectedAnswer)
  return String(
    option?.feedback ?? option?.hint ?? task?.feedback ?? task?.check?.hint ?? ''
  ).trim()
}

function checkPassedFromTask(task, selectedAnswer) {
  return task?.check?.type === 'answer_equals' && task.check.value === selectedAnswer
}
