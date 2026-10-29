# Game agent: random solvable courses with a class seed (no dead-end traps)

- **Status:** planned
- **Branch:** feature/game-courses (built, not merged)
- **Kind:** activity mode
- **Requested by:** Ryan (approved by Ryan), 2026-10-28
- **Lessons blocked:** none yet

## Need

AI Level 1 Lessons 11-12 (project, race). Ryan wants mystery maps 'even procedurally generated'. A New random course button that always makes a fair, solvable map, the same set for the whole class so the race is fair. Also sidesteps #321 (testMaps can't be saved).

Closest existing capability (from `lessons capabilities`): game_agent testMaps (R110): fixed sealed maps, which currently can't be saved (#321).

Current workaround and why it falls short: Fixed testMaps once #321 is fixed. Works but finite and hand-made; no 'throw it at as many courses as you like'.

## Fun moment

Wow: throw their robot at course after course it's never seen. Dial: senses and rewards. Theirs: their racer. First used: AI Level 1 Lesson 12. Play: whose robot clears the most new courses?

## Example task

    - type: game_agent
      randomCourses: { size: 7, walls: 0.25, pits: 1, seed: class }   # new; seed 'class' = same courses for everyone in a session
      race: true

## Checks wanted

Generated maps are always solvable (BFS) and reject U-shaped dead-end traps that walls+compass senses can't escape (cold review), or cap how many. 'Try a new course' runs the trained robot once with no training; passing as R110. With seed: class every student in a live session gets the same sequence. Tutor card shows each student's score on the shared courses (no ranking screen in v1).

## Devices

Ordinary Chromebooks and laptops, mouse or trackpad; works by touch too (buttons at least 44px, no drag-only controls without a tap alternative). No camera or microphone. Cap the work per frame so it stays smooth on a low-end Chromebook; data stays on the device.

## Notes

Ryan asked for this in #lesson-gen, 28 Oct 2026 22:05 ('Can you pass some platform requests to dev please?'), after reviewing test lesson f09ych4mt5 v2. Plan and Opus cold review: Lesson Gen Agent/Plans/AI L1 activities rethink.md (#320). Principle: start from a product students already use, a win they can say in five words, something they make and show off. Simplest working version first; cut before polish. Build order by teaching date: Next-Word (January) first.

## Resolution

Built on branch `feature/game-courses` (not merged, no PR yet), in the existing `game_agent` activity ([docs](../activities/game_agent.md#random-courses)). New task field `randomCourses: { size, walls, pits, coins, seed }`: a pure seeded generator (`courses.js`) that rejects unsolvable courses (breadth-first search, pits blocked) and courses with a dead-end pocket at least 2 deep near the line from R to T. **Try a new course** takes the place of Try a new map with the same pass rule. With `seed: class` the seed comes from the lesson id and the task id, so every student in a live session gets the same courses. The tutor card lists each course by number and score; no ranking screen.

Update: Train now practises on random courses too (a separate training stream, so the courses **Try a new course** runs stay unseen; 5 times `episodes` tries per press). In the unit test (size 5, walls 0.15, no pits, 3 presses of Train, 60 classes x the first 5 courses) `walls` + `treasure_direction` clears about 70%, `treasure_direction` alone about 55% and `position` about 15%, so the sensing story holds. Larger courses with pits are harder (about 20% on the 7 x 7 default).
