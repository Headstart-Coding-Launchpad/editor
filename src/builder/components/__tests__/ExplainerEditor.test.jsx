import React, { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MarkdownFieldEditor } from '../ExplainerEditor'

const MOCK_TOPICS = [{
  id: 'for-loop',
  title: 'For loops',
  types: ['python'],
  category: 'Loop',
  summary: 'Repeat code.',
  aliases: ['for loop'],
  related: [],
}]

vi.mock('../../../shared/topicLibrary', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useTopicLibrary: () => ({ topics: MOCK_TOPICS, allTopics: MOCK_TOPICS, loading: false, error: null }) }
})

function ControlledEditor() {
  const [value, setValue] = useState('Use a for loop to repeat the code.')
  return <MarkdownFieldEditor value={value} onChange={setValue} lessonType="python" />
}

describe('MarkdownFieldEditor topic library links', () => {

  it('offers to link a detected topic mention in author text', async () => {
    const user = userEvent.setup()
    render(<ControlledEditor />)

    await user.click(await screen.findByRole('button', { name: 'Link to For loops' }))

    expect(screen.getByRole('textbox')).toHaveValue('Use a [[for-loop|for loop]] to repeat the code.')
  })
})
