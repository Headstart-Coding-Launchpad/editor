import { useState, useRef } from 'react'
import ScratchWorkspace from '../../../app/components/ScratchWorkspace'
import { DEFAULT_SPRITES } from '../../../shared/scratch'
import { resolveAssetsPath } from '../../../shared/assetPaths'
import { copyScratchSpriteStateToStarters } from '../../lessonUtils'
import { CodeWorkspaceTabs, Modal, SpriteManager, BackdropManager } from './TaskEditorFields'
import { ScratchToolboxPicker, VariableManager, PredefinedBlocksEditor } from './ScratchEditors'

export default function ScratchTaskSetup({ task, lesson, onUpdate, checkResult, setCheckResult }) {
  const [testScratchBlocks, setTestScratchBlocks] = useState(null)
  const [starterBlocksOpen, setStarterBlocksOpen] = useState(false)
  const [starterBlocksSyncKey, setStarterBlocksSyncKey] = useState(0)
  const [scratchModalTab, setScratchModalTab] = useState('starter')
  const [modalSelectedSpriteId, setModalSelectedSpriteId] = useState(null)
  const [modalSpritePanelTarget, setModalSpritePanelTarget] = useState(null)
  const [sidebarSections, setSidebarSections] = useState({ toolbox: true, sprites: true, backdrops: true, variables: false })
  const [modalStarterBlocks, setModalStarterBlocks] = useState(null)
  const modalStarterBlocksRef = useRef(null)
  const modalCompleteBlocksRef = useRef(null)
  const modalCompleteSpriteStatesRef = useRef(null)
  const modalStageSpriteStatesRef = useRef({})

  const codeStages = task.codeStages ?? []

  function set(field, value) {
    onUpdate({ ...task, [field]: value })
  }

  function updateStage(idx, updates) {
    const existing = task.codeStages ?? []
    const updated = existing.map((s, i) => i === idx ? { ...s, ...updates } : s)
    onUpdate({ ...task, codeStages: updated })
  }

  function cloneBlocks(blocks) {
    if (!blocks) return null
    if (typeof structuredClone === 'function') return structuredClone(blocks)
    return JSON.parse(JSON.stringify(blocks))
  }

  function getScratchSprites() {
    return task.sprites?.length > 0 ? task.sprites : DEFAULT_SPRITES
  }

  function handleStarterSpritesChange(newSprites) {
    const previousSprites = getScratchSprites()
    set('sprites', newSprites)
    const previousIds = new Set(previousSprites.map(sp => sp.id))
    const added = newSprites.find(sp => !previousIds.has(sp.id))
    if (added) {
      setModalSelectedSpriteId(added.id)
    } else if (!newSprites.find(sp => sp.id === modalSelectedSpriteId)) {
      setModalSelectedSpriteId(newSprites[0]?.id ?? null)
    }
  }

  function handleAddStarterSprite() {
    const sprites = getScratchSprites()
    let next = sprites.length + 1
    while (sprites.some(sp => sp.id === `sprite${next}`)) next += 1
    handleStarterSpritesChange([
      ...sprites,
      { id: `sprite${next}`, name: `Sprite ${next}`, type: 'cat', x: 0, y: 0, size: 100, direction: 90 },
    ])
  }

  function handleOpenStarterBlocks() {
    const blocks = cloneBlocks(task.starterBlocks)
    modalStarterBlocksRef.current = blocks
    modalCompleteBlocksRef.current = cloneBlocks(task.completeBlocks)
    modalCompleteSpriteStatesRef.current = null
    modalStageSpriteStatesRef.current = {}
    setModalStarterBlocks(blocks)
    setTestScratchBlocks(cloneBlocks(blocks))
    setScratchModalTab('starter')
    setStarterBlocksOpen(true)
    setCheckResult(null)
    const activeSprites = task.sprites?.length > 0 ? task.sprites : DEFAULT_SPRITES
    setModalSelectedSpriteId(activeSprites[0]?.id ?? null)
  }

  function handleCloseStarterBlocks() {
    setStarterBlocksSyncKey(key => key + 1)
    requestAnimationFrame(() => setStarterBlocksOpen(false))
  }

  function toggleSidebarSection(name) {
    setSidebarSections(prev => ({ ...prev, [name]: !prev[name] }))
  }

  function handleScratchModalTabChange(tab) {
    if (tab === scratchModalTab) return
    setCheckResult(null)

    if (tab === 'complete') {
      setStarterBlocksSyncKey(key => key + 1)
      requestAnimationFrame(() => {
        const starterSnapshot = modalStarterBlocksRef.current ?? modalStarterBlocks ?? task.starterBlocks
        const initBlocks = task.completeBlocks != null
          ? cloneBlocks(task.completeBlocks)
          : cloneBlocks(starterSnapshot)
        if (task.completeBlocks == null) {
          set('completeBlocks', initBlocks)
        }
        modalCompleteBlocksRef.current = initBlocks
        setTestScratchBlocks(initBlocks)
        setScratchModalTab('complete')
      })
      return
    }

    setScratchModalTab(tab)
  }

  function handleAddScratchStage() {
    const existing = task.codeStages ?? []
    const srcBlocks = existing.length > 0
      ? cloneBlocks(existing[existing.length - 1].blocks)
      : cloneBlocks(modalStarterBlocksRef.current ?? task.starterBlocks)
    const newStage = { label: `Stage ${existing.length + 1}`, blocks: srcBlocks }
    const updated = [...existing, newStage]
    onUpdate({ ...task, codeStages: updated })
    setScratchModalTab(`stage_${updated.length - 1}`)
  }

  function handleCopySpriteInfoToStarter() {
    const stageMatch = scratchModalTab.match(/^stage_(\d+)$/)
    const stageIndex = stageMatch ? parseInt(stageMatch[1], 10) : null
    const spriteStates = scratchModalTab === 'complete'
      ? modalCompleteSpriteStatesRef.current
      : modalStageSpriteStatesRef.current[stageIndex]
    const sprites = task.sprites?.length > 0 ? task.sprites : DEFAULT_SPRITES
    set('sprites', copyScratchSpriteStateToStarters(sprites, spriteStates))
  }

  function handleRemoveScratchStage(idx) {
    const existing = task.codeStages ?? []
    const updated = existing.filter((_, i) => i !== idx)
    onUpdate({ ...task, codeStages: updated.length > 0 ? updated : undefined })
    setScratchModalTab('starter')
  }

  return (
    <>
      <div className="te-starter-blocks-summary">
        <div>
          <span className="te-preview-title">Scratch Task Setup</span>
          <p className="te-summary-text">
            {task.starterBlocks && Object.values(task.starterBlocks).some(Boolean)
              ? 'Starter blocks configured for this task.'
              : 'No starter blocks set. Students will start with an empty workspace.'}
          </p>
        </div>
        <button className="btn-ghost te-secondary-btn" onClick={handleOpenStarterBlocks}>
          Edit
        </button>
      </div>

      {starterBlocksOpen && (
        <Modal title="Scratch Task Setup" onClose={handleCloseStarterBlocks}>
          <div className="te-scratch-modal-content">
            <div className="te-scratch-modal-header">
              <CodeWorkspaceTabs
                activeTab={scratchModalTab}
                onChange={handleScratchModalTabChange}
                starterLabel="Scratch Task Setup"
                testLabel="Complete blocks"
                stages={codeStages}
                onAddStage={handleAddScratchStage}
                onRemoveStage={handleRemoveScratchStage}
              />
              {scratchModalTab === 'complete' && checkResult !== null && (
                <span className={checkResult === 'pass' ? 'te-scratch-check-pass' : 'te-scratch-check-fail'}>
                  {checkResult === 'pass' ? 'Check passes' : 'Check not passing'}
                </span>
              )}
              {scratchModalTab !== 'starter' && (
                <button type="button" className="btn-ghost te-secondary-btn" onClick={handleCopySpriteInfoToStarter}>
                  Copy Sprite Info to Starter
                </button>
              )}
            </div>

            <div className="te-scratch-modal-body">
              {scratchModalTab === 'starter' && (
                <div className="te-scratch-config-sidebar">
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid #e5e7eb' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.88rem' }}>
                      <input
                        type="checkbox"
                        checked={!!task.enableStageCode}
                        onChange={e => {
                          if (!e.target.checked) {
                            const nextStarter = { ...(task.starterBlocks ?? {}) }
                            delete nextStarter['__stage__']
                            const nextComplete = { ...(task.completeBlocks ?? {}) }
                            delete nextComplete['__stage__']
                            onUpdate({
                              ...task,
                              enableStageCode: false,
                              starterBlocks: Object.keys(nextStarter).length ? nextStarter : undefined,
                              completeBlocks: Object.keys(nextComplete).length ? nextComplete : undefined,
                            })
                          } else {
                            set('enableStageCode', true)
                          }
                        }}
                      />
                      <span style={{ fontWeight: 600 }}>Enable stage code</span>
                    </label>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#6b7280', margin: '4px 0 0 24px' }}>
                      Show a Stage tab in the workspace for backdrop-level scripts.
                    </p>
                  </div>

                  <div className="te-collapsible">
                    <button type="button" className="te-collapsible__header" onClick={() => toggleSidebarSection('toolbox')}>
                      <span className="te-collapsible__label">Toolbox blocks</span>
                      <span className="te-collapsible__chevron" style={{ transform: sidebarSections.toolbox ? 'rotate(180deg)' : 'none' }}>▾</span>
                    </button>
                    {sidebarSections.toolbox && (
                      <>
                        <ScratchToolboxPicker
                          toolbox={task.toolbox ?? ''}
                          onChange={toolbox => set('toolbox', toolbox)}
                        />
                        <div style={{ padding: '8px 12px', borderTop: '1px solid #e5e7eb' }}>
                          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.82rem', color: 'var(--colour-text)', display: 'block', marginBottom: 6 }}>Predefined blocks</span>
                          <PredefinedBlocksEditor
                            predefinedBlocks={task.predefinedBlocks ?? []}
                            toolbox={task.toolbox ?? ''}
                            onChange={pbs => set('predefinedBlocks', pbs.length ? pbs : undefined)}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="te-collapsible">
                    <button type="button" className="te-collapsible__header" onClick={() => toggleSidebarSection('sprites')}>
                      <span className="te-collapsible__label">Sprites</span>
                      <span className="te-collapsible__chevron" style={{ transform: sidebarSections.sprites ? 'rotate(180deg)' : 'none' }}>▾</span>
                    </button>
                    {sidebarSections.sprites && (
                      <div ref={setModalSpritePanelTarget} className="te-sprite-panel-host" />
                    )}
                  </div>

                  <div className="te-collapsible">
                    <button type="button" className="te-collapsible__header" onClick={() => toggleSidebarSection('backdrops')}>
                      <span className="te-collapsible__label">Backdrops</span>
                      <span className="te-collapsible__chevron" style={{ transform: sidebarSections.backdrops ? 'rotate(180deg)' : 'none' }}>▾</span>
                    </button>
                    {sidebarSections.backdrops && (
                      <div style={{ padding: '10px 12px', borderTop: '1px solid #e5e7eb' }}>
                        <BackdropManager
                          backdrops={task.backdrops?.length > 0 ? task.backdrops : [{ id: 'backdrop1', name: 'Backdrop 1', colour: '#ffffff' }]}
                          onChange={backdrops => set('backdrops', backdrops)}
                          assetsPath={lesson.assetsPath ? resolveAssetsPath(lesson.assetsPath) : ''}
                          storageAssets={lesson.storageAssets ?? []}
                          lessonId={lesson.id}
                          lessonType={lesson.type}
                        />
                      </div>
                    )}
                  </div>

                  <div className="te-collapsible">
                    <button type="button" className="te-collapsible__header" onClick={() => toggleSidebarSection('variables')}>
                      <span className="te-collapsible__label">Variables</span>
                      <span className="te-collapsible__chevron" style={{ transform: sidebarSections.variables ? 'rotate(180deg)' : 'none' }}>▾</span>
                    </button>
                    {sidebarSections.variables && (
                      <div style={{ padding: '10px 12px', borderTop: '1px solid #e5e7eb' }}>
                        <VariableManager
                          variables={task.variables ?? []}
                          onChange={variables => set('variables', variables.length > 0 ? variables : undefined)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="te-scratch-modal-workspace">
                {scratchModalTab === 'starter' ? (
                  <ScratchWorkspace
                    key={`builder-scratch-starter-${task.id}-${(task.sprites ?? []).map(sp => sp.id).join(',')}`}
                    task={task}
                    hideStage
                    assetsPath={lesson.assetsPath ? resolveAssetsPath(lesson.assetsPath) : ''}
                    initialStates={modalStarterBlocks}
                    onStateChange={states => {
                      modalStarterBlocksRef.current = states
                      setModalStarterBlocks(states)
                      set('starterBlocks', states)
                    }}
                    onSpriteStatesChange={states => {
                      set('sprites', copyScratchSpriteStateToStarters(getScratchSprites(), states))
                    }}
                    syncNowKey={starterBlocksSyncKey}
                    selectedSpriteId={modalSelectedSpriteId}
                    onSpriteSelect={setModalSelectedSpriteId}
                    spritePanelTarget={modalSpritePanelTarget}
                    onAddSprite={handleAddStarterSprite}
                    predefinedBlocks={task.predefinedBlocks ?? null}
                    spritePanelEditor={(
                      <SpriteManager
                        sprites={getScratchSprites()}
                        focusedSpriteId={modalSelectedSpriteId}
                        hideAdd
                        hidePosRow
                        onChange={handleStarterSpritesChange}
                        assetsPath={lesson.assetsPath ? resolveAssetsPath(lesson.assetsPath) : ''}
                        storageAssets={lesson.storageAssets ?? []}
                        lessonId={lesson.id}
                        lessonType={lesson.type}
                      />
                    )}
                  />
                ) : scratchModalTab === 'complete' ? (
                  <ScratchWorkspace
                    key={`builder-scratch-complete-${task.id}-${(task.sprites ?? []).map(sp => sp.id).join(',')}`}
                    task={task}
                    assetsPath={lesson.assetsPath ? resolveAssetsPath(lesson.assetsPath) : ''}
                    initialStates={testScratchBlocks}
                    onStateChange={states => {
                      modalCompleteBlocksRef.current = states
                      setTestScratchBlocks(states)
                      set('completeBlocks', states)
                    }}
                    onSpriteStatesChange={states => {
                      modalCompleteSpriteStatesRef.current = states
                    }}
                    onCheckResult={passed => {
                      setCheckResult(passed ? 'pass' : 'fail')
                      if (task.check) {
                        onUpdate({
                          ...task,
                          completeBlocks: modalCompleteBlocksRef.current ?? testScratchBlocks,
                          _checkTested: true,
                        })
                      }
                    }}
                    syncNowKey={starterBlocksSyncKey}
                    predefinedBlocks={task.predefinedBlocks ?? null}
                  />
                ) : (() => {
                  const stageMatch = scratchModalTab.match(/^stage_(\d+)$/)
                  if (!stageMatch) return null
                  const stageIdx = parseInt(stageMatch[1], 10)
                  const stage = codeStages[stageIdx]
                  if (!stage) return null
                  const stagePredefined = [
                    ...(task.predefinedBlocks ?? []),
                    ...(stage.predefinedBlocks ?? []),
                  ]
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid #e5e7eb', flexShrink: 0, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>Stage label:</span>
                        <input
                          className="te-input"
                          style={{ width: 200, padding: '4px 8px', fontSize: '0.82rem' }}
                          value={stage.label ?? ''}
                          onChange={e => updateStage(stageIdx, { label: e.target.value })}
                          placeholder={`Stage ${stageIdx + 1}`}
                        />
                        <div style={{ flex: '1 1 100%', padding: '4px 0 0' }}>
                          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.8rem', color: '#6b7280', display: 'block', marginBottom: 4 }}>Predefined blocks for this stage</span>
                          <PredefinedBlocksEditor
                            predefinedBlocks={stage.predefinedBlocks ?? []}
                            toolbox={task.toolbox ?? ''}
                            onChange={pbs => updateStage(stageIdx, { predefinedBlocks: pbs.length ? pbs : undefined })}
                          />
                        </div>
                      </div>
                      <ScratchWorkspace
                        key={`builder-scratch-stage-${task.id}-${stageIdx}-${(task.sprites ?? []).map(sp => sp.id).join(',')}`}
                        task={task}
                        hideStage
                        assetsPath={lesson.assetsPath ? resolveAssetsPath(lesson.assetsPath) : ''}
                        initialStates={stage.blocks ?? null}
                        onStateChange={states => updateStage(stageIdx, { blocks: states })}
                        onSpriteStatesChange={states => {
                          modalStageSpriteStatesRef.current[stageIdx] = states
                        }}
                        syncNowKey={starterBlocksSyncKey}
                        predefinedBlocks={stagePredefined.length ? stagePredefined : null}
                      />
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
