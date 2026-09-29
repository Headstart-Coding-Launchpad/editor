// Milestone release notes shown from the Admin Portal version footer, newest first.
// When you bump MAJOR.MINOR in package.json, add an entry here with the same version;
// releaseNotes.test.js fails if the newest entry doesn't match package.json.
export const RELEASE_NOTES = [
  {
    version: '1.0',
    date: '2026-09-29',
    title: 'First versioned release',
    notes: [
      'Version number, commit and build date now shown at the bottom of the Admin Portal.',
      'Modular activities: quiz and code-arrange tasks now run as pluggable activities.',
      'Shared workspaces: students can share their work, with teacher approval.',
      'Python Turtle task type, with code checks on Turtle, Arcade and Electronics lessons.',
      'Teacher controls: starter-line hints, reference and copy controls, obfuscated lesson answers.',
    ],
  },
]
