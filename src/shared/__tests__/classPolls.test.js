// @vitest-environment node
import { describe, expect, it } from 'vitest'
import yaml from 'js-yaml'
import {
  buildPollsReport,
  getActivePoll,
  getStudentPollChoice,
  normalizePollDraft,
  pollOptionList,
  pollPercent,
  tallyPoll,
  tallyPollTask,
} from '../classPolls'
import { anonymizeSessionReport, buildSessionReport, reportToYamlText } from '../lessonReport'

const poll = {
  question: 'What would you like to do next?',
  options: ['Games', 'Art', 'Music'],
  status: 'open',
  showResults: false,
  createdAt: 1000,
}

const session = {
  startedAt: 500,
  activePollId: 'p2',
  polls: {
    p2: { ...poll, question: 'Second?', options: ['Yes', 'No'], createdAt: 3000 },
    p1: { ...poll, status: 'closed', closedAt: 2000, showResults: true },
  },
  students: {
    'anon-a': {
      displayName: 'Ada',
      firstJoinedAt: 600,
      pollResponses: { p1: { choice: 1, answeredAt: 1100 }, p2: { choice: 0, answeredAt: 3100 } },
    },
    'anon-b': {
      displayName: 'Ben',
      firstJoinedAt: 700,
      pollResponses: { p1: { choice: 1, answeredAt: 1200 } },
    },
    // Joined after p1 closed: not counted as missing p1.
    'anon-c': { displayName: 'Cy', firstJoinedAt: 2500 },
  },
}

describe('normalizePollDraft', () => {
  it('trims the question and options and drops blank options', () => {
    expect(normalizePollDraft({ question: ' Q? ', options: [' A ', '', '  ', 'B'] })).toEqual({
      poll: { question: 'Q?', options: ['A', 'B'] },
    })
  })

  it('needs a question, 2 to 6 distinct options and short text', () => {
    expect(normalizePollDraft({ question: '', options: ['A', 'B'] }).error).toMatch(/question/)
    expect(normalizePollDraft({ question: 'Q', options: ['A'] }).error).toMatch(/at least 2/)
    expect(
      normalizePollDraft({ question: 'Q', options: ['1', '2', '3', '4', '5', '6', '7'] }).error
    ).toMatch(/at most 6/)
    expect(normalizePollDraft({ question: 'Q', options: ['A', 'a'] }).error).toMatch(/different/)
    expect(normalizePollDraft({ question: 'x'.repeat(201), options: ['A', 'B'] }).error).toMatch(
      /under 200/
    )
    expect(normalizePollDraft({ question: 'Q', options: ['A', 'x'.repeat(101)] }).error).toMatch(
      /under 100/
    )
  })
})

describe('reading polls', () => {
  it('reads options stored as an array or an index-keyed object', () => {
    expect(pollOptionList({ options: ['A', 'B'] })).toEqual(['A', 'B'])
    expect(pollOptionList({ options: { 1: 'B', 0: 'A' } })).toEqual(['A', 'B'])
    expect(pollOptionList({})).toEqual([])
  })

  it('finds the active poll and a student choice', () => {
    expect(getActivePoll(session)).toMatchObject({ pollId: 'p2', options: ['Yes', 'No'] })
    expect(getActivePoll({ ...session, activePollId: null })).toBeNull()
    expect(getActivePoll({ ...session, activePollId: 'gone' })).toBeNull()
    expect(getStudentPollChoice(session, 'anon-a', 'p2')).toBe(0)
    expect(getStudentPollChoice(session, 'anon-b', 'p2')).toBeNull()
  })

  it('ignores a stored choice outside the options', () => {
    const odd = {
      polls: { p1: poll },
      students: { s: { pollResponses: { p1: { choice: 7, answeredAt: 1 } } } },
    }
    expect(getStudentPollChoice(odd, 's', 'p1')).toBeNull()
  })
})

describe('tallyPoll', () => {
  it('counts each option, lists the voters and who has not answered', () => {
    const tally = tallyPoll(session, 'p1')
    expect(tally.total).toBe(3)
    expect(tally.respondedCount).toBe(2)
    expect(tally.options.map((o) => o.count)).toEqual([0, 2, 0])
    expect(tally.options[1].voters.map((v) => v.name)).toEqual(['Ada', 'Ben'])
    expect(tally.notResponded.map((v) => v.name)).toEqual(['Cy'])
  })

  it('works out percentages of the votes cast', () => {
    expect(pollPercent(1, 3)).toBe(33)
    expect(pollPercent(0, 0)).toBe(0)
  })
})

