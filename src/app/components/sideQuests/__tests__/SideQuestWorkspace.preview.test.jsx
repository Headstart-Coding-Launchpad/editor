// A side-quest runs in a throwaway useStudentCodeState with previewMode, whose mount normally
// clears the shared in-memory store. In lesson preview (and teacher presentation) that store
// holds the previewer's task code, so opening a side-quest wiped what carryCodeFrom reads and
// the next task fell back to its starter. The side-quest must keep the store.
import React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SideQuestWorkspace from '../SideQuestWorkspace'
import { ephemeralStorage, clearEphemeralStorage } from '../../../studentStorage'

vi.mock('../../LessonTaskContent', () => ({ default: () => <div /> }))

const csSpy = vi.fn()
vi.mock('../../../hooks/useStudentCodeState', () => ({
  useStudentCodeState: (args) => {
    csSpy(args)
    return { work: null }
  },
}))

describe('SideQuestWorkspace in preview', () => {
  it('keeps the in-memory task saves (carryCodeFrom) when it mounts', () => {
    clearEphemeralStorage()
    ephemeralStorage.saveCode('lesson-1', 1, 'me', { code: 'print("mine")' })
    const lesson = { type: 'python', tasks: [{ id: 1, title: 'A' }] }
    render(
      <SideQuestWorkspace
        lesson={lesson}
        lessonId="lesson-1"
        task={lesson.tasks[0]}
        quest={{ index: 0, kind: 'extend', title: 'Q' }}
        questCount={1}
        moduleType="python"
        anonymousId="me"
        persist={false}
        onClose={() => {}}
      />
    )
    expect(csSpy.mock.calls[0][0]).toMatchObject({ previewMode: true, keepSeededWork: true })
  })
})
