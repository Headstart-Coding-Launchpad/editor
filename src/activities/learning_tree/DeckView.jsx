import { useState } from 'react'
import ActivityLayout, { ActChip, ActStepper } from '../ui/ActivityLayout.jsx'
import {
  MAX_NAME,
  allowedFeaturesOf,
  clampDepth,
  deckRowsOf,
  depthOf,
  displayLabelsOf,
  featureQuestion,
  featuresOf,
  gradeTask,
  labelsOf,
  maxDepthOf,
  normalizeState,
  picksOf,
  studentDepthOn,
  studentLabelsOn,
  twentyQuestionsOn,
} from './learning_tree.js'
import { pathOf } from './tree.js'
import Tree from './TreeDiagram.jsx'

// Learning Tree, deck mode: the tree is on the left; on the right the child sorts a ready-made
// deck of cards into bins (drag, or tap a card then a bin) and the tree regrows at once. With
// twentyQuestions a "Play 20 Questions" test has the tree ask about a new card one question at a
// time, light its path and guess a bin. Controlled view like the plain one; only sorting, bin
// names and marked rounds reach the state. The play position (which card, which question) lives
// in this view.

const NONE = '-'

// The boxes the child has walked through: the tree is rebuilt on every render, so the walk is kept
// as the answers given and replayed down the current tree.
const walkOf = (tree, answers) =>
  answers.reduce((nodes, yes) => [...nodes, yes ? nodes.at(-1).yes : nodes.at(-1).no], [tree])

