# Scratch layout: starter block hidden behind the palette, and the stage on another tab on tablets

- **Status:** shipped
- **Kind:** bug
- **Requested by:** Ryan (approved by Ryan), 2026-10-17
- **Lessons blocked:** none yet

## Need

HSC Audit item 1 (Ryan, 2026-10-15). Scratch is the only LaunchPad feature Ryan says doesn't work. HSC Hub\Research\HSC Audit\Interview - LaunchPad.md: "Scratch: both agree. A long-running layout problem, and the only feature Ryan says doesn't work (3/5, "No")." The AI visual review rates it Problem (HSC Hub\Research\HSC Audit\Visual Review\Visual Review.md, group 08): "On desktop the starter 'say Hello! for 2 seconds' block is half hidden behind the palette, while the instruction says 'Click the block stack'" and "(tablet) Instructions/Code and Blocks/Stage are tabs, so a student clicks the block, then switches tabs to see the stage, by which time the message may have gone." Scratch L1 lessons depend on clicking a stack and watching the stage react.

Closest existing capability (from `lessons capabilities`): The Scratch workspace module (platform-docs scratch.md). It lacks: starter blocks placed clear of the palette, and a tablet layout that keeps the stage visible beside the blocks.

Current workaround and why it falls short: Tutors tell students to drag the starter stack out and to switch tabs quickly. It fails Scratch L1's 'click a block and see what it does' objective on tablets, where the result has gone before the stage tab opens.

## Checks wanted

- Desktop 1440x900: every starter stack in a Scratch task is fully visible and clickable without scrolling or dragging.
- Tablet 1024x768 touch: blocks and stage are on screen together, so clicking a stack shows its effect without changing tab.
- Re-run the HSC Audit visual review (scripts/hsc-audit) and group 08 no longer rates Problem.

## Devices

Tablets are the main failure (stage on a separate tab). Check touch on iPad-size screens, plus desktop and Chromebook widths.

## Notes

Also from the review, same group: Scratch quiz block pictures are tiny (about 11px) and show dropdown arrows real say blocks don't have. Fix if cheap; not the headline.

## Resolution

Branch `fix/scratch-layout-starter-and-tablet-stage`. No code change needed: all three asks already shipped on main in bb80ed46 (2026-10-16). `revealBlocksBesideFlyout` scrolls the workspace (xy unchanged) so blocks clear the palette until the student first touches the canvas; the Blocks/Stage tab switch starts below 860px (`SCRATCH_COMPACT_BREAKPOINT`), so a ~990px tablet keeps the stage beside the blocks at 65%; Scratch quiz pictures are 1.35x bigger and say/think/ask inputs have no dropdown arrow. Needs a real-browser check at 1440x900 and 1024x768 touch, then a re-run of the HSC Audit visual review (group 08).
