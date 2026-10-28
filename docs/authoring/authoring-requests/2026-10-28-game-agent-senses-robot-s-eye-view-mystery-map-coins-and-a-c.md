# Game agent: senses, robot's-eye view, mystery map, coins and a class leaderboard

- **Status:** planned
- **Branch:** feature/game-agent (built, not merged)
- **Kind:** activity mode
- **Requested by:** Ryan (approved by Ryan), 2026-10-28
- **Lessons blocked:** none yet

## Need

AI Level 1 Lessons 11-12 (the reinforcement learning final project) need the student to choose what the robot wants (rewards, including coins) and how it sees (senses), then race on a map nobody trained on. Today the robot only knows its square number, so it memorises one map and the activity is about 10 minutes, not two lessons. Builds on the game_agent branch (feature/game-agent, #102).

Closest existing capability (from `lessons capabilities`): game_agent (feature/game-agent docs/authoring/activities/game_agent.md): rewards and pits are student-set, but the state is the square only, there's one map, no coins, and race isn't built.

Current workaround and why it falls short: Lesson 12 becomes a second rewards lesson and the tutor ranks student cards by hand. This fails concept 14's race and the 'how it sees' design choice (and the tie back to Lesson 3's unseen data).

## Fun moment

Wow: their Lesson 11 robot gets lost on a new map, then one with a compass and wall sensors finds the way first time, and wins the class race. Dial: the rewards and senses they pick. Theirs: their racer. First used: AI Level 1 Lessons 11-12. Play: silly rewards make daft robots; too many senses make slow learners.

## Example task

    - type: game_agent
      map: ["#######", "#R.C..#", "#.#X#T#", "#######"]   # C coin (collected once)
      rewards: {treasure: 10, step: -1, wall: -5, pit: -10, coin: 3}
      senses: [walls, treasure_direction]   # starting senses; the student picks from position, walls, treasure_direction, pit_near, coin_direction
      maxSenses: 3
      testMaps:                              # sealed; 'Go on a new map' runs once, no training
        - ["######", "#..T.#", "#.##.#", "#R...#", "######"]
      race: true

## Checks wanted

Pass: 'Go on a new map' reaches the treasure on a testMap (when testMaps is set; otherwise the current rule). Show 'your robot has N situations to learn' for the chosen senses. A robot's-eye view toggle greys the grid and shows only what the senses report. A 'what it learned' view: arrows per square (position) or 'when it sees X it goes Y' (senses). Race v1: the tutor's screen ranks every student's mystery-map Go by score. Small fixes from the #308 review: draw T under the robot when it stands on it. Report senses, rewards, tries, test-map result and score.

## Devices

Ordinary Chromebooks and laptops, mouse or trackpad; works by touch too (buttons only, at least 44px). No camera or microphone. Recompute only when the student changes something; no new animation loop.

## Notes

Ryan asked for this in #lesson-gen, 28 Oct 2026 09:54 ('file all the platform requests that we have discussed'). Plans: Lesson Gen Agent/Plans/AI L1 student choices deep dive.md (#311) and Plans/AI L1 game agent deep dive.md (#309). Simplest working version first; cut before polish.

## Resolution

Built on feature/game-agent (not merged): senses, coins (C), testMaps with Go on a new map, robot's-eye view, "when it sees X it goes Y" list, race v1 as the mystery-map score on the tutor card. Docs: docs/authoring/activities/game_agent.md. Not built: a class ranking screen (needs a class-level activity hook), per-request extras such as a Test button on the training map or a student-visible race board.
