import { useState } from 'react'

// ActivityLayout: the one screen layout for activities (Layout briefs 2026-10-28). It has no
// state of its own about the activity, no marking and no Firebase writes: an activity keeps its
// own logic and only puts its JSX into these slots.
//
//   progress      RoundProgress, above the stage.
//   stageTop      switches that change the picture (a row at the top of the stage).
//   stage         the picture (left column, takes the space that is left).
//   result        the result: banner, score or verdict (aria-live="polite"). Placed by
//                 resultPlacement: 'overlay' (on the stage's bottom edge), 'top' (just above the
//                 stage) or 'side' (top of the right column).
//   action        { main, secondary, link } where each is { label, icon, onClick, disabled,
//                 testId, ariaLabel }, or any React node (rendered as it is, for activities that
//                 swap in their own buttons). Right column, or under the stage when
//                 actionUnderStage is set. Stacked: straight after the stage and result.
//   tip           one line of text (the only yellow element).
//   controls      cards of dials (right column).
//   folds         [{ id, title, summary, defaultOpen, revealed, children }]. Closed by default;
//                 revealed: false leaves it out. Controlled with openFolds ({ [id]: boolean }) and
//                 onFoldToggle(id, open) when the open state should be in the shared state;
//                 otherwise it is kept here.
//
// Two columns when the panel is at least 900px wide (a container query, so it also works in the
// narrow tutor modal), stacked below that: progress, stage, action, tip, controls, folds.

export function ActButton({ main, secondary, link }) {
  const render = (spec, className) =>
    spec ? (
      <button
        type="button"
        className={className}
        disabled={spec.disabled}
        aria-label={spec.ariaLabel}
        data-testid={spec.testId}
        onClick={spec.onClick}
      >
        {spec.icon ? (
          <span aria-hidden="true" className="act-btn__icon">
            {spec.icon}
          </span>
        ) : null}
        {spec.label}
      </button>
    ) : null
  return (
    <>
      {render(main, 'act-btn act-btn--main')}
      {(secondary || link) && (
        <div className="act-layout__action-row">
          {render(secondary, 'act-btn act-btn--secondary')}
          {render(link, 'act-link')}
        </div>
      )}
    </>
  )
}

function isSpec(action) {
  return (
    action != null &&
    typeof action === 'object' &&
    !Array.isArray(action) &&
    !('$$typeof' in action) &&
    ('main' in action || 'secondary' in action || 'link' in action)
  )
}

// A multi-pick toggle: dashed pill when off, solid accent outline, lilac fill and a ✓ when on.
// Never a solid accent fill (that always means "press me to do something").
export function ActChip({ pressed, onClick, disabled, children, className = '', ...rest }) {
  return (
    <button
      type="button"
      className={`act-chip${className ? ` ${className}` : ''}`}
      aria-pressed={!!pressed}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      {pressed ? (
        <span className="act-chip__tick" aria-hidden="true">
          ✓
        </span>
      ) : null}
      {children}
    </button>
  )
}

// A pick-one switch: grey track, the selected option a white raised pill with a ✓. `options` is
// [{ value, label, ariaLabel }]. Each option is a radio.
export function ActSegmented({ label, options, value, onChange, disabled, testId }) {
  return (
    <div
      className="act-seg"
      role="radiogroup"
      aria-label={label}
      data-testid={testId}
      data-act-control="group"
    >
      {options.map((option) => {
        const on = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={option.ariaLabel}
            className={`act-seg__opt${on ? ' act-seg__opt--on' : ''}`}
            disabled={disabled}
            onClick={() => onChange?.(option.value)}
          >
            {on ? (
              <span className="act-chip__tick" aria-hidden="true">
                ✓
              </span>
            ) : null}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

// A number: − value + in one outlined box. `name` makes the aria-labels ("Fewer layers").
export function ActStepper({
  name,
  value,
  min = 0,
  max = 99,
  onChange,
  disabled,
  lessLabel,
  moreLabel,
  valueText,
}) {
  return (
    <div className="act-stepper" role="group" aria-label={name} data-act-control="group">
      <button
        type="button"
        aria-label={lessLabel ?? `Fewer ${name}`}
        disabled={disabled || value <= min}
        onClick={() => onChange?.(value - 1)}
      >
        −
      </button>
      <span className="act-stepper__value" aria-live="polite">
        {valueText ?? value}
      </span>
      <button
        type="button"
        aria-label={moreLabel ?? `More ${name}`}
        disabled={disabled || value >= max}
        onClick={() => onChange?.(value + 1)}
      >
        +
      </button>
    </div>
  )
}

// A collapsible card: { id, title, summary, children }. Closed children are not rendered.
export function ActFold({ fold, open, onToggle }) {
  const bodyId = `act-fold-${fold.id}`
  return (
    <section className="act-fold" data-testid={`act-fold-${fold.id}`}>
      <button
        type="button"
        className="act-fold__head"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => onToggle(!open)}
      >
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span className="act-fold__title">{fold.title}</span>
        {fold.summary ? <span className="act-fold__summary">{fold.summary}</span> : null}
      </button>
      {open ? (
        <div className="act-fold__body" id={bodyId}>
          {fold.children}
        </div>
      ) : null}
    </section>
  )
}

export default function ActivityLayout({
  progress = null,
  stageTop = null,
  stage = null,
  result = null,
  resultPlacement = 'overlay',
  action = null,
  actionUnderStage = false,
  tip = null,
  controls = null,
  folds = [],
  openFolds = null,
  onFoldToggle = null,
  className = '',
  testId,
}) {
  const [localOpen, setLocalOpen] = useState({})
  const shownFolds = folds.filter((fold) => fold.revealed !== false)
  const isOpen = (fold) => {
    if (openFolds && fold.id in openFolds) return !!openFolds[fold.id]
    if (fold.id in localOpen) return localOpen[fold.id]
    return !!fold.defaultOpen
  }
  const toggle = (fold, next) => {
    if (onFoldToggle) onFoldToggle(fold.id, next)
    if (!openFolds) setLocalOpen((prev) => ({ ...prev, [fold.id]: next }))
  }

  const actionNode = isSpec(action) ? (
    <div className="act-layout__action">
      <ActButton {...action} />
    </div>
  ) : action ? (
    <div className="act-layout__action">{action}</div>
  ) : null

  const resultNode =
    result != null && result !== false ? (
      <div
        className={`act-layout__result act-layout__result--${resultPlacement}`}
        role="status"
        aria-live="polite"
        data-testid="act-layout-result"
      >
        {result}
      </div>
    ) : null

  return (
    <div className={`act-layout${className ? ` ${className}` : ''}`} data-testid={testId}>
      <div className="act-layout__grid">
        <div className="act-layout__main">
          {progress}
          <div className="act-layout__stagebox">
            {stageTop ? <div className="act-layout__stagetop">{stageTop}</div> : null}
            {resultPlacement === 'top' ? resultNode : null}
            <div className="act-layout__stage">
              {stage}
              {resultPlacement === 'overlay' ? resultNode : null}
            </div>
          </div>
          {actionUnderStage ? actionNode : null}
        </div>
        <div className="act-layout__side">
          {resultPlacement === 'side' ? resultNode : null}
          {actionUnderStage ? null : actionNode}
          {tip ? <p className="act-tip">{tip}</p> : null}
          {controls}
          {shownFolds.map((fold) => (
            <ActFold
              key={fold.id}
              fold={fold}
              open={isOpen(fold)}
              onToggle={(next) => toggle(fold, next)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
