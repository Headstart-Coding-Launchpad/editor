# Fun first: a design guide for platform features

From Lesson Gen's LG-P10 guide, adopted 2026-10-23 (handoff #103).

**Who for:** children aged 7 to 16, in live online classes of 3 to 10 led by one tutor. Lessons are 40 minutes, and the class moves through tasks together. **Fun comes first, learning second, and learning is never dropped.** Fun means fast, big results, and something that's theirs to keep or show. The brief: "simple and possibly even kinda stupid but work".

Use this when designing any student-facing feature, activity or module. See also the tutor visibility principle in `docs/agents/project-rules.md`.

## Principles

1. **Fun moment first, within seconds.** Every feature has a fun moment (requests carry a Fun moment section). Build that first. The student's first action makes something visible happen. Never make the fun a reward at the end of a chore.
2. **The dial is the concept.** The thing students want to fiddle with *is* what's being taught (drag the loop count, not the colour). Don't add fun controls that pull away from the step.
3. **Less on screen.** Show only what this lesson needs, and let the lesson switch more parts on later. Choose the simplest version that works, and cut features before polish.
4. **Obvious.** Big targets, a clear place to look, and an unmistakable change when an item or task changes.
5. **Rounds inside a task; the tutor moves between tasks.** A round is one goal of 3 to 8 reps that advances by itself, with bonus reps after it. Only the tutor moves the class to the next task.
6. **Feedback straight away, kept small. The big moment is finishing.** Mark each action as it happens with a small tick. Save the celebration for the end of the round. Use one standard success and try-again look across every activity.
7. **Mistakes are safe.** Make undo and try again easy. Never count play or exploring as failure (for example, scrub releases logged as failed attempts). Reward making a prediction, not only getting it right.
8. **Say it once, with a picture.** One short sentence a 7-year-old can read, plus a picture of the key or gesture (keycaps for Ctrl + C).
9. **Friendly but not babyish.** Plain words over jargon ("Sensible / Silly", not "temperature"), but no baby talk. Prefer words over emoji, because 14 to 16 year olds use the same screens.
10. **Theirs, and keepable.** Their choices show. Their work is saved, can be shown on the class screen, and can be exported or shared.
11. **Real, and honest about it.** Say what real thing this is a small version of, and don't pretend a toy is the real thing.
12. **The tutor can see and lead it.** At a glance: who's started, who's finished, who's stuck. The tutor can call time on a round for the whole class.
13. **Accessible.**
    - Respect reduced-motion and keep motion small.
    - Sound is off by default, and the tutor controls it.
    - Never use colour alone: add a tick or cross and a word.
    - Make everything usable by keyboard, with visible focus.
    - Use a readable font size.
    - Works on Chromebook trackpads and Macs.
14. **Safeguarding beats fun.**
    - Students exchange only fixed or encoded content, never free text with each other.
    - The tutor approves anything before it goes on the class screen.
    - Share links show first names or nicknames only.

## Anti-patterns (don't build)

- Leaderboards or ranking students against each other.
- Streaks you can lose.
- Timers that pit students against each other.
- Random rewards (loot boxes, surprise prizes).
- Nagging or guilt prompts.
- A "Check my work" button under work that could be marked live.
- Navigation inside a task (Previous/Next within an activity).
- Speed pressure for children who can't type yet. Any timed mode needs an adaptive speed or a no-fail practice mode.

## The fun check (pass or fail, before shipping)

1. First visible result in **under 10 seconds** from opening.
2. Instruction is **one sentence**, with a picture.
3. The student **makes a choice** that shows in the result.
4. The control they'll fiddle with **is the concept**.
5. Works on a **Chromebook trackpad with sound off**.
6. Passes the **accessibility** rules (motion, colour, keyboard).
7. Anything shared or shown is **safe to share**.
8. The tutor can **see progress and call time**.
9. Fits the task's minutes for both the **youngest and the oldest age** it serves.
10. **Watched one real class use it** (below).

Run it on the design before building, and again on the finished screen. Note any fail and why it stays.

## Test it with real children

Pilot with one class before rolling it out. The tutor notes three things:

- seconds until each child first acts;
- who asked "what do I do?";
- who finished early and what they did next.

Ship when those look right.
