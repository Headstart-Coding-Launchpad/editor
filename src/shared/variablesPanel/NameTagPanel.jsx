import React, { useId, useState } from 'react'
import './NameTagPanel.css'
import {
  currentSnapshot,
  describeVariable,
  findVariable,
  formatValue,
  hiddenItemCount,
  isCollectionNode,
  nodeItems,
  typeLabel,
  visibleVars,
} from './variablesPanel.js'
import { formatTargetValue, targetMatches } from './predictions.js'

// How much of a value shows before "Show all".
const VALUE_CHARS = 48
const TILE_CHARS = 16
const TILE_LIMIT = 10
const DICT_LIMIT = 8

/**
 * The name-tag panel: one tag per variable (its name, a type label and the value), as the
 * student's program left them. Presentational — the caller hands it the data:
 *
 * - `config`: the task's showVariables (getShowVariables): mode view | predict | target,
 *   `predict` names, `target` values
 * - `run`: a run state (buildVariablesRun) or null before any run. It holds a SEQUENCE of
 *   snapshots and an `index`, so a step-by-step player can drive the same panel; `changed`
 *   names get a brief "changed" mark
 * - `predictions`: `{ values: { name: text }, results: { name: bool } | null }`
 * - `onPredictionChange(name, text)` / `onPredictionCommit()`: predict-mode inputs (omit, or
 *   `readOnly`, for a tutor's or a Go Live viewer's copy)
 * - `running`: the program is running now
 * - `audience`: 'student' (default) or 'tutor' (wording)
 *
 * Step-by-step players (Python slow-mo) also pass:
 * - `history`: `{ name: [earlier value nodes, newest first] }`, shown struck through on the tag
 * - `status`: the status line's words (in place of the run summary)
 * - `pulseKey`: changes on every step, so a changed tag pulses again; `pulse: false` turns the
 *   pulse off (fast playback, so tags never flash more than about twice a second)
 */
