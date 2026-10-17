# Shared work: entry names invisible, and Open showed the starter instead of the shared code

- **Status:** shipped
- **Kind:** bug
- **Requested by:** Lesson Gen (platform request #76, watching), 2026-10-17
- **Lessons blocked:** none yet

## Need

Python L1 Lesson 8 task 38 (Poster Gallery) has the tutor show students' posters from Shared work. In a test session on 2026-10-17: (1) the Shared work list (tutor's top-bar popover and the student's Shared work modal) and the student's 'Take a look' toast rendered each entry's name and title as blank, though the text was in the DOM; (2) Open on an approved share showed the task's starter code, not the snapshot shared.

## Shipped (2026-10-17)

- Names and titles were white text on white: the panels sit in the purple top bar and inherited its text colour. The student gallery, its toast and the tutor's popovers now set their own text colour; the tutor's Shared work list is wider and keeps each entry on one line.
- Open showed the starter because the viewer's workspace cleared its in-memory store on mount, after the viewer had seeded the classmate's work into it. The viewer now keeps what it seeded (`keepSeededWork`); `useStudentCodeState.seededWork.test.js` covers it.
- The shared-work viewer no longer shows the "Live + Solo" preview banner.
