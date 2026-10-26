import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import BeatSequencer from '../BeatSequencer.jsx'
import StagePane from '../../stage/StagePane.jsx'
import { readBeatSong, validateBeatCall } from '../patterns.js'
import { BEATS_MUTED_KEY, BEATS_VOLUME_KEY, beatGain, MAX_BEAT_GAIN } from '../beatSoundSettings.js'
import { stopBeat } from '../player.js'

const play = (args, kwargs) => validateBeatCall('play', args, kwargs).command

afterEach(() => {
  stopBeat()
  localStorage.removeItem(BEATS_MUTED_KEY)
  localStorage.removeItem(BEATS_VOLUME_KEY)
})

describe('BeatSequencer', () => {
  it('draws a row per pattern, lit where there is an x, and says it in words', () => {
    const song = readBeatSong([play(['x...x...', '....x...'])])
    render(<BeatSequencer song={song} />)
    const grid = screen.getByRole('img')
    expect(grid.getAttribute('aria-label')).toContain('kick on steps 0, 4; snare on step 4')
    expect(screen.getByText('kick')).toBeTruthy()
    expect(screen.getByText('snare')).toBeTruthy()
    expect(grid.querySelectorAll('[data-hit="1"]')).toHaveLength(3)
  })

  it('shows the full controls by default, Play and sound for the tutor, none on the card', () => {
    const song = readBeatSong([play(['x...'])])
    const { rerender } = render(<BeatSequencer song={song} />)
    expect(screen.getByTestId('beat-play')).toBeTruthy()
    expect(screen.getByTestId('beat-save')).toBeTruthy()
    expect(screen.getByLabelText('Beat volume')).toBeTruthy()
    rerender(<BeatSequencer song={song} controls="play" />)
    expect(screen.getByTestId('beat-mute')).toBeTruthy()
    expect(screen.queryByTestId('beat-save')).toBeNull()
    rerender(<BeatSequencer song={song} controls="none" />)
    expect(screen.queryByTestId('beat-play')).toBeNull()
  })

  it('remembers sound off on this device', () => {
    render(<BeatSequencer song={readBeatSong([play(['x...'])])} />)
    fireEvent.click(screen.getByTestId('beat-mute'))
    expect(localStorage.getItem(BEATS_MUTED_KEY)).toBe('1')
    expect(screen.getByTestId('beat-mute').textContent).toContain('Sound off')
  })

  it('Play turns into Stop while it plays (silently without Web Audio)', () => {
    render(<BeatSequencer song={readBeatSong([play(['x...'])])} />)
    fireEvent.click(screen.getByTestId('beat-play'))
    expect(screen.getByTestId('beat-play').textContent).toContain('Stop')
    fireEvent.click(screen.getByTestId('beat-play'))
    expect(screen.getByTestId('beat-play').textContent).toContain('Play')
  })

  it('caps the volume and mutes to silence', () => {
    expect(beatGain({ muted: false, volume: 1 })).toBe(MAX_BEAT_GAIN)
    expect(beatGain({ muted: false, volume: 5 })).toBe(MAX_BEAT_GAIN)
    expect(beatGain({ muted: true, volume: 1 })).toBe(0)
  })
})

describe('StagePane with a beat', () => {
  it('shows the sequencer in place of the canvas when nothing else was drawn', () => {
    render(<StagePane commands={[play(['x...'])]} />)
    expect(screen.getByTestId('beat-sequencer')).toBeTruthy()
    expect(document.querySelector('canvas')).toBeNull()
  })

  it('shows both when the code also drew', () => {
    render(
      <StagePane commands={[{ type: 'circle', x: 200, y: 200, r: 50 }, play(['x...'])]} compact />
    )
    expect(screen.getByTestId('beat-sequencer')).toBeTruthy()
    expect(document.querySelector('canvas')).not.toBeNull()
    expect(screen.queryByTestId('beat-save')).toBeNull() // compact: Play and sound only
  })
})