export default function NameTagPanel({
  config,
  run = null,
  predictions = null,
  onPredictionChange,
  onPredictionCommit,
  readOnly = false,
  running = false,
  audience = 'student',
  history = null,
  status = null,
  pulseKey = null,
  pulse = true,
  style,
}) {
  if (!config) return null
  const snapshot = currentSnapshot(run)
  const vars = visibleVars(snapshot, config.hide)
  const results = predictions?.results ?? null
  const values = predictions?.values ?? {}
  const changed = new Set(Array.isArray(run?.changed) ? run.changed : [])

  const featured =
    config.mode === 'predict'
      ? config.predict
      : config.mode === 'target'
        ? Object.keys(config.target ?? {})
        : []
  const others = vars.filter((entry) => !featured.includes(entry.n))
  const showOthers = !!snapshot && others.length > 0

  return (
    <section
      className={`ntp${pulse ? '' : ' ntp--still'}`}
      aria-label="Variables"
      style={style}
      data-mode={config.mode}
    >
      <div className="ntp-head">
        <h3 className="ntp-title">Variables</h3>
        <p className="ntp-status" role="status" aria-live="polite">
          {status ?? statusText({ config, run, snapshot, results, running, audience })}
        </p>
      </div>

      {config.mode === 'predict' && featured.length > 0 && (
        <ul className="ntp-tags" aria-label="Predictions">
          {featured.map((name) => (
            <PredictTag
              key={name}
              name={name}
              value={values[name] ?? ''}
              result={results && name in results ? results[name] : null}
              node={snapshot ? findVariable(snapshot, name) : null}
              revealed={!!snapshot}
              readOnly={readOnly || !onPredictionChange}
              onChange={(text) => onPredictionChange?.(name, text)}
              onCommit={() => onPredictionCommit?.()}
            />
          ))}
        </ul>
      )}

      {config.mode === 'target' && featured.length > 0 && (
        <ul className="ntp-tags" aria-label="Targets">
          {featured.map((name) => (
            <TargetTag
              key={name}
              name={name}
              target={config.target[name]}
              node={snapshot ? findVariable(snapshot, name) : null}
              ran={!!snapshot}
              changed={changed.has(name)}
            />
          ))}
        </ul>
      )}

      {showOthers && featured.length > 0 && <p className="ntp-section-label">Other variables</p>}
      {showOthers && (
        <ul className="ntp-tags" aria-label={featured.length > 0 ? 'Other variables' : 'Variables'}>
          {others.map((entry) => (
            <ValueTag
              key={changed.has(entry.n) && pulseKey != null ? `${entry.n}@${pulseKey}` : entry.n}
              name={entry.n}
              node={entry.v}
              changed={changed.has(entry.n)}
              previous={history?.[entry.n] ?? null}
              stepping={history != null}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function statusText({ config, run, snapshot, results, running, audience }) {
  const them = audience === 'tutor'
  if (running) return 'Running…'
  if (!run) {
    if (config.mode === 'predict') {
      return them
        ? 'Not run yet. Their predictions show as they type them.'
        : 'Fill in what you think each variable will hold, then press Run.'
    }
    if (config.mode === 'target') {
      return them ? 'Not run yet.' : 'Make each variable match its target, then press Run to check.'
    }
    return them ? 'Not run yet.' : "Press Run to see what's in each variable."
  }
  if (!snapshot) return "The code didn't run, so there's nothing to show yet."
  const parts = []
  if (run.status === 'error') {
    parts.push('The program stopped with an error. These are the values it had then.')
  } else if (run.at === 'marker' && run.peekReached) {
    parts.push(
      snapshot.scope
        ? `The values when the program reached the marked line, inside ${snapshot.scope}().`
        : 'The values when the program reached the marked line.'
    )
  } else if (run.at === 'marker') {
    parts.push('The program never reached the marked line, so these are the values at the end.')
  } else {
    parts.push('The values when the program finished.')
  }
  if (config.mode === 'predict' && results) {
    const names = config.predict
    const right = names.filter((name) => results[name] === true).length
    parts.push(`${right} of ${names.length} predictions right.`)
  }
  if (config.mode === 'target') {
    const names = Object.keys(config.target ?? {})
    const hit = names.filter((name) =>
      targetMatches(findVariable(snapshot, name), config.target[name])
    ).length
    parts.push(`${hit} of ${names.length} on target.`)
  }
  return parts.join(' ')
}

function TagTop({ name, node, changed, label }) {
  return (
    <div className="ntp-tag-top">
      {label ?? <span className="ntp-name">{name}</span>}
      {changed && <span className="ntp-changed">changed</span>}
      {node && <span className="ntp-type">{typeLabel(node)}</span>}
    </div>
  )
}

function ValueTag({ name, node, changed, previous = null, stepping = false }) {
  const earlier = Array.isArray(previous) ? previous.filter(Boolean) : []
  const changedWords = stepping ? ' (changed on this step)' : ' (changed since the last run)'
  const wasWords = earlier.length
    ? `, before that ${earlier.map((value) => formatValue(value, { maxChars: 60 })).join(', then ')}`
    : ''
  return (
    <li
      className={`ntp-tag${changed ? ' is-changed' : ''}`}
      aria-label={describeVariable(name, node) + (changed ? changedWords : '') + wasWords}
    >
      <TagTop name={name} node={node} changed={changed} />
      <ValueView node={node} />
      {earlier.length > 0 && (
        <span className="ntp-history" aria-hidden="true">
          was{' '}
          {earlier.map((value, index) => (
            <React.Fragment key={index}>
              {index > 0 && ', '}
              <s className="ntp-history-value">{formatValue(value, { maxChars: TILE_CHARS })}</s>
            </React.Fragment>
          ))}
        </span>
      )}
    </li>
  )
}

function PredictTag({ name, value, result, node, revealed, readOnly, onChange, onCommit }) {
  const inputId = useId()
  const verdictId = useId()
  const verdictKnown = revealed && result !== null
  const stateClass = verdictKnown ? (result ? ' is-right' : ' is-wrong') : ''
  return (
    <li className={`ntp-tag ntp-tag--predict${stateClass}`}>
      <TagTop
        node={verdictKnown ? node : null}
        label={
          readOnly ? (
            <span className="ntp-name">{name}</span>
          ) : (
            <label className="ntp-name" htmlFor={inputId}>
              {name}
            </label>
          )
        }
      />
      {readOnly ? (
        <span className="ntp-value">
          {value ? (
            <>
              <span className="ntp-sr-only">Prediction: </span>
              {value}
            </>
          ) : (
            <span className="ntp-missing">no prediction yet</span>
          )}
        </span>
      ) : (
        <input
          id={inputId}
          className="ntp-input"
          type="text"
          value={value}
          placeholder="Your prediction"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby={verdictKnown ? verdictId : undefined}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onCommit}
        />
      )}
      {verdictKnown && (
        <div id={verdictId} className="ntp-verdict">
          {result ? '✓ Right' : '✗ Not quite'}
          {node ? (
            <>
              <span className="ntp-sr-only">, it holds {describeVariable(name, node)}</span>
              <span aria-hidden="true"> — it holds:</span>
            </>
          ) : (
            <span> — {name} was never made</span>
          )}
        </div>
      )}
      {verdictKnown && node && (
        <div aria-hidden="true">
          <ValueView node={node} />
        </div>
      )}
      {revealed && result === null && (
        <span className="ntp-more">Changed — press Run to check it again.</span>
      )}
    </li>
  )
}

function TargetTag({ name, target, node, ran, changed }) {
  const hit = ran && targetMatches(node, target)
  const stateClass = ran ? (hit ? ' is-right' : ' is-wrong') : ''
  const label = `${name}: target ${formatTargetValue(target)}, ${
    !ran ? 'not run yet' : node ? describeVariable(name, node) : 'not made yet'
  }${ran ? (hit ? ', on target' : ', not on target yet') : ''}`
  return (
    <li
      className={`ntp-tag ntp-tag--target${stateClass}${changed ? ' is-changed' : ''}`}
      aria-label={label}
    >
      <TagTop name={name} node={node} changed={changed} />
      <span className="ntp-target">
        Target: <code className="ntp-value">{formatTargetValue(target)}</code>
      </span>
      {ran &&
        (node ? <ValueView node={node} /> : <span className="ntp-missing">not made yet</span>)}
      {ran && <span className="ntp-verdict">{hit ? '✓ On target' : '✗ Not yet'}</span>}
    </li>
  )
}

/** A value: text / numbers inline, lists as indexed tiles, dicts as key → value rows. */
export function ValueView({ node }) {
  const [expanded, setExpanded] = useState(false)
  if (!node) return null
  if (!isCollectionNode(node)) {
    const full = formatValue(node)
    const cut = !expanded && (full.length > VALUE_CHARS || node.more > 0)
    return (
      <>
        <code className="ntp-value">
          {cut ? formatValue(node, { maxChars: VALUE_CHARS }) : full}
        </code>
        {node.more > 0 && expanded && (
          <span className="ntp-more">({node.more} more characters not shown)</span>
        )}
        {(full.length > VALUE_CHARS || node.more > 0) && (
          <ExpandButton expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
        )}
      </>
    )
  }
  const items = nodeItems(node)
  const notRead = hiddenItemCount(node)
  if (items.length === 0 && notRead === 0) {
    return <code className="ntp-empty">{formatValue(node)} (empty)</code>
  }
  const limit = node.t === 'dict' ? DICT_LIMIT : TILE_LIMIT
  const shown = expanded ? items : items.slice(0, limit)
  const folded = items.length - shown.length
  const anyCut =
    folded > 0 ||
    items.some((item) =>
      node.t === 'dict'
        ? formatValue(item?.v).length > VALUE_CHARS
        : formatValue(item).length > TILE_CHARS
    )
  return (
    <>
      {node.t === 'dict' ? (
        <dl className="ntp-dict">
          {shown.map((entry, index) => (
            <React.Fragment key={index}>
              <dt>
                <code className="ntp-value">{formatValue(entry?.k, { maxChars: TILE_CHARS })}</code>
              </dt>
              <dd className="ntp-arrow" aria-hidden="true">
                →
              </dd>
              <dd>
                <code className="ntp-value">
                  {formatValue(entry?.v, { maxChars: expanded ? Infinity : VALUE_CHARS })}
                </code>
              </dd>
            </React.Fragment>
          ))}
        </dl>
      ) : (
        <ol className="ntp-tiles" start={0}>
          {shown.map((item, index) => (
            <li key={index} className="ntp-tile">
              <code className="ntp-value">
                {formatValue(item, { maxChars: expanded ? Infinity : TILE_CHARS })}
              </code>
              {node.t !== 'set' && <span className="ntp-index">{index}</span>}
            </li>
          ))}
        </ol>
      )}
      {folded > 0 && <span className="ntp-more">+{folded} more</span>}
      {notRead > 0 && (
        <span className="ntp-more">
          {notRead} more {notRead === 1 ? 'item' : 'items'} not shown
        </span>
      )}
      {anyCut && <ExpandButton expanded={expanded} onToggle={() => setExpanded((v) => !v)} />}
    </>
  )
}

function ExpandButton({ expanded, onToggle }) {
  return (
    <button
      type="button"
      className="btn-ghost-outline ntp-expand"
      aria-expanded={expanded}
      onClick={onToggle}
    >
      {expanded ? 'Show less' : 'Show all'}
    </button>
  )
}
