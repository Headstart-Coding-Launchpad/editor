import React, { useEffect, useRef, useState } from 'react'
import SplitPane from '../../../shared/SplitPane'
import { CodeEditor } from '../../../shared/CodeEditor'
import FileManager from '../FileManager'
import ScratchWorkspace from '../../../modules/scratch/ScratchWorkspace'
import { ScratchToolboxPicker, SpriteManager, BackdropManager } from '../TaskEditor'
import { DEFAULT_SPRITES } from '../../../modules/scratch/checks'
import { resolveAssetsPath } from '../../../shared/assetPaths'
import { FsTreeEditor } from '../../../modules/filesystem/filesystemEditors'
import ElectronicsWorkspace from '../../../modules/electronics/ElectronicsWorkspace'
import { DEFAULT_CIRCUIT, parseCircuit, serializeCircuit } from '../../../modules/electronics/circuit'
import { getEffectiveLessonForModule, getLessonModules, isComposedLesson } from '../../../shared/composedLesson'
import Modal from './Modal'
import { s } from './styles'

function isPythonLikeType(type) {
  return type === 'python' || type === 'arcade'
}

function getSandboxStarterSummaryForType(lesson) {
  const sandboxLineCount = (lesson.sandboxStarter ?? '').trim()
    ? (lesson.sandboxStarter ?? '').split('\n').length
    : 0
  const sandboxFileCount = lesson.sandboxStarterFiles?.length ?? 0
  const sandboxFsCount = lesson.sandboxStarterFs ? Object.keys(lesson.sandboxStarterFs).length - 1 : 0

  if (isPythonLikeType(lesson.type)) {
    return sandboxLineCount ? `${sandboxLineCount} lines configured` : 'No sandbox starter code set.'
  }
  if (lesson.type === 'scratch') {
    return lesson.sandboxStarter ? 'Scratch sandbox starter configured.' : 'No Scratch sandbox starter set.'
  }
  if (lesson.type === 'filesystem') {
    return sandboxFsCount ? `${sandboxFsCount} items configured` : 'No sandbox filesystem set.'
  }
  if (lesson.type === 'electronics') {
    return lesson.sandboxStarterCircuit ? 'Sandbox breadboard configured.' : 'No sandbox breadboard set.'
  }
  return sandboxFileCount ? `${sandboxFileCount} starter files configured` : 'No sandbox starter files set.'
}

export function getSandboxStarterSummary(lesson) {
  if (!isComposedLesson(lesson)) return getSandboxStarterSummaryForType(lesson)

  const modules = getLessonModules(lesson)
  if (modules.length === 0) return 'Add a code task to configure a sandbox.'
  if (modules.length === 1) {
    return getSandboxStarterSummaryForType(getEffectiveLessonForModule(lesson, modules[0].id))
  }
  return modules
    .map(module => `${module.title}: ${getSandboxStarterSummaryForType(getEffectiveLessonForModule(lesson, module.id))}`)
    .join(' ')
}

export default function SandboxStarterModal({ lesson, onSetField, onSetModuleSandboxField, onClose }) {
  if (isComposedLesson(lesson)) {
    return (
      <ComposedSandboxStarterModal
        lesson={lesson}
        onSetModuleSandboxField={onSetModuleSandboxField}
        onClose={onClose}
      />
    )
  }

  return (
    <Modal title="Sandbox starter" onClose={onClose}>
      <SandboxStarterEditor lesson={lesson} onSetField={onSetField} />
    </Modal>
  )
}

function ComposedSandboxStarterModal({ lesson, onSetModuleSandboxField, onClose }) {
  const modules = getLessonModules(lesson)
  const [selectedModuleId, setSelectedModuleId] = useState(modules[0]?.id ?? null)

  if (modules.length === 0) {
    return (
      <Modal title="Sandbox starter" onClose={onClose}>
        <p style={s.summaryText}>Add a code task to this lesson to create a module before configuring its sandbox.</p>
      </Modal>
    )
  }

  const activeModuleId = modules.some(module => module.id === selectedModuleId) ? selectedModuleId : modules[0].id
  const effectiveLesson = getEffectiveLessonForModule(lesson, activeModuleId)

  return (
    <Modal title="Sandbox starter" onClose={onClose}>
      {modules.length > 1 && (
        <div style={s.workspaceTabs} className="ui-tabs" role="tablist" aria-label="Sandbox module">
          {modules.map(module => (
            <button
              key={module.id}
              type="button"
              className={`ui-tab${module.id === activeModuleId ? ' is-active' : ''}`}
              role="tab"
              aria-selected={module.id === activeModuleId}
              onClick={() => setSelectedModuleId(module.id)}
            >
              {module.title}
            </button>
          ))}
        </div>
      )}
      <SandboxStarterEditor
        lesson={effectiveLesson}
        onSetField={(field, value) => onSetModuleSandboxField(activeModuleId, field, value)}
      />
    </Modal>
  )
}

