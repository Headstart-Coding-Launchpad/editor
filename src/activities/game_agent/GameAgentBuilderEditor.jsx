import { useState } from 'react'
import definition from './definition.js'
import {
  DEFAULT_EPISODES,
  MAX_EPISODES,
  REWARD_KEYS,
  REWARD_MAX,
  REWARD_MIN,
  SENSE_KEYS,
  SENSE_LABELS,
  rewardsOf,
  sensesOf,
} from './game_agent.js'
import {
  Field,
  InlineField,
  ValidationMessages,
  readNumber,
  useActivityValidation,
} from '../ui/builderKit.jsx'

// Builder editor for Game agent tasks: the map (one row of text per line), the starting rewards,
// how many tries one Train runs, and whether the learning curve shows. validateTask messages
// show at the top.

const REWARD_NAMES = {
  treasure: 'Treasure reward',
  step: 'Step reward',
  wall: 'Wall reward',
  pit: 'Pit reward',
  coin: 'Coin reward',
}

const mapText = (task) => (Array.isArray(task.map) ? task.map.join('\n') : '')
// Test maps are typed as maps separated by a blank line.
const testText = (task) =>
  Array.isArray(task.testMaps) ? task.testMaps.map((m) => [].concat(m).join('\n')).join('\n\n') : ''
const parseTests = (text) => {
  const maps = text
    .split(/\n\s*\n/)
    .map((block) => block.split('\n').filter((row) => row.trim() !== ''))
    .filter((rows) => rows.length)
  return maps.length ? maps : undefined
}

export default function GameAgentBuilderEditor({ task, onUpdate }) {
  const validation = useActivityValidation(definition, task)
  const [text, setText] = useState(mapText(task))
  const [tests, setTests] = useState(testText(task))
  const set = (patch) => onUpdate({ ...task, ...patch })
  const rewards = rewardsOf(task)
  const senses = task.senses === undefined ? [] : sensesOf(task)

  return (
    <div className="te-act-editor" data-activity-editor="game_agent">
      <ValidationMessages messages={validation.general} />

      <p className="te-act-note">
        Students set the rewards and train a little robot, over many tries, to find the treasure.
        The robot learns by itself (reinforcement learning).
      </p>

      <Field
        label="Map"
        hint="One row per line. # wall, . floor, R robot start, T treasure, X pit (optional), C coin (optional). At most 10 x 10."
      >
        <textarea
          className="te-input"
          rows={Math.min(10, Math.max(4, text.split('\n').length))}
          spellCheck={false}
          style={{ fontFamily: 'monospace' }}
          aria-label="Map"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            set({ map: event.target.value.split('\n').filter((row) => row.trim() !== '') })
          }}
        />
      </Field>

      <Field label="Starting rewards" hint="Students can change these; whole numbers.">
        <div className="te-act-inline-row">
          {REWARD_KEYS.filter((key) => key in rewards).map((key) => (
            <InlineField key={key} label={REWARD_NAMES[key]}>
              <input
                className="te-input"
                type="number"
                min={REWARD_MIN}
                max={REWARD_MAX}
                value={rewards[key]}
                aria-label={REWARD_NAMES[key]}
                onChange={(event) => {
                  const value = readNumber(event.target.value)
                  set({ rewards: { ...rewards, ...(value === undefined ? {} : { [key]: value }) } })
                }}
              />
            </InlineField>
          ))}
        </div>
      </Field>

      <Field
        label="Senses the student can choose"
        hint="Tick the robot's starting senses. Leave none ticked to keep the old behaviour (it only knows its square)."
      >
        <div className="te-act-inline-row">
          {SENSE_KEYS.map((sense) => (
            <label key={sense} className="te-check-toggle">
              <input
                type="checkbox"
                checked={senses.includes(sense)}
                onChange={(event) => {
                  const next = SENSE_KEYS.filter((k) =>
                    k === sense ? event.target.checked : senses.includes(k)
                  )
                  set({ senses: next.length ? next : undefined })
                }}
              />
              {SENSE_LABELS[sense][0]}
            </label>
          ))}
          <InlineField label="Most senses at once">
            <input
              className="te-input"
              type="number"
              min={1}
              max={SENSE_KEYS.length}
              value={task.maxSenses ?? ''}
              aria-label="Most senses at once"
              onChange={(event) => set({ maxSenses: readNumber(event.target.value) })}
            />
          </InlineField>
        </div>
      </Field>

      <Field
        label="Test maps (sealed)"
        hint="Optional. Up to 5 maps, separated by a blank line. 'Go on a new map' runs the trained robot once on one; the task passes when it reaches the treasure there."
      >
        <textarea
          className="te-input"
          rows={5}
          spellCheck={false}
          style={{ fontFamily: 'monospace' }}
          aria-label="Test maps"
          value={tests}
          onChange={(event) => {
            setTests(event.target.value)
            set({ testMaps: parseTests(event.target.value) })
          }}
        />
      </Field>

      <div className="te-act-inline-row">
        <label className="te-check-toggle">
          <input
            type="checkbox"
            checked={task.race === true}
            onChange={(event) => set({ race: event.target.checked ? true : undefined })}
          />
          Race (the tutor card shows each mystery-map score)
        </label>
        <InlineField label="Tries per Train">
          <input
            className="te-input"
            type="number"
            min={1}
            max={MAX_EPISODES}
            value={task.episodes ?? DEFAULT_EPISODES}
            aria-label="Tries per Train"
            onChange={(event) => set({ episodes: readNumber(event.target.value) })}
          />
        </InlineField>
        <label className="te-check-toggle">
          <input
            type="checkbox"
            checked={task.showLearning !== false}
            onChange={(event) => set({ showLearning: event.target.checked ? undefined : false })}
          />
          Show the learning curve
        </label>
      </div>
    </div>
  )
}
