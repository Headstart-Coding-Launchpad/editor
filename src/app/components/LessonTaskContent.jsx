import React, { useEffect, useRef, useState } from 'react'
import Banner from '../../shared/Banner'
import { getLessonModule } from '../../modules/registry'
import SplitPane from '../../shared/SplitPane'
import ExplainerPanel from './ExplainerPanel'
import InformationTask from './InformationTask'
import QuizTask from './QuizTask'
import CodeArrangeTaskContainer from './CodeArrangeTaskContainer'
import CheckFeedbackBanner from './CheckFeedbackBanner'
import TaskSlideTransition from './TaskSlideTransition'
import { CollapsedPanelRail, CollapseTabButton } from './CollapsiblePanelControls'
import PanelTabs from './PanelTabs'
import SupportStagePanel from './SupportStagePanel'
import { getCompleteStage, getRevealableStages } from '../../shared/taskUtils'
import { useElementSize } from '../../shared/useElementSize'
import { loadLayoutTab, saveLayoutTab } from '../studentStorage'
import { NARROW_BREAKPOINT as SCRATCH_CODE_WIDE_WIDTH } from '../../modules/scratch/ScratchWorkspace'

const SIDE_EXPLAINER_TYPES = ['python', 'arcade', 'html', 'scratch', 'electronics']
// Lesson types whose module StudentWorkspace reports its own visiblePanes (a togglable
// pane/tab/run-state that's meaningful to show on the teacher's student list) via the
// generic `modulePanes` state below, rather than the Scratch-specific plumbing.
const MODULE_PANES_TYPES = ['electronics', 'python', 'arcade', 'html']
// Scratch's explainer is a fixed, non-resizable width (no drag-to-resize) rather than a
// percentage split — Scratch explainers often carry block-pill images/markdown that need
// real width, and a fixed size is simpler and more predictable than a shrinking one.
const EXPLAINER_FIXED_WIDTH = 400
// Gap between the explainer and code columns (s.scratchFixedSplit) — must be included in
// the threshold below, or the code area ends up ~12px short of SCRATCH_CODE_WIDE_WIDTH
// right at the boundary, letting ScratchWorkspace's own Blocks/Stage tabs sneak in a hair
// before Instructions would have tabbed away instead.
const SCRATCH_SPLIT_GAP = 12
// Instructions tabs away *before* the code area (editor+stage) would otherwise be
// squeezed under ScratchWorkspace's own "wide" width (SCRATCH_CODE_WIDE_WIDTH, imported
// from ScratchWorkspace.jsx so the two never drift apart) — i.e. as soon as a fixed
// 400px explainer would leave the code area under 1000px, Instructions gives up its
// space entirely instead of leaving Blocks/Stage to squeeze into their own compact tabs.
// Only once the *whole* panel is under that combined width does Code, now with the full
// panel to itself, still end up compact — at which point Stage tabs away from Blocks as
// the final fallback (see ScratchWorkspace.jsx's own `compact`).
const TASK_PANEL_TABS_SURFACE = 'task_panel'

