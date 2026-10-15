import { describe, expect, it } from 'vitest'
import {
  buildLiveSlowMoPayload,
  buildLiveSlowMoStep,
  parseLiveRecording,
  readLiveSlowMo,
} from '../live.js'

const recording = {
  steps: [
    { l: 1, k: 0, s: { x: { t: 'int', v: 1 } } },
    { l: 2, k: 0, o: 2 },
  ],
  output: '1\n',
  loops: [],
  status: 'success',
}

describe('Go Live slow-mo', () => {
  it('sends the recording once, as JSON text, with the step', () => {
    const { pythonSlowMo } = buildLiveSlowMoPayload({
      taskId: 7,
      id: 'r1',
      recording,
      position: 1,
      mode: 'paused',
      speed: 2,
    })
    expect(pythonSlowMo).toMatchObject({
      taskId: 7,
      id: 'r1',
      position: 1,
      mode: 'paused',
      speed: 2,
    })
    expect(parseLiveRecording(pythonSlowMo.json).steps).toHaveLength(2)
    expect(readLiveSlowMo(pythonSlowMo)).toEqual(pythonSlowMo)
  })

  it('moves only the step afterwards (multi-path keys keep the recording)', () => {
    expect(buildLiveSlowMoStep({ position: 3.7, mode: 'nonsense', speed: 9 })).toEqual({
      'pythonSlowMo/position': 3,
      'pythonSlowMo/mode': 'paused',
      'pythonSlowMo/speed': 4,
    })
  })

  it('ignores a broadcast without its recording', () => {
    expect(readLiveSlowMo(null)).toBeNull()
    expect(readLiveSlowMo({ position: 2, mode: 'playing' })).toBeNull()
    expect(parseLiveRecording('{not json')).toBeNull()
  })
})
