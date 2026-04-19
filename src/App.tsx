import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import './App.css'
import { AvailableSyntaxCard } from './components/AvailableSyntaxCard'
import { BoardInternalsPanel } from './components/BoardInternalsPanel'
import { CoachmarkBubble } from './components/CoachmarkBubble'
import { HelpCenter, type HelpEntry } from './components/HelpCenter'
import { IntroModal } from './components/IntroModal'
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
import { buildEditorCompletions } from './game/editorCompletions'
import {
  advanceProgramRun,
  applyTaskResult,
  dismissUnlockSpotlight,
  isBluePortalActive,
  jumpToDeveloperGoal,
  loadPersistedGameState,
  normalizeListsQueue,
  purchaseShopNode,
  resetProgress,
  savePersistedGameState,
  setCurrentView,
  setAutoRunEnabled,
  setSoundEnabled,
  spawnAmbientPlainBall,
  startCheckpoint,
  startProgramRun,
  updateHelperProgramSource,
  updateProgramSource,
  validateWriteTaskAnswer,
} from './game/engine'
import { MAX_FOR_RANGE, MAX_STEPS_PER_RUN } from './game/program'
import { canOpenShop, getSupportUpgradeEffects } from './game/shop'
import { usePrefersReducedMotion } from './useAccessibility'
import { useGameAudio } from './useGameAudio'
import type {
  BallType,
  GameTask,
  GameState,
  Locale,
  LockedConstruct,
  PracticeGoalDefinition,
  ProgramValidation,
  ReferenceExampleItem,
  ReferenceValueItem,
  SupportUpgradeId,
  TaskTopicId,
  TopicDefinition,
  UiText,
  UnlockPrimerCard,
} from './types'

type NextStepModel = {
  title: string
  body: string
  stageLabel: string
  progressText: string | null
  progressValue: number | null
  hintText: string | null
  actionLabel: string | null
  actionKind: 'checkpoint' | 'dismiss_unlock' | null
  primerCards: UnlockPrimerCard[]
}

type HelpEntryId =
  | 'welcome'
  | 'unlock-variables'
  | 'unlock-conditions'
  | 'unlock-functions'
  | 'unlock-loops'
  | 'unlock-lists'

type ProgressCopyStatus = 'copied' | 'manual' | null

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
    case 'lists':
      return ui.constructListsLabel
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
    validation.issues.find((issue) => issue.code === 'unknown_identifier') ??
    validation.issues.find((issue) => issue.code === 'invalid_condition') ??
    validation.issues.find((issue) => issue.code === 'invalid_index_access') ??
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
  const withHelperPrefix = (message: string) =>
    prioritizedIssue.source === 'helper'
      ? `${ui.helperEditorTitle}: ${message}`
      : message

  switch (prioritizedIssue.code) {
    case 'empty_program':
      return ui.programErrorEmpty
    case 'line_capacity_exceeded':
      return formatText(ui.programErrorTooManyLines, {
        limit: String(prioritizedIssue.limit ?? 0),
      })
    case 'invalid_command':
      return withHelperPrefix(formatText(ui.programErrorInvalidLine, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      }))
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
    case 'unknown_identifier':
      return withHelperPrefix(formatText(ui.programErrorUnknownIdentifier, {
        line: String(prioritizedIssue.lineNumber ?? 1),
        name: prioritizedIssue.identifierName ?? 'value',
      }))
    case 'invalid_expression':
      return withHelperPrefix(formatText(ui.programErrorInvalidExpression, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      }))
    case 'invalid_index_access':
      return withHelperPrefix(formatText(ui.programErrorInvalidIndexAccess, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      }))
    case 'invalid_condition':
      return withHelperPrefix(formatText(ui.programErrorInvalidCondition, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      }))
    case 'invalid_set_aim':
      return withHelperPrefix(formatText(ui.programErrorInvalidSetAim, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      }))
    case 'continue_outside_loop':
      return withHelperPrefix(ui.programErrorContinueOutsideLoop
        ? formatText(ui.programErrorContinueOutsideLoop, {
            line: String(prioritizedIssue.lineNumber ?? 1),
          })
        : `Line ${String(prioritizedIssue.lineNumber ?? 1)}: continue can only be used inside a for loop.`)
    case 'aim_range_limit':
      return withHelperPrefix(formatText(ui.programErrorAimRangeLimit, {
        line: String(prioritizedIssue.lineNumber ?? 1),
      }))
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

function getCurrentPracticeGoal(
  gameState: GameState,
  topics: TopicDefinition[],
): PracticeGoalDefinition | null {
  const currentTopic = getCurrentTopic(gameState, topics)

  if (currentTopic === null) {
    return null
  }

  return currentTopic.practiceGoals[gameState.topicMeter] ?? null
}

function getBallTypeConstant(ballType: BallType): string {
  switch (ballType) {
    case 'plain':
      return 'ball'
    case 'portal':
      return 'portal_ball'
    case 'negative':
      return 'negative_ball'
    case 'center':
    default:
      return 'center_ball'
  }
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value)
}

function formatBonusMapValue(values: number[]): string {
  return `[${values.map((value) => formatNumber(value)).join(', ')}]`
}

function formatSummaryList(values: readonly string[]): string {
  return values.length > 0 ? values.join(',') : 'none'
}

function buildProgressSummary(
  gameState: GameState,
  sessionStartedAt: number | null,
  copiedAt: number,
): string {
  const currentTopicId =
    gameState.currentTopicId ??
    (gameState.topicStage === 'onboarding' ? 'onboarding' : 'none')
  const goalProgress =
    gameState.currentTopicId !== null && gameState.topicMeterGoal > 0
      ? `${String(gameState.topicMeter)}/${String(gameState.topicMeterGoal)}`
      : 'none'
  const sessionDurationMinutes =
    sessionStartedAt === null
      ? 0
      : Math.max(0, Math.round((copiedAt - sessionStartedAt) / 60000))

  return [
    `current_topic_id=${currentTopicId}`,
    `topic_stage=${gameState.topicStage}`,
    `goal_progress=${goalProgress}`,
    `active_task_id=${gameState.activeTaskId ?? 'none'}`,
    `learned_topic_ids=${formatSummaryList(gameState.learnedTopicIds)}`,
    `mastered_topic_ids=${formatSummaryList(gameState.masteredTopicIds)}`,
    `solved_task_count=${String(gameState.solvedTaskIds.length)}`,
    `score=${String(gameState.score)}`,
    `resolved_drop_count=${String(gameState.resolvedDropCount)}`,
    `support_upgrade_ids=${formatSummaryList(gameState.supportUpgradeIds)}`,
    `current_view=${gameState.currentView}`,
    `session_duration_minutes=${String(sessionDurationMinutes)}`,
    `copied_at=${new Date(copiedAt).toISOString()}`,
  ].join('\n')
}

