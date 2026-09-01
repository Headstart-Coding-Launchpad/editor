import React, { useEffect, useRef, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { useAssets } from '../../shared/useAssets'
import { useLessonStorageAssets } from '../../shared/useLessonStorageAssets'
import { useTypeAssets } from '../../shared/useTypeAssets'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { useAuth } from '../../auth/useAuth'
import { firestore } from '../../shared/firebase'
import { getLessonLevelRef, getLessonLevelScope, levelTitleFromLesson, LEVEL_COLLECTION, normalizeLevelRecord } from '../../shared/lessonLevels'
import { getLessonModules } from '../../shared/composedLesson'
import LessonTopicSummary from './LessonTopicSummary'
import AssetSummary from './lesson-meta/AssetSummary'
import Field from './lesson-meta/Field'
import SandboxStarterModal, { getSandboxStarterSummary } from './lesson-meta/SandboxStarterModal'
import SharedAssetsSelector from './lesson-meta/SharedAssetsSelector'
import StorageAssetUploader from './lesson-meta/StorageAssetUploader'
import { s } from './lesson-meta/styles'

export default function LessonMetaPanel({ lesson, onUpdate, onCollapse, topicState }) {
  const [sandboxOpen, setSandboxOpen] = useState(false)
  const { lessonAssets, loading: assetsLoading } = useAssets()
  const {
    storageAssets: lessonStorageAssets,
    refresh: refreshLessonStorageAssets,
  } = useLessonStorageAssets(lesson.id, lesson.storageAssets ?? [])
  const { typeStorageAssets } = useTypeAssets(['html', 'arcade'].includes(lesson.type) ? lesson.type : null)
  const lastAutoKeyRef = useRef('')
  const { role } = useAuth()
  const [levels, setLevels] = useState([])

  function set(field, value) {
    onUpdate(prev => ({ ...prev, [field]: value }))
  }

  function setModuleSandboxField(moduleId, field, value) {
    onUpdate(prev => {
      const resolvedModule = getLessonModules(prev).find(module => module.id === moduleId)
      const baseModules = Array.isArray(prev.modules) ? prev.modules : []
      const nextModules = baseModules.some(module => module.id === moduleId)
        ? baseModules.map(module => module.id === moduleId
          ? { ...module, sandbox: { ...(module.sandbox ?? {}), [field]: value } }
          : module)
        : [...baseModules, { id: moduleId, type: resolvedModule?.type, title: resolvedModule?.title, sandbox: { [field]: value } }]
      return { ...prev, modules: nextModules }
    })
  }

  function setLevel(levelId) {
    const level = levels.find(item => item.id === levelId)
    if (!level) {
      onUpdate(prev => ({ ...prev, levelId: undefined, levelRef: undefined, level: undefined }))
      return
    }
    onUpdate(prev => ({
      ...prev,
      levelId: level.id,
      levelRef: { id: level.id, scopeType: level.scopeType, scopeId: level.scopeId },
      level: level.title,
    }))
  }

  // Keep assetsPath in sync with lesson ID for relative costume/backdrop resolution
  useEffect(() => {
    if (!lesson.id) return
    const newPath = `/assets/${lesson.id}/`
    if (lesson.assetsPath !== newPath) {
      onUpdate(prev => ({ ...prev, assetsPath: newPath }))
    }
  }, [lesson.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-populate assets list when manifest loads or ID/type changes
  useEffect(() => {
    if (assetsLoading || !lesson.id) return
    const key = `${lesson.id}__${lesson.type}`
    if (key === lastAutoKeyRef.current) return
    lastAutoKeyRef.current = key
    const merged = lessonAssets(lesson.id, lesson.type)
    if (merged.length > 0) {
      onUpdate(prev => ({ ...prev, assets: merged }))
    }
  }, [lesson.id, lesson.type, assetsLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return onSnapshot(collection(firestore, LEVEL_COLLECTION), snap => {
      setLevels(snap.docs.map(d => normalizeLevelRecord({ id: d.id, ...d.data() })))
    }, () => setLevels([]))
  }, [])

  const lessonTypeLabel = getLessonTypeLabel(lesson.type)
  const scope = getLessonLevelScope(lesson)
  const availableLevels = levels
    .filter(level => level.scopeType === scope.scopeType && level.scopeId === scope.scopeId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const levelRef = getLessonLevelRef(lesson)
  const legacyLevel = levelTitleFromLesson(lesson, levels)

  return (
    <div style={s.panel}>
      <div style={s.header}>
        <span>Lesson Details</span>
        {onCollapse && (
          <button type="button" style={s.collapseBtn} onClick={onCollapse} title="Collapse panel">
            &lsaquo;
          </button>
        )}
      </div>
      <div style={s.fields}>
        <Field label="Lesson type">
          <div style={s.typeBadge}>{lessonTypeLabel}</div>
        </Field>

        <Field label="Lesson ID" hint="e.g. python-intro">
          <input
            style={s.input}
            value={lesson.id}
            onChange={e => set('id', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="python-intro"
          />
        </Field>

        <Field label="Lesson title">
          <input
            style={s.input}
            value={lesson.title}
            onChange={e => set('title', e.target.value)}
            placeholder="Introduction to Python"
          />
        </Field>

        <Field label="Draft workflow" hint="Draft lessons may have incomplete real tasks and cannot be published until this is cleared.">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontWeight: 600, color: lesson.draft ? '#92400e' : 'var(--colour-text)' }}>
            <input type="checkbox" checked={lesson.draft === true} onChange={e => set('draft', e.target.checked)} />
            Draft {lesson.draft ? '— incomplete authoring allowed' : '— ready for full validation'}
          </label>
          <span style={s.summaryText}>Current version: {lesson.version ?? 0}</span>
        </Field>

        <Field label="Solo-only lesson" hint="When on, every link to this lesson goes straight to solo mode — no live/wait option is ever offered, regardless of the URL.">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontWeight: 600, color: 'var(--colour-text)' }}>
            <input type="checkbox" checked={lesson.soloOnly === true} onChange={e => set('soloOnly', e.target.checked)} />
            Solo-only {lesson.soloOnly ? '— live/wait option hidden' : '— live and solo both available'}
          </label>
        </Field>

        {lesson.fork?.sourceLessonId && (
          <Field label="Class fork">
            <div style={s.summaryText}>
              {lesson.fork.sourceLessonTitle || lesson.fork.sourceLessonId} / {lesson.fork.className || lesson.fork.classId}
            </div>
          </Field>
        )}

        <Field label="Level" hint={`Scoped to ${scope.scopeType}: ${scope.scopeId}. Create levels in Admin > Levels.`}>
          <select
            style={s.input}
            value={levelRef?.id ?? ''}
            onChange={e => setLevel(e.target.value)}
          >
            <option value="">No level</option>
            {availableLevels.map(level => (
              <option key={level.id} value={level.id}>{level.title}</option>
            ))}
          </select>
          {legacyLevel && !levelRef?.id && (
            <span style={s.summaryText}>Legacy value: {legacyLevel}</span>
          )}
        </Field>

        <Field label="Description">
          <textarea
            style={{ ...s.input, resize: 'vertical', minHeight: 60 }}
            value={lesson.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Short summary shown on entry screen."
          />
        </Field>

        <LessonTopicSummary
          lesson={lesson}
          topics={topicState?.topics ?? []}
          loading={topicState?.loading ?? false}
          error={topicState?.error ?? null}
          onUpdate={onUpdate}
        />

        <AssetSummary
          assets={lesson.assets}
          assetsPath={resolveAssetsPath(lesson.assetsPath)}
          storageAssets={lessonStorageAssets}
        />

        {role === 'admin' && (
          <StorageAssetUploader
            lessonId={lesson.id}
            storageAssets={lessonStorageAssets}
            onUpdate={updater => onUpdate(prev => ({ ...prev, storageAssets: typeof updater === 'function' ? updater(prev.storageAssets ?? []) : updater }))}
            onRefresh={refreshLessonStorageAssets}
          />
        )}

        {['html', 'arcade'].includes(lesson.type) && typeStorageAssets.length > 0 && (
          <SharedAssetsSelector
            typeStorageAssets={typeStorageAssets}
            sharedAssetNames={lesson.sharedAssetNames ?? null}
            onChange={names => onUpdate(prev => ({ ...prev, sharedAssetNames: names }))}
          />
        )}

        <div style={s.divider} />

        <div style={s.sandboxSummary}>
          <div>
            <span style={s.fieldLabel}>Sandbox starter</span>
            <p style={s.summaryText}>{getSandboxStarterSummary(lesson)}</p>
          </div>
          <button className="btn-ghost" style={s.secondaryBtn} onClick={() => setSandboxOpen(true)}>
            Edit
          </button>
        </div>

        {sandboxOpen && (
          <SandboxStarterModal
            lesson={lesson}
            onSetField={set}
            onSetModuleSandboxField={setModuleSandboxField}
            onClose={() => setSandboxOpen(false)}
          />
        )}
      </div>
    </div>
  )
}

function getLessonTypeLabel(type) {
  if (type === 'python') return 'Python'
  if (type === 'arcade') return 'Arcade Kit'
  if (type === 'scratch') return 'Scratch'
  if (type === 'filesystem') return 'Files & Folders'
  if (type === 'electronics') return 'Electronics'
  return 'Web'
}
