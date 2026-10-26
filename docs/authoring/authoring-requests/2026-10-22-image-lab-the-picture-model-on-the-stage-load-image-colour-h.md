# Image Lab: the picture model on the Stage (load_image, colour helpers, snapshot, Save my picture)

- **Status:** planned
- **Kind:** module
- **Requested by:** Ryan (approved by Ryan), 2026-10-22
- **Lessons blocked:** none yet

## Need

Make It Real's first build (Lesson Gen Agent\Plans\LG-P9 Make it real.md §2 and 'One picture model'). A picture is a plain Python list of colours (a flat list with a width, or a list of rows), exactly what grid() draws today. Add: rgb(r, g, b) returning a hex string like hue(); red(c), green(c), blue(c) reading the numbers back; load_image(name) returning a pixel list (about 32x32 for Levels 1-2, 64x64 later, under grid()'s 100x100 cap) from an HSC image library of 20-30 pictures (real licence-free photos, a few made for filters such as an astronaut on a green screen and backdrops, some pixel-art sprites; no people, no uploads); snapshot() turning the Stage's shapes into a pixel list; and Stage PNG in Export work, shown to students as a visible 'Save my picture' button. Accept (r, g, b) tuples too, so real Pillow code works at Level 4. One shared colour and picture module, later reused by the LED matrix, 3D and beats.

Closest existing capability (from `lessons capabilities`): Stage (stage.md): grid() draws a list of colours; hue() and named and hex colours exist; Export work saves a Stage PNG. Missing: no image loading, no rgb()/red()/green()/blue(), no snapshot(), no image library.

Current workaround and why it falls short: Hand-typed small pixel lists on locked lines. They work for 8x8 slow-mo tasks but can't give a real photo to filter, so the green-screen and filter lessons (Level 1 if, Level 2 arithmetic, loops, and/or) can't be taught as planned.

## Fun moment

One line and a real photo appears: fox = load_image("fox"). A few lines later it's pop-art, flipped, or the astronaut is standing on the Moon via green screen ('how films really do it'). The picture is theirs, and Save my picture takes it home. First lesson: Python Level 1's if lesson (swap one colour), or the Level 2 and/or green screen.

## Example task

    from stage import *
    fox = load_image("fox")
    for i in range(len(fox)):
        if fox[i] == "#ff8800":   # given loop at Level 1; student writes the if
            fox[i] = "purple"
    grid(fox, width=32)

## Checks wanted

Existing Stage checks: stage_matches_target on the filtered picture, and variable checks on the pixel list. No new check type is needed for the first lessons.

## Devices

Stage rules as now; images small enough to load fast on Chromebooks.

## Notes

Ryan, 2026-10-22: visual lessons come first in Dev's queue, ahead of the new January courses. Follow the fun guide (#103) and keep it simple.

## Resolution

Built on branch `feature/image-lab` (not merged yet), in the existing `stage` module (no new
module or activity id): `rgb()`, `red()`/`green()`/`blue()`, `load_image(name, size=32)` with a
27-picture library (`public/image-lab/`, CC0 / public domain), `snapshot(size=32)`, `(r, g, b)`
tuples as colours, and a **Save my picture** button on the student's Stage. Docs:
[stage.md → Image Lab](../stage.md#10-image-lab-pictures-are-lists). Real-browser click-through
pending before `shipped`.
