import { startTransition, useEffect, useState } from 'react'
import './App.css'
import { ActivityFeed } from './components/ActivityFeed'
import { AvailableSyntaxCard } from './components/AvailableSyntaxCard'
import { HelpCenter, type HelpEntry } from './components/HelpCenter'
import { NextStepCard } from './components/NextStepCard'
import { PachinkoBoard } from './components/PachinkoBoard'
import { ProgramEditor } from './components/ProgramEditor'
import { ShopTree } from './components/ShopTree'
import { TaskModal } from './components/TaskModal'
import {
  formatText,
  getInitialLocale,
  getLocaleContent,
  LANGUAGE_STORAGE_KEY,
} from './content'
import {
  advanceProgramRun,
  applyTaskResult,
  createInitialGameState,
  dismissUnlockSpotlight,
  purchaseShopNode,
  setCurrentView,
  startCheckpoint,
  startProgramRun,
  updateHelperProgramSource,
  updateProgramSource,
} from './game/engine'
import { MAX_FOR_RANGE, MAX_STEPS_PER_RUN } from './game/program'
import { canOpenShop } from './game/shop'
import type {
  GameTask,
  GameState,
  Locale,
  LockedConstruct,
  ProgramValidation,
  ReferenceExampleItem,
  ReferenceValueItem,
  SupportUpgradeId,
  TaskTopicId,
  TopicDefinition,
  UiText,
} from './types'

type NextStepModel = {
  title: string
  body: string
  stageLabel: string
  progressText: string | null
  progressValue: number | null
  actionLabel: string | null
}

type HelpEntryId =
  | 'welcome'
  | 'unlock-variables'
  | 'unlock-conditions'
  | 'unlock-functions'
  | 'unlock-loops'

function getCurrentTopic(
  gameState: GameState,
  topics: TopicDefinition[],
): TopicDefinition | null {
  if (gameState.currentTopicId === null) {
    return null
  }

  return topics.find((topic) => topic.id === gameState.currentTopicId) ?? null
}

function getConstructLabel(construct: LockedConstruct, ui: UiText): string {
  switch (construct) {
    case 'for':
      return ui.constructForLabel
    case 'variables':
      return ui.constructVariablesLabel
    case 'if':
      return ui.constructIfLabel
    case 'functions':
      return ui.constructFunctionsLabel
    default:
      return ui.constructFunctionsLabel
  }
}

