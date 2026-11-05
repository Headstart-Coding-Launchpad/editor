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
      {open && <HelpTopicsDialog type={type} onClose={() => setOpen(false)} />}
    </>
  )
}

// Mounted only while open, so closing and reopening after a failed load fetches again. The dialog
// (and its Close button) shows at once; loading and errors show inside it.
function HelpTopicsDialog({ type, onClose }) {
  const { topics, loading, error } = useTopicLibrary(type)
  let status = null
  if (topics.length === 0) {
    if (loading) status = 'Loading topics...'
    else if (error) status = "Couldn't load topics, try again."
    else status = 'No help topics here yet.'
  }
  return (
    <TopicLibraryDialog
      topics={topics}
      renderMarkdown={MarkdownRenderer}
      topicType={type}
      onClose={onClose}
      status={status}
    />
  )
}
