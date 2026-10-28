# Learning decision tree activity (AI Level 1)

- **Status:** built on branch feature/learning-tree (not merged)
- **Kind:** activity
- **Requested by:** Ryan (approved by Ryan), 2026-10-23
- **Lessons blocked:** none yet

## Need

AI Level 1 teaches the difference between AI you can explain and AI you can't. Students give labelled examples and the tree builds itself by picking the best yes/no questions (ID3-style), drawn as a tree they can read and run on a new example. The hand-built Decision Tree (#96) was declined because a tree the student builds by hand isn't AI.

Closest existing capability (from `lessons capabilities`): Classifier activity (activities/classifier.md): learns from examples, but it's nearest-match with no readable model. Nothing draws a learned tree.

Current workaround and why it falls short: A quiz on a pre-drawn tree. Fails the concept: nothing learns, so students can't see the tree choose its own questions from their examples.

## Fun moment

Wow: they add a few examples and the tree picks its own questions and draws itself. Dial: the examples (add one and the tree changes) and how deep it may grow. Theirs: their own tree, run on a friend's item. First used: AI Level 1, about Lesson 7 (concept map concept 10). Play: add a tricky example and watch the tree grow a new question to cope.

## Example task

    - type: activity
      activityType: learning_tree
      features: [has_fur, can_fly, lives_in_water]   # yes/no features the lesson sets
      labels: [pet, wild]
      maxExamples: 20
      maxDepth: 3
      testItems: [...]   # the lesson's unseen items

## Checks wanted

Outcome: the student's tree sorts the lesson's test items to a target (e.g. 4 of 5). Report itemProgress, the tree's depth and test score to the tutor card and session report.

## Devices

Ordinary Chromebooks and laptops, mouse or trackpad; works by touch too. No camera or microphone. Must stay smooth on a low-end Chromebook (cap the work per frame).

## Notes

Proposed courses that need this (see `Lesson Info/Courses/Proposed Courses/Checklists/` for whether each needs it at launch):

- AI (Plans/LG-P8 Concept map - AI Level 1.md, concept 10 (AI you can explain: a tree that learns its own questions); about Lesson 7): Approved concept map (Ryan, 2026-10-23: 'These both sound excellent!')

Design brief (Ryan, 2026-10-22): the simplest version that works; simple and a bit silly beats clever; cut features before polish. Dev sizing was asked on handoff #100 and hasn't come back: please size it (rough size, Chromebook risks, what you'd cut first) before building. Data stays on the device; no live AI model.

## Resolution

Built on branch `feature/learning-tree` (not merged, no PR yet). Activity id `learning_tree` (`type: learning_tree`), docs: [activities/learning_tree.md](../activities/learning_tree.md). Task fields `features`, `labels`, `testItems` (`name`, `yes`, `label`), `maxExamples`, `maxDepth`, `passAt`. Cut for now: the student's own depth dial.
