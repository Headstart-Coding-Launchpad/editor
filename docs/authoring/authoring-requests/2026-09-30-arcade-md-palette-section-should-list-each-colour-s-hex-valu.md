# arcade.md Palette section should list each colour's hex value

- **Status:** resolved
- **Kind:** docs
- **Requested by:** Ryan (approved by Ryan), 2026-09-30
- **Lessons blocked:** none yet

## Need

platform-docs/arcade.md's Palette section says 'Use one of these names (or its matching hex value)' but lists only the 16 names. Lesson visuals for Games Dev and Arcade tasks are generated in Arcade's palette (Visuals Writing Guide, Course style overrides), and image-generation prompts need the exact hex values to match what students see in the game window.

Closest existing capability (from `lessons capabilities`): platform-docs/arcade.md, Palette section: lists black, dark_blue, dark_purple, dark_green, brown, dark_gray, light_gray, white, red, orange, yellow, green, blue, lavender, pink, peach with no hexes. The only hex in the file (#ff004d in the arcadeDesign frames example) matches the standard PICO-8 red.

Current workaround and why it falls short: Style strings name 'the PICO-8 16-colour palette' instead of exact hexes. This works if Arcade really uses PICO-8's hexes, but it's unconfirmed, so generated art may drift from the in-game colours.

## Notes

Lessons that hit this gap:

- Games Dev::Level 1::1 (Games Dev Level 1 — all lesson visuals (retro style override)): Found while adding the Games Dev retro visual style override, 2026-09-30.

## Resolution

Branch `feature/authoring-docs-2026-10`: the Palette section is now a name | hex table taken from `ARCADE_PALETTE` (`src/modules/arcade/design.js`), confirmed as exactly the standard PICO-8 16-colour palette, with a call-out that `white` is the warm `#fff1e8`, not `#ffffff`, for image-generation prompts. Docs: [arcade.md](../arcade.md#palette).