function getProgramValidationMessage(
  validation: ProgramValidation,
  ui: UiText,
): string | null {
  if (validation.isValid) {
    return null
  }

  const prioritizedIssue =
    validation.issues.find((issue) => issue.code === 'step_limit_exceeded') ??
    validation.issues.find((issue) => issue.code === 'helper_limit_exceeded') ??
    validation.issues.find((issue) => issue.code === 'duplicate_function') ??
    validation.issues.find((issue) => issue.code === 'helper_not_defined') ??
    validation.issues.find((issue) => issue.code === 'invalid_function_definition') ??
    validation.issues.find((issue) => issue.code === 'aim_range_limit') ??
    validation.issues.find((issue) => issue.code === 'invalid_set_aim') ??
    validation.issues.find((issue) => issue.code === 'continue_outside_loop') ??
    validation.issues.find((issue) => issue.code === 'invalid_condition') ??
    validation.issues.find((issue) => issue.code === 'invalid_expression') ??
    validation.issues.find((issue) => issue.code === 'locked_construct') ??
    validation.issues.find((issue) => issue.code === 'for_range_limit') ??
    validation.issues.find((issue) => issue.code === 'unsupported_for_loop') ??
    validation.issues.find((issue) => issue.code === 'for_body_required') ??
    validation.issues.find((issue) => issue.code === 'invalid_for_body') ??
    validation.issues.find((issue) => issue.code === 'unexpected_indentation') ??
    validation.issues.find((issue) => issue.code === 'invalid_command') ??
    validation.issues.find((issue) => issue.code === 'line_capacity_exceeded') ??
    validation.issues[0]

  switch (prioritizedIssue.code) {
    case 'empty_program':
      return ui.programErrorEmpty
    case 'line_capacity_exceeded':
      return formatText(ui.programErrorTooManyLines, {
        limit: String(prioritizedIssue.limit ?? 0),
      })
    case 'invalid_command':
      return formatText(ui.programErrorInvalidLine, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      })
    case 'locked_construct':
      return formatText(ui.programErrorLockedConstruct, {
        construct: getConstructLabel(
          prioritizedIssue.construct ?? 'functions',
          ui,
        ),
      })
    case 'unsupported_for_loop':
      return formatText(ui.programErrorUnsupportedForLoop, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      })
    case 'for_range_limit':
      return formatText(ui.programErrorForRangeLimit, {
        line: String(prioritizedIssue.lineNumber ?? 1),
        max: String(prioritizedIssue.maxRange ?? MAX_FOR_RANGE),
      })
    case 'for_body_required':
      return formatText(ui.programErrorForBodyRequired, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      })
    case 'invalid_for_body':
      return formatText(ui.programErrorInvalidForBody, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      })
    case 'unexpected_indentation':
      return formatText(ui.programErrorUnexpectedIndentation, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      })
    case 'step_limit_exceeded':
      return formatText(ui.programErrorStepLimitExceeded, {
        max: String(prioritizedIssue.maxSteps ?? MAX_STEPS_PER_RUN),
      })
    case 'invalid_expression':
      return formatText(ui.programErrorInvalidExpression, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      })
    case 'invalid_condition':
      return formatText(ui.programErrorInvalidCondition, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      })
    case 'invalid_set_aim':
      return formatText(ui.programErrorInvalidSetAim, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      })
    case 'continue_outside_loop':
      return ui.programErrorContinueOutsideLoop
        ? formatText(ui.programErrorContinueOutsideLoop, {
            line: String(prioritizedIssue.lineNumber ?? 1),
          })
        : `Line ${String(prioritizedIssue.lineNumber ?? 1)}: continue can only be used inside a for loop.`
    case 'aim_range_limit':
      return formatText(ui.programErrorAimRangeLimit, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      })
    case 'invalid_function_definition':
      return formatText(ui.programErrorInvalidFunctionDefinition, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      })
    case 'duplicate_function':
      return formatText(ui.programErrorDuplicateFunction, {
        line: String(prioritizedIssue.lineNumber ?? 1),
        name: prioritizedIssue.helperName ?? 'helper',
      })
    case 'helper_limit_exceeded':
      return formatText(ui.programErrorHelperLimitExceeded, {
        limit: String(prioritizedIssue.limit ?? 1),
      })
    case 'helper_line_limit_exceeded':
      return formatText(ui.programErrorHelperLineLimitExceeded, {
        limit: String(prioritizedIssue.limit ?? 6),
      })
    case 'helper_not_defined':
      return formatText(ui.programErrorHelperNotDefined, {
        line: String(prioritizedIssue.lineNumber ?? 1),
        name: prioritizedIssue.helperName ?? 'helper',
      })
    default:
      return ui.runBlockedInvalidProgram
  }
}

function getUnlockHelpEntryId(topicId: TaskTopicId): HelpEntryId {
  switch (topicId) {
    case 'variables':
      return 'unlock-variables'
    case 'conditions':
      return 'unlock-conditions'
    case 'functions':
      return 'unlock-functions'
    case 'loops':
      return 'unlock-loops'
    default:
      return 'unlock-variables'
  }
}

