# Learning tree: student-picked features and depth, and the path highlighted

- **Status:** planned
- **Branch:** feature/learning-tree (built, not merged)
- **Kind:** activity mode
- **Requested by:** Ryan (approved by Ryan), 2026-10-28
- **Lessons blocked:** none yet

## Need

AI Level 1 Lesson 8 (AI you can explain) should let the student choose which features the tree may use and how deep it grows, and show the exact path each test item took, which is the 'explain why' punchline beside the network. Builds on feature/learning-tree (#99).

Closest existing capability (from `lessons capabilities`): learning_tree (feature/learning-tree docs/authoring/activities/learning_tree.md): features and maxDepth are author-set; Try it shows right/wrong but not the path.

Current workaround and why it falls short: The tutor traces paths by hand on the big screen. This fails the concept's 'explainable' moment for each student, and the concept map's depth dial.

## Fun moment

Wow: give it a useless feature and the tree goes wrong; pick good ones and it's right, and it shows exactly why. Dial: features and depth. Theirs: their tree. First used: AI Level 1 Lesson 8. Play: build the smallest tree that gets them all right.

## Example task

    - type: learning_tree
      features: [has_fur, can_fly, lives_in_water, is_brown, has_stripes]
      studentPicksFeatures: 3     # the student chooses up to 3 of the features
      studentDepth: true          # depth slider 1 to maxDepth
      maxDepth: 4

## Checks wanted

Tapping a test result highlights its path through the tree ('has fur? yes -> lives in water? no -> pet'). Marking unchanged. Report features chosen and depth.

## Devices

Ordinary Chromebooks and laptops, mouse or trackpad; works by touch too (buttons only, at least 44px). No camera or microphone. Recompute only when the student changes something; no new animation loop.

## Notes

Ryan asked for this in #lesson-gen, 28 Oct 2026 09:54 ('file all the platform requests that we have discussed'). Plans: Lesson Gen Agent/Plans/AI L1 student choices deep dive.md (#311) and Plans/AI L1 game agent deep dive.md (#309). Simplest working version first; cut before polish.

## Resolution

Built on branch `feature/learning-tree` (not merged, no PR yet), in the existing `learning_tree` activity ([docs](../activities/learning_tree.md)). The path highlight with the written route and the student depth dial (`studentDepth`) were already there. New: `studentPicksFeatures: N`, the student ticks up to N of the task's features and the tree regrows from only those (examples still record all features; the tutor card and shared state show the chosen features). Field absent means all features, as before.
