# Student data we hold

Every place LaunchPad keeps something about a student, who can read it, and when it goes. It's for the UK Children's Code checks (Hub #223, Ryan 25 Oct 2026: "a list of every field we hold on a student"). Field shapes are in [runtime-model.md](runtime-model.md). This page is the summary. When you add a field that is about a student, add it here too.

Not legal advice. The research behind it is in Ryan Hub `drafts/research-children-data.md`.

## What we never collect

- No surname, school, email, phone, photo, voice or location.
- No IP address, user agent or screen size is written anywhere. `navigator.userAgent` is only read on the device, to pick touch or mouse controls.
- Students don't log in. A student is a Firebase anonymous-auth uid (`anonymousId`) plus the name they type when they join (1-30 characters, usually a first name).

## Where it lives

| Place | About the student | Who can read it | When it goes |
|---|---|---|---|
| Realtime Database `sessions/{lessonId}/students/{anonymousId}` | Typed name; live code, files and output; run status and error line; answers and drafts; hint shown; help request; window focus; what they're doing now | Anyone signed in (students anonymously) with the lesson id (`database.rules.json`: `$lessonId` `.read: "auth != null"`, #288) | `endSession` clears `students`; the whole session node goes when the tutor tab disconnects; an admin can clear stale sessions (no tutor for 2 hours) in the Admin Portal |
| `sessions/{lessonId}` logs: `attemptLog`, `badges`, `studentSignals`, `taskTimeline`, `typingHistory`, `rosterMatches`, `shownResponses` | Submissions (can be whole programs), badges, timing, typing speed, answer text shown to the class | Anyone signed in with the lesson id | `shownResponses` and `draftLog` are cleared at End Session. The rest go when the session node goes. `badges` and `studentSignals` deliberately survive End Session until then |
| `joiningStudents/{tempId}` | The name while it is being typed | Anyone | On join or disconnect |
| `sharedWorkspacePayloads/{lessonId}` | Code a student shared with the class and the sharer's name | `approved`: anyone signed in with the lesson id. `pending`: the author and tutors | At End Session and on disconnect |
| `carryInbox`, `peerHelp*`, `sessionArchive` | Earlier-lesson code, help requests, sandbox snapshots | The student (own carry), tutors | At End Session and on disconnect |
| Firestore `lessons/{id}/sessionReports` | Anonymous: "Student N" and a one-way `studentKey` hash, attempts, timings, typing numbers, badges, help. Reports saved before 16 Jul 2026 can still hold names and ids | Tutors and admins | No retention limit. They go only when the lesson is deleted |
| Firestore `classes/{id}/roster` (+ `work`, `typing`) | Name and initial, saved code per task, typing scores | Tutors and admins | No retention limit. They go when the roster entry is deleted |
| Firestore `sharedWork/{id}` (`/share/:id` links) | Task title and a code snapshot, with no name | Anyone with the 128-bit link id, until it expires or is revoked | Hidden after 30 days or on revoke (tutor, per link, or admin). The document stays |
| Browser `localStorage` (`headstart_*`) | `anonymousId`, typed name, code per task, mute and volume | That device only | Never expires (cleared with the browser's site data) |

Storage (images, sounds) holds only lesson assets written by admins. Students upload nothing.

## Child-safe defaults: where we stand (27 Oct 2026)

| Default (research note) | Today |
|---|---|
| Big screen shows first names only | Show it shows no names at all ("Build 1/2/3"). Badge award toasts on the class screen do name the child |
| Share links are unguessable, expire, can be revoked, aren't indexed | 128-bit ids, 30-day expiry, per-link revoke. Every page now carries `noindex` (27 Oct) |
| Minimal data | Nothing beyond first name and work. See the gaps below |
| Reports: tutor-only, retention limit | Tutor-only and anonymous since Jul 2026, but no retention limit |
| No geolocation, profiling or public galleries | None |

## Open gaps (for Ryan, not changed)

1. Closed 2026-10-27 (#288, Ryan yes): live session reads now need a sign-in (`auth != null`). Students sign in anonymously, so nothing changes for them. Anyone signed in with the lesson id (including an anonymous sign-in) still sees that class, which the live view needs.
2. There is no retention limit on session reports, roster work and typing, or expired `sharedWork` documents.
3. Reports saved before 16 Jul 2026 may still hold names.
