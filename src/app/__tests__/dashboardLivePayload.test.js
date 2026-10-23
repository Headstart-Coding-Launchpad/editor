import { describe, expect, it } from 'vitest'
import { buildDashboardLivePayload } from '../dashboardLivePayload'
import { liveBannerTaskLabel } from '../studentLiveDisplay'

describe('buildDashboardLivePayload', () => {
  const pyLesson = { type: 'python', tasks: [{ id: 3, title: 'Say hi', taskType: 'code' }] }

  it('marks the payload as a tutor broadcast published by the dashboard', () => {
    const p = buildDashboardLivePayload({
      lesson: pyLesson,
      taskId: 3,
      work: 'print("hi")',
      layout: 'code',
    })
    expect(p).toMatchObject({
      source: 'teacher',
      publisher: 'dashboard',
      taskId: 3,
      lessonType: 'python',
      layout: 'code',
      code: 'print("hi")',
      files: {},
    })
  })

  it('defaults an unknown layout to both', () => {
    expect(
      buildDashboardLivePayload({ lesson: pyLesson, taskId: 3, work: '', layout: 'x' }).layout
    ).toBe('both')
  })

  it('sends html work as a files map with the task entry file', () => {
    const lesson = {
      type: 'html',
      tasks: [{ id: 1, title: 'Page', taskType: 'code', entryFile: 'page.html' }],
    }
    const p = buildDashboardLivePayload({
      lesson,
      taskId: 1,
      work: [{ name: 'page.html', content: '<p>x</p>' }],
    })
    expect(p.files).toEqual({ 'page.html': '<p>x</p>' })
    expect(p.code).toBe('')
    expect(p.activeFile).toBe('page.html')
    expect(p.lessonType).toBe('html')
  })

  it('serialises structured work through the module wire (scratch)', () => {
    const lesson = { type: 'scratch', tasks: [{ id: 1, taskType: 'code' }] }
    const p = buildDashboardLivePayload({ lesson, taskId: 1, work: null })
    expect(p.lessonType).toBe('scratch')
    expect(p.code).toBe('{}')
  })
})

describe('liveBannerTaskLabel', () => {
  const tasks = [{ id: 'a', title: 'First' }, { id: 'b' }]
  it('numbers the task and adds its title', () => {
    expect(liveBannerTaskLabel(tasks, 'a')).toBe('Task 1: First')
    expect(liveBannerTaskLabel(tasks, 'b')).toBe('Task 2')
    expect(liveBannerTaskLabel(tasks, 'zzz')).toBe('')
  })
})
