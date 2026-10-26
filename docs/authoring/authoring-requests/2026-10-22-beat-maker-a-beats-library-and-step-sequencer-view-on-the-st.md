# Beat maker: a beats library and step-sequencer view on the Stage (Make It Real)

- **Status:** planned
- **Kind:** module
- **Requested by:** Ryan (approved by Ryan), 2026-10-22
- **Lessons blocked:** none yet

## Need

Make It Real's second build (Lesson Gen Agent\Plans\LG-P9 Make it real.md §1; Ryan's favourite). A drum pattern is a string: x for a hit, . for a rest, one character per step. play(kick, snare, hat, tempo=100) plays the patterns together while a step-sequencer grid draws each string as a row of squares, lit where there's an x, with a playhead sweeping across. Strings and indexes become something students hear and see. Needs: a sound engine and an HSC-owned or licence-free drum set first (kick, snare, hats, clap; melody and bass later for Level 3 lists); the beats library with play and stop; the sequencer view; a volume cap and mute; WAV export in Export work ('Save my beat'). The step grid must be enough on its own: every beat task can be done and checked with sound off.

Closest existing capability (from `lessons capabilities`): Stage (stage.md) draws pictures but makes no sound; Export work already renders Scratch synth sounds to WAV, so part of the audio pipeline exists. Nothing in Python plays or sequences sound.

Current workaround and why it falls short: Print the patterns as text. It fails the lesson moment entirely: nothing plays, and nothing shows a string as steps in time.

## Fun moment

Three lines, press Run, and their own beat plays while the grid lights up in time. They change one character and hear the difference (the string is the dial). They save the track as a WAV to play at home. First used in Python Level 1's strings and variables lessons; later loops build fills, lists make melodies, and functions make verse() and chorus().

## Example task

    from beats import *
    kick  = "x...x...x...x..."
    snare = "....x.......x..."
    hat   = "x.x.x.x.x.x.x.x."
    play(kick, snare, hat, tempo=100)

## Checks wanted

Existing variable checks on the pattern strings (sound-off safe). Later: a 'matches the target beat' check for Hit the target tasks.

## Devices

Sound optional per student (some have no headphones or share a room): mute and a volume cap; the tutor can play one beat on screen share. Works on Chromebooks.

## Notes

Ryan, 2026-10-22: queue after Image Lab (request #97) in the visual-lessons-first order (handoff #104). Keep it simple, even a bit silly, but working; follow the fun guide (#103).

## Resolution

Built on branch `feature/beat-maker` (2026-10-26, not merged yet): the `beats` Python module
(`play(kick, snare, hat, clap, tempo=100)`, `stop()`) in `src/shared/beats/`, a Web Audio drum kit
made in code (kick, snare, closed hat, clap), the step-sequencer grid in the Stage pane, mute and a
capped volume per device, Save my beat (WAV) and the WAV in Export work, and the grid on the tutor's
card, modal and Show it (Play button, no auto-play). Checks: the existing `variable_*` / `code`
checks (sound-off safe); the "matches the target beat" check is not built. Melody and bass notes
(Level 3) are not built. Docs: [beats.md](../beats.md). Demo lesson: `exports/beat-maker-demo.json`.
