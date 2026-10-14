# Scratch task: choose which backdrop the Stage starts on

- **Status:** open
- **Kind:** activity mode
- **Requested by:** Ryan (approved by Ryan), 2026-10-14
- **Lessons blocked:** none yet

## Need

A Scratch task's backdrops list sets which backdrops exist, but nothing sets which one is showing when the task loads; the Stage opens on the first one listed. A Build Reference stage with no backdrop block then shows the wrong scene: Scratch Level 1 Lesson 7 (m8q1wbgock) task 26's farm welcome opened on the Beach because the build's list order is Beach, Farm, Forest, until task 30 adds the Farm reset. The same applies to any Complete Example that relies on the Stage starting on a particular backdrop.

Closest existing capability (from `lessons capabilities`): platform-docs/scratch.md's Code Task Fields and Backdrop Object: backdrops[] takes id/name/image only, with no current/starting flag, so the starting backdrop is fixed by list order.

Current workaround and why it falls short: Reorder backdrops so the wanted one is first. That fails wherever the build's own later steps depend on the list order (next backdrop), as in m8q1wbgock, so the lesson's first Project step shows the wrong scene.

## Example task

    backdrops:
      - { id: beach, name: Beach, image: ... }
      - { id: farm, name: Farm, image: ..., current: true }

## Notes

Ryan asked for this candidate in the open-notes triage (2026-10-14). Source: Missing Information.md entry 'Scratch task setup: which backdrop the Stage starts on' (create-lesson-skeleton and write-lesson-code both hit it).

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
