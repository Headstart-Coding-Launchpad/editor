import { defineBadge } from '../defineBadge.js'
import { sideQuestsDone } from '../rules.js'
import { attemptEvent, sideQuestDoneEvent } from '../timeline.js'

// Side-quests (src/shared/sideQuests.js) are unchecked and Done is self-reported, so this is only
// ever suggested: the tutor decides, never auto-award.
export default defineBadge({
  id: 'side_quester',
  emoji: '🗺️',
  title: 'Side Quester',
  blurb: 'Took on side-quests after finishing.',
  ruleText:
    'Marked at least sideQuesterMinDone (default 2) side-quests Done in the session, on any tasks. Done is self-reported, so this is suggested only; the tutor decides.',
  rule: sideQuestsDone(),
  reasonText: ({ count, taskTitle }) => {
    const done = `Finished ${count} side-quest${count === 1 ? '' : 's'}`
    return taskTitle ? `${done} (the last on “${taskTitle}”)` : done
  },
  autoAwardable: false,
  examples: [
    {
      name: 'two side-quests marked done',
      timelines: {
        alex: [
          sideQuestDoneEvent({ taskId: 't2', index: 0, at: 10 }),
          sideQuestDoneEvent({ taskId: 't4', index: 1, at: 20 }),
        ],
      },
      expect: [['alex', 't4']],
    },
    {
      name: 'one side-quest is not enough',
      timelines: { alex: [sideQuestDoneEvent({ taskId: 't2', index: 0, at: 10 })] },
      expect: [],
    },
    {
      name: 'the same side-quest marked twice counts once',
      timelines: {
        alex: [
          sideQuestDoneEvent({ taskId: 't2', index: 0, at: 10 }),
          sideQuestDoneEvent({ taskId: 't2', index: 0, at: 20 }),
        ],
      },
      expect: [],
    },
    {
      name: 'a lesson can ask for one',
      options: { sideQuesterMinDone: 1 },
      timelines: { alex: [sideQuestDoneEvent({ taskId: 't2', index: 2, at: 10 })] },
      expect: [['alex', 't2']],
    },
    {
      name: 'a side-quest on a task that has gone does not count',
      timelines: {
        alex: [
          sideQuestDoneEvent({ taskId: 't2', index: 0, at: 10 }),
          sideQuestDoneEvent({ taskId: 'gone', index: 0, at: 20 }),
        ],
      },
      expect: [],
    },
    {
      name: 'passing tasks is not doing side-quests',
      timelines: {
        alex: [
          attemptEvent({ taskId: 't2', passed: true, firstTry: true, at: 10 }),
          attemptEvent({ taskId: 't4', passed: true, firstTry: true, at: 20 }),
        ],
      },
      expect: [],
    },
  ],
})
