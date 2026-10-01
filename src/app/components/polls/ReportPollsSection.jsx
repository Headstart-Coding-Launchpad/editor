import React from 'react'
import PollResultBars from './PollResultBars'

function formatTime(ms) {
  return typeof ms === 'number' ? new Date(ms).toLocaleTimeString() : null
}

// The session report's live class polls (report.polls, src/shared/classPolls.js), shown in
// TeacherReportModal — which the teacher's Reports panel and the Admin lesson panel reuse.
export default function ReportPollsSection({ report }) {
  const polls = Array.isArray(report?.polls) ? report.polls : []
  if (polls.length === 0) return null
  return (
    <section>
      <h3 className="report-polls__title">Class polls</h3>
      {polls.map((poll) => {
        const asked = formatTime(poll.createdAt)
        return (
          <div key={poll.pollId} className="report-poll">
            <div className="report-poll__question">{poll.question}</div>
            <div className="report-poll__meta">
              {asked ? `Asked ${asked} · ` : ''}
              {poll.respondedCount} answered
              {poll.notResponded?.length ? ` · ${poll.notResponded.length} didn't` : ''}
              {poll.showResults ? ' · results shown to the class' : ''}
            </div>
            <PollResultBars options={poll.options ?? []} respondedCount={poll.respondedCount} />
            {poll.responses?.length > 0 && (
              <div className="report-poll__who">
                {poll.responses.map((r) => `${r.studentLabel}: ${r.choiceText}`).join(' · ')}
              </div>
            )}
            {poll.notResponded?.length > 0 && (
              <div className="report-poll__who">Not answered: {poll.notResponded.join(', ')}</div>
            )}
          </div>
        )
      })}
    </section>
  )
}
