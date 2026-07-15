import { describe, it, expect } from 'vitest'
import { getLessonModule, getStudentWorkspace, getBuilderWorkspace, getCheckEditor } from '../registry.js'

describe('getLessonModule', () => {
  it('returns a module for each known lesson type', () => {
    expect(getLessonModule('python')).not.toBeNull()
    expect(getLessonModule('html')).not.toBeNull()
    expect(getLessonModule('scratch')).not.toBeNull()
    expect(getLessonModule('filesystem')).not.toBeNull()
    expect(getLessonModule('electronics')).not.toBeNull()
  })

  it('returns null for an unknown type', () => {
    expect(getLessonModule('unknown')).toBeNull()
    expect(getLessonModule(undefined)).toBeNull()
    expect(getLessonModule('')).toBeNull()
  })

  it('returns the correct type string on each module', () => {
    expect(getLessonModule('python').type).toBe('python')
    expect(getLessonModule('html').type).toBe('html')
    expect(getLessonModule('scratch').type).toBe('scratch')
    expect(getLessonModule('filesystem').type).toBe('filesystem')
    expect(getLessonModule('electronics').type).toBe('electronics')
  })
})

describe('getStudentWorkspace', () => {
  it('returns null for unknown type', () => {
    expect(getStudentWorkspace('unknown')).toBeNull()
  })
})

describe('getBuilderWorkspace', () => {
  it('returns null for unknown type', () => {
    expect(getBuilderWorkspace('unknown')).toBeNull()
  })
})

describe('getCheckEditor', () => {
  it('returns null for unknown type', () => {
    expect(getCheckEditor('unknown')).toBeNull()
  })
})
