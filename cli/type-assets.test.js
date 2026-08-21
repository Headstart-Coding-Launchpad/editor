import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ records: new Map(), files: new Map() }))

vi.mock('./firebase.mjs', () => ({
  db: {
    collection: name => ({
      doc: id => ({
        get: async () => {
          const data = state.records.get(`${name}/${id}`)
          return { exists: data != null, id, data: () => data }
        },
        set: async (value, opts) => {
          const key = `${name}/${id}`
          const current = state.records.get(key) ?? {}
          state.records.set(key, opts?.merge ? { ...current, ...value } : value)
        },
      }),
    }),
  },
  storage: {
    bucket: () => ({
      name: 'test-bucket',
      getFiles: async ({ prefix }) => [
        [...state.files.keys()]
          .filter(path => path.startsWith(prefix))
          .map(path => ({
            name: path,
            getMetadata: async () => [{ metadata: state.files.get(path).metadata }],
          })),
      ],
      file: path => ({
        save: async (buffer, opts) => {
          state.files.set(path, { buffer, metadata: opts?.metadata?.metadata ?? {} })
        },
      }),
    }),
  },
}))

import { listTypeAssets, uploadTypeAsset, setDefaultSprites, uploadDefaultBackdrop } from './type-assets.mjs'

describe('CLI lesson-type shared assets', () => {
  beforeEach(() => {
    state.records.clear()
    state.files.clear()
  })

  it('rejects a non-slug type', async () => {
    await expect(listTypeAssets('Not Valid')).rejects.toThrow(/lowercase slug/)
  })

  it('uploads a shared file for a lesson type and lists it back', async () => {
    const result = await uploadTypeAsset('scratch', 'cat.png', Buffer.from('hi').toString('base64'), 'image/png')
    expect(result).toMatchObject({ success: true, type: 'scratch', filename: 'cat.png' })

    const listed = await listTypeAssets('scratch')
    expect(listed.storageAssets).toEqual([
      expect.objectContaining({ name: 'cat.png', showInEditor: false }),
    ])
  })

  it('sets the default sprite list for scratch and rejects other lesson types', async () => {
    const sprites = [{ id: 'sprite1', name: 'Cat', type: 'cat' }]
    const result = await setDefaultSprites('scratch', sprites)
    expect(result).toMatchObject({ success: true, count: 1 })
    expect((await listTypeAssets('scratch')).defaultSprites).toEqual(sprites)

    await expect(setDefaultSprites('python', sprites)).rejects.toThrow(/only supported for the 'scratch'/)
  })

  it('accepts a { sprites: [...] } wrapper and drops invalid entries', async () => {
    const result = await setDefaultSprites('scratch', { sprites: [{ id: 'sprite1', name: 'Cat' }, { id: 'bad' }] })
    expect(result.count).toBe(1)
  })

  it('uploads an image and adds it as a default backdrop in one step', async () => {
    const result = await uploadDefaultBackdrop('scratch', 'sky.png', Buffer.from('hi').toString('base64'), 'image/png', { name: 'Sky' })
    expect(result.success).toBe(true)
    expect(result.backdrop).toMatchObject({ id: 'backdrop1', name: 'Sky', colour: '#ffffff' })
    expect(result.backdrop.image).toContain('sky.png')

    const listed = await listTypeAssets('scratch')
    expect(listed.defaultBackdrops).toHaveLength(1)
    expect(listed.storageAssets).toEqual([expect.objectContaining({ name: 'sky.png' })])
  })

  it('rejects default backdrops for a non-scratch lesson type', async () => {
    await expect(
      uploadDefaultBackdrop('python', 'sky.png', Buffer.from('hi').toString('base64'), 'image/png')
    ).rejects.toThrow(/only supported for the 'scratch'/)
  })

  it('rejects a duplicate explicit backdrop id', async () => {
    await uploadDefaultBackdrop('scratch', 'a.png', Buffer.from('a').toString('base64'), 'image/png', { id: 'bg1' })
    await expect(
      uploadDefaultBackdrop('scratch', 'b.png', Buffer.from('b').toString('base64'), 'image/png', { id: 'bg1' })
    ).rejects.toThrow(/already exists/)
  })
})
