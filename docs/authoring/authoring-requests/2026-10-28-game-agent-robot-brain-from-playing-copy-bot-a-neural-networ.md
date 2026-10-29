# Game agent: robot brain from playing (copy-bot, a neural network that learns from your driving)

- **Status:** planned
- **Branch:** feature/game-courses (built, not merged)
- **Kind:** activity mode
- **Requested by:** Ryan (approved by Ryan), 2026-10-28
- **Lessons blocked:** none yet

## Need

AI Level 1 Lesson 11. Ryan: combine neurons with the game agent ('the robot brain also good'). The student drives the robot with arrow keys; each move is an example (what it senses -> which way they went); a small neural network learns to copy them, then drives itself on a new course. Imitation learning, honestly how early self-driving cars learned. Lesson 12 then flips to reward learning and races copy-bot against reward-bot.

Closest existing capability (from `lessons capabilities`): game_agent (platform-docs/activities/game_agent.md): Q-learning from rewards with senses (R110); no driving mode, no network.

Current workaround and why it falls short: Reward learning only. Fails the lesson: no neural network, and no 'it learned from me'.

## Fun moment

Wow: it drives like them on a course it's never seen. Dial: how they drive, and what it senses. Theirs: their copy-bot. First used: AI Level 1 Lesson 11. Play: teach it a silly habit and watch it copy.

## Example task

    - type: game_agent
      brain: copy            # new: copy (network learns from the student's driving) | reward (today's)
      senses: [walls, treasure_direction]
      panels: [network]      # draws inputs (senses), hidden neurons, 4 outputs, lit as it decides

## Checks wanted

Drive mode: arrow keys and on-screen arrows (44px) move the robot; each move records (senses, move). Train fits the small network on those examples (seconds, capped per frame). Go runs the network on a new random course (see the random courses request). Drive badly and it copies the mistakes. Passes when the copy-bot reaches the treasure on a new course. Report examples recorded and new-course result. Copy-bot and reward-bot from the same student can be raced on the same course.

## Devices

Ordinary Chromebooks and laptops, mouse or trackpad; works by touch too (buttons at least 44px, no drag-only controls without a tap alternative). No camera or microphone. Cap the work per frame so it stays smooth on a low-end Chromebook; data stays on the device.

## Notes

Ryan asked for this in #lesson-gen, 28 Oct 2026 22:05 ('Can you pass some platform requests to dev please?'), after reviewing test lesson f09ych4mt5 v2. Plan and Opus cold review: Lesson Gen Agent/Plans/AI L1 activities rethink.md (#320). Principle: start from a product students already use, a win they can say in five words, something they make and show off. Simplest working version first; cut before polish. Build order by teaching date: Next-Word (January) first.

## Resolution

Built on branch `feature/game-courses` (not merged, no PR yet), in the `game_agent` activity ([docs](../activities/game_agent.md#copy-bot)). New task fields `brain: copy` (default `reward`) and `panels: [network]`. Drive with the arrow keys or four 48px on-screen arrows (one control group); each move is saved as (sense vector, move) on a practice course; **Next course** goes to the next one; the screen says "You've shown it 34 moves on 2 courses". **Train** fits a small seeded network (8 hidden neurons, 4 outputs, 600 SGD steps, 60 per animation frame); **Watch it drive** runs it on the next unseen class course (`randomCourses`, defaults when omitted) and the task passes when it reaches the treasure. `position` is left out of a copy-bot's senses by default. The tutor card reads `copy-bot · 34 moves · course 3: 8 pts`. Race v1 is two tasks (one `brain: copy`, one `brain: reward`) on the same class seed, compared by course number on the cards; no ranking screen.

Fun moment holds in tests: a shortest-way driver on 3 practice courses gives a bot that clears about 78% of the first 5 unseen class courses; an always-right driver about 39%, and it copies the habit. Known limit: the copy-bot does not walk into the same wall twice from one square and slightly prefers new squares (without that, a reactive network circles and a good driver cleared only about half); on 7 x 7 courses with pits it clears less (about 60%).