function buildNextStepModel(
  gameState: GameState,
  topics: TopicDefinition[],
  ui: UiText,
): NextStepModel {
  const currentTopic = getCurrentTopic(gameState, topics)
  const progressText =
    currentTopic !== null && gameState.topicMeterGoal > 0
      ? formatText(ui.nextStepProgressValue, {
          current: String(gameState.topicMeter),
          total: String(gameState.topicMeterGoal),
        })
      : null
  const progressValue =
    currentTopic !== null && gameState.topicMeterGoal > 0
      ? gameState.topicMeter / gameState.topicMeterGoal
      : null

  switch (gameState.topicStage) {
    case 'onboarding':
      return {
        title: ui.nextStepOnboardingTitle,
        body: ui.nextStepOnboardingBody,
        stageLabel: ui.nextStepStageOnboarding,
        progressText: null,
        progressValue: null,
        actionLabel: null,
      }
    case 'checkpoint_ready':
      return {
        title: currentTopic?.title ?? ui.nextStepCheckpointTitle,
        body: formatText(ui.nextStepCheckpointReadyBody, {
          topic: currentTopic?.title ?? ui.nextStepCheckpointTitle,
        }),
        stageLabel: ui.nextStepStageCheckpointReady,
        progressText,
        progressValue: 1,
        actionLabel: ui.currentGoalStartCheckpointButton,
      }
    case 'checkpoint_active':
      return {
        title: currentTopic?.title ?? ui.nextStepCheckpointTitle,
        body: formatText(ui.nextStepCheckpointActiveBody, {
          topic: currentTopic?.title ?? ui.nextStepCheckpointTitle,
        }),
        stageLabel: ui.nextStepStageCheckpointActive,
        progressText,
        progressValue: 1,
        actionLabel: null,
      }
    case 'completed':
      return {
        title: ui.nextStepCompletedTitle,
        body: ui.nextStepCompletedBody,
        stageLabel: ui.nextStepStageCompleted,
        progressText: null,
        progressValue: null,
        actionLabel: null,
      }
    case 'new_unlock_spotlight':
      return {
        title: currentTopic?.title ?? ui.nextStepLearningTitle,
        body: currentTopic?.nextActionText ?? ui.nextStepOnboardingBody,
        stageLabel: ui.nextStepStageUnlocked,
        progressText,
        progressValue,
        actionLabel: null,
      }
    case 'topic_active':
    default:
      return {
        title: currentTopic?.title ?? ui.nextStepLearningTitle,
        body: currentTopic?.nextActionText ?? ui.nextStepOnboardingBody,
        stageLabel: ui.nextStepStageLearning,
        progressText,
        progressValue,
        actionLabel: null,
      }
  }
}

function buildHelpCatalog(
  ui: UiText,
  topics: TopicDefinition[],
): Record<HelpEntryId, HelpEntry> {
  const topicById = new Map(topics.map((topic) => [topic.id, topic]))

  return {
    welcome: {
      id: 'welcome',
      title: ui.guideWelcomeTitle,
      body: ui.guideWelcomeBody,
      snippet: 'drop_ball()',
    },
    'unlock-variables': {
      id: 'unlock-variables',
      title: ui.guideVariablesUnlockTitle,
      body: ui.guideVariablesUnlockBody,
      snippet: topicById.get('variables')?.suggestedSnippet,
    },
    'unlock-conditions': {
      id: 'unlock-conditions',
      title: ui.guideConditionsUnlockTitle,
      body: ui.guideConditionsUnlockBody,
      snippet: topicById.get('conditions')?.suggestedSnippet,
    },
    'unlock-functions': {
      id: 'unlock-functions',
      title: ui.guideFunctionsUnlockTitle,
      body: ui.guideFunctionsUnlockBody,
      snippet: topicById.get('functions')?.suggestedSnippet,
    },
    'unlock-loops': {
      id: 'unlock-loops',
      title: ui.guideLoopsUnlockTitle,
      body: ui.guideLoopsUnlockBody,
      snippet: topicById.get('loops')?.suggestedSnippet,
    },
  }
}