function SandboxStarterEditor({ lesson, onSetField }) {
  const isPython = isPythonLikeType(lesson.type)
  const isScratch = lesson.type === 'scratch'
  const isFilesystem = lesson.type === 'filesystem'
  const isElectronics = lesson.type === 'electronics'

  return (
    <>
      {isPython ? (
        <div style={s.modalEditor}>
          <CodeEditor
            value={lesson.sandboxStarter ?? ''}
            language="python"
            onChange={v => onSetField('sandboxStarter', v || undefined)}
            style={s.modalCodeEditor}
          />
        </div>
      ) : isScratch ? (
        <ScratchSandboxStarter
          value={lesson.sandboxStarter}
          toolbox={lesson.sandboxToolbox ?? ''}
          sprites={lesson.sandboxSprites?.length > 0 ? lesson.sandboxSprites : DEFAULT_SPRITES}
          backdrops={lesson.sandboxBackdrops?.length > 0 ? lesson.sandboxBackdrops : [{ id: 'backdrop1', name: 'Backdrop 1', colour: '#ffffff' }]}
          assetsPath={lesson.assetsPath ?? ''}
          storageAssets={lesson.storageAssets ?? []}
          lessonId={lesson.id}
          lessonType={lesson.type}
          onChange={state => onSetField('sandboxStarter', state ? JSON.stringify(state) : undefined)}
          onToolboxChange={v => onSetField('sandboxToolbox', v || undefined)}
          onSpritesChange={sprites => onSetField('sandboxSprites', sprites)}
          onBackdropsChange={backdrops => onSetField('sandboxBackdrops', backdrops)}
        />
      ) : isFilesystem ? (
        <div style={{ padding: '12px 0' }}>
          <FsTreeEditor
            label="Sandbox starting filesystem"
            fs={lesson.sandboxStarterFs ?? { '/': { type: 'dir' } }}
            onFsChange={newFs => onSetField('sandboxStarterFs', newFs)}
            storageAssets={lesson.storageAssets ?? []}
          />
        </div>
      ) : isElectronics ? (
        <div style={s.modalEditor}>
          <ElectronicsWorkspace
            circuit={parseCircuit(lesson.sandboxStarterCircuit, DEFAULT_CIRCUIT)}
            onChange={circuit => onSetField('sandboxStarterCircuit', JSON.parse(serializeCircuit(circuit)))}
            setupMode
            title="Sandbox breadboard"
          />
        </div>
      ) : (
        <SandboxStarterFiles
          files={lesson.sandboxStarterFiles ?? []}
          onChange={files => onSetField('sandboxStarterFiles', files.length ? files : undefined)}
        />
      )}
    </>
  )
}

function parseScratchStarter(value) {
  if (!value) return null
  try {
    return typeof value === 'string' ? JSON.parse(value) : value
  } catch {
    return null
  }
}

