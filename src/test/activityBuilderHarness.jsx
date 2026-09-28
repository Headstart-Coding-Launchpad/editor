// Renders an activity BuilderEditor with the task held in state (as the Builder does), so tests
// can edit through the UI and assert on the resulting task.
import React, { useState } from 'react'
import { render } from '@testing-library/react'

function Harness({ Editor, initialTask, taskRef }) {
  const [task, setTask] = useState(initialTask)
  return (
    <Editor
      task={task}
      lessonType="python"
      onUpdate={(next) => {
        taskRef.current = next
        setTask(next)
      }}
    />
  )
}

export function renderBuilderEditor(Editor, initialTask) {
  const taskRef = { current: initialTask }
  const utils = render(<Harness Editor={Editor} initialTask={initialTask} taskRef={taskRef} />)
  return { ...utils, task: () => taskRef.current }
}