function buildReferenceValues(
  gameState: GameState,
  ui: UiText,
): ReferenceValueItem[] {
  return [
    {
      id: 'lane_numbers',
      label: ui.referenceLaneNumbersLabel,
      description: ui.referenceLaneNumbersDescription,
    },
    ...(gameState.learnedTopicIds.includes('variables')
      ? [
          {
            id: 'portal_side',
            label: 'portal_side',
            description: ui.referencePortalSideDescription,
          },
        ]
      : []),
    ...(gameState.learnedTopicIds.includes('conditions')
      ? [
          {
            id: 'next_ball',
            label: 'next_ball',
            description: ui.referenceNextBallDescription,
          },
          {
            id: 'normal_ball',
            label: 'normal_ball',
            description: ui.referenceNormalBallDescription,
          },
          {
            id: 'lucky_ball',
            label: 'lucky_ball',
            description: ui.referenceLuckyBallDescription,
          },
          {
            id: 'evil_ball',
            label: 'evil_ball',
            description: ui.referenceEvilBallDescription,
          },
        ]
      : []),
  ]
}

function buildReferenceExamples(
  gameState: GameState,
  ui: UiText,
): ReferenceExampleItem[] {
  return [
    ...(gameState.learnedTopicIds.includes('variables')
      ? [
          {
            id: 'variables-example',
            label: ui.referenceExampleVariablesLabel,
            code: 'target = portal_side\nchoose_chute(target)\ndrop_ball()',
          },
        ]
      : []),
    ...(gameState.learnedTopicIds.includes('conditions')
      ? [
          {
            id: 'conditions-example',
            label: ui.referenceExampleConditionsLabel,
            code:
              'if next_ball == evil_ball:\n    skip_ball()\nelse:\n    choose_chute(portal_side)\n    drop_ball()',
          },
        ]
      : []),
    ...(gameState.learnedTopicIds.includes('functions')
      ? [
          {
            id: 'functions-example',
            label: ui.referenceExampleFunctionsLabel,
            code: 'follow_portal()',
          },
        ]
      : []),
    ...(gameState.learnedTopicIds.includes('loops')
      ? [
          {
            id: 'loops-example',
            label: ui.referenceExampleLoopsLabel,
            code:
              'for ball in range(3):\n    if next_ball == evil_ball:\n        skip_ball()\n        continue\n    follow_portal()',
          },
        ]
      : []),
  ]
}

