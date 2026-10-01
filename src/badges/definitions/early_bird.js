import { defineBadge } from '../defineBadge.js'
import { joinedEarly } from '../rules.js'
import { earlyJoinEvent } from '../timeline.js'

const MINUTE = 60 * 1000

// Times come from two devices' clocks (the student's join, the tutor's Start), so this is
// suggested, never auto-awarded.
export default defineBadge({
  id: 'early_bird',
  emoji: '🐦',
  title: 'Early Bird',
  blurb: 'Was ready before the lesson started.',
  ruleText:
    'First joined the session at least earlyBirdMinutes (default 5) before the tutor pressed Start. Suggested once the session has started.',
  rule: joinedEarly(),
  reasonText: ({ minutes }) => `Joined ${minutes} min before the lesson started`,
  examples: [
    {
      name: 'joined five minutes before Start',
      timelines: { alex: [earlyJoinEvent({ leadMs: 5 * MINUTE, at: 100 })] },
      expect: [['alex', null]],
    },
    {
      name: 'joined just under five minutes before Start',
      timelines: { alex: [earlyJoinEvent({ leadMs: 5 * MINUTE - 1, at: 100 })] },
      expect: [],
    },
    {
      name: 'a lesson can ask for less',
      options: { earlyBirdMinutes: 2 },
      timelines: { alex: [earlyJoinEvent({ leadMs: 3 * MINUTE, at: 100 })] },
      expect: [['alex', null]],
    },
  ],
})
