# ADR 0011: Live badges: code registry, pure rules engine, decisions-only storage

## Status

Accepted (Live Student Badges plan, PRs 1–7, 2026-09-30).

## Context

Live Student Badges recognise good learning behaviour during a live lesson (🐛 Bug Hunter, 🔧 Code
Fixer, ⌨️ Keyboard Wizard, …) while the tutor stays in control, with no points, totals or
rankings. Three forces shaped the design:

- **There is no event stream or backend.** The teacher's client already subscribes to the whole
  `sessions/{lessonId}` node; everything else would have to be derived there or added as new
  Realtime Database data, which streams to every client.
- **Badges must be trustworthy and cheap to add.** A rule that rewards the wrong thing (a pass
  after the complete code was shown, a reload re-run) teaches students to game it. New badges
  should be testable without a browser.
- **Some badges are pure tutor judgement**, and schools want to add their own without a deploy.

## Decision

- **Built-in badges are a code registry.** Each badge is `src/badges/definitions/<id>.js`
  exporting `defineBadge({ id, emoji, title, blurb, ruleText, rule?, reasonText?, autoAwardable?,
  examples? })`. `registry.pure.js` (Node-safe: CLI, validation, engine, reports) lists them;
  `registry.js` is the UI registry, mirroring the activity registry (ADR 0009). Tutor-only badges
  omit `rule`. `npm run new:badge` scaffolds one.
- **Rules are pure functions over timelines.** The teacher's client turns the session snapshot
  into one normalised, ordered event list per student (`liveTimeline.js` → `timeline.js` events),
  and `evaluateBadgeRules` runs every rule over all students' timelines. Rules never touch
  Firebase or React; they are built from a few helpers in `rules.js` that share one set of
  anti-gaming guards (a pass is "real" only without teacher help, override, complete code shown,
  a complete-stage reveal or a large paste before it). Every rule-backed badge carries at least
  two `examples`, which one generic test runs, so a badge is tested by writing examples.
- **Rules suggest; the tutor decides; only decisions are stored.** Suggestions are recomputed
  from the snapshot (they survive a teacher reload and are never written). A decision
  (`sessions/{lessonId}/badges/{anonymousId}/{badgeId}`: awarded, dismissed or revoked) is a
  write-if-absent transaction, so two teacher tabs or an auto-award racing a dismissal can't
  double-write. First-in-class is a pure function of passes and earlier decisions, so a later
  award never moves an earlier suggestion.
- **New student data is signals, not code**: first-occurrence records and per-run counters under
  `studentSignals/{anonymousId}`, never per keystroke. Teacher-sandbox code goes to a separate
  top-level `sessionArchive/{lessonId}` that no client subscribes to live.
- **Manual-only badges live in a Firestore catalogue** (`badgeCatalogue/{id}`: admin write,
  teacher read), edited in Admin Portal → Badges with no deploy. Ids can't collide with the
  registry and emoji are unique across all badges. Students can't read the catalogue, so a
  catalogue award copies `{ emoji, title, blurb }` onto the decision (`decision.badge`), which
  every display path falls back to. Catalogue badges are archived, never deleted.
- **Lessons tune, never define, badges**: the envelope's `badgeOptions` and a task's
  `badgeHints` (suggest / suppress), with the task kind parsed from the existing `taskActivity`
  string (`src/shared/taskActivity.js`) rather than re-tagging lessons.

## Consequences

- Adding a rule-backed badge is one definition file (plus examples) and one registry line;
  `badgeRegistry.test.js` fails if a file isn't registered, an emoji repeats, or an example
  disagrees with its rule. A behaviour nothing records yet needs a new signal and its own
  data-model sign-off.
- The engine runs only on the teacher's client (live v1). Because rules only read timelines, a
  later solo mode can add a `buildSoloTimeline` and reuse every rule unchanged.
- Nothing about badges is stored in lesson documents or localStorage; `endSession` keeps the
  `badges` node so students still see their moments after a reload, and the session report
  copies what it needs (including the catalogue badge's emoji and title) at session end.
- A catalogue badge renamed after it was awarded shows its new name to the tutor (who reads the
  catalogue) and its award-time name to students (the snapshot).
- See [docs/architecture/live-badges-plan.md](../architecture/live-badges-plan.md) and
  [docs/authoring/badges.md](../authoring/badges.md).
