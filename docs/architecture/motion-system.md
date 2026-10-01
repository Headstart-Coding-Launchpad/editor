# Motion System

How the app animates: one set of principles, tokens, classes and hooks that every animation
uses, so motion feels like one product and reduced motion is handled in one place. The candidate
list of future moments is in [animation-ideas.md](animation-ideas.md); this doc is how to build
any of them.

## Principles

- **Calm by default.** Motion marks a change the student should notice (a new task, a pass, a
  hint). It is never ambient decoration, never loops, never covers the editor, steals focus or
  blocks a click.
- **Once, then still.** Entrances play on a task's first view only. Emphasis (a spin, a wobble)
  plays once per event and then the element stays still. No infinite pulses on student UI.
- **Celebrate real achievements.** A spin or chime marks something the student did (their checks
  passed), never opening a page. No points, streaks or comparisons.
- **Respect reduced motion.** Under `prefers-reduced-motion: reduce` entrances become a short
  fade with no stagger, and emphasis and looping status animation stop. There is no in-app motion
  switch; the OS setting is the switch.
- **Short.** Most movement is 180–460ms; the longest (a badge tumbling in) is under a second.
- **No library.** CSS keyframes in `src/index.css` plus `src/shared/motion.js`. Don't add an
  animation dependency.

## Tokens (`:root` in `src/index.css`)

| Token | Value | Use |
|---|---|---|
| `--motion-fast` | 180ms | Small UI responses, reduced-motion fades |
| `--motion-base` | 280ms | Item entrances (bullets, answers) |
| `--motion-slow` | 460ms | Panel entrances (explainer), task slides |
| `--motion-stagger` | 70ms | Gap between staggered items |
| `--motion-spin` | 620ms | Length of `motion-spin-once` |
| `--motion-tumble` | 720ms | Length of `motion-tumble-in` |
| `--motion-ease-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Default: things arriving |
| `--motion-ease-glide` | `cubic-bezier(0.22, 1, 0.36, 1)` | Long travel (task slides) |
| `--motion-ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful overshoot (spin, tumble) |

`--ui-motion` (hover and focus transitions) is `var(--motion-fast) var(--motion-ease-out)`.
`MOTION_MS` in `src/shared/motion.js` mirrors the durations for JS timers that must line up with
CSS; change both together.

## Classes

| Class | Movement | For |
|---|---|---|
| `motion-drop-in` | Falls a little from above and fades in | Panels arriving (explainer, class wall) |
| `motion-slide-in` | Slides in from the left | List items (explainer bullets) |
| `motion-rise-in` | Rises a little from below | Choices (quiz options, activity choices) |
| `motion-pop-in` | Scales up from 80% with a small overshoot and fades in | A box arriving as a reward (the pass banner) |
| `motion-spin-once` | One full turn with a small overshoot | A pass: ✓ icon, Next button, "✓ Correct" |
| `motion-wobble` | Small side-to-side shake | A failed check's hint banner |
| `motion-tumble-in` | Falls from high up while rotating, bounces to rest | Badge stickers on the Badge Summary |
| `motion-stagger` | Delays by `--motion-i` × `--motion-stagger`, capped at 8 items | Add to any of the above in a list |
| `motion-now` | Sets `--motion-entrance-delay` to 0 on the element | Something arriving after its task has landed (a live Badge Summary row) |

Every class uses `animation-fill-mode: backwards`: a staggered item stays hidden during its delay,
and once the animation ends the element's own `transform` (a hover lift, the quiz scale-to-fit)
applies again. Don't switch a motion class to `both` or `forwards`.

**Slide first, then entrances.** A task's entering slide panel sets `--motion-entrance-delay` to
`--motion-slow`, and every entrance class (`drop-in`, `slide-in`, `rise-in`, `tumble-in`, and
`motion-stagger`) adds it to its delay. So the task slides in, then its explainer drops in and its
bullets and answers follow, with no JS timers; content is hidden while it waits (backwards fill).
The variable stays for the panel's life (turning it off mid-animation would make a delayed
entrance jump), so anything that arrives later adds `motion-now`. Reduced motion sets it to 0.
Emphasis classes (`spin-once`, `wobble`, `pop-in`) never wait. A JS timer that waits out an
entrance must include `MOTION_MS.slow` for the slide (`CHOICE_ENTRANCE_MS` does).

To replay a one-shot class (the spin on a second pass), either change the element's React `key`
(for example to the `usePassMoment` count) or, for anything that can hold keyboard focus, restart
it in place: remove the class, read `offsetWidth` to force a reflow, add it back (`SoloNav.jsx`
does this so the Next button keeps focus). Re-adding the same class name alone does not restart a
CSS animation.

## Hooks and helpers (`src/shared/motion.js`)

- `prefersReducedMotion()` — for JS that picks a different path (the badge card), not for CSS,
  which uses the media query.
- `useFirstView(key)` — true for the whole first mount that shows `key` on this screen, false on
  any later mount. Build keys with `firstViewKey('explainer', lessonId, taskId)` and namespace them
  per component. Memory only: a reload shows entrances again, and each window (presentation,
  Builder preview) has its own memory. Keying by task id means a Builder edit doesn't replay it,
  and the task slide's leaving panel (a remount) never replays it.