function sourceMentionsToken(source: string, token: string): boolean {
  const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escapedToken}\\b`).test(source)
}

function getZeroStepFeedbackMessage(
  gameState: GameState,
  ui: UiText,
): string | null {
  const combinedSource = `${gameState.programSource}\n${gameState.helperProgramSource}`
  const mentionsDrop = combinedSource.includes('drop_ball()')
  const mentionsSkip = combinedSource.includes('skip_ball()')

  if (!mentionsDrop && !mentionsSkip) {
    return ui.programZeroStepNeedActionMessage
  }

  if (!gameState.learnedTopicIds.includes('conditions')) {
    return ui.programZeroStepMessage
  }

  const nextBall = gameState.ballQueue[gameState.ballQueueCursor] ?? null

  if (nextBall === null || nextBall === 'plain') {
    return ui.programZeroStepMessage
  }

  if (
    nextBall === 'negative' &&
    mentionsSkip &&
    sourceMentionsToken(combinedSource, 'negative_ball')
  ) {
    return null
  }

  const mentionedBallTypes = (['negative', 'portal', 'center'] as const).filter(
    (ballType) => sourceMentionsToken(combinedSource, getBallTypeConstant(ballType)),
  )

  if (mentionedBallTypes.includes(nextBall)) {
    return ui.programZeroStepMessage
  }

  if (mentionedBallTypes.length === 1) {
    return formatText(ui.programZeroStepWrongBallMessage, {
      ball: getBallTypeConstant(nextBall),
      handled: getBallTypeConstant(mentionedBallTypes[0]),
    })
  }

  return formatText(ui.programZeroStepUnhandledBallMessage, {
    ball: getBallTypeConstant(nextBall),
  })
}

function buildBallReferenceValues(ui: UiText): ReferenceValueItem[] {
  return [
    {
      id: 'center_ball',
      label: 'center_ball',
      description: ui.referenceNormalBallDescription,
    },
    {
      id: 'portal_ball',
      label: 'portal_ball',
      description: ui.referenceLuckyBallDescription,
    },
    {
      id: 'negative_ball',
      label: 'negative_ball',
      description: ui.referenceEvilBallDescription,
    },
  ]
}

function getHelperNames(helperProgramSource: string): string[] {
  return [...helperProgramSource.matchAll(/^\s*def\s+([A-Za-z_]\w*)\s*\(\s*\)\s*:/gm)]
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined)
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function sourceUsesHelperCall(source: string, helperNames: string[]): boolean {
  return helperNames.some((name) =>
    new RegExp(`\\b${escapeRegex(name)}\\s*\\(`).test(source),
  )
}

function buildNextStepModel(
  gameState: GameState,
  topics: TopicDefinition[],
  tasks: GameTask[],
  ui: UiText,
): NextStepModel {
  const currentTopic = getCurrentTopic(gameState, topics)
  const currentGoal = getCurrentPracticeGoal(gameState, topics)
  const unlockPrimerCards = currentTopic?.unlockPrimerCards ?? []
  const onboardingTaskTotal = tasks.filter((task) => task.kind === 'onboarding').length
  const solvedOnboardingCount = tasks.filter(
    (task) => task.kind === 'onboarding' && gameState.solvedTaskIds.includes(task.id),
  ).length
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
        body:
          gameState.activeTaskId === null
            ? ui.nextStepOnboardingBody
            : solvedOnboardingCount === 0
              ? ui.nextStepOnboardingAfterRunBody
              : ui.nextStepOnboardingTaskBody,
        stageLabel: ui.nextStepStageOnboarding,
        progressText:
          onboardingTaskTotal > 0 && gameState.activeTaskId !== null
            ? formatText(ui.nextStepProgressValue, {
                current: String(solvedOnboardingCount),
                total: String(onboardingTaskTotal),
              })
            : null,
        progressValue:
          onboardingTaskTotal > 0 && gameState.activeTaskId !== null
            ? solvedOnboardingCount / onboardingTaskTotal
            : null,
        hintText: null,
        actionLabel: null,
        actionKind: null,
        primerCards: [],
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
        hintText: null,
        actionLabel: ui.currentGoalStartCheckpointButton,
        actionKind: 'checkpoint',
        primerCards: [],
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
        hintText: null,
        actionLabel: null,
        actionKind: null,
        primerCards: [],
      }
    case 'completed':
      return {
        title: ui.nextStepCompletedTitle,
        body: ui.nextStepCompleteBody,
        stageLabel: ui.nextStepStageCompleted,
        progressText: null,
        progressValue: null,
        hintText: null,
        actionLabel: null,
        actionKind: null,
        primerCards: [],
      }
    case 'new_unlock_spotlight':
      return {
        title: currentTopic?.title ?? ui.nextStepLearningTitle,
        body: currentTopic?.unlockSpotlightText ?? ui.nextStepUnlockBody,
        stageLabel: ui.nextStepStageUnlocked,
        progressText,
        progressValue,
        hintText: null,
        actionLabel: ui.currentGoalDismissSpotlightButton,
        actionKind: 'dismiss_unlock',
        primerCards: unlockPrimerCards,
      }
    case 'topic_active':
    default:
      return {
        title: currentGoal?.title ?? currentTopic?.title ?? ui.nextStepLearningTitle,
        body: currentGoal?.instruction ?? ui.nextStepOnboardingBody,
        stageLabel: ui.nextStepStageLearning,
        progressText,
        progressValue,
        hintText: currentGoal?.boardHint ?? null,
        actionLabel: null,
        actionKind: null,
        primerCards: currentGoal?.primerCards ?? [],
      }
  }
}

function buildHelpCatalog(
  ui: UiText,
  topics: TopicDefinition[],
): Record<HelpEntryId, HelpEntry> {
  const buildTopicEntry = (
    id: Exclude<HelpEntryId, 'welcome'>,
    topicId: TopicDefinition['id'],
  ): HelpEntry => {
    const topic = topics.find((candidate) => candidate.id === topicId)

    return {
      id,
      title: topic?.title ?? ui.nextStepLearningTitle,
      body: topic?.unlockSpotlightText ?? '',
      stageLabel: ui.nextStepStageUnlocked,
      primerCards: topic?.unlockPrimerCards ?? [],
    }
  }

  return {
    welcome: {
      id: 'welcome',
      title: ui.guideWelcomeTitle,
      body: ui.guideWelcomeBody,
      stageLabel: ui.nextStepStageOnboarding,
      primerCards: [],
    },
    'unlock-variables': buildTopicEntry('unlock-variables', 'variables'),
    'unlock-conditions': buildTopicEntry('unlock-conditions', 'conditions'),
    'unlock-functions': buildTopicEntry('unlock-functions', 'functions'),
    'unlock-loops': buildTopicEntry('unlock-loops', 'loops'),
    'unlock-lists': buildTopicEntry('unlock-lists', 'lists'),
  }
}

function buildReferenceValues(
  gameState: GameState,
  ui: UiText,
  topics: TopicDefinition[],
): ReferenceValueItem[] {
  const portalActive = isBluePortalActive(gameState)
  const variablesTopic = topics.find((topic) => topic.id === 'variables')
  const portalGoal = variablesTopic?.practiceGoals.find(
    (goal) => goal.id === 'variables-store-target',
  )
  const portalDescription =
    portalGoal?.instruction.split('\n\n')[0] ??
    ui.boardGateExplanationAdvanced ??
    ui.boardGateExplanation

  return [
    {
      id: 'lane_numbers',
      label: ui.referenceLaneNumbersLabel,
      description: ui.referenceLaneNumbersDescription,
    },
    ...(portalActive
      ? [
          {
            id: 'blue_portal',
            label: ui.boardActivePortalLabel,
            description: portalDescription,
          },
          {
            id: 'portal_side',
            label: 'portal_side',
            description: ui.referencePortalSideDescription,
            example: `portal_side = ${String(gameState.moduleStates.board.portalSide)}`,
          },
        ]
      : []),
    ...(gameState.learnedTopicIds.includes('conditions')
      ? [
          {
            id: 'next_ball',
            label: 'next_ball',
            description: ui.referenceNextBallDescription,
            example: `next_ball = ${getBallTypeConstant(
              gameState.ballQueue[gameState.ballQueueCursor] ?? 'plain',
            )}`,
          },
          ...buildBallReferenceValues(ui),
        ]
      : []),
    ...(gameState.learnedTopicIds.includes('lists')
      ? [
          {
            id: 'bonus_map',
            label: 'bonus_map',
            description: ui.referenceBonusMapDescription,
            example: formatText(ui.boardBonusMapCodeValue, {
              value: formatBonusMapValue(gameState.moduleStates.board.bonusMap),
            }),
          },
        ]
      : []),
  ]
}

function buildReferencePatterns(
  gameState: GameState,
  ui: UiText,
  helperProgramSource: string,
): ReferenceExampleItem[] {
  const portalActive = isBluePortalActive(gameState)
  const helperName = getHelperNames(helperProgramSource)[0] ?? 'follow_portal'

  return [
    ...(portalActive
      ? [
          {
            id: 'variables-example-store',
            label: ui.referenceExampleVariablesLabel,
            code: 'target = portal_side\nchoose_input(target)',
          },
          {
            id: 'variables-example-fixed',
            label: ui.referenceExampleVariablesLabel,
            code: 'target = 2\nchoose_input(target)\ndrop_ball()',
          },
        ]
      : []),
    ...(gameState.learnedTopicIds.includes('conditions')
      ? [
          {
            id: 'conditions-example-skip',
            label: ui.referenceExampleConditionsLabel,
            code: 'if next_ball == negative_ball:\n    skip_ball()',
          },
          {
            id: 'conditions-example-branch',
            label: ui.referenceExampleConditionsLabel,
            code: [
              'if next_ball == negative_ball:',
              '    skip_ball()',
              'elif next_ball == center_ball:',
              '    choose_input(2)',
              '    drop_ball()',
              'else:',
              '    choose_input(portal_side)',
              '    drop_ball()',
            ].join('\n'),
          },
        ]
      : []),
    ...(gameState.learnedTopicIds.includes('functions')
      ? [
          {
            id: 'functions-example-define',
            label: ui.referenceExampleFunctionsLabel,
            code: [
              `def ${helperName}():`,
              '    choose_input(portal_side)',
              '    drop_ball()',
            ].join('\n'),
          },
          {
            id: 'functions-example-call',
            label: ui.referenceExampleFunctionsLabel,
            code: [
              'if next_ball == portal_ball:',
              `    ${helperName}()`,
            ].join('\n'),
          },
        ]
      : []),
    ...(gameState.learnedTopicIds.includes('loops')
      ? [
          {
            id: 'loops-example-repeat',
            label: ui.referenceExampleLoopsLabel,
            code: 'for shot in range(3):\n    drop_ball()',
          },
          {
            id: 'loops-example-preview',
            label: ui.referenceExampleLoopsLabel,
            code: [
              'for shot in range(3):',
              '    if next_ball == negative_ball:',
              '        skip_ball()',
              '        continue',
              '    elif next_ball == center_ball:',
              '        choose_input(2)',
              '        drop_ball()',
              '    else:',
              '        follow_portal()',
            ].join('\n'),
          },
        ]
      : []),
    ...(gameState.learnedTopicIds.includes('lists')
      ? [
          {
            id: 'lists-example-index',
            label: ui.referenceExampleListsLabel,
            code: [
              'left_bonus = bonus_map[0]',
              'right_bonus = bonus_map[2]',
              'if right_bonus > left_bonus:',
              '    choose_input(3)',
              'else:',
              '    choose_input(1)',
              'drop_ball()',
            ].join('\n'),
          },
          {
            id: 'lists-example-search',
            label: ui.referenceExampleListsLabel,
            code: [
              'best_multiplier = bonus_map[0]',
              'best_index = 0',
              'index = 0',
              'for multiplier in bonus_map:',
              '    if multiplier > best_multiplier:',
              '        best_multiplier = multiplier',
              '        best_index = index',
              '    index = index + 1',
              'choose_input(best_index + 1)',
              'drop_ball()',
            ].join('\n'),
          },
        ]
      : []),
  ]
}

function App() {
  const initialLocale = getInitialLocale()
  const initialLocaleContent = getLocaleContent(initialLocale)
  const [locale, setLocale] = useState<Locale>(() => initialLocale)
  const [gameState, setGameState] = useState(() =>
    loadPersistedGameState(
      initialLocaleContent.topics,
      initialLocaleContent.tasks,
    ),
  )
  const [animationNow, setAnimationNow] = useState(() => Date.now())
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(() =>
    gameState.introDismissed ? Date.now() : null,
  )
  const [selectedHelpEntryId, setSelectedHelpEntryId] =
    useState<HelpEntryId | null>(null)
  const [isHelpManuallyOpen, setIsHelpManuallyOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [copyProgressStatus, setCopyProgressStatus] =
    useState<ProgressCopyStatus>(null)
  const [isDeveloperMenuOpen, setIsDeveloperMenuOpen] = useState(false)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(
    () => gameState.activeTaskId !== null,
  )
  const [isHelpCoachmarkDismissed, setIsHelpCoachmarkDismissed] = useState(false)
  const [isReferenceCoachmarkDismissed, setIsReferenceCoachmarkDismissed] =
    useState(false)
  const settingsRef = useRef<HTMLDivElement | null>(null)
  const helpButtonRef = useRef<HTMLButtonElement | null>(null)
  const referenceCardRef = useRef<HTMLElement | null>(null)
  const latestGameStateRef = useRef(gameState)
  const saveTimeoutRef = useRef<number | null>(null)
  const previousAudioSnapshotRef = useRef<{
    activeBallIds: number[]
    portalSplitCount: number
    score: number
    supportUpgradeCount: number
  } | null>(null)
  const prefersReducedMotion = usePrefersReducedMotion()
  const {
    play: playSound,
    unlock: unlockAudio,
    isReady: isAudioReady,
  } = useGameAudio(gameState.soundEnabled)

  const { ui, tasks, shopNodes, topics } = useMemo(
    () => getLocaleContent(locale),
    [locale],
  )
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
    ...(gameState.learnedTopicIds.includes('lists')
      ? (['unlock-lists'] as const)
      : []),
  ]
  const activeHelpEntryId =
    selectedHelpEntryId ?? helpEntryIds[helpEntryIds.length - 1] ?? null
  const helpEntries = helpEntryIds
    .map((entryId) => helpCatalog[entryId])
    .filter((entry): entry is HelpEntry => entry !== undefined)
  const isHelpOpen = isHelpManuallyOpen
  const activeTask =
    gameState.activeTaskId === null
      ? null
      : tasks.find((task) => task.id === gameState.activeTaskId) ?? null
  const copyProgressStatusMessage =
    copyProgressStatus === 'copied'
      ? ui.settingsCopyProgressCopied
      : copyProgressStatus === 'manual'
        ? ui.settingsCopyProgressManual
        : null
  const activeTaskId = activeTask?.id ?? null
  const canShowSupportCoachmarks =
    gameState.introDismissed &&
    gameState.currentView === 'play' &&
    gameState.learnedTopicIds.includes('variables') &&
    gameState.topicStage !== 'new_unlock_spotlight' &&
    activeTask === null &&
    !isHelpOpen &&
    !isSettingsOpen
  const showHelpCoachmark =
    canShowSupportCoachmarks && !isHelpCoachmarkDismissed
  const showReferenceCoachmark =
    canShowSupportCoachmarks &&
    isHelpCoachmarkDismissed &&
    !isReferenceCoachmarkDismissed
  const shopIsAvailable = canOpenShop(gameState)
  const supportEffects = getSupportUpgradeEffects(gameState.supportUpgradeIds)
  const functionsUnlocked =
    gameState.unlocks.unlockedConstructs.includes('functions')
  const isSpotlight = gameState.topicStage === 'new_unlock_spotlight'
  const helperNames = getHelperNames(gameState.helperProgramSource)
  const mainUsesHelperCall = sourceUsesHelperCall(
    gameState.programSource,
    helperNames,
  )
  const helperFunctionCalls =
    functionsUnlocked && helperNames.length > 0
      ? helperNames.map((name) => `${name}()`)
      : functionsUnlocked
        ? ['follow_portal()']
        : []
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
  const isHelperOptional =
    gameState.currentTopicId === 'lists' && !mainUsesHelperCall
  const isProgramReady =
    gameState.programValidation.isValid &&
    (!functionsUnlocked ||
      isHelperOptional ||
      gameState.helperProgramValidation.isValid)
  const editorHelperText = !gameState.unlocks.editorEditable
    ? ui.editorLockedDescription
    : isSpotlight
      ? ui.editorSpotlightDescription
      : null
  const helperHelperText = isSpotlight
    ? ui.helperEditorSpotlightDescription
    : gameState.currentTopicId === 'lists'
      ? ui.helperEditorOptionalDescription
      : null
  const editorFeedbackMessage = isSpotlight
    ? null
    : validationMessage
      ? validationMessage
    : gameState.goalChangeNoticeTarget === 'main'
      ? ui.goalEditRequiredMainMessage
    : gameState.programValidation.executionStepCount === 0
      ? getZeroStepFeedbackMessage(gameState, ui)
      : null
  const helperFeedbackMessage = isSpotlight
    ? null
    : helperValidationMessage && !isHelperOptional
      ? helperValidationMessage
    : gameState.goalChangeNoticeTarget === 'helper'
      ? ui.goalEditRequiredHelperMessage
      : null
  const editorFeedbackTone = validationMessage
    ? 'error'
    : gameState.goalChangeNoticeTarget === 'main'
      ? 'warning'
    : gameState.programValidation.executionStepCount === 0
      ? 'warning'
      : 'success'
  const helperFeedbackTone =
    helperValidationMessage && !isHelperOptional
      ? 'error'
    : gameState.goalChangeNoticeTarget === 'helper'
        ? 'warning'
        : 'success'
  const availableFunctions = [
    'drop_ball()',
    ...(gameState.unlocks.allowedCommands.includes('choose_input')
      ? ['choose_input(2)']
      : []),
    ...(gameState.unlocks.allowedCommands.includes('skip_ball')
      ? ['skip_ball()']
      : []),
    ...helperFunctionCalls,
  ]
  const portalActive = isBluePortalActive(gameState)
  const availableStructures = [
    ...(gameState.unlocks.unlockedConstructs.includes('variables') && portalActive
      ? ['target = portal_side']
      : []),
    ...(gameState.unlocks.unlockedConstructs.includes('if')
      ? [
          'if next_ball == negative_ball:',
          'elif next_ball == center_ball:',
          'else:',
        ]
      : []),
    ...(functionsUnlocked
      ? [`def ${helperNames[0] ?? 'follow_portal'}():`]
      : []),
    ...(gameState.unlocks.unlockedConstructs.includes('for')
      ? ['for ball in range(3):', 'continue']
      : []),
    ...(gameState.unlocks.unlockedConstructs.includes('lists')
      ? ['best_multiplier = bonus_map[0]', 'for multiplier in bonus_map:']
      : []),
  ]
  const referenceValues = buildReferenceValues(gameState, ui, topics)
  const referencePatterns = buildReferencePatterns(
    gameState,
    ui,
    gameState.helperProgramSource,
  )
  const mainEditorCompletions = buildEditorCompletions({
    variant: 'main',
    availableFunctions,
    availableStructures: availableStructures.filter(
      (entry) => !entry.startsWith('def '),
    ),
    referenceValues,
    helperProgramSource: gameState.helperProgramSource,
  })
  const helperEditorCompletions = buildEditorCompletions({
    variant: 'helper',
    availableFunctions,
    availableStructures,
    referenceValues,
    helperProgramSource: gameState.helperProgramSource,
  })
  const nextStep = buildNextStepModel(gameState, topics, tasks, ui)
  const previewCount = Math.max(
    supportEffects.previewCount,
    gameState.activeScenario?.visiblePreviewCount ?? 0,
  )
  const upcomingBallPreview =
    gameState.learnedTopicIds.includes('conditions')
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
    activeTask === null
      ? null
      : activeTask.kind === 'onboarding'
        ? activeTask.taskOrder
        : gameState.checkpointIndex + 1
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
    setIsTaskModalOpen(activeTaskId !== null)
  }, [activeTaskId])

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale)
  }, [locale])

  useEffect(() => {
    latestGameStateRef.current = gameState
  }, [gameState])

  useEffect(() => {
    if (
      gameState.currentTopicId !== 'lists' ||
      gameState.isRunning ||
      !gameState.ballQueue.some((ballType) => ballType === 'plain')
    ) {
      return
    }

    setGameState((currentState) => normalizeListsQueue(currentState))
  }, [gameState.ballQueue, gameState.currentTopicId, gameState.isRunning])

  useEffect(() => {
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      savePersistedGameState(gameState)
      saveTimeoutRef.current = null
    }, 250)

    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
    }
  }, [gameState])

  useEffect(() => {
    const flushSave = () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }

      savePersistedGameState(latestGameStateRef.current)
    }

    window.addEventListener('pagehide', flushSave)

    return () => {
      window.removeEventListener('pagehide', flushSave)
      flushSave()
    }
  }, [])

  useEffect(() => {
    if (
      supportEffects.ambientDropIntervalMs === null ||
      gameState.currentView !== 'play' ||
      gameState.topicStage !== 'completed' ||
      gameState.activeTaskId !== null ||
      gameState.isRunning ||
      gameState.activeBalls.length > 0 ||
      !gameState.introDismissed
    ) {
      return
    }

    const intervalId = window.setInterval(() => {
      setGameState((currentState) => spawnAmbientPlainBall(currentState))
    }, supportEffects.ambientDropIntervalMs)

    return () => window.clearInterval(intervalId)
  }, [
    gameState.activeBalls.length,
    gameState.activeTaskId,
    gameState.currentView,
    gameState.introDismissed,
    gameState.isRunning,
    gameState.topicStage,
    supportEffects.ambientDropIntervalMs,
  ])

  useEffect(() => {
    if (!isSettingsOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        settingsRef.current !== null &&
        event.target instanceof Node &&
        !settingsRef.current.contains(event.target)
      ) {
        setIsSettingsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSettingsOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isSettingsOpen])

  useEffect(() => {
    if (!isSettingsOpen) {
      setCopyProgressStatus(null)
    }
  }, [isSettingsOpen])

  useEffect(() => {
    const handleDeveloperKeyDown = (event: KeyboardEvent) => {
      if (
        event.ctrlKey &&
        event.altKey &&
        event.shiftKey &&
        event.key.toLowerCase() === 'd'
      ) {
        event.preventDefault()
        setIsHelpManuallyOpen(false)
        setIsSettingsOpen(false)
        setIsDeveloperMenuOpen((current) => !current)
        return
      }

      if (event.key === 'Escape') {
        setIsDeveloperMenuOpen(false)
      }
    }

    window.addEventListener('keydown', handleDeveloperKeyDown)

    return () => window.removeEventListener('keydown', handleDeveloperKeyDown)
  }, [])

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

  useEffect(() => {
    if (!gameState.soundEnabled || isAudioReady) {
      return
    }

    const handleGestureUnlock = () => {
      unlockAudio()
    }

    window.addEventListener('pointerdown', handleGestureUnlock)
    window.addEventListener('keydown', handleGestureUnlock)

    return () => {
      window.removeEventListener('pointerdown', handleGestureUnlock)
      window.removeEventListener('keydown', handleGestureUnlock)
    }
  }, [gameState.soundEnabled, isAudioReady, unlockAudio])

  useEffect(() => {
    const snapshot = {
      activeBallIds: gameState.activeBalls.map((ball) => ball.id),
      portalSplitCount: gameState.currentRunStats?.portalSplitCount ?? 0,
      score: gameState.score,
      supportUpgradeCount: gameState.supportUpgradeIds.length,
    }
    const previousSnapshot = previousAudioSnapshotRef.current

    if (previousSnapshot !== null) {
      const previousBallIds = new Set(previousSnapshot.activeBallIds)
      const hasNewLaunch = gameState.activeBalls.some(
        (ball) =>
          !previousBallIds.has(ball.id) &&
          ball.spawnKind === 'direct' &&
          ball.source !== 'ambient',
      )
      const boughtUpgrade =
        snapshot.supportUpgradeCount > previousSnapshot.supportUpgradeCount
      const gainedPoints =
        snapshot.score > previousSnapshot.score && gameState.lastPoints > 0
      const lostPoints =
        snapshot.score < previousSnapshot.score && gameState.lastPoints < 0
      const triggeredPortal =
        snapshot.portalSplitCount > previousSnapshot.portalSplitCount

      if (hasNewLaunch) {
        playSound('launch')
      }

      if (triggeredPortal) {
        playSound('portal')
      }

      if (boughtUpgrade) {
        playSound('shop')
      } else if (gainedPoints) {
        playSound('score')
      } else if (lostPoints) {
        playSound('penalty')
      }
    }

    previousAudioSnapshotRef.current = snapshot
  }, [
    playSound,
    gameState.activeBalls,
    gameState.currentRunStats?.portalSplitCount,
    gameState.lastPoints,
    gameState.score,
    gameState.supportUpgradeIds.length,
  ])

  useEffect(() => {
    if (
      !gameState.autoRunUnlocked ||
      !gameState.autoRunEnabled ||
      gameState.currentView !== 'play' ||
      gameState.isRunning ||
      activeTask !== null ||
      !isProgramReady ||
      gameState.topicStage === 'new_unlock_spotlight' ||
      gameState.topicStage === 'checkpoint_ready' ||
      gameState.topicStage === 'checkpoint_active' ||
      !gameState.introDismissed
    ) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setGameState((currentState) => startProgramRun(currentState))
    }, 1600)

    return () => window.clearTimeout(timeoutId)
  }, [
    activeTask,
    gameState.autoRunEnabled,
    gameState.autoRunUnlocked,
    gameState.currentView,
    gameState.introDismissed,
    gameState.isRunning,
    gameState.programSource,
    gameState.helperProgramSource,
    gameState.topicStage,
    isProgramReady,
  ])

  const handleRunProgram = () => {
    unlockAudio()
    setGameState((currentState) => startProgramRun(currentState))
  }

  const handleTaskResolved = (wasCorrect: boolean, task: GameTask) => {
    setGameState((currentState) =>
      applyTaskResult(currentState, task, wasCorrect, tasks, topics),
    )
  }

  const handleTaskEvaluated = (wasCorrect: boolean) => {
    unlockAudio()
    playSound(wasCorrect ? 'task_success' : 'task_failure')
  }

  const handleProgramChange = useCallback((value: string) => {
    startTransition(() => {
      setGameState((currentState) => updateProgramSource(currentState, value))
    })
  }, [])

  const handleHelperProgramChange = useCallback((value: string) => {
    startTransition(() => {
      setGameState((currentState) =>
        updateHelperProgramSource(currentState, value),
      )
    })
  }, [])

  const handleChangeView = (view: 'play' | 'shop') => {
    setGameState((currentState) => setCurrentView(currentState, view))
  }

  const handleSetLocale = (nextLocale: Locale) => {
    setLocale(nextLocale)
  }

  const handleToggleSettings = () => {
    setIsHelpManuallyOpen(false)
    setIsSettingsOpen((current) => !current)
  }

  const handleDeveloperJump = (topicId: TaskTopicId, goalIndex: number) => {
    setGameState((currentState) =>
      jumpToDeveloperGoal(currentState, topicId, goalIndex, topics),
    )
    setSessionStartedAt(Date.now())
    setIsHelpManuallyOpen(false)
    setIsSettingsOpen(false)
    setIsDeveloperMenuOpen(false)
  }

  const handleCopyProgressSummary = async () => {
    const copiedAt = Date.now()
    const summary = buildProgressSummary(gameState, sessionStartedAt, copiedAt)

    try {
      if (
        typeof navigator === 'undefined' ||
        navigator.clipboard === undefined ||
        typeof navigator.clipboard.writeText !== 'function'
      ) {
        throw new Error('clipboard unavailable')
      }

      await navigator.clipboard.writeText(summary)
      setCopyProgressStatus('copied')
    } catch {
      window.prompt(ui.settingsCopyProgressManualPrompt, summary)
      setCopyProgressStatus('manual')
    }
  }

  const handlePurchaseNode = (nodeId: SupportUpgradeId) => {
    unlockAudio()
    setGameState((currentState) => purchaseShopNode(currentState, nodeId))
  }

  const handleToggleAutoRun = () => {
    setGameState((currentState) =>
      setAutoRunEnabled(currentState, !currentState.autoRunEnabled),
    )
  }

  const handleStartCheckpoint = () => {
    setGameState((currentState) => startCheckpoint(currentState))
  }

  const handleCloseTaskModal = () => {
    setIsTaskModalOpen(false)
  }

  const handleResumeTaskModal = () => {
    setIsTaskModalOpen(true)
  }

  const handleCloseHelp = () => {
    setIsHelpManuallyOpen(false)
  }

  const handleToggleHelp = () => {
    setIsSettingsOpen(false)
    setIsHelpCoachmarkDismissed(true)

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

  const handleDismissIntro = () => {
    setSessionStartedAt((current) => current ?? Date.now())
    setGameState((currentState) => ({
      ...currentState,
      introDismissed: true,
    }))
  }

  const handleDismissSpotlight = () => {
    setGameState((currentState) => dismissUnlockSpotlight(currentState))
  }

  const handleToggleSound = () => {
    if (!gameState.soundEnabled) {
      unlockAudio()
    }

    setGameState((currentState) =>
      setSoundEnabled(currentState, !currentState.soundEnabled),
    )
  }

  const handleResetProgress = () => {
    if (gameState.isRunning || !window.confirm(ui.settingsResetProgressConfirm)) {
      return
    }

    setGameState((currentState) => resetProgress(currentState))
    setSessionStartedAt(null)
    setIsHelpManuallyOpen(false)
    setSelectedHelpEntryId(null)
    setIsSettingsOpen(false)
    setCopyProgressStatus(null)
    setIsHelpCoachmarkDismissed(false)
    setIsReferenceCoachmarkDismissed(false)
  }

  const handleValidateWriteAnswer = (task: GameTask, answer: string) => {
    const result = validateWriteTaskAnswer(task, answer)
    const validationDetail =
      result.validation !== null
        ? (getProgramValidationMessage(result.validation, ui) ?? ui.taskValidationNeedsRun)
        : undefined
    const feedbackDetail =
      result.feedback !== undefined
        ? formatText(ui[result.feedback.key], result.feedback.values ?? {})
        : undefined
    const detail = feedbackDetail ?? validationDetail

    return {
      ...result,
      feedbackMessage:
        detail === undefined
          ? undefined
          : result.failedCaseTitle !== undefined
            ? formatText(ui.taskValidationCaseFailure, {
                case: result.failedCaseTitle,
                detail,
              })
            : detail,
    }
  }

  const nextStepAction =
    activeTask !== null && !isTaskModalOpen
      ? handleResumeTaskModal
      : nextStep.actionKind === 'checkpoint'
        ? handleStartCheckpoint
        : nextStep.actionKind === 'dismiss_unlock'
          ? handleDismissSpotlight
          : null
  const nextStepActionLabel =
    activeTask !== null && !isTaskModalOpen
      ? ui.taskResumeButton
      : nextStep.actionLabel

  return (
    <main className="app-shell">
      <section className="app-topbar">
        <div className="topbar-left">
          <div className="topbar-primary-cluster">
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
          </div>
          <div
            className={`points-chip${
              gameState.topicStage !== 'completed' ? ' points-chip-secondary' : ''
            }`}
            aria-label={ui.pointsChipLabel}
          >
            <span className="points-chip-icon" aria-hidden="true" />
            <span className="points-chip-label">{ui.pointsChipLabel}</span>
            <strong className="points-chip-value">{gameState.score}</strong>
          </div>
        </div>

        <div className="topbar-right" ref={settingsRef}>
          <a
            className="settings-button feedback-link"
            href="https://forms.gle/fVkM43kZryFyQSsY7"
            target="_blank"
            rel="noreferrer"
          >
            {ui.feedbackButtonLabel}
          </a>

          <div className="topbar-utility-cluster">
            <HelpCenter
              ui={ui}
              entries={helpEntries}
              activeEntryId={activeHelpEntryId}
              isOpen={isHelpOpen}
              hasUnread={false}
              onToggle={handleToggleHelp}
              onClose={handleCloseHelp}
              onSelect={handleSelectHelpEntry}
              buttonRef={helpButtonRef}
              isHighlighted={showHelpCoachmark}
            />

            <button
              className={`settings-button settings-trigger${isSettingsOpen ? ' active' : ''}`}
              onClick={handleToggleSettings}
              type="button"
              aria-expanded={isSettingsOpen}
              aria-haspopup="dialog"
            >
              {ui.settingsButtonLabel}
            </button>
          </div>

          {isSettingsOpen ? (
            <section className="settings-panel" aria-labelledby="settings-panel-title">
              <div className="settings-header">
                <h2 className="settings-title" id="settings-panel-title">
                  {ui.settingsTitle}
                </h2>
              </div>

              <div className="settings-section settings-section-progress">
                <span className="settings-section-label">{ui.settingsLanguageLabel}</span>
                <div className="language-switcher" aria-label={ui.settingsLanguageLabel}>
                  <button
                    className={`language-button${locale === 'et' ? ' active' : ''}`}
                    onClick={() => handleSetLocale('et')}
                    type="button"
                    aria-pressed={locale === 'et'}
                  >
                    {ui.estonianLabel}
                  </button>
                  <button
                    className={`language-button${locale === 'en' ? ' active' : ''}`}
                    onClick={() => handleSetLocale('en')}
                    type="button"
                    aria-pressed={locale === 'en'}
                  >
                    {ui.englishLabel}
                  </button>
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-row">
                  <span className="settings-section-label">{ui.settingsSoundLabel}</span>
                  <button
                    className={`settings-toggle${gameState.soundEnabled ? ' active' : ''}`}
                    onClick={handleToggleSound}
                    type="button"
                    aria-pressed={gameState.soundEnabled}
                  >
                    <span>{ui.settingsSoundLabel}</span>
                    <strong>
                      {gameState.soundEnabled
                        ? ui.settingsSoundOn
                        : ui.settingsSoundOff}
                    </strong>
                  </button>
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-row">
                  <span className="settings-section-label">{ui.settingsProgressLabel}</span>
                  <div className="settings-actions">
                    <button
                      className="ghost-button settings-copy-progress"
                      onClick={handleCopyProgressSummary}
                      type="button"
                    >
                      {ui.settingsCopyProgressButton}
                    </button>
                    <button
                      className="ghost-button settings-reset"
                      onClick={handleResetProgress}
                      type="button"
                      disabled={gameState.isRunning}
                    >
                      {ui.settingsResetProgressButton}
                    </button>
                  </div>
                </div>
                <p className="settings-progress-note">
                  {ui.settingsCopyProgressDescription}
                </p>
                {copyProgressStatusMessage !== null ? (
                  <p className="settings-progress-status" aria-live="polite">
                    {copyProgressStatusMessage}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>
      </section>

      {isDeveloperMenuOpen ? (
        <div
          className="modal-backdrop developer-menu-backdrop"
          onMouseDown={() => setIsDeveloperMenuOpen(false)}
          role="presentation"
        >
          <section
            className="modal-card developer-menu"
            aria-labelledby="developer-menu-title"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="developer-menu-header">
              <div>
                <p className="panel-kicker">Developer</p>
                <h2 id="developer-menu-title">Jump To Goal</h2>
                <p className="developer-menu-note">
                  Press Ctrl+Alt+Shift+D to reopen this menu.
                </p>
              </div>
              <button
                className="task-close-button"
                onClick={() => setIsDeveloperMenuOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="developer-menu-grid">
              {topics.map((topic) => (
                <article className="developer-topic-card" key={topic.id}>
                  <p className="panel-kicker">{topic.id}</p>
                  <h3>{topic.title}</h3>
                  <div className="developer-goal-list">
                    {topic.practiceGoals.map((goal, goalIndex) => (
                      <button
                        className="ghost-button developer-goal-button"
                        key={`${topic.id}-${goal.id}`}
                        onClick={() => handleDeveloperJump(topic.id, goalIndex)}
                        type="button"
                      >
                        <span>{`Goal ${String(goalIndex + 1)}`}</span>
                        <strong>{goal.title}</strong>
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {gameState.currentView === 'play' ? (
        <section className="play-layout">
          <div className="workspace-grid">
            <div className="editor-column">
              <NextStepCard
                key={`${nextStep.stageLabel}-${nextStep.title}-${nextStep.body}`}
                ui={ui}
                title={nextStep.title}
                body={nextStep.body}
                stageLabel={nextStep.stageLabel}
                progressText={nextStep.progressText}
                progressValue={nextStep.progressValue}
                hintText={nextStep.hintText}
                primerCards={nextStep.primerCards}
                actionLabel={nextStepActionLabel}
                onAction={nextStepAction}
                highlightAction={
                  nextStep.actionKind === 'checkpoint' ||
                  (activeTask !== null && !isTaskModalOpen)
                }
              />

              <ProgramEditor
                code={gameState.programSource}
                title={ui.editorTitle}
                variant="main"
                ui={ui}
                status={
                  !gameState.unlocks.editorEditable
                    ? 'locked'
                    : isSpotlight
                      ? 'read-only'
                      : 'editable'
                }
                isEditable={
                  gameState.unlocks.editorEditable &&
                  !gameState.isRunning &&
                  !isSpotlight
                }
                isHighlighted={false}
                activeLineNumber={gameState.activeLineNumber}
                lineUsageText={lineUsageText}
                helperText={editorHelperText}
                feedbackMessage={editorFeedbackMessage}
                feedbackTone={editorFeedbackTone}
                completions={mainEditorCompletions}
                onChange={handleProgramChange}
              />

              {functionsUnlocked ? (
                <ProgramEditor
                  code={gameState.helperProgramSource}
                  title={ui.helperEditorTitle}
                  variant="helper"
                  ui={ui}
                  status={isSpotlight ? 'read-only' : 'editable'}
                  isEditable={!gameState.isRunning && !isSpotlight}
                  isHighlighted={false}
                  activeLineNumber={null}
                  lineUsageText={helperUsageText}
                  helperText={helperHelperText}
                  feedbackMessage={helperFeedbackMessage}
                  feedbackTone={helperFeedbackTone}
                  completions={helperEditorCompletions}
                  onChange={handleHelperProgramChange}
                />
              ) : null}
              <aside className="editor-toolbar">
                <div className="editor-toolbar-main">
                  <p className="panel-kicker">{ui.runPanelTitle}</p>
                  {gameState.autoRunUnlocked ? (
                    <button
                      className={`auto-run-toggle${
                        gameState.autoRunEnabled ? ' active' : ''
                      }`}
                      onClick={handleToggleAutoRun}
                      type="button"
                    >
                      <span>{ui.autoRunLabel}</span>
                      <strong>
                        {gameState.autoRunEnabled ? ui.autoRunOn : ui.autoRunOff}
                      </strong>
                    </button>
                  ) : null}
                </div>

                <div className="editor-toolbar-actions">
                  {isSpotlight ? (
                    <p className="run-summary">{ui.runPanelSpotlightMessage}</p>
                  ) : null}
                  <button
                    className="run-button compact"
                    onClick={handleRunProgram}
                  disabled={
                    activeTask !== null ||
                    gameState.isRunning ||
                    !isProgramReady ||
                    isSpotlight
                  }
                    type="button"
                  >
                    {gameState.isRunning ? ui.runButtonRunning : ui.runButton}
                  </button>
                </div>
              </aside>
            </div>

            <div className="board-column">
              <PachinkoBoard
                ui={ui}
                activeBalls={gameState.activeBalls}
                portalSide={gameState.moduleStates.board.portalSide}
                portalActive={portalActive}
                extraPortalChildren={supportEffects.extraPortalChildren}
                bonusMap={
                  gameState.learnedTopicIds.includes('lists')
                    ? gameState.moduleStates.board.bonusMap
                    : null
                }
                now={animationNow}
                reducedMotion={prefersReducedMotion}
              />

              <BoardInternalsPanel
                ui={ui}
                portalActive={portalActive}
                portalSide={gameState.moduleStates.board.portalSide}
                upcomingBalls={upcomingBallPreview}
                scenarioPreviewCount={gameState.activeScenario?.visiblePreviewCount ?? null}
                bonusMap={
                  gameState.learnedTopicIds.includes('lists')
                    ? gameState.moduleStates.board.bonusMap
                    : null
                }
              />

                <AvailableSyntaxCard
                  ui={ui}
                  functions={availableFunctions}
                  structures={availableStructures}
                  referenceValues={referenceValues}
                  patterns={referencePatterns}
                  containerRef={referenceCardRef}
                  isHighlighted={showReferenceCoachmark}
                />
              </div>
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

      <IntroModal
        ui={ui}
        isOpen={!gameState.introDismissed}
        onStart={handleDismissIntro}
      />

      <TaskModal
        key={activeTaskId ?? 'no-task'}
        task={activeTask}
        isOpen={isTaskModalOpen}
        ui={ui}
        progressText={taskProgressText}
        onResolved={handleTaskResolved}
        onClose={handleCloseTaskModal}
        onEvaluated={handleTaskEvaluated}
        validateWriteAnswer={handleValidateWriteAnswer}
        getValidationMessage={(validation) =>
          getProgramValidationMessage(validation, ui)
        }
      />

      {showHelpCoachmark ? (
        <CoachmarkBubble
          targetRef={helpButtonRef}
          message={ui.helpCoachmarkBody}
          dismissLabel={ui.coachmarkDismissButton}
          onDismiss={() => setIsHelpCoachmarkDismissed(true)}
          placement="below-end"
        />
      ) : null}

      {showReferenceCoachmark ? (
        <CoachmarkBubble
          targetRef={referenceCardRef}
          message={ui.referenceCoachmarkBody}
          dismissLabel={ui.coachmarkDismissButton}
          onDismiss={() => setIsReferenceCoachmarkDismissed(true)}
          placement="above-end"
        />
      ) : null}
    </main>
  )
}

export default App