export default function LearningTreeDeckView({ task, state, onChange, readOnly = false }) {
  const features = featuresOf(task)
  const clean = normalizeState(task, state)
  const labels = displayLabelsOf(task, clean)
  const bins = labelsOf(task)
  const deck = deckRowsOf(task)
  const g = gradeTask(task, clean)
  const twenty = twentyQuestionsOn(task)
  const [sel, setSel] = useState(null)
  const [play, setPlay] = useState(null)
  const [picked, setPicked] = useState(null)
  const [note, setNote] = useState(null)
  const [showFacts, setShowFacts] = useState(false)
  const [everTried, setEverTried] = useState(!!clean.tried)
  const [blocked, setBlocked] = useState(false)
  const maxDepth = maxDepthOf(task)
  const depth = depthOf(task, clean)
  const picks = picksOf(task)
  const allowed = allowedFeaturesOf(task, clean)

  function change(fn) {
    onChange?.((prev) => fn(normalizeState(task, prev)))
  }

  const blankRounds = () => '-'.repeat(g.total)

  function moveCard(index, bin) {
    if (readOnly || index == null || !deck[index]) return
    setSel(null)
    setPicked(null)
    setPlay(null)
    setNote(null)
    change((prev) => {
      const cells = Array.from(prev.b)
      if (cells[index] === String(bin)) return prev
      cells[index] = String(bin)
      return { ...prev, b: cells.join(''), tried: false, ...(twenty ? { q: blankRounds() } : {}) }
    })
  }

  function rename(i, text) {
    change((prev) => {
      const ln = bins.map((_, j) => (j === i ? text : (prev.ln?.[j] ?? '')))
      return { ...prev, ln }
    })
  }

  function setDepth(next) {
    const d = clampDepth(task, next)
    if (d === depth) return
    setPicked(null)
    setPlay(null)
    change((prev) => ({ ...prev, d, tried: false, ...(twenty ? { q: blankRounds() } : {}) }))
  }

  function toggleFeature(i) {
    const on = allowed.includes(i)
    if (!on && allowed.length >= picks) {
      setBlocked(true)
      return
    }
    setBlocked(false)
    setPicked(null)
    setPlay(null)
    change((prev) => {
      const u = features.map((_, j) => {
        if (j === i) return on ? '0' : '1'
        return (prev.u ?? '')[j] === '1' ? '1' : '0'
      })
      return { ...prev, u: u.join(''), tried: false, ...(twenty ? { q: blankRounds() } : {}) }
    })
  }

  function tryIt() {
    setEverTried(true)
    change((prev) => ({ ...prev, tried: prev.examples.length > 0 }))
  }

  // --- 20 Questions ---------------------------------------------------------------------------
  function nextUnplayed(from = -1) {
    for (let k = 1; k <= g.total; k += 1) {
      const i = (from + k) % g.total
      if (!g.played[i] && i !== from) return i
    }
    return null
  }

  function startPlay() {
    const mystery = nextUnplayed(-1) ?? 0
    setPicked(null)
    setNote(null)
    setShowFacts(false)
    setPlay({ mystery, answers: [], phase: g.tree.leaf ? 'guess' : 'asking' })
  }

  function answer(yes) {
    const row = g.rows[play.mystery]
    const node = walkOf(g.tree, play.answers).at(-1)
    const truth = row.f[node.feature] === 1
    if (yes !== truth) {
      setNote(`Look at the card again: ${featureQuestion(features[node.feature])}`)
      return
    }
    setNote(null)
    const next = yes ? node.yes : node.no
    setPlay({ ...play, answers: [...play.answers, yes], phase: next.leaf ? 'guess' : 'asking' })
  }

  function mark(right) {
    const i = play.mystery
    setPlay({ ...play, phase: 'marked', mark: right })
    change((prev) => {
      const cells = Array.from(prev.q ?? blankRounds())
      cells[i] = right ? 'r' : 'w'
      return { ...prev, q: cells.join('') }
    })
  }

  // The card after this one that has not been played. `g` is from before the mark, so the card
  // just marked is skipped by index.
  function nextCard() {
    const after = nextUnplayed(play.mystery)
    setNote(null)
    setShowFacts(false)
    if (after === null) {
      setPlay(null)
      return
    }
    setPlay({ mystery: after, answers: [], phase: g.tree.leaf ? 'guess' : 'asking' })
  }

  // --- the picture ----------------------------------------------------------------------------
  const route =
    !play && g.tried && picked !== null && g.rows[picked] ? pathOf(g.tree, g.rows[picked].f) : null
  const lit = new Set(play ? walkOf(g.tree, play.answers) : route ? route.nodes : [])
  const binned = clean.examples.length
  const stuck =
    binned >= 2 &&
    g.tree.leaf &&
    new Set(clean.examples.map((e) => e.l)).size > 1 &&
    (!picks || allowed.length > 0)

  const stageTop =
    picks > 0 || studentDepthOn(task) ? (
      <>
        {picks > 0 && (
          <div
            className={`act-lt-picks${blocked ? ' act-lt-shake' : ''}`}
            role="group"
            aria-label="Tree may use"
            data-act-control="group"
            onAnimationEnd={() => setBlocked(false)}
          >
            <span className="act-lt-picks__label">Tree may use</span>
            {features.map((feature, i) => (
              <ActChip
                key={feature}
                pressed={allowed.includes(i)}
                disabled={readOnly}
                onClick={() => toggleFeature(i)}
              >
                {featureQuestion(feature)}
              </ActChip>
            ))}
          </div>
        )}
        {studentDepthOn(task) && (
          <div className="act-lt-depthrow">
            <span className="act-lt-depthrow__label">Max questions</span>
            <ActStepper
              name="questions"
              value={depth}
              min={1}
              max={maxDepth}
              disabled={readOnly}
              lessLabel="Fewer questions"
              moreLabel="More questions"
              valueText={<span data-testid="lt-depth">{depth}</span>}
              onChange={setDepth}
            />
          </div>
        )}
      </>
    ) : null

  const results =
    g.tried && !play ? (
      <div className="act-lt-results" data-testid="lt-results" role="status" aria-live="polite">
        <p className="act-lt-score">
          <span aria-hidden="true">{g.passed ? '✓ ' : '• '}</span>
          <span>
            {twenty
              ? `20 Questions: ${g.correct} of ${g.playedCount} right`
              : `Your tree got ${g.correct} of ${g.total} right`}
          </span>
        </p>
        <ul className="act-lt-resultlist">
          {g.rows.map((row, i) =>
            g.played[i] ? (
              <li key={row.id}>
                <button
                  type="button"
                  className={`act-lt-result ${g.results[i].right ? 'act-lt-result--ok' : 'act-lt-result--miss'}`}
                  aria-pressed={picked === i}
                  aria-label={`${row.name}: tree says ${labels[g.results[i].predicted]}`}
                  onClick={() => setPicked(picked === i ? null : i)}
                >
                  <span aria-hidden="true">
                    {g.results[i].right ? '✓' : '✗'} {row.emoji} {row.name}
                  </span>
                </button>
              </li>
            ) : null
          )}
        </ul>
      </div>
    ) : null

  const stage = (
    <div className="act-lt-stage">
      {binned === 0 ? (
        <p className="act-lt-empty">Put a card in a bin and the tree grows by itself.</p>
      ) : (
        <div className="act-lt-scroll" data-testid="lt-tree" aria-label="Your tree">
          <Tree node={g.tree} features={features} labels={labels} on={lit} />
        </div>
      )}
      {stuck && <p className="act-lt-stuck">It can only use the questions it was given.</p>}
      {results}
    </div>
  )

  // --- the sorting board ----------------------------------------------------------------------
  const cardButton = (i) => {
    const card = deck[i]
    return (
      <button
        key={i}
        type="button"
        className="act-lt-deckcard"
        aria-pressed={sel === i}
        aria-label={`${card.name}${clean.b[i] === NONE ? '' : ` in ${labels[Number(clean.b[i])]}`}`}
        disabled={readOnly}
        draggable={!readOnly}
        onDragStart={(event) => {
          event.dataTransfer?.setData('text/plain', String(i))
          if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
        }}
        onClick={() => setSel(sel === i ? null : i)}
      >
        <span aria-hidden="true">{card.emoji}</span> {card.name}
      </button>
    )
  }
  const dropOn = (bin) => ({
    onDragOver: (event) => event.preventDefault(),
    onDrop: (event) => {
      event.preventDefault()
      const index = Number(event.dataTransfer?.getData('text/plain'))
      if (Number.isInteger(index)) moveCard(index, bin)
    },
  })
  const inDeck = deck.map((_, i) => i).filter((i) => clean.b[i] === NONE)
  const selBinned = sel !== null && clean.b[sel] !== NONE

  const board = (
    <section
      className="act-lt-board"
      role="group"
      aria-label="Sort the cards"
      data-act-control="group"
    >
      <div className="act-lt-deck" {...dropOn(NONE)} data-testid="lt-deck">
        <h3 className="act-lt-heading">
          Deck ({inDeck.length})
          {selBinned && !readOnly && (
            <button type="button" className="act-lt-back" onClick={() => moveCard(sel, NONE)}>
              ↩ Back to the deck
            </button>
          )}
        </h3>
        {inDeck.length === 0 ? (
          <p className="act-lt-empty">All sorted.</p>
        ) : (
          <div className="act-lt-cards">{inDeck.map(cardButton)}</div>
        )}
      </div>
      <div className="act-lt-bins">
        {bins.map((original, i) => {
          const members = deck.map((_, k) => k).filter((k) => clean.b[k] === String(i))
          return (
            <div
              key={original}
              className={`act-lt-bin act-lt-tone-${i % 6}`}
              data-testid={`lt-bin-${i}`}
              {...dropOn(i)}
            >
              {studentLabelsOn(task) && !readOnly ? (
                <input
                  className="act-lt-binname"
                  type="text"
                  autoComplete="off"
                  maxLength={MAX_NAME}
                  aria-label={`Name of bin ${i + 1}`}
                  value={clean.ln?.[i] ?? original}
                  onChange={(event) => rename(i, event.target.value)}
                />
              ) : (
                <strong className="act-lt-binname">{labels[i]}</strong>
              )}
              {!readOnly && (
                <button
                  type="button"
                  className="act-lt-putin"
                  aria-label={`Put in ${labels[i]}`}
                  onClick={() => (sel === null ? setNote('Tap a card first.') : moveCard(sel, i))}
                >
                  Put here
                </button>
              )}
              <div className="act-lt-cards">{members.map(cardButton)}</div>
            </div>
          )
        })}
      </div>
    </section>
  )

  // --- 20 Questions panel ---------------------------------------------------------------------
  let playPanel = null
  if (play) {
    const row = g.rows[play.mystery]
    const node = walkOf(g.tree, play.answers).at(-1)
    const truthLabel = bins[row.l]
    playPanel = (
      <section className="act-lt-play" aria-label="20 Questions" data-testid="lt-play">
        <div className="act-lt-mystery">
          <span className="act-lt-mystery__emoji" aria-hidden="true">
            {row.emoji || '❓'}
          </span>
          <strong>{row.name}</strong>
        </div>
        {play.phase !== 'marked' && (
          <button
            type="button"
            className="act-lt-back"
            aria-pressed={showFacts}
            onClick={() => setShowFacts(!showFacts)}
          >
            {showFacts ? 'Hide the facts' : 'Show the facts'}
          </button>
        )}
        {(showFacts || play.phase === 'marked') && (
          <ul className="act-lt-facts" data-testid="lt-facts">
            {features.map((f, i) => (
              <li key={f}>
                <span aria-hidden="true">{row.f[i] === 1 ? '✓' : '✗'}</span> {featureQuestion(f)}{' '}
                {row.f[i] === 1 ? 'Yes' : 'No'}
              </li>
            ))}
          </ul>
        )}
        {play.phase === 'asking' && (
          <div className="act-lt-ask">
            <p className="act-lt-step">Question {play.answers.length + 1}</p>
            <p className="act-lt-question" data-testid="lt-ask">
              {featureQuestion(features[node.feature])}
            </p>
            <div className="act-lt-yesno">
              <button
                type="button"
                className="act-btn act-btn--secondary"
                onClick={() => answer(true)}
              >
                Yes
              </button>
              <button
                type="button"
                className="act-btn act-btn--secondary"
                onClick={() => answer(false)}
              >
                No
              </button>
            </div>
          </div>
        )}
        {play.phase === 'guess' && (
          <div className="act-lt-ask">
            <p className="act-lt-question" data-testid="lt-guess">
              I think: {labels[node.label]}
            </p>
            <div className="act-lt-yesno">
              <button
                type="button"
                className="act-btn act-btn--secondary"
                onClick={() => mark(true)}
              >
                ✓ Right
              </button>
              <button
                type="button"
                className="act-btn act-btn--secondary"
                onClick={() => mark(false)}
              >
                ✗ Wrong
              </button>
            </div>
          </div>
        )}
        {play.phase === 'marked' && (
          <div className="act-lt-ask">
            <p className="act-lt-question" role="status">
              {studentLabelsOn(task)
                ? play.mark
                  ? 'You marked it right.'
                  : 'You marked it wrong.'
                : (node.label === row.l) === play.mark
                  ? `Spot on. It was ${truthLabel}.`
                  : `Look again. The tree said ${labels[node.label]} and it was ${truthLabel}.`}
            </p>
            <button type="button" className="act-btn act-btn--secondary" onClick={nextCard}>
              {nextUnplayed(play.mystery) === null ? 'See my score' : 'Next card'}
            </button>
          </div>
        )}
      </section>
    )
  }

  // --- action, tip ----------------------------------------------------------------------------
  let action = null
  if (!readOnly) {
    if (play) {
      action = { link: { label: '← Back to sorting', onClick: () => setPlay(null) } }
    } else if (twenty) {
      if (binned >= 2) {
        action = {
          main: {
            label: g.tried ? 'Play 20 Questions again' : 'Play 20 Questions',
            icon: '🎲',
            testId: 'lt-play-btn',
            onClick: startPlay,
          },
        }
      }
    } else {
      action = {
        [binned < 2 ? 'secondary' : 'main']: {
          label: everTried && !g.tried ? 'Try it again' : 'Try it on new cards',
          icon: '🔍',
          disabled: binned === 0,
          onClick: tryIt,
          testId: 'lt-try',
        },
      }
    }
  }

  let tip = note
  if (!tip && blocked) tip = 'Untick one first'
  if (!tip && !readOnly && !play) {
    if (binned < 2) tip = 'Drag a card into a bin, or tap a card then tap a bin.'
    else if (picks && allowed.length === 0)
      tip = `Pick up to ${picks} features for the tree to use.`
    else if (!g.tried)
      tip = twenty
        ? 'Press Play 20 Questions to test your tree on a new card.'
        : 'Press Try it to see how your tree does on new cards.'
    else if (!g.passed) tip = 'Sort the cards a different way and play again.'
  }

  return (
    <div className="act-panel act-lt" data-testid="learning_tree-activity">
      <ActivityLayout
        className="act-layout--lt"
        stageTop={stageTop}
        stage={stage}
        action={action}
        tip={tip}
        controls={playPanel ?? board}
      />
    </div>
  )
}
