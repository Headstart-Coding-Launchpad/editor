import { useState } from 'react'
import { getModuleDefinition } from '../../modules/definitions'
import { useTopicLibrary } from '../../shared/topicLibrary'
import { TopicLibraryDialog } from '../../shared/TopicLibraryView'
import { MarkdownRenderer } from '../../shared/markdown'

// "Help topics" in a playground's top bar: the same topic library a lesson's explainer opens,
// filtered by the playground's module type. A playground has no explainer, so this is its only
// way in. Not shown where the module has no topic library (Scratch: capabilities.topicLibrary
// false). Topics are public-read Firestore (`topicLibrary`), so a login-less visitor can load them.
export default function PlaygroundHelpTopics({ type, style }) {
  const offered = getModuleDefinition(type)?.capabilities.topicLibrary ?? false
  const [open, setOpen] = useState(false)
  const { topics, loading } = useTopicLibrary(type, offered)
  if (!offered) return null
  return (
    <>
      <button
        type="button"
        className="btn-ghost"
        style={style}
        onClick={() => setOpen(true)}
        title="Look up commands and ideas"
      >
        ? Help topics
      </button>
      {open &&
        (loading && topics.length === 0 ? (
          <span role="status" style={s.loading}>
            Loading topics...
          </span>
        ) : (
          <TopicLibraryDialog
            topics={topics}
            renderMarkdown={MarkdownRenderer}
            topicType={type}
            onClose={() => setOpen(false)}
          />
        ))}
    </>
  )
}

const s = {
  loading: { fontSize: 12, color: '#fff', whiteSpace: 'nowrap' },
}