function cloneScratchStarter(value) {
  if (!value) return null
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

function ScratchSandboxStarter({ value, toolbox, sprites, backdrops, assetsPath, storageAssets, lessonId, lessonType, onChange, onToolboxChange, onSpritesChange, onBackdropsChange }) {
  const [activeTab, setActiveTab] = useState('starter')
  const [testBlocks, setTestBlocks] = useState(() => cloneScratchStarter(parseScratchStarter(value)))
  const [syncNowKey, setSyncNowKey] = useState(0)
  const starterBlocksRef = useRef(parseScratchStarter(value))
  const tabChangeFrameRef = useRef(null)

  useEffect(() => () => {
    if (tabChangeFrameRef.current != null) cancelAnimationFrame(tabChangeFrameRef.current)
  }, [])

  function handleTabChange(tab) {
    if (tab === activeTab) return
    if (tab === 'test') {
      setSyncNowKey(key => key + 1)
      tabChangeFrameRef.current = requestAnimationFrame(() => {
        tabChangeFrameRef.current = null
        const snapshot = starterBlocksRef.current ?? parseScratchStarter(value)
        setTestBlocks(cloneScratchStarter(snapshot))
        setActiveTab('test')
      })
      return
    }
    setActiveTab('starter')
  }

  const resolvedAssets = assetsPath ? resolveAssetsPath(assetsPath) : ''
  const spriteIds = (sprites ?? []).map(sp => sp.id).join(',')

  return (
    <div style={s.scratchSandboxShell}>
      <div style={s.workspaceTabs} className="ui-tabs" role="tablist" aria-label="Sandbox starter workspace">
        <button
          type="button"
          className={`ui-tab${activeTab === 'starter' ? ' is-active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'starter'}
          onClick={() => handleTabChange('starter')}
        >
          Starter Blocks
        </button>
        <button
          type="button"
          className={`ui-tab${activeTab === 'test' ? ' is-active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'test'}
          onClick={() => handleTabChange('test')}
        >
          Test Code
        </button>
      </div>

      <div style={s.scratchSandboxEditor}>
        {activeTab === 'starter' && (
          <div style={s.scratchConfigSidebar}>
            <div style={s.sidebarSection}>
              <span style={s.sidebarSectionTitle}>Toolbox blocks</span>
              <ScratchToolboxPicker toolbox={toolbox} onChange={onToolboxChange} />
            </div>
            <div style={s.sidebarSection}>
              <span style={s.sidebarSectionTitle}>Sprites</span>
              <SpriteManager
                sprites={sprites}
                onChange={onSpritesChange}
                assetsPath={resolvedAssets}
                storageAssets={storageAssets}
                lessonId={lessonId}
                lessonType={lessonType}
              />
            </div>
            <div style={s.sidebarSection}>
              <span style={s.sidebarSectionTitle}>Backdrops</span>
              <BackdropManager
                backdrops={backdrops}
                onChange={onBackdropsChange}
                assetsPath={resolvedAssets}
                storageAssets={storageAssets}
                lessonId={lessonId}
                lessonType={lessonType}
              />
            </div>
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex' }}>
          {activeTab === 'starter' ? (
            <ScratchWorkspace
              key={`scratch-sandbox-starter-${spriteIds}`}
              task={{ toolbox, check: null, sprites, backdrops }}
              hideStage
              assetsPath={resolvedAssets}
              initialState={parseScratchStarter(value)}
              onStateChange={state => {
                starterBlocksRef.current = state
                onChange(state)
              }}
              syncNowKey={syncNowKey}
            />
          ) : (
            <ScratchWorkspace
              key={`scratch-sandbox-test-${spriteIds}`}
              task={{ toolbox, check: null, sprites, backdrops }}
              assetsPath={resolvedAssets}
              initialState={testBlocks}
              onStateChange={setTestBlocks}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function SandboxStarterFiles({ files, onChange }) {
  const [selectedFile, setSelectedFile] = useState(files[0]?.name ?? '')

  return (
    <SplitPane
      defaultSplit={34}
      style={{ flex: 1, minHeight: 0 }}
      left={
        <FileManager
          files={files}
          entryFile={files.find(f => f.type === 'html')?.name ?? files[0]?.name ?? ''}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
          onAddFile={f => { onChange([...files, f]); setSelectedFile(f.name) }}
          onSetFiles={(newFiles, newEntry) => { onChange(newFiles); setSelectedFile(newFiles[0]?.name ?? '') }}
          onDeleteFile={name => {
            const next = files.filter(f => f.name !== name)
            onChange(next)
            setSelectedFile(next[0]?.name ?? '')
          }}
          onChangeType={(name, type) => onChange(files.map(f => f.name === name ? { ...f, type } : f))}
          onChangeEntryFile={() => {}}
        />
      }
      right={
        <div style={s.modalEditor}>
          {selectedFile ? (
            <CodeEditor
              key={selectedFile}
              value={files.find(f => f.name === selectedFile)?.content ?? ''}
              language={files.find(f => f.name === selectedFile)?.type ?? 'html'}
              onChange={v => onChange(files.map(f => f.name === selectedFile ? { ...f, content: v } : f))}
              style={s.htmlCodeEditor}
            />
          ) : (
            <div style={s.noFile}>Select or add a file to edit.</div>
          )}
        </div>
      }
    />
  )
}