function App() {
  const [locale, setLocale] = useState<Locale>(() => getInitialLocale())
  const [gameState, setGameState] = useState(() => createInitialGameState())
  const [animationNow, setAnimationNow] = useState(() => Date.now())
  const [selectedHelpEntryId, setSelectedHelpEntryId] =
    useState<HelpEntryId | null>(null)
  const [isHelpManuallyOpen, setIsHelpManuallyOpen] = useState(false)
  const [dismissedAutoHelpIds, setDismissedAutoHelpIds] = useState<HelpEntryId[]>(
    [],
  )

  const { ui, tasks, shopNodes, topics } = getLocaleContent(locale)
  const helpCatalog = buildHelpCatalog(ui, topics)
  const helpEntryIds: HelpEntryId[] = [
    'welcome',
    ...(gameState.learnedTopicIds.includes('variables')
      ? (['unlock-variables'] as const)
      : []),
    ...(gameState.learnedTopicIds.includes('conditions')
      ? (['unlock-conditions'] as const)
      : []),
    ...(gameState.learnedTopicIds.includes('functions')
      ? (['unlock-functions'] as const)
      : []),
    ...(gameState.learnedTopicIds.includes('loops')
      ? (['unlock-loops'] as const)
      : []),
  ]
  const forcedHelpEntryId: HelpEntryId | null =
    gameState.topicStage === 'onboarding'
      ? 'welcome'
      : gameState.currentTopicId !== null &&
          gameState.topicStage === 'new_unlock_spotlight'
        ? getUnlockHelpEntryId(gameState.currentTopicId)
        : null
  const showForcedHelp =
    forcedHelpEntryId !== null &&
    !dismissedAutoHelpIds.includes(forcedHelpEntryId)
  const activeHelpEntryId =
    showForcedHelp
      ? forcedHelpEntryId
      : selectedHelpEntryId ?? helpEntryIds[helpEntryIds.length - 1] ?? null
  const helpEntries = helpEntryIds
    .map((entryId) => helpCatalog[entryId])
    .filter((entry): entry is HelpEntry => entry !== undefined)
  const isHelpOpen = isHelpManuallyOpen || showForcedHelp
  const activeTask =
    gameState.activeTaskId === null
      ? null
      : tasks.find((task) => task.id === gameState.activeTaskId) ?? null
  const shopIsAvailable = canOpenShop(gameState)
  const functionsUnlocked =
    gameState.unlocks.unlockedConstructs.includes('functions')
  const validationMessage = getProgramValidationMessage(
    gameState.programValidation,
    ui,
  )
  const helperValidationMessage = getProgramValidationMessage(
    gameState.helperProgramValidation,
    ui,
  )
  const lineUsageText = formatText(ui.editorLineUsageValue, {
    used: String(gameState.programValidation.executableLineCount),
    limit: String(gameState.unlocks.lineCapacity),
  })
  const helperUsageText = formatText(ui.helperEditorLineUsageValue, {
    used: String(gameState.helperProgramValidation.executableLineCount),
    limit: String(gameState.unlocks.helperLineCapacity),
  })
  const isProgramReady =
    gameState.programValidation.isValid &&
    (!functionsUnlocked || gameState.helperProgramValidation.isValid)
  const editorHelperText = gameState.unlocks.editorEditable
    ? ui.editorUnlockedDescription
    : ui.editorLockedDescription
  const editorFeedbackMessage = validationMessage
    ? validationMessage
    : gameState.programValidation.executionStepCount === 0
      ? ui.programZeroStepMessage
      : formatText(ui.programReadyMessage, {
          count: String(gameState.programValidation.executionStepCount),
        })
  const helperFeedbackMessage = helperValidationMessage
    ? helperValidationMessage
    : functionsUnlocked
      ? ui.helperProgramReadyMessage
      : null
  const editorFeedbackTone = validationMessage
    ? 'error'
    : gameState.programValidation.executionStepCount === 0
      ? 'warning'
      : 'success'
  const helperFeedbackTone = helperValidationMessage ? 'error' : 'success'
  const availableFunctions = [
    'drop_ball()',
    ...(gameState.unlocks.allowedCommands.includes('choose_chute')
      ? ['choose_chute(2)']
      : []),
    ...(gameState.unlocks.allowedCommands.includes('skip_ball')
      ? ['skip_ball()']
      : []),
    ...(functionsUnlocked ? ['follow_portal()'] : []),
  ]
  const availableStructures = [
    ...(gameState.unlocks.unlockedConstructs.includes('variables')
      ? ['target = portal_side']
      : []),
    ...(gameState.unlocks.unlockedConstructs.includes('if')
      ? ['if next_ball == evil_ball:']
      : []),
    ...(functionsUnlocked ? ['def follow_portal():'] : []),
    ...(gameState.unlocks.unlockedConstructs.includes('for')
      ? ['for ball in range(3):', 'continue']
      : []),
  ]
  const referenceValues = buildReferenceValues(gameState, ui)
  const referenceExamples = buildReferenceExamples(gameState, ui)
  const nextStep = buildNextStepModel(gameState, topics, ui)
  const previewCount = gameState.supportUpgradeIds.includes('queue_peek') ? 3 : 1
  const upcomingBallPreview = gameState.learnedTopicIds.includes('conditions')
    ? gameState.ballQueue.slice(
        gameState.ballQueueCursor,
        gameState.ballQueueCursor + previewCount,
      )
    : []
  const checkpointTasks = tasks.filter(
    (task) =>
      activeTask !== null &&
      task.kind === activeTask.kind &&
      task.topicId === activeTask.topicId,
  )
  const currentTaskIndex =
    activeTask === null ? null : gameState.checkpointIndex + 1
  const currentTaskTotal =
    activeTask === null
      ? null
      : gameState.activeCheckpointTaskIds.length || checkpointTasks.length
  const taskProgressText =
    currentTaskIndex !== null && currentTaskTotal !== null
      ? formatText(ui.challengeProgressValue, {
          current: String(currentTaskIndex),
          total: String(currentTaskTotal),
        })
      : null

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale)
  }, [locale])

  useEffect(() => {
    if (!gameState.isRunning && gameState.activeBalls.length === 0) {
      return
    }

    const intervalId = window.setInterval(() => {
      setGameState((currentState) =>
        advanceProgramRun(currentState, tasks, topics),
      )
    }, 50)

    return () => window.clearInterval(intervalId)
  }, [gameState.isRunning, gameState.activeBalls.length, tasks, topics])

  useEffect(() => {
    if (gameState.activeBalls.length === 0) {
      return
    }

    const intervalId = window.setInterval(() => {
      setAnimationNow(Date.now())
    }, 16)

    return () => window.clearInterval(intervalId)
  }, [gameState.activeBalls.length])

  const handleRunProgram = () => {
    setGameState((currentState) => startProgramRun(currentState))
  }

  const handleTaskResolved = (wasCorrect: boolean, task: GameTask) => {
    setGameState((currentState) =>
      applyTaskResult(currentState, task, wasCorrect, tasks, topics),
    )
  }

  const handleProgramChange = (value: string) => {
    startTransition(() => {
      setGameState((currentState) => updateProgramSource(currentState, value))
    })
  }

  const handleHelperProgramChange = (value: string) => {
    startTransition(() => {
      setGameState((currentState) =>
        updateHelperProgramSource(currentState, value),
      )
    })
  }

  const handleChangeView = (view: 'play' | 'shop') => {
    setGameState((currentState) => setCurrentView(currentState, view))
  }

  const handlePurchaseNode = (nodeId: SupportUpgradeId) => {
    setGameState((currentState) => purchaseShopNode(currentState, nodeId))
  }

  const handleStartCheckpoint = () => {
    setGameState((currentState) => startCheckpoint(currentState))
  }

  const handleCloseHelp = () => {
    if (forcedHelpEntryId !== null) {
      setDismissedAutoHelpIds((currentIds) =>
        currentIds.includes(forcedHelpEntryId)
          ? currentIds
          : [...currentIds, forcedHelpEntryId],
      )
    }

    if (
      forcedHelpEntryId !== null &&
      gameState.currentTopicId !== null &&
      gameState.topicStage === 'new_unlock_spotlight'
    ) {
      setGameState((currentState) => dismissUnlockSpotlight(currentState))
    }

    setIsHelpManuallyOpen(false)
  }

  const handleToggleHelp = () => {
    if (isHelpOpen) {
      handleCloseHelp()
      return
    }

    setSelectedHelpEntryId(helpEntryIds[helpEntryIds.length - 1] ?? null)
    setIsHelpManuallyOpen(true)
  }

  const handleSelectHelpEntry = (entryId: string) => {
    setSelectedHelpEntryId(entryId as HelpEntryId)
  }

  return (
    <main className="app-shell">
      <section className="app-topbar">
        <div className="topbar-left">
          <p className="eyebrow">{ui.eyebrow}</p>
          <nav className="view-tabs" aria-label="Primary">
            <button
              className={`view-tab${gameState.currentView === 'play' ? ' active' : ''}`}
              onClick={() => handleChangeView('play')}
              type="button"
              disabled={gameState.isRunning}
            >
              {ui.playTabLabel}
            </button>
            <button
              className={`view-tab${gameState.currentView === 'shop' ? ' active' : ''}`}
              onClick={() => handleChangeView('shop')}
              type="button"
              disabled={gameState.isRunning || !shopIsAvailable}
            >
              {ui.shopTabLabel}
            </button>
          </nav>
          <div className="points-chip" aria-label={ui.pointsChipLabel}>
            <span className="points-chip-icon" aria-hidden="true" />
            <span>{ui.pointsChipLabel}</span>
            <strong>{gameState.score}</strong>
          </div>
        </div>

        <div className="language-switcher" aria-label={ui.languageLabel}>
          <span className="language-label">{ui.languageLabel}</span>
          <button
            className={`language-button${locale === 'et' ? ' active' : ''}`}
            onClick={() => setLocale('et')}
            type="button"
            aria-pressed={locale === 'et'}
          >
            {ui.estonianLabel}
          </button>
          <button
            className={`language-button${locale === 'en' ? ' active' : ''}`}
            onClick={() => setLocale('en')}
            type="button"
            aria-pressed={locale === 'en'}
          >
            {ui.englishLabel}
          </button>
        </div>
      </section>

      {gameState.currentView === 'play' ? (
        <section className="play-panel">
          <div className="editor-column">
            <ProgramEditor
              code={gameState.programSource}
              title={ui.editorTitle}
              variant="main"
              ui={ui}
              isEditable={gameState.unlocks.editorEditable && !gameState.isRunning}
              isUnlocked={gameState.unlocks.editorEditable}
              isHighlighted={false}
              activeLineNumber={gameState.activeLineNumber}
              lineUsageText={lineUsageText}
              helperText={editorHelperText}
              feedbackMessage={editorFeedbackMessage}
              feedbackTone={editorFeedbackTone}
              onChange={handleProgramChange}
            />

            {functionsUnlocked ? (
              <ProgramEditor
                code={gameState.helperProgramSource}
                title={ui.helperEditorTitle}
                variant="helper"
                ui={ui}
                isEditable={!gameState.isRunning}
                isUnlocked
                isHighlighted={false}
                activeLineNumber={null}
                lineUsageText={helperUsageText}
                helperText={ui.helperEditorUnlockedDescription}
                feedbackMessage={helperFeedbackMessage}
                feedbackTone={helperFeedbackTone}
                onChange={handleHelperProgramChange}
              />
            ) : null}

            <AvailableSyntaxCard
              ui={ui}
              functions={availableFunctions}
              structures={availableStructures}
              referenceValues={referenceValues}
              examples={referenceExamples}
            />
          </div>

          <div className="utility-column">
            <NextStepCard
              ui={ui}
              title={nextStep.title}
              body={nextStep.body}
              stageLabel={nextStep.stageLabel}
              progressText={nextStep.progressText}
              progressValue={nextStep.progressValue}
              actionLabel={nextStep.actionLabel}
              onAction={
                nextStep.actionLabel === null ? null : handleStartCheckpoint
              }
            />

            <aside className="controls">
              <p className="panel-kicker">{ui.runPanelTitle}</p>
              <button
                className="run-button"
                onClick={handleRunProgram}
                disabled={
                  activeTask !== null ||
                  gameState.isRunning ||
                  !isProgramReady ||
                  gameState.topicStage === 'checkpoint_ready'
                }
                type="button"
              >
                {gameState.isRunning ? ui.runButtonRunning : ui.runButton}
              </button>
            </aside>

            <PachinkoBoard
              ui={ui}
              activeBalls={gameState.activeBalls}
              portalSide={gameState.moduleStates.board.portalSide}
              learnedTopicIds={gameState.learnedTopicIds}
              upcomingBalls={upcomingBallPreview}
              portalChildCount={
                gameState.supportUpgradeIds.includes('portal_overcharge') ? 3 : 2
              }
              now={animationNow}
            />

            <ActivityFeed
              entries={gameState.feedEntries}
              tasks={tasks}
              shopNodes={shopNodes}
              topics={topics}
              ui={ui}
            />
          </div>
        </section>
      ) : (
        <ShopTree
          gameState={gameState}
          shopNodes={shopNodes}
          ui={ui}
          onPurchase={handlePurchaseNode}
        />
      )}

      <TaskModal
        key={activeTask?.id ?? 'no-task'}
        task={activeTask}
        ui={ui}
        progressText={taskProgressText}
        onResolved={handleTaskResolved}
      />

      <HelpCenter
        ui={ui}
        entries={helpEntries}
        activeEntryId={activeHelpEntryId}
        isOpen={isHelpOpen}
        hasUnread={false}
        onToggle={handleToggleHelp}
        onClose={handleCloseHelp}
        onSelect={handleSelectHelpEntry}
      />
    </main>
  )
}

export default App
