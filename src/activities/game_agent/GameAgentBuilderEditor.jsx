import { useState } from 'react'
import definition from './definition.js'
import {
  DEFAULT_EPISODES,
  MAX_EPISODES,
  REWARD_KEYS,
  REWARD_MAX,
  REWARD_MIN,
  rewardsOf,
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
}

const mapText = (task) => (Array.isArray(task.map) ? task.map.join('\n') : '')

export default function GameAgentBuilderEditor({ task, onUpdate }) {
  const validation = useActivityValidation(definition, task)
  const [text, setText] = useState(mapText(task))
  const set = (patch) => onUpdate({ ...task, ...patch })
  const rewards = rewardsOf(task)

  return (
    <div className="te-act-editor" data-activity-editor="game_agent">
      <ValidationMessages messages={validation.general} />

      <p className="te-act-note">
        Students set the rewards and train a little robot, over many tries, to find the treasure.
        The robot learns by itself (reinforcement learning).
      </p>

      <Field
        label="Map"
        hint="One row per line. # wall, . floor, R robot start, T treasure, X pit (optional). At most 10 x 10."
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
          {REWARD_KEYS.map((key) => (
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

      <div className="te-act-inline-row">
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
