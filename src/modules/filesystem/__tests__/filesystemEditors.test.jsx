import { describe, expect, it } from 'vitest'
import {
  fsCheckFromUi,
  fsUiFromCheck,
  getFsAspectOptions,
  getFsOperatorOptions,
  getFsSubjectOptions,
} from '../filesystemEditors.jsx'

describe('filesystem check editor split controls', () => {
  it('splits canonical filesystem checks into subject, field, and condition', () => {
    expect(fsUiFromCheck({ type: 'fs_path', itemType: 'file', operator: 'exists' })).toEqual({
      subject: 'file_path',
      aspect: 'path',
      operator: 'exists',
    })
    expect(fsUiFromCheck({ type: 'fs_file_content', operator: 'matches_regex' })).toEqual({
      subject: 'file',
      aspect: 'content',
      operator: 'matches_regex',
    })
    expect(
      fsUiFromCheck({ type: 'fs_folder_count', itemType: 'dir', operator: 'greater_than_or_equal' })
    ).toEqual({ subject: 'folder', aspect: 'folder_count', operator: 'greater_than_or_equal' })
    expect(fsUiFromCheck({ type: 'fs_opened', itemType: 'dir' })).toEqual({
      subject: 'opened',
      aspect: 'folder',
      operator: 'is_open',
    })
  })

  it('maps legacy filesystem checks into the same split controls', () => {
    expect(fsUiFromCheck({ type: 'fs_file_exists' })).toEqual({
      subject: 'file_path',
      aspect: 'path',
      operator: 'exists',
    })
    expect(fsUiFromCheck({ type: 'fs_dir_exists' })).toEqual({
      subject: 'folder_path',
      aspect: 'path',
      operator: 'exists',
    })
    expect(fsUiFromCheck({ type: 'fs_content_not_matches_regex' })).toEqual({
      subject: 'file',
      aspect: 'content',
      operator: 'not_matches_regex',
    })
    expect(fsUiFromCheck({ type: 'fs_file_count', operator: 'less_than' })).toEqual({
      subject: 'folder',
      aspect: 'file_count',
      operator: 'less_than',
    })
  })

  it('writes canonical checks from split UI choices', () => {
    expect(
      fsCheckFromUi('folder_path', 'path', 'exists', { path: '/Docs/', hint: 'make it' })
    ).toEqual({
      type: 'fs_path',
      operator: 'exists',
      itemType: 'dir',
      path: '/Docs/',
      hint: 'make it',
    })
    expect(
      fsCheckFromUi('file', 'content', 'not_matches_regex', {
        path: '/a.txt',
        value: '^x',
        flags: 'i',
      })
    ).toEqual({
      type: 'fs_file_content',
      operator: 'not_matches_regex',
      path: '/a.txt',
      value: '^x',
      flags: 'i',
    })
    expect(
      fsCheckFromUi('folder', 'file_count', 'greater_than', { path: '/Docs/', value: '2' })
    ).toEqual({
      type: 'fs_folder_count',
      operator: 'greater_than',
      itemType: 'file',
      path: '/Docs/',
      value: '2',
    })
  })

  it('scopes aspects and conditions by subject', () => {
    expect(getFsSubjectOptions().map((o) => o.value)).toEqual([
      'file_path',
      'folder_path',
      'any_path',
      'file',
      'folder',
      'opened',
    ])
    expect(getFsAspectOptions('file').map((o) => o.value)).toEqual([
      'content',
      'line_count',
      'location',
    ])
    expect(getFsOperatorOptions('file', 'location').map((o) => o.value)).toEqual(['in_folder'])
    expect(getFsOperatorOptions('opened', 'file').map((o) => o.value)).toEqual(['is_open'])
  })
})
