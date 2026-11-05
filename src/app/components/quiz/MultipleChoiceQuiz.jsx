import React from 'react'
import { InlineMarkdown, MarkdownRenderer } from '../../../shared/markdown'
import CheckFeedbackBanner from '../CheckFeedbackBanner'
import { encodePollChoice, parsePollChoice } from '../../../shared/classPolls'
import { useChoiceEntrance } from '../../../activities/ui/choiceEntrance.jsx'
import {
  optionHasPicture,
  quizHasPictureOptions,
  quizOptionAriaLabel,
  quizOptionDescription,
  quizOptionLabel,
} from '../../../shared/quizPictureOptions'
import { QuizOptionPicture } from './QuizOptionPicture'
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
  // Extra content under the options (a poll's "you can change your vote" line).
  footer = null,
  // Poll only: tick any number of options; selectedAnswer is then a JSON array string.
  multiple = false,
}) {
  const options = task?.options ?? []
  const ticked = multiple ? parsePollChoice(selectedAnswer) : []
  const correctId = task?.check?.type === 'answer_equals' ? task.check.value : null
  const revealAnswers = showCorrectAnswer && submitted && disabled && correctId
  const correctOption = options.find((o) => o.id === correctId)
  const locked = disabled || (submitted && checkPassed)
  const optionsFrameRef = React.useRef(null)
  const optionsGridRef = React.useRef(null)
  const [optionsScale, setOptionsScale] = React.useState(1)
  const entrance = useChoiceEntrance()

  // Options render in the order the lesson author wrote them. They are shuffled once, by
  // the authoring agent, when the lesson is written; shuffling again per mount gave every
  // student in the room a different order, which is why neither the colour nor the letter
  // could be used to refer to an answer out loud.
  const displayedOptions = options

  // Picture answer options (request 128): equal cards in a grid (2 or 3 side by side, 4 as
  // 2x2, one column in a narrow pane via .quiz-picture-grid in index.css). Never on a poll. An
  // option with no picture is drawn as a normal word card in the same grid; more than 4 options
  // (a validation error) still all show, in more rows.
  const pictureMode = !multiple && task?.quizType !== 'poll' && quizHasPictureOptions(task)
  const pictureColumns = options.length === 3 ? 3 : 2

  React.useLayoutEffect(() => {
    const container = optionsFrameRef.current
    const content = optionsGridRef.current
    if (!container || !content) return undefined

    // A rising option (its first-view entrance) is translated down, which scrollHeight counts
    // as overflow; measure with the options at rest so the entrance never shrinks them. An
    // !important declaration outranks the animation without restarting it.
    const run = () => {
      const options = Array.from(content.children)
      options.forEach((option) => option.style.setProperty('transform', 'none', 'important'))
      try {
        shrinkToFit({
          setScale: (scale) => {
            content.style.setProperty('--quiz-option-scale', String(scale))
            setOptionsScale(scale)
          },
          // An option's own text scrolls sideways rather than spilling (unbroken code), so
          // check each one too: shrink before falling back to a scroll.
          isOverflowing: () =>
            content.scrollHeight > container.clientHeight + 1 ||
            content.scrollWidth > container.clientWidth + 1 ||
            Array.from(content.querySelectorAll('.quiz-option-text')).some(
              (text) => text.scrollWidth > text.clientWidth + 1
            ),
        })
      } finally {
        options.forEach((option) => option.style.removeProperty('transform'))
      }
    }

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
      <div
        ref={optionsFrameRef}
        style={s.optionsFrame}
        className={pictureMode ? 'quiz-picture-frame' : undefined}
      >
        <div
          ref={optionsGridRef}
          style={pictureMode ? { ...s.options, ...s.pictureOptions } : s.options}
          className={pictureMode ? 'quiz-picture-grid' : undefined}
          data-picture-columns={pictureMode ? pictureColumns : undefined}
          role={multiple ? 'group' : 'radiogroup'}
          aria-label={task?.title ?? 'Quiz options'}
        >
          {displayedOptions.map((option, index) => {
            const active = multiple ? ticked.includes(option.id) : selectedAnswer === option.id
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
            // A picture option's words are its caption; outside picture mode (a poll, say) a
            // stray picture option is named by its alt text rather than left blank.
            const optionText = normalizeQuizAnswerText(
              pictureMode || option.text?.trim() ? option.text : quizOptionDescription(option)
            )
            const usesBlockMarkdown = hasFencedCodeBlock(optionText)
            const usesScratchMarkdown = isScratchMarkdown(optionText)
            const chooseOption = () => {
              if (locked) return
              if (multiple) {
                onSelectAnswer?.(
                  encodePollChoice(
                    active ? ticked.filter((id) => id !== option.id) : [...ticked, option.id]
                  )
                )
              } else onSelectAnswer?.(option.id)
            }

            const optionEntrance = entrance(index)
            const onKeyDown = (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                chooseOption()
              }
            }

            if (pictureMode && optionHasPicture(option)) {
              const caption = optionText.trim()
              // The tick badge: ✓ on the chosen card (or the revealed right answer), ✗ on a
              // chosen wrong answer once a tutor's view reveals the verdict.
              const badge = isWrong ? '✗' : active || isCorrect ? '✓' : null
              const ring = verdict ? verdict.border : colour.active
              return (
                <div
                  key={option.id}
                  role="radio"
                  aria-checked={active}
                  aria-disabled={locked || undefined}
                  aria-label={quizOptionAriaLabel(option)}
                  tabIndex={locked ? -1 : 0}
                  className={optionEntrance.className}
                  style={{
                    ...s.pictureOption,
                    borderColor: verdict ? verdict.border : colour.border,
                    background: active && !verdict ? colour.background : '#fff',
                    ...(active || isCorrect || isWrong
                      ? {
                          boxShadow: `inset 0 0 0 4px ${ring}, 0 6px 18px rgba(17, 24, 39, 0.18)`,
                          zIndex: 2,
                        }
                      : {}),
                    ...optionEntrance.style,
                  }}
                  onClick={chooseOption}
                  onKeyDown={onKeyDown}
                >
                  <div style={s.pictureRow}>
                    {/* The letter and the tick sit in their own column, never over the
                        picture (a "Which Corner?" picture has its answer in a corner). */}
                    <div style={s.pictureSide}>
                      <span style={{ ...s.pictureOptionId, background: colour.active }}>
                        {option.id}
                      </span>
                      {badge && (
                        <span
                          data-testid="quiz-picture-tick"
                          aria-hidden="true"
                          style={{ ...s.pictureTick, background: ring }}
                        >
                          {badge}
                        </span>
                      )}
                    </div>
                    <div style={s.pictureBox} data-picture-box="">
                      <QuizOptionPicture option={option} />
                    </div>
                  </div>
                  {caption && (
                    <div className="quiz-option-text" style={s.pictureCaption}>
                      <InlineMarkdown content={caption} />
                    </div>
                  )}
                </div>
              )
            }

            return (
              <div
                key={option.id}
                role={multiple ? 'checkbox' : 'radio'}
                aria-checked={active}
                aria-disabled={locked || undefined}
                tabIndex={locked ? -1 : 0}
                className={optionEntrance.className}
                style={{
                  ...s.option,
                  background: bg,
                  borderColor: border,
                  color: textColour,
                  ...(active || isCorrect || isWrong ? s.optionActive : {}),
                  ...optionEntrance.style,
                }}
                onClick={chooseOption}
                onKeyDown={onKeyDown}
              >
                <span
                  style={{
                    ...s.optionId,
                    background:
                      active || isCorrect || isWrong ? 'rgba(255,255,255,0.22)' : colour.active,
                    color: '#fff',
                  }}
                >
                  {multiple && active ? '\u2713' : option.id}
                </span>
                <div
                  className="quiz-option-text"
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
          {optionHasPicture(correctOption) && (
            <QuizOptionPicture
              option={correctOption}
              size={40}
              decorative
              style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 6 }}
            />
          )}
          <span style={s.correctAnswerText}>
            <InlineMarkdown
              content={
                optionHasPicture(correctOption)
                  ? quizOptionLabel(correctOption)
                  : normalizeQuizAnswerText(correctOption?.text ?? correctId)
              }
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
      {footer}
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