- `staggerStyle(i)` — the inline `--motion-i` for the `i`th staggered item.
- `usePassMoment(passed, taskKey)` — counts the times `passed` went false → true while the
  student watched this task. Arriving on an already-passed task, or a reload that restores a pass,
  is 0. Use it for spins and the success chime.

## Sound

Sounds are synthesised with Web Audio (`CHIME_PRESETS` in `src/app/nudgeAlert.js`), never audio
files. A sound only plays where the student can mute it, and the tutor's class-wide Sounds off
always wins in a live session. It never plays on the teacher view, the presentation window or
the Builder preview.

- **One Sounds mute.** `src/app/soundSettings.js` (`useSoundsMuted()`) stores it in localStorage
  as `headstart_sounds_muted` (`'1'` when muted), kept in sync across components and tabs. The
  student sets it from the 🔊/🔇 top-bar button (`SoundsToggleButton.jsx`, solo and live) or the
  🎖️ pill's popover; both are the same setting.
- **Celebration sounds:** the badge chime and the `complete` chime (`useCompleteChime`, once per
  task per screen, on a pass the student watched; silent for passes restored on arrival or reload).
- **Not a celebration:** the teacher's nudge chime calls a student back and ignores the mute.
  The class countdown's falling `timesUp` chime (`useClassCountdown`) marks the teacher's
  deadline; unlike the nudge it respects the mute and Sounds off.

## Adding motion: checklist

1. Is it marking a real change or achievement? If it's decoration, don't.
2. Use an existing `motion-*` class and the tokens. Add a new class here only for a genuinely new
   kind of movement, with its reduced-motion rule in the shared block at the end of `index.css`.
3. Entrance? Gate it with `useFirstView`. Emphasis on an event? Key it off the event
   (`usePassMoment`).
4. No `infinite` on student UI. Status indicators that must loop (a live dot) need a
   reduced-motion rule.
5. Inline `animation:` style strings can't be overridden by the reduced-motion media query; prefer
   a class.
6. Check it in a real browser, with reduced motion on and off: jsdom tests only see class names.

## Where it's used

| Moment | Where | Motion |
|---|---|---|
| Task slide | `TaskSlideTransition.jsx` (students via `LessonTaskContent`, presentation window, teacher explainer in `TeacherView`) | Direction-aware 120px slide over `--motion-slow` / glide; Back slides the other way |
| Neighbour images | `usePreloadNeighbourImages` (`src/shared/preloadImages.js`) in `StudentView` and `TeacherView` | Not motion: the next and previous tasks' images load in the background, so they don't pop in after the slide |
| Explainer arrives | `ExplainerPanel.jsx` (`entranceKey`) | `motion-drop-in` after the task slide lands, first view only; not on collapse/expand. Teacher view: the old explainer slides out, then the new one drops in |
| Explainer and information bullets | `MarkdownRenderer` `animateLists` (explainer and `InformationTask` only) | `motion-slide-in` + `motion-stagger` per list |
| Answers | Multiple choice, Match, fill-in-the-blank, confidence (`src/activities/ui/choiceEntrance.jsx`) | `motion-rise-in` + `motion-stagger`, first view only |
| Checks pass | `CheckFeedbackBanner.jsx` | Banner `motion-pop-in` while its ✓ `motion-spin-once`, each pass banner |
| Checks fail | `CheckFeedbackBanner.jsx` fail banner | `motion-wobble` each failed check |
| Next after a pass | `SoloNav.jsx` | Static success glow; `motion-spin-once` on a pass the student watched (`usePassMoment`) |
| Activity correct | `src/activities/ui/ActivityCorrect.jsx` (`ActivityCorrect`, `SpinTick`) | ✓ `motion-spin-once` when it appears |
| Success chime | `useCompleteChime` (StudentView) | Rising C–E–G Web Audio chime, first watched pass per task |
| Teacher 👍 | `ThumbsUpToast.jsx` + `useThumbsUp` (StudentView) | Toast `motion-pop-in` per push, auto-dismissed after 2.5s; the `badge` chime unless muted |
| Badge Summary | `BadgeSummaryTask.jsx`, `BadgeStickerSheet` `entrance="tumble"` | Student: stickers `motion-tumble-in` 260ms apart, then the wall drops; teacher/presentation: row emoji tumble, rows drop; later arrivals only drop in |
| Badge celebration card, class toast, sticker sheet | `src/app/components/badges/` | `sv-badge-*` keyframes (predate this system; same principles) |
| Class countdown Time's up | `TimesUpBanner.jsx` + `useClassCountdown` (StudentView, students and presentation window) | Banner `motion-pop-in` once per watched deadline, auto-dismissed after 5s; the `timesUp` chime on the student's own screen unless muted. The countdown pill only changes colour (no looping animation) |
| Presentation annotations | `src/app/liveInk/LiveInkOverlay.jsx` (`live-ink-*` classes in `index.css`) | Teacher's pointer dot lerps between ~12Hz updates; ink strokes hold 2.5 s then fade over 1.5 s (`live-ink-fade`). Reduced motion: the dot jumps and strokes vanish at the same moment with no fade |
