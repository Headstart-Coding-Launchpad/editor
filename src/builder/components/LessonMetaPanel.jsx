import React, { useEffect, useRef, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { useAssets } from '../../shared/useAssets'
import { useLessonStorageAssets } from '../../shared/useLessonStorageAssets'
import { useTypeAssets } from '../../shared/useTypeAssets'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { useAuth } from '../../auth/useAuth'
import { firestore } from '../../shared/firebase'
import { getLessonLevelRef, getLessonLevelScope, levelTitleFromLesson, LEVEL_COLLECTION, normalizeLevelRecord } from '../../shared/lessonLevels'
import LessonTopicSummary from './LessonTopicSummary'
import AssetSummary from './lesson-meta/AssetSummary'
import Field from './lesson-meta/Field'
import SandboxStarterModal, { getSandboxStarterSummary } from './lesson-meta/SandboxStarterModal'
import SharedAssetsSelector from './lesson-meta/SharedAssetsSelector'
import StorageAssetUploader from './lesson-meta/StorageAssetUploader'
import { s } from './lesson-meta/styles'

const STAGE_LABELS = { ideas: 'Ideas', details: 'Details', review: 'Review', approved: 'Approved', published: 'Published' }
const STAGE_COLORS = { ideas: '#6b7280', details: '#2563eb', review: '#d97706', approved: '#16a34a', published: '#7c3aed' }
const STAGE_ORDER = ['ideas', 'details', 'review', 'approved', 'published']

export default function LessonMetaPanel({ lesson, onUpdate, onCollapse, onSetStage, topicState }) {
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

        <Field label="Stage">
          <div style={s.stageGrid}>
            {STAGE_ORDER.map(value => {
              const active = (lesson.stage ?? 'published') === value
              return (
                <button
                  key={value}
                  type="button"
                  style={{
                    ...s.stageBtn,
                    background: active ? STAGE_COLORS[value] : '#f9fafb',
                    color: active ? '#fff' : '#4b5563',
                    borderColor: active ? STAGE_COLORS[value] : '#d1d5db',
                    fontWeight: active ? 700 : 500,
                  }}
                  onClick={() => onSetStage?.(value)}
                >
                  {STAGE_LABELS[value]}
                </button>
              )
            })}
          </div>
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