describe('tallyPollTask', () => {
  const task = {
    id: 4,
    options: [
      { id: 'a', text: 'Games' },
      { id: 'b', text: 'Art' },
    ],
  }

  it("counts each student's latest logged choice and skips auto-check entries", () => {
    const session = {
      attemptLog: {
        s1: { 4: { x: { submission: 'a', loggedAt: 1 }, y: { submission: 'b', loggedAt: 5 } } },
        s2: { 4: { x: { submission: 'a', loggedAt: 2 } } },
        s3: { 4: { x: { submission: 'b', loggedAt: 3, auto: 'leave' } } },
        s4: { 9: { x: { submission: 'a', loggedAt: 3 } } },
      },
    }
    const tally = tallyPollTask(session, task)
    expect(tally.respondedCount).toBe(2)
    expect(tally.options.map((o) => o.count)).toEqual([1, 1])
  })

  it("puts the viewer's current pick in before their own log arrives", () => {
    const session = { attemptLog: { s1: { 4: { x: { submission: 'a', loggedAt: 1 } } } } }
    const tally = tallyPollTask(session, task, { anonymousId: 's1', choice: 'b' })
    expect(tally.options.map((o) => o.count)).toEqual([0, 1])
    expect(tally.respondedCount).toBe(1)
  })
})

describe('buildPollsReport', () => {
  it('reports every poll oldest first with counts, responses and non-responders', () => {
    const labels = { 'anon-a': 'Student 1', 'anon-b': 'Student 2', 'anon-c': 'Student 3' }
    const polls = buildPollsReport(session, (id) => labels[id])
    expect(polls.map((p) => p.pollId)).toEqual(['p1', 'p2'])
    expect(polls[0]).toEqual({
      pollId: 'p1',
      question: 'What would you like to do next?',
      options: [
        { index: 0, text: 'Games', count: 0 },
        { index: 1, text: 'Art', count: 2 },
        { index: 2, text: 'Music', count: 0 },
      ],
      status: 'closed',
      showResults: true,
      createdAt: 1000,
      closedAt: 2000,
      respondedCount: 2,
      responses: [
        { studentLabel: 'Student 1', choice: 1, choiceText: 'Art', answeredAt: 1100 },
        { studentLabel: 'Student 2', choice: 1, choiceText: 'Art', answeredAt: 1200 },
      ],
      notResponded: [],
    })
    // Still open (no closedAt, session not ended): everyone in the class counts.
    expect(polls[1]).toMatchObject({
      status: 'open',
      closedAt: null,
      respondedCount: 1,
      notResponded: ['Student 2', 'Student 3'],
    })
  })

  it('is empty without polls', () => {
    expect(buildPollsReport({}, () => 'x')).toEqual([])
  })
})

describe('session report polls', () => {
  const lesson = { id: 'l1', title: 'Lesson', tasks: [{ id: 1, title: 'Code' }] }

  it('adds a top-level polls list labelled with anonymous students', () => {
    const report = buildSessionReport({ session, lesson })
    expect(report.polls).toHaveLength(2)
    const text = JSON.stringify(report.polls)
    expect(text).not.toMatch(/anon-|Ada|Ben/)
    expect(report.polls[0].responses.map((r) => r.studentLabel)).toEqual(['Student 1', 'Student 2'])
  })

  it('leaves polls out when the session had none', () => {
    const report = buildSessionReport({ session: { ...session, polls: null }, lesson })
    expect(report).not.toHaveProperty('polls')
  })

  it('relabels poll students when anonymising and exports them to YAML', () => {
    // An old or hand-made report that names its students.
    const named = anonymizeSessionReport({
      students: [{ anonymousId: 'anon-a', displayName: 'Ada', tasks: [] }],
      polls: [
        {
          pollId: 'p1',
          responses: [{ studentLabel: 'Ada', choice: 0 }],
          notResponded: ['anon-a', 'Someone else'],
        },
      ],
    })
    expect(named.polls[0].responses).toEqual([{ studentLabel: 'Student 1', choice: 0 }])
    expect(named.polls[0].notResponded).toEqual(['Student 1', 'Former student'])

    const report = buildSessionReport({ session, lesson })
    const parsed = yaml.load(reportToYamlText(report))
    expect(parsed.polls[0].question).toBe('What would you like to do next?')
    expect(parsed.polls[0].options[1]).toEqual({ index: 1, text: 'Art', count: 2 })
  })
})
