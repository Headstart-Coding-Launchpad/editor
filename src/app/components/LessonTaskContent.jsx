import React, { useEffect, useState } from 'react'
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
import { NARROW_BREAKPOINT as SCRATCH_CODE_WIDE_WIDTH, NARROW_BREAKPOINT_HEIGHT as SCRATCH_CODE_WIDE_HEIGHT } from '../../modules/scratch/ScratchWorkspace'

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
  isCodeArrangeTask,
  displayCode,
  displayArcadeDesign,
  displaySpriteState,
  displayCursor,
  displayBlockDrag,
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
}) {
  const [explainerCollapsed, setExplainerCollapsed] = useState(false)
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

  // What's actually on screen right now, for the teacher's student list — see the
  // `scratchCodePanes` comment above for why Scratch and the other modules compute this
  // differently.
  const instructionsPaneVisible = !taskPanelCompact || taskPanelTab === 'instructions'
  const codePaneVisible = !taskPanelCompact || taskPanelTab === 'code'
  const visiblePanes = isScratchLesson
    ? [...(instructionsPaneVisible ? ['instructions'] : []), ...(codePaneVisible ? scratchCodePanes : [])]
    : supportsModulePanes
    ? modulePanes
    : null
  const visiblePanesKey = visiblePanes?.join(',') ?? ''

  useEffect(() => {
    if (isScratchLesson || supportsModulePanes) onVisiblePanesChange?.(visiblePanes)
  // visiblePanes is rebuilt every render; visiblePanesKey is its stable dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScratchLesson, supportsModulePanes, visiblePanesKey, onVisiblePanesChange])

  function handleTaskPanelTabChange(id) {
    setTaskPanelTab(id)
    saveLayoutTab(TASK_PANEL_TABS_SURFACE, id)
  }
  const showsCompleteCode = !!explainerShowsComplete && !!task?.completeCode
  const hasTaskExplainer = (!!task?.explainer || showsCompleteCode) && !isSandbox && !cs.inPersonalSandbox && !isQuizTask && !isInformationTask
  const useFluidWorkspace = supportsSideExplainer && !isMobile && !isQuizTask && !isInformationTask
  const useSideExplainer = hasTaskExplainer && useFluidWorkspace
  const showExplainerPane = presenterLayout !== 'code'
  const showCodePane = presenterLayout !== 'explainer'
  const supportsStageReveal = ['python', 'html', 'arcade', 'electronics', 'scratch'].includes(lessonMod?.type ?? lesson.type)
  const activeSupportStage = !isSandbox && !cs.inPersonalSandbox && !isQuizTask && !isInformationTask && !isViewingPrev && !isForcedTeacherLive && !isTeacherEditing && supportsStageReveal && cs.activeSupportStageIndex != null
    ? getRevealableStages(task).find(({ index }) => index === cs.activeSupportStageIndex) ?? null
    : null
  const authoredCompleteStage = getCompleteStage(task)?.stage
  const completeReferenceStage = !isSandbox && !cs.inPersonalSandbox && !isQuizTask && !isInformationTask && !isViewingPrev && !isForcedTeacherLive && !isTeacherEditing && cs.completePreviewShown && ['python', 'html'].includes(lesson.type) && (authoredCompleteStage || task?.completeCode || task?.completeFiles?.length)
    ? authoredCompleteStage ?? (lesson.type === 'html'
      ? { label: 'Complete solution', files: task.completeFiles ?? [], entryFile: task.completeEntryFile ?? task.entryFile }
      : { label: 'Complete solution', code: task.completeCode })
    : null
  const targetedReferenceStage = !isSandbox && !cs.inPersonalSandbox && !isQuizTask && !isInformationTask && !isViewingPrev && !isForcedTeacherLive && !isTeacherEditing && cs.targetedPreviewStageIndex != null
    ? task?.codeStages?.[cs.targetedPreviewStageIndex] ?? null
    : null
  const displayedReferenceStage = completeReferenceStage ?? targetedReferenceStage ?? activeSupportStage
  const targetedOfferStage = cs.targetedStageOffer ? task?.codeStages?.[cs.targetedStageOffer.stageIndex] ?? null : null
  const genericNextStage = !targetedOfferStage && cs.offeredSupportStageIndex == null && canOfferNextStage
    ? task?.codeStages?.[cs.offeredStageIndex + 1] ?? null
    : null

  const taskContentStyle = (!isSandbox && isQuizTask)
    ? s.taskContentQuiz
    : (!isSandbox && isInformationTask)
    ? s.taskContentInfo
    : (modStyles.taskContentStyle ?? s.taskContentFallback)

  const editorAreaStyle = (!isSandbox && isQuizTask)
    ? s.editorAreaQuiz
    : (!isSandbox && isInformationTask)
    ? s.editorAreaInfo
    : (modStyles.editorAreaStyle ?? s.editorAreaFallback)

  // s.fluidTaskContent's overflow:'hidden' + minHeight:0 is right for the other
  // fluid-workspace types (SplitPane manages its own per-pane scrolling internally), but
  // for Scratch it would clip scratchTaskPanelWrap's height floor (see its style below)
  // instead of letting StudentView.jsx's `s.body` (overflow:'auto') scroll around it when
  // a sibling like the completion banner grows. `minHeight: 'auto'` (not 0, and not simply
  // omitted — taskContentStyle already bakes in minHeight:0) is what actually re-enables a
  // flex item's content-based automatic minimum size, which is what lets it grow to fit a
  // child's explicit min-height when overflow is visible — CSS resolves this content-based
  // minimum to 0 for any *other* overflow value, so minHeight:'auto' only works paired with
  // overflow:'visible' here, not on its own.
  const transitionStyle = isScratchLesson && useFluidWorkspace
    ? { ...taskContentStyle, flex: 1, minHeight: 'auto' }
    : useFluidWorkspace
      ? { ...taskContentStyle, ...s.fluidTaskContent }
      : taskContentStyle
  // TaskSlideTransition.jsx's own `.task-slide-panel` CSS class also hardcodes
  // `min-height: 0` (index.css) — same reason, needs the same override, but that's a class
  // rule, not something `style` (which only reaches `.task-slide-viewport`) can touch —
  // hence the separate `panelStyle` prop.
  const taskPanelInnerStyle = isScratchLesson && useFluidWorkspace ? { minHeight: 'auto' } : undefined

  const taskExplainer = hasTaskExplainer ? (
    <div style={useSideExplainer ? s.sideExplainerShell : undefined}>
      {useSideExplainer && (
        <CollapseTabButton
          onClick={() => setExplainerCollapsed(true)}
          direction="left"
          title="Collapse Explainer"
          ariaLabel="Collapse Explainer"
          style={s.sideExplainerCollapse}
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

      {!isSandbox && isInformationTask ? (
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
        />
      ) : (
        <Banner accent="#dc2626" color="#991b1b" style={{ borderRadius: 8 }}>
          Unable to load this task - unrecognised lesson type "{lesson.type}".
        </Banner>
      )}
    </>
  )

  const editorArea = (
    <div
      style={useFluidWorkspace ? { ...editorAreaStyle, ...s.fluidWorkspace } : editorAreaStyle}
      className={isForcedTeacherLive ? 'live-view-active' : undefined}
    >
      {workspaceContent}
    </div>
  )

  return (
    <TaskSlideTransition transitionKey={transitionKey} style={transitionStyle} panelStyle={taskPanelInnerStyle}>
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
          defaultSplit={25}
          leftCollapsed={explainerCollapsed}
          collapsedLeftWidth={44}
          collapsedLeft={
            <CollapsedPanelRail
              onClick={() => setExplainerCollapsed(false)}
              label="Explainer"
              direction="right"
              title="Show Explainer"
              ariaLabel="Show Explainer"
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
    // A real floor, not 0: without this, a growing sibling (e.g. the completion banner
    // wrapping onto extra lines) directly shrinks this panel's available height instead
    // of the page scrolling around it — StudentView.jsx's `s.body` already has
    // `overflow: 'auto'` for exactly this. Below this floor, ScratchWorkspace's own
    // measured height would drop under its NARROW_BREAKPOINT_HEIGHT and force Blocks/Stage
    // into compact tabs for no better reason than a banner temporarily taking up space.
    minHeight: SCRATCH_CODE_WIDE_HEIGHT,
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
