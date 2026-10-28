# Game agent (reinforcement learning) activity (AI Level 1)

- **Status:** built on branch feature/game-agent (not merged)
- **Kind:** activity
- **Requested by:** Ryan (approved by Ryan), 2026-10-23
- **Lessons blocked:** none yet

## Need

AI Level 1's project teaches reinforcement learning: on a small grid world (a robot finding treasure), the student sets the rewards and the agent learns over episodes (Q-learning), with its learning visible and a score to race classmates' agents.

Closest existing capability (from `lessons capabilities`): Turtle course mode (turtle.md) has grid maps and goals, but the student writes the moves: nothing learns from rewards.

Current workaround and why it falls short: A Turtle maze solved by code. Fails the project: the student programs the route instead of training an AI to find it.

## Fun moment

Wow: their AI learns to play the game, then races classmates' AIs. Dial: the rewards they set (make steps cost more and it finds a shorter route). Theirs: their own agent and its score. First used: AI Level 1 Lessons 11-12 project (concept 14). Play: set silly rewards and watch it do something daft, then fix them.

## Example task

    - type: activity
      activityType: game_agent
      map: ["#####", "#R..#", "#.#T#", "#####"]   # R robot, T treasure
      rewards: {treasure: 10, step: -1, wall: -5}    # student-editable
      episodes: 50
      showLearning: true
      race: true

## Checks wanted

Outcome: the trained agent reaches the treasure within a step limit. Report itemProgress, episodes trained and the best score.

## Devices

Ordinary Chromebooks and laptops, mouse or trackpad; works by touch too. No camera or microphone. Must stay smooth on a low-end Chromebook (cap the work per frame).

## Notes

Proposed courses that need this (see `Lesson Info/Courses/Proposed Courses/Checklists/` for whether each needs it at launch):

- AI (Plans/LG-P8 Concept map - AI Level 1.md, concept 14 (reinforcement learning: learning from rewards); Lessons 11-12 project): Approved concept map (Ryan, 2026-10-23: 'These both sound excellent!')

Design brief (Ryan, 2026-10-22): the simplest version that works; simple and a bit silly beats clever; cut features before polish. Dev sizing was asked on handoff #100 and hasn't come back: please size it (rough size, Chromebook risks, what you'd cut first) before building. Data stays on the device; no live AI model.

## Resolution

Built as activity `game_agent` on branch `feature/game-agent` (not merged, no PR yet). Docs: `docs/authoring/activities/game_agent.md`. Map with `#` `.` `R` `T` and an optional `X` pit (10 x 10 max, reachability checked), student-editable rewards, hand-written Q-learning with a seeded RNG, a watchable paced Train with a Fast toggle, the learning curve, Go! for the learned route. Completion is a Go! that reaches the treasure; the report carries itemProgress, tries trained and best score.

**`race` is cut for this version:** cross-student racing needs a design decision. `race: true` validates with a warning, and the tutor's card shows each student's tries and best score so the tutor can run a race on the big screen.
