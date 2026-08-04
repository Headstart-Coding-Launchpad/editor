import { describe, it, expect } from 'vitest'
import { getLessonModule, getLessonModules, getStudentWorkspace, getBuilderWorkspace, getCheckEditor } from '../registry.js'

describe('getLessonModule', () => {
  it('returns a module for each known lesson type', () => {
    expect(getLessonModule('python')).not.toBeNull()
    expect(getLessonModule('arcade')).not.toBeNull()
    expect(getLessonModule('html')).not.toBeNull()
    expect(getLessonModule('scratch')).not.toBeNull()
    expect(getLessonModule('filesystem')).not.toBeNull()
    expect(getLessonModule('electronics')).not.toBeNull()
    expect(getLessonModule('desktop')).not.toBeNull()
  })

  it('returns null for an unknown type', () => {
    expect(getLessonModule('unknown')).toBeNull()
    expect(getLessonModule(undefined)).toBeNull()
    expect(getLessonModule('')).toBeNull()
  })

  it('returns the correct type string on each module', () => {
    expect(getLessonModule('python').type).toBe('python')
    expect(getLessonModule('arcade').type).toBe('arcade')
    expect(getLessonModule('html').type).toBe('html')
    expect(getLessonModule('scratch').type).toBe('scratch')
    expect(getLessonModule('filesystem').type).toBe('filesystem')
    expect(getLessonModule('electronics').type).toBe('electronics')
    expect(getLessonModule('desktop').type).toBe('desktop')
  })

  it('exposes ordered module labels for admin and authoring UI', () => {
    expect(getLessonModules().map(module => [module.type, module.label])).toEqual([
      ['python', 'Python'],
      ['arcade', 'Arcade Kit'],
      ['scratch', 'Scratch'],
      ['html', 'HTML'],
      ['filesystem', 'Filesystem'],
      ['desktop', 'Desktop'],
      ['electronics', 'Electronics'],
    ])
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