export default function LessonTaskContent({
  lesson,
  task,
  cs,
  lessonId,
  identityId,
  sandboxExplainer,
  activeStudentView,
  viewingTaskId,
  currentTaskId,
  transitionKey,
  previewMode,
  isSandbox,
  isViewingPrev,
  isForcedTeacherLive,
  isMobile,
  isQuizTask,
  isAutoEvaluatedQuiz,
  isInformationTask,
  isViewingExplainerSlide,
  isCodeArrangeTask,
  displayCode,
  displayArcadeDesign,
  displaySpriteState,
  displayCursor,
  displayBlockDrag,
  displayCodeArrangeSlots,
  displayCodeArrangeCursor,
  displayFiles,
  displayActiveFile,
  displayOutput,
  displayRunStatus,
  displayCheckPassed,
  displayCheckAttempted,
  displayCheckSuggestion,
  displaySelection,
  displayFs,
  isTeacherEditing,
  teacherLiveCode,
  teacherLiveFiles,
  teacherLiveActiveFile,
  teacherLiveWorkspace,
  teacherLiveArcadeDesign,
  canOfferNextStage,
  canOfferCompletePreview,
  canOfferCompleteSolution,
  canOfferPersonalSandbox,
  explainerShowsComplete,
  presenterLayout = 'both',
  onNeedHelp,
  onTopicOpen,
  onTopicClose,
  openTopicId,
  onVisiblePanesChange,
  highlightedPanes,
  forcedPaneCommand,
}) {
  const [explainerCollapsed, setExplainerCollapsed] = useState(false)
  // Tracks the explainer's own accordion collapse (used whenever `!useSideExplainer` —
  // i.e. lesson types outside SIDE_EXPLAINER_TYPES like Filesystem, and the mobile
  // fallback for every type) so its open/closed state can feed visiblePanes below just
  // like the side-rail's explainerCollapsed does.
  const [accordionExplainerCollapsed, setAccordionExplainerCollapsed] = useState(false)
  const [taskPanelTab, setTaskPanelTab] = useState(() => loadLayoutTab(TASK_PANEL_TABS_SURFACE) || 'code')
  const [taskPanelSizeRef, taskPanelSize] = useElementSize()
  // Scratch's Instructions/Code (desktop-compact, below) and, inside ScratchWorkspace
  // itself, Blocks/Stage are the only panes that hide via this shared explainer/code
  // split, so they get their own dedicated state. Other module-internal togglable state
  // (Electronics' Breadboard/Code tab, Python's console, Arcade's tab+running, HTML's
  // active file+preview) is reported by each module's own StudentWorkspace into the
  // generic `modulePanes` state instead — see MODULE_PANES_TYPES above.
  const [scratchCodePanes, setScratchCodePanes] = useState(['blocks', 'stage'])
  const [modulePanes, setModulePanes] = useState([])
  const lessonMod = getLessonModule(lesson.type)
  const StudentWorkspace = lessonMod?.StudentWorkspace
  const modStyles = lessonMod?.getLayoutStyles(isMobile) ?? {}
  const supportsSideExplainer = SIDE_EXPLAINER_TYPES.includes(lessonMod?.type ?? lesson.type)
  const isScratchLesson = (lessonMod?.type ?? lesson.type) === 'scratch'
  const supportsModulePanes = MODULE_PANES_TYPES.includes(lessonMod?.type ?? lesson.type)
  const taskPanelMeasured = taskPanelSize.width > 0
  // Width-only: giving Code its own tab doesn't add height (explainer and code already
  // share the same row's height), so a short-but-wide window is left to ScratchWorkspace's
  // own compact detection (which checks height too) rather than tabbing Instructions away
  // for no benefit.
  const taskPanelCompact = isScratchLesson && taskPanelMeasured &&
    taskPanelSize.width < EXPLAINER_FIXED_WIDTH + SCRATCH_SPLIT_GAP + SCRATCH_CODE_WIDE_WIDTH
  const showsCompleteCode = !!explainerShowsComplete && !!task?.completeCode
  const hasTaskExplainer = (!!task?.explainer || showsCompleteCode) && !isSandbox && !cs.inPersonalSandbox && !isQuizTask && !isInformationTask && !isViewingExplainerSlide
  const useFluidWorkspace = supportsSideExplainer && !isMobile && !isQuizTask && !isInformationTask && !isViewingExplainerSlide
  const useSideExplainer = hasTaskExplainer && useFluidWorkspace

  // What's actually on screen right now, for the teacher's student list — see the
  // `scratchCodePanes` comment above for why Scratch and the other modules compute this
  // differently. `hasTaskExplainer` gates this off entirely for tasks with no explainer
  // to show at all (quizzes, information tasks, sandbox), where compact/useSideExplainer
  // would otherwise report a phantom always-visible instructions pane.
  const instructionsPaneVisible = !hasTaskExplainer
    ? false
    : taskPanelCompact
    ? taskPanelTab === 'instructions'
    : useSideExplainer
    ? !explainerCollapsed
    : !accordionExplainerCollapsed
  const codePaneVisible = !taskPanelCompact || taskPanelTab === 'code'
  const visiblePanes = isScratchLesson
    ? [...(instructionsPaneVisible ? ['instructions'] : []), ...(codePaneVisible ? scratchCodePanes : [])]
    : supportsModulePanes
    ? [...(instructionsPaneVisible ? ['instructions'] : []), ...modulePanes]
    : hasTaskExplainer
    ? (instructionsPaneVisible ? ['instructions'] : [])
    : null
  const visiblePanesKey = visiblePanes?.join(',') ?? ''
  const instructionsHighlighted = !!highlightedPanes?.includes('instructions')

  useEffect(() => {
    if (isScratchLesson || supportsModulePanes || hasTaskExplainer) onVisiblePanesChange?.(visiblePanes)
  // visiblePanes is rebuilt every render; visiblePanesKey is its stable dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScratchLesson, supportsModulePanes, hasTaskExplainer, visiblePanesKey, onVisiblePanesChange])

  // Teacher "force" push for the instructions/explainer pane — applied once per distinct
  // forcedPaneCommand (guarded by its pushedAt token) via the same collapse/tab state a
  // manual click would use, so the student is free to close it again right after. The
  // module-specific half of a force command (e.g. Electronics' breadboard/code,
  // Scratch's blocks/stage) is applied inside each module's own StudentWorkspace instead —
  // see forcedPaneCommand passed to StudentWorkspace below.
  const lastAppliedForceTokenRef = useRef(null)
  useEffect(() => {
    if (!forcedPaneCommand || !hasTaskExplainer || lastAppliedForceTokenRef.current === forcedPaneCommand.pushedAt) return
    lastAppliedForceTokenRef.current = forcedPaneCommand.pushedAt
    const wantsInstructions = forcedPaneCommand.panes.includes('instructions')
    if (useSideExplainer) {
      setExplainerCollapsed(!wantsInstructions)
      if (taskPanelCompact) handleTaskPanelTabChange(wantsInstructions ? 'instructions' : 'code')
    } else {
      setAccordionExplainerCollapsed(!wantsInstructions)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forcedPaneCommand, hasTaskExplainer, useSideExplainer, taskPanelCompact])

  function handleTaskPanelTabChange(id) {
    setTaskPanelTab(id)
    saveLayoutTab(TASK_PANEL_TABS_SURFACE, id)
  }
  const showExplainerPane = presenterLayout !== 'code'
  const showCodePane = presenterLayout !== 'explainer'
  const supportsStageReveal = ['python', 'html', 'arcade', 'electronics', 'scratch'].includes(lessonMod?.type ?? lesson.type)
  const activeSupportStage = !isSandbox && !cs.inPersonalSandbox && !isQuizTask && !isInformationTask && !isViewingExplainerSlide && !isViewingPrev && !isForcedTeacherLive && !isTeacherEditing && supportsStageReveal && cs.activeSupportStageIndex != null
    ? getRevealableStages(task).find(({ index }) => index === cs.activeSupportStageIndex) ?? null
    : null
  const authoredCompleteStage = getCompleteStage(task)?.stage
  const completeReferenceStage = !isSandbox && !cs.inPersonalSandbox && !isQuizTask && !isInformationTask && !isViewingExplainerSlide && !isViewingPrev && !isForcedTeacherLive && !isTeacherEditing && cs.completePreviewShown && ['python', 'html'].includes(lesson.type) && (authoredCompleteStage || task?.completeCode || task?.completeFiles?.length)
    ? authoredCompleteStage ?? (lesson.type === 'html'
      ? { label: 'Complete solution', files: task.completeFiles ?? [], entryFile: task.completeEntryFile ?? task.entryFile }
      : { label: 'Complete solution', code: task.completeCode })
    : null
  const targetedReferenceStage = !isSandbox && !cs.inPersonalSandbox && !isQuizTask && !isInformationTask && !isViewingExplainerSlide && !isViewingPrev && !isForcedTeacherLive && !isTeacherEditing && cs.targetedPreviewStageIndex != null
    ? task?.codeStages?.[cs.targetedPreviewStageIndex] ?? null
    : null
  const displayedReferenceStage = completeReferenceStage ?? targetedReferenceStage ?? activeSupportStage
  const targetedOfferStage = cs.targetedStageOffer ? task?.codeStages?.[cs.targetedStageOffer.stageIndex] ?? null : null
  const genericNextStage = !targetedOfferStage && cs.offeredSupportStageIndex == null && canOfferNextStage
    ? task?.codeStages?.[cs.offeredStageIndex + 1] ?? null
    : null

  const taskContentStyle = (!isSandbox && isQuizTask)
    ? s.taskContentQuiz
    : (!isSandbox && (isInformationTask || isViewingExplainerSlide))
    ? s.taskContentInfo
    : (modStyles.taskContentStyle ?? s.taskContentFallback)

  const editorAreaStyle = (!isSandbox && isQuizTask)
    ? s.editorAreaQuiz
    : (!isSandbox && (isInformationTask || isViewingExplainerSlide))
    ? s.editorAreaInfo
    : (modStyles.editorAreaStyle ?? s.editorAreaFallback)

  // s.fluidTaskContent's overflow:'hidden' + minHeight:0 applies to every fluid-workspace
  // type, Scratch included: scratchTaskPanelWrap carries no height floor of its own to
  // protect (ScratchWorkspace scales its stage down to fit whatever height it's given —
  // see computeStageScale there), so there's nothing here that needs to grow past its
  // flex-allotted space or stay visible while doing so.
  const transitionStyle = useFluidWorkspace
    ? { ...taskContentStyle, ...s.fluidTaskContent }
    : taskContentStyle

  const taskExplainer = hasTaskExplainer ? (
    <div style={useSideExplainer ? s.sideExplainerShell : undefined}>
      {useSideExplainer && (
        <CollapseTabButton
          onClick={() => setExplainerCollapsed(true)}
          direction="left"
          title="Collapse Explainer"
          ariaLabel="Collapse Explainer"
          style={s.sideExplainerCollapse}
          highlighted={instructionsHighlighted}
        />
      )}
      <ExplainerPanel
        title={showsCompleteCode ? 'Complete Code' : task.title}
        content={showsCompleteCode ? '```python\n' + task.completeCode + '\n```' : task.explainer}
        topicType={lesson.type}
        onTopicOpen={onTopicOpen}
        onTopicClose={onTopicClose}
        openTopicId={openTopicId}
        disableCopy
        fill={useSideExplainer}
        collapsible={!useSideExplainer}
        markdownTextScale={useSideExplainer ? 1.08 : 1}
        onCollapsedChange={!useSideExplainer ? setAccordionExplainerCollapsed : undefined}
        highlighted={!useSideExplainer && instructionsHighlighted}
      />
    </div>
  ) : null

  const shouldShowFeedbackBanner = !cs.stagePromptAccepted && !isSandbox && !cs.inPersonalSandbox && (
    ((task?.check || isAutoEvaluatedQuiz) && displayCheckAttempted) || cs.offeredSupportStageIndex != null
  )
  const feedbackBanner = shouldShowFeedbackBanner ? (
    <CheckFeedbackBanner
      passed={cs.offeredSupportStageIndex != null ? false : displayCheckPassed}
      failureMessage={isQuizTask ? 'Not quite right, try again.' : undefined}
      suggestion={displayCheckSuggestion}
      onShowCodeStage={targetedOfferStage
        ? cs.handlePreviewTargetedStage
        : cs.offeredSupportStageIndex != null
        ? cs.handleRevealOfferedSupportStage
        : canOfferNextStage ? () => {
        const nextStageIndex = cs.offeredStageIndex + 1
        cs.handleAcceptGenericNextStage(nextStageIndex)
      } : undefined}
      stageActionLabel={targetedOfferStage
        ? `Show ${targetedOfferStage.label || 'reference'}`
        : cs.offeredSupportStageIndex != null ? 'Show reference'
        : genericNextStage ? `Use ${genericNextStage.label || 'next stage'}` : undefined}
      stageActionConfirm={targetedOfferStage?.action === 'replace'
        ? `This will replace your current work with “${targetedOfferStage.label || 'this stage'}”. Continue?`
        : genericNextStage
          ? `This will replace your current work with “${genericNextStage.label || 'the next stage'}”. Continue?`
        : undefined}
      onPreviewCompleteCode={canOfferCompletePreview ? cs.handlePreviewCompleteCode : undefined}
      onShowCompleteCode={canOfferCompleteSolution ? cs.handleShowCompleteCode : undefined}
      onGoPersonalSandbox={canOfferPersonalSandbox ? cs.handleEnterPersonalSandbox : undefined}
      onNeedHelp={onNeedHelp}
    />
  ) : null

  const workspaceContent = (
    <>
      {isSandbox && sandboxExplainer && (
        <ExplainerPanel title="Instructions" content={sandboxExplainer} topicType={lesson.type} disableCopy />
      )}

      {displayedReferenceStage && (() => {
        const reveal = completeReferenceStage || targetedReferenceStage ? null : cs.supportStageReveals?.[activeSupportStage?.index]
        const sourceLabel = completeReferenceStage
          ? 'Complete reference'
          : targetedReferenceStage
            ? 'Shown for your feedback'
          : reveal?.source === 'teacher'
            ? 'Opened by your teacher'
            : 'Shown after a failed attempt'
        return (
          <SupportStagePanel
            stage={completeReferenceStage ?? targetedReferenceStage ?? activeSupportStage.stage}
            lessonType={lesson.type}
            revealed={completeReferenceStage || targetedReferenceStage ? true : !!reveal}
            sourceLabel={sourceLabel}
          />
        )
      })()}

      {!isSandbox && (isInformationTask || isViewingExplainerSlide) ? (
        <InformationTask task={task} lesson={lesson} fill disableCopy />
      ) : !isSandbox && isQuizTask ? (
        <QuizTask
          task={task}
          showQuestion
          selectedAnswer={cs.selectedAnswer}
          onSelectAnswer={isViewingPrev ? undefined : cs.handleQuizSelect}
          submitted={cs.runStatus === 'submitted'}
          checkPassed={cs.checkPassed}
          disabled={isViewingPrev}
          showResult={false}
        />
      ) : !isSandbox && isCodeArrangeTask ? (
        <CodeArrangeTaskContainer
          task={task}
          cs={cs}
          viewingTaskId={viewingTaskId}
          currentTaskId={currentTaskId}
          isViewingPrev={isViewingPrev}
          isForcedTeacherLive={isForcedTeacherLive}
          isTeacherEditing={isTeacherEditing}
          displayCode={displayCode}
          displayFiles={displayFiles}
          displayOutput={displayOutput}
          displayRunStatus={displayRunStatus}
          displayCheckPassed={displayCheckPassed}
          displayCheckAttempted={displayCheckAttempted}
          displayCodeArrangeSlots={displayCodeArrangeSlots}
          displayCodeArrangeCursor={displayCodeArrangeCursor}
          teacherLiveCode={teacherLiveCode}
          teacherLiveFiles={teacherLiveFiles}
        />
      ) : StudentWorkspace ? (
        <StudentWorkspace
          lesson={lesson}
          task={task}
          cs={cs}
          lessonId={lessonId}
          identityId={identityId}
          viewingTaskId={viewingTaskId}
          currentTaskId={currentTaskId}
          isSandbox={isSandbox}
          isViewingPrev={isViewingPrev}
          isForcedTeacherLive={isForcedTeacherLive}
          isMobile={isMobile}
          activeStudentView={activeStudentView}
          previewMode={previewMode}
          displayCode={displayCode}
          displayArcadeDesign={displayArcadeDesign}
          displaySpriteState={displaySpriteState}
          displayCursor={displayCursor}
          displayBlockDrag={displayBlockDrag}
          displayFiles={displayFiles}
          displayActiveFile={displayActiveFile}
          displayOutput={displayOutput}
          displayRunStatus={displayRunStatus}
          displayCheckPassed={displayCheckPassed}
          displayCheckAttempted={displayCheckAttempted}
          displaySelection={displaySelection}
          displayFs={displayFs}
          isTeacherEditing={isTeacherEditing}
          teacherLiveCode={teacherLiveCode}
          teacherLiveFiles={teacherLiveFiles}
          teacherLiveActiveFile={teacherLiveActiveFile}
          teacherLiveWorkspace={teacherLiveWorkspace}
          teacherLiveArcadeDesign={teacherLiveArcadeDesign}
          onVisiblePanesChange={isScratchLesson ? setScratchCodePanes : supportsModulePanes ? setModulePanes : undefined}
          highlightedPanes={highlightedPanes}
          forcedPaneCommand={forcedPaneCommand}
        />
      ) : (
        <Banner accent="#dc2626" color="#991b1b" style={{ borderRadius: 8 }}>
          Unable to load this task - unrecognised lesson type "{lesson.type}".
        </Banner>
      )}
    </>
  )

  // code_arrange isn't a SplitPane-managed workspace with its own internal per-pane
  // scrolling like the other fluid-workspace types (python/html/scratch/electronics/arcade
  // editors) — it's plain flowing content (program lines + tile pool) that can outgrow the
  // available height, so it needs the editor area itself to scroll instead of clipping it.
  const editorArea = (
    <div
      style={useFluidWorkspace
        ? { ...editorAreaStyle, ...s.fluidWorkspace, ...(isCodeArrangeTask ? { overflow: 'auto' } : {}) }
        : editorAreaStyle}
      className={isForcedTeacherLive ? 'live-view-active' : undefined}
    >
      {workspaceContent}
    </div>
  )

  return (
    <TaskSlideTransition transitionKey={transitionKey} style={transitionStyle}>
      {previewMode && task && !isSandbox && (
        <Banner accent="#0ea5e9" color="#0369a1" style={{ padding: '5px 16px', fontSize: 12, fontWeight: 600 }}>
          {task.taskMode === 'live'
            ? 'Live sessions only'
            : task.taskMode === 'solo'
            ? 'Solo mode only'
            : 'Live + Solo'}
        </Banner>
      )}

      {feedbackBanner}

      {useSideExplainer && showExplainerPane && showCodePane && isScratchLesson ? (
        // Explainer and code panes are ALWAYS the same two divs, in the same tree
        // position, in both compact (tabbed) and split (fixed-width) modes — only their
        // `style` (and, for the explainer, whether it shows the rail) changes between
        // modes. This is deliberate: if the two modes rendered structurally different
        // trees here (e.g. PanelTabPanel-wrapped vs plain divs), React would unmount and
        // remount everything below on every threshold crossing — destroying and
        // re-injecting every Blockly workspace inside ScratchWorkspace each time,
        // which can leave its own compact-detection mid-remeasurement and stuck.
        <div ref={taskPanelSizeRef} style={s.scratchTaskPanelWrap}>
          {taskPanelCompact && (
            <PanelTabs
              label="Task panel"
              tabs={[{ id: 'instructions', label: 'Instructions' }, { id: 'code', label: 'Code' }]}
              activeId={taskPanelTab}
              onChange={handleTaskPanelTabChange}
              highlightedIds={highlightedPanes}
            />
          )}
          <div style={s.scratchFixedSplit}>
            <div
              role={taskPanelCompact ? 'tabpanel' : undefined}
              id={taskPanelCompact ? 'panel-tabpanel-instructions' : undefined}
              aria-labelledby={taskPanelCompact ? 'panel-tab-instructions' : undefined}
              hidden={taskPanelCompact ? taskPanelTab !== 'instructions' : undefined}
              style={taskPanelCompact
                ? { ...s.scratchCodeFlex, display: taskPanelTab === 'instructions' ? 'flex' : 'none' }
                : (explainerCollapsed ? s.scratchExplainerRail : s.scratchExplainerFixed)}
            >
              {!taskPanelCompact && explainerCollapsed ? (
                <CollapsedPanelRail
                  onClick={() => setExplainerCollapsed(false)}
                  label="Explainer"
                  direction="right"
                  title="Show Explainer"
                  ariaLabel="Show Explainer"
                  highlighted={instructionsHighlighted}
                />
              ) : taskExplainer}
            </div>
            <div
              role={taskPanelCompact ? 'tabpanel' : undefined}
              id={taskPanelCompact ? 'panel-tabpanel-code' : undefined}
              aria-labelledby={taskPanelCompact ? 'panel-tab-code' : undefined}
              hidden={taskPanelCompact ? taskPanelTab !== 'code' : undefined}
              style={taskPanelCompact
                ? { ...s.scratchCodeFlex, display: taskPanelTab === 'code' ? 'flex' : 'none' }
                : s.scratchCodeFlex}
            >
              {editorArea}
            </div>
          </div>
        </div>
      ) : useSideExplainer && showExplainerPane && showCodePane ? (
        <SplitPane
          style={s.sideBySideLayout}
          // 25% put the explainer - the thing a student has to read to know what to do -
          // in a ~310px column wrapping at five or six words, while the editor beside it
          // held ~900px for a 40-character line. Prose was in the narrow column and code
          // had the wide one. 32% gives the explainer a readable measure and still leaves
          // the workspace about two thirds of the width.
          defaultSplit={32}
          leftCollapsed={explainerCollapsed}
          collapsedLeftWidth={44}
          collapsedLeft={
            <CollapsedPanelRail
              onClick={() => setExplainerCollapsed(false)}
              label="Explainer"
              direction="right"
              title="Show Explainer"
              ariaLabel="Show Explainer"
              highlighted={instructionsHighlighted}
            />
          }
          left={taskExplainer}
          right={editorArea}
        />
      ) : (
        <>
          {showExplainerPane && taskExplainer}
          {showCodePane && editorArea}
        </>
      )}
    </TaskSlideTransition>
  )
}

const s = {
  taskContentFallback: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minHeight: 0,
    overflow: 'visible',
  },
  taskContentQuiz: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minHeight: 0,
    overflow: 'visible',
  },
  taskContentInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
  editorAreaFallback: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minHeight: 0,
  },
  editorAreaQuiz: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minHeight: 0,
    overflow: 'auto',
  },
  editorAreaInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
  fluidTaskContent: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  sideBySideLayout: {
    flex: 1,
    minHeight: 0,
    gap: 12,
    overflow: 'hidden',
  },
  scratchTaskPanelWrap: {
    flex: 1,
    minWidth: 0,
    // No minHeight floor here (deliberately): a growing sibling (e.g. a banner, or the
    // completion banner wrapping onto extra lines) is free to shrink this panel however far
    // it needs to — ScratchWorkspace scales its own stage down to fit whatever height it's
    // given (see computeStageScale there) rather than needing a reserved floor, and its
    // stagePane keeps its own `overflow: auto` as a last resort if it's ever squeezed
    // tighter than that scaling can absorb.
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    overflow: 'hidden',
  },
  // Scratch's explainer is a fixed width, not a draggable split — see EXPLAINER_FIXED_WIDTH.
  scratchFixedSplit: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    gap: 12,
    overflow: 'hidden',
  },
  scratchExplainerFixed: {
    width: EXPLAINER_FIXED_WIDTH,
    minWidth: EXPLAINER_FIXED_WIDTH,
    flexShrink: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  scratchExplainerRail: {
    width: 44,
    minWidth: 44,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  scratchCodeFlex: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sideExplainerShell: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
  },
  sideExplainerCollapse: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 3,
    width: 28,
    height: 28,
    alignSelf: 'auto',
    color: '#fff',
  },
  fluidWorkspace: {
    flex: '1 1 auto',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  },
}
