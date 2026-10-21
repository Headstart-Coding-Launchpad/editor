# Share links built for every student at the end of each session, listed in the tutor view and CLI

- **Status:** planned
- **Kind:** tooling
- **Requested by:** Ryan (approved by Ryan), 2026-10-18
- **Lessons blocked:** none yet

## Need

Ryan wants parents to see what their child made after every lesson (free tasters included), through a link we'll later post in Pencilcase. LaunchPad can already make a read-only, nameless share link, but only one child at a time by hand from Export work, so nobody does it after every lesson. Needed: at the end of each session LaunchPad builds a read-only share link per student, without the child's name, for Scratch, Python and web pages, and lists them for us in the tutor view and through the CLI so a script can pick them up. LaunchPad sends nothing anywhere; getting links into Pencilcase is our own later plumbing and out of scope. Questions for LaunchPad Dev: how long should the links last (today's 30 days, a term, or permanent)? Or would a per-child 'projects' page (one stable link per child, each lesson's work added to it) fit better than a new link every session?

Closest existing capability (from `lessons capabilities`): Export work (#59, shipped): tutor's student window › More › Export work gives a download and a read-only share link without the child's name, valid 30 days (HSC Hub Specs/Parent Features.md §10). It lacks: building links automatically for every student at End Session, tasters included; a list of a session's links in the tutor view; any CLI read of share links.

Current workaround and why it falls short: The tutor opens each child's window and makes a link by hand after every lesson, then copies them out. Too slow for every class and taster, so in practice parents get no link and the P7/P22 aim (each child goes home with their work) isn't met.

## Example task

    ```
    # Built automatically when the tutor ends a session (live lessons and free tasters).
    # Read them back, no new sharing step:
    node cli/cli.mjs sessions share-links <lessonId> --session <startedAt> --yaml
    # or every session since a date, so a nightly script can pick them up:
    node cli/cli.mjs sessions share-links --since 2026-10-17 --yaml
    ```
    ```yaml
    - lessonId: caakmdqj5j
      lessonTitle: "Name Tags"
      sessionStartedAt: 2026-10-20T16:00:00Z
      className: "Foxes"          # class label only, never student names
      links:
        - studentKey: s_7f3k2      # stable, anonymous key per student (same child, same key across sessions)
          kind: python | scratch | html
          url: https://.../share/abc123   # read-only, no login, no child's name on the page
          expiresAt: 2026-11-19     # or null if a per-child projects page is used instead
          shows: finished project + lesson title + "what we learnt" line
    ```
    In the tutor view: the session summary (End Session) lists the same links per student, with a copy button each and "copy all".
    

## Checks wanted

- Outcome: when a session ends (including a free taster session), every student who did work gets one read-only share link for that lesson's project, with no extra tutor step.
- Outcome: works for Scratch (opens the project read-only, runnable), Python (code + run output) and web pages (rendered page + code).
- Outcome: the shared page shows no child's name, no classmates' names or work, and nothing that reveals the class roster; the URL is unguessable.
- Outcome: the links are listed in the tutor view (session summary) and returned by a CLI command filterable by lesson, session and date, so a script can collect them without opening the browser.
- Outcome: LaunchPad sends nothing anywhere (no emails, no posting to Pencilcase); it only builds and lists.
- Outcome: the CLI output carries a stable anonymous student key, so our script can match a child's links across sessions without names entering our files.
- Outcome: a link can be revoked by the tutor.
- Method (suggested): reuse the existing Export work share-link snapshot (#59, 30-day read-only copy) and trigger it per student at End Session.


## Devices

Tutor view on desktop; the share pages must open on parents' phones and tablets (touch, small screens) as well as desktops, with Scratch projects runnable there.

## Notes

From HSC Hub handoff 2026-10-16 'parents see their child's work through a link in Pencilcase', narrowed by Ryan 2026-10-17: 'Don't ask LaunchPad to share them, just be able to build them.' Students' names never go into Hub or Lesson Gen files.

## Resolution

Built on branch `feature/end-session-share-links` (2026-10-21), waiting on Ryan's merge OK.
Links last 30 days (today's share setting); a per-child projects page can come later on top of
the stable `studentKey`. Class labels aren't in the CLI output (reports don't carry one). Docs:
[session-reports.md](../session-reports.md#share-links).
