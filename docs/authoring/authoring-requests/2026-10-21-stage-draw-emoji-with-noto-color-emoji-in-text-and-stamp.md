# Stage: draw emoji with Noto Color Emoji in text() and stamp()

- **Status:** shipped
- **Kind:** module
- **Requested by:** Ryan (approved by Ryan), 2026-10-21
- **Lessons blocked:** none yet

## Need

Ryan, 2026-10-20 after the LG-P6 pilots: 'Change stage emojis to Colour Noto in both text and stamp.' Emoji drawn on the Stage use the device's system emoji font, so they look different on Windows, Chromebooks, iPads and Macs, and stageTarget pictures and lesson screenshots won't match what every student sees.

Closest existing capability (from `lessons capabilities`): python.md Stage calls: stamp(emoji, x, y, size=32) and text(words, ...). No font option; emoji render with the system font.

Current workaround and why it falls short: Accept per-device emoji. Fails consistency: a lesson screenshot or target picture shows a different emoji from the student's screen.

## Notes

Both text() and stamp(), and anything else that draws an emoji on the Stage (stageTarget ghosts, lessons screenshot). Noto Color Emoji is open source (SIL OFL).

## Resolution

Shipped 2026-10-22: live on `main` (5221fe93, Ryan's OK in session). Not yet clicked through in a real browser (HSC Hub #93).

Built on branch `feature/stage-noto-emoji` (2026-10-22), merged 2026-10-22. No font file
is bundled: the app already loads Noto Color Emoji from Google Fonts (`src/index.css`, also used by
Scratch). The Stage canvas puts it first for `stamp()` and lets emoji in `text()` fall through to
it, and redraws once the font has loaded. The SVG/PNG export (Export work) names it too, but an SVG
turned into a PNG can't load web fonts, so exported pictures still use the device's emoji unless
Noto is installed. Docs: python.md and stage.md Stage tables, CHANGELOG 2026-10-22.
