export type Locale = 'et' | 'en'

export type TaskTopicId = 'variables' | 'conditions' | 'functions' | 'loops'

export type TopicStage =
  | 'onboarding'
  | 'topic_active'
  | 'checkpoint_ready'
  | 'checkpoint_active'
  | 'new_unlock_spotlight'
  | 'completed'

export type AllowedCommand = 'drop_ball' | 'choose_chute' | 'skip_ball'

export type GameView = 'play' | 'shop'

export type LockedConstruct = 'for' | 'variables' | 'if' | 'functions'

export type SupportUpgradeId =
  | 'extra_line'
  | 'portal_overcharge'
  | 'queue_peek'
  | 'lucky_bonus'
  | 'helper_line_capacity'

export type SupportUpgradeKind =
  | 'capacity'
  | 'visibility'
  | 'reliability'
  | 'conversion'

export type SupportUpgradeDefinition = {
  id: SupportUpgradeId
  kind: SupportUpgradeKind
  cost: number
  requiredTopicId: TaskTopicId
  mainLineCapacityBonus?: number
  helperLineCapacityBonus?: number
}

export type SupportUpgradeCopy = {
  id: SupportUpgradeId
  title: string
  description: string
}

export type ShopNodeStatus = 'completed' | 'available' | 'locked'

export type AimLevel = 1 | 2 | 3

export type PortalSide = 1 | 3

export type ActiveBallSource = 'main' | 'helper'
export type BallSpawnKind = 'direct' | 'portal'
export type BallType = 'normal' | 'lucky' | 'evil'

export type BoardPathNode = {
  x: number
  y: number
  contact?: boolean
}

export type ScoreBreakdownKind =
  | 'bucket'
  | 'lucky_bonus'
  | 'evil_penalty'
  | 'total'

export type ScoreBreakdownLine = {
  kind: ScoreBreakdownKind
  value: number
}

export type BoardOutcome = {
  bucketIndex: number
  basePoints: number
  points: number
  ballType: BallType
  usedLuckyBonus: boolean
  usedEvilPenalty: boolean
  triggeredPortal: boolean
  path: BoardPathNode[]
}

export type ExecutionStep =
  | {
      type: 'drop_ball'
      lineNumber: number
      aim: AimLevel
      source: ActiveBallSource
      ballType: BallType
    }
  | {
      type: 'skip_ball'
      lineNumber: number
      ballType: BallType
    }

export type ProgramFeatureUsage = {
  usedVariables: boolean
  usedChooseChute: boolean
  usedIf: boolean
  usedHelperCall: boolean
  usedFor: boolean
}

export type ActiveBallState = 'falling' | 'settled' | 'canceled'

export type ActiveBall = {
  id: number
  lineNumber: number
  aim: AimLevel
  source: ActiveBallSource
  ballType: BallType
  spawnKind: BallSpawnKind
  portalDepth: number
  bucketIndex: number
  basePoints: number
  usedLuckyBonus: boolean
  usedEvilPenalty: boolean
  triggeredPortal: boolean
  points: number
  scoreBreakdown: ScoreBreakdownLine[]
  path: BoardPathNode[]
  spawnedAt: number
  settleAt: number
  removeAt: number
  state: ActiveBallState
  cancelX?: number
  cancelY?: number
}

export type ProgramValidationIssueCode =
  | 'empty_program'
  | 'invalid_command'
  | 'line_capacity_exceeded'
  | 'locked_construct'
  | 'unsupported_for_loop'
  | 'for_range_limit'
  | 'for_body_required'
  | 'invalid_for_body'
  | 'nested_block_not_supported'
  | 'unexpected_indentation'
  | 'step_limit_exceeded'
  | 'invalid_expression'
  | 'invalid_condition'
  | 'invalid_set_aim'
  | 'continue_outside_loop'
  | 'aim_range_limit'
  | 'invalid_function_definition'
  | 'duplicate_function'
  | 'helper_limit_exceeded'
  | 'helper_line_limit_exceeded'
  | 'helper_not_defined'

export type ValidationIssue = {
  code: ProgramValidationIssueCode
  lineNumber?: number
  limit?: number
  construct?: LockedConstruct
  maxRange?: number
  maxSteps?: number
  helperName?: string
}

export type ProgramValidation = {
  isValid: boolean
  issues: ValidationIssue[]
  executableLineCount: number
  executionStepCount: number
  helperCount: number
}

export type ParsedProgram = {
  steps: ExecutionStep[]
  featureUsage: ProgramFeatureUsage
  mainValidation: ProgramValidation
  helperValidation: ProgramValidation
}

export type FeedEntryType =
  | 'module_installed'
  | 'checkpoint_ready'
  | 'task_solved'
  | 'topic_mastered'
  | 'support_upgrade_bought'
  | 'shop_opened'

export type FeedEntry = {
  id: number
  type: FeedEntryType
  taskId?: string
  topicId?: TaskTopicId
  upgradeId?: SupportUpgradeId
}

export type TaskKind = 'onboarding' | 'mastery'

export type TaskArchetype = 'read' | 'choose' | 'repair'

export type GameTask = {
  id: string
  kind: TaskKind
  archetype: TaskArchetype
  topicId: TaskTopicId | 'onboarding'
  topicOrder: number
  taskOrder: number
  title: string
  question: string
  code: string
  boardHint: string
  unlockConnection: string
  options: string[]
  correctOption: number
  successMessage: string
  failureMessage: string
}

export type TopicDefinition = {
  id: TaskTopicId
  courseOrderLabel: string
  title: string
  moduleName: string
  meterGoal: number
  masteryTaskIds: string[]
  visibleStateLabels: string[]
  supportUpgradeIds: SupportUpgradeId[]
  goalText: string
  machineObjectiveText: string
  boardMeaningText: string
  nextActionText: string
  unlockSpotlightText: string
  suggestedSnippet: string
}

export type ReferenceValueItem = {
  id: string
  label: string
  description: string
  example?: string
}

export type ReferenceExampleItem = {
  id: string
  label: string
  code: string
}

export type UiText = {
  eyebrow: string
  playTabLabel: string
  shopTabLabel: string
  pointsChipLabel: string
  languageLabel: string
  estonianLabel: string
  englishLabel: string
  editorTitle: string
  editorLockedTitle: string
  editorUnlockedTitle: string
  editorLockedDescription: string
  editorUnlockedDescription: string
  helperEditorTitle: string
  helperEditorLockedDescription: string
  helperEditorUnlockedDescription: string
  editorLineUsageValue: string
  helperEditorLineUsageValue: string
  programReadyMessage: string
  helperProgramReadyMessage: string
  programZeroStepMessage: string
  runBlockedInvalidProgram: string
  runButton: string
  runButtonRunning: string
  runPanelTitle: string
  runPanelReadyMessage: string
  runPanelRunningMessage: string
  runPanelLockedMessage: string
  runPanelInvalidMessage: string
  runPanelCheckpointReadyMessage: string
  runPanelCheckpointActiveMessage: string
  executionStatusLabel: string
  actionsPerRunLabel: string
  actionsPerRunValue: string
  programErrorEmpty: string
  programErrorTooManyLines: string
  programErrorInvalidLine: string
  programErrorLockedConstruct: string
  programErrorUnsupportedForLoop: string
  programErrorForRangeLimit: string
  programErrorForBodyRequired: string
  programErrorInvalidForBody: string
  programErrorNestedBlocks: string
  programErrorUnexpectedIndentation: string
  programErrorStepLimitExceeded: string
  programErrorInvalidExpression: string
  programErrorInvalidCondition: string
  programErrorInvalidSetAim: string
  programErrorContinueOutsideLoop: string
  programErrorAimRangeLimit: string
  programErrorInvalidFunctionDefinition: string
  programErrorDuplicateFunction: string
  programErrorHelperLimitExceeded: string
  programErrorHelperLineLimitExceeded: string
  programErrorHelperNotDefined: string
  constructForLabel: string
  constructVariablesLabel: string
  constructIfLabel: string
  constructFunctionsLabel: string
  availableSyntaxTitle: string
  availableFunctionsLabel: string
  availableStructuresLabel: string
  availableReadableValuesLabel: string
  availableLimitsLabel: string
  availableStructuresEmpty: string
  availableSyntaxStepLimit: string
  availableSyntaxRangeLimit: string
  referenceTitle: string
  referenceSectionAvailableLabel: string
  referenceSectionBoardLabel: string
  referenceSectionExamplesLabel: string
  referenceLaneNumbersLabel: string
  referenceLaneNumbersDescription: string
  referenceNoExamples: string
  referenceBonusLaneDescription: string
  referencePortalSideDescription: string
  referenceNextBallDescription: string
  referenceNormalBallDescription: string
  referenceLuckyBallDescription: string
  referenceEvilBallDescription: string
  referenceExampleVariablesLabel: string
  referenceExampleConditionsLabel: string
  referenceExampleFunctionsLabel: string
  referenceExampleLoopsLabel: string
  nextStepLabel: string
  nextStepProgressLabel: string
  nextStepProgressValue: string
  nextStepOnboardingTitle: string
  nextStepOnboardingBody: string
  nextStepLearningTitle: string
  nextStepCheckpointTitle: string
  nextStepCheckpointReadyBody: string
  nextStepCheckpointActiveBody: string
  nextStepCompletedTitle: string
  nextStepCompletedBody: string
  nextStepStageOnboarding: string
  nextStepStageLearning: string
  nextStepStageUnlocked: string
  nextStepStageCheckpointReady: string
  nextStepStageCheckpointActive: string
  nextStepStageCompleted: string
  helpCenterButtonLabel: string
  helpCenterTitle: string
  helpCenterCloseButton: string
  helpCenterArchiveLabel: string
  helpCenterLatestLabel: string
  helpCenterArchiveItemLabel: string
  helpCenterEmpty: string
  guideWelcomeTitle: string
  guideWelcomeBody: string
  guideVariablesUnlockTitle: string
  guideVariablesUnlockBody: string
  guideConditionsUnlockTitle: string
  guideConditionsUnlockBody: string
  guideFunctionsUnlockTitle: string
  guideFunctionsUnlockBody: string
  guideLoopsUnlockTitle: string
  guideLoopsUnlockBody: string
  currentGoalTitle: string
  currentGoalModuleLabel: string
  currentGoalStageLabel: string
  currentGoalSummaryLabel: string
  currentGoalMeterLabel: string
  currentGoalNextUnlockLabel: string
  currentGoalGoalLabel: string
  currentGoalActionLabel: string
  currentGoalBoardMeaningLabel: string
  currentGoalVisibleStateLabel: string
  currentGoalSuggestedSnippetLabel: string
  currentGoalStageOnboarding: string
  currentGoalStageActive: string
  currentGoalStageCheckpointReady: string
  currentGoalStageCheckpointActive: string
  currentGoalStageSpotlight: string
  currentGoalStageCompleted: string
  currentGoalNoNextUnlock: string
  currentGoalOnboardingTitle: string
  currentGoalOnboardingSummary: string
  currentGoalOnboardingGoal: string
  currentGoalOnboardingAction: string
  currentGoalCompletedGoal: string
  currentGoalCompletedAction: string
  currentGoalCompletedBoardMeaning: string
  currentGoalStartCheckpointButton: string
  currentGoalDismissSpotlightButton: string
  currentGoalCheckpointSummary: string
  currentGoalSpotlightSummary: string
  currentGoalCheckpointAction: string
  currentGoalCheckpointActiveAction: string
  currentGoalSpotlightAction: string
  boardTitle: string
  boardSubtitle: string
  boardBonusLaneLabel: string
  boardActivePortalLabel: string
  boardUpcomingBallsLabel: string
  boardNextBallLabel: string
  boardBallTypeNormal: string
  boardBallTypeLucky: string
  boardBallTypeEvil: string
  boardSkipLabel: string
  boardMainLauncherLabel: string
  boardScoreBucketLabel: string
  boardScoreLuckyBonusLabel: string
  boardScoreEvilPenaltyLabel: string
  boardScoreTotalLabel: string
  boardPortalSplitLabel: string
  boardLastPointsLabel: string
  boardLastBucketLabel: string
  boardStreakLabel: string
  boardLaneOneLabel: string
  boardLaneTwoLabel: string
  boardLaneThreeLabel: string
  boardCalibrationTitle: string
  boardFocusChargeLabel: string
  boardLuckyBallReadyLabel: string
  boardBestLaneLabel: string
  boardDiverterTitle: string
  boardJackpotSideLabel: string
  boardReturnSideLabel: string
  boardReturnGateLabel: string
  boardGateOpen: string
  boardGateClosed: string
  boardRelayTitle: string
  boardRelayStatusLabel: string
  boardRelayArmed: string
  boardRelayIdle: string
  boardRelayTargetLabel: string
  boardRelayBonusLabel: string
  boardBurstTitle: string
  boardFeederChargeLabel: string
  boardComboTargetLabel: string
  boardBurstReadyLabel: string
  boardBurstWaiting: string
  boardBurstReady: string
  boardLightningBonusLabel: string
  boardEchoTargetLabel: string
  boardLaneLeft: string
  boardLaneCenter: string
  boardLaneRight: string
  boardLegendTitle: string
  boardLegendLaneHelp: string
  boardLegendBonusHelp: string
  challengeLabel: string
  challengeProgressValue: string
  taskReadLabel: string
  taskChooseLabel: string
  taskRepairLabel: string
  submitButton: string
  continueButton: string
  retryButton: string
  correctTitle: string
  incorrectTitle: string
  taskBoardHintLabel: string
  taskUnlockConnectionLabel: string
  taskShowHintButton: string
  taskHideHintButton: string
  activityFeedTitle: string
  activityFeedEmpty: string
  feedCategoryModule: string
  feedCategoryTask: string
  feedCategoryShop: string
  feedModuleInstalled: string
  feedCheckpointReady: string
  feedTaskSolved: string
  feedTopicMastered: string
  feedSupportUpgradeBought: string
  feedShopOpened: string
  shopTitle: string
  shopSubtitle: string
  shopScoreLabel: string
  shopNodeCompleted: string
  shopNodeAvailable: string
  shopNodeLocked: string
  shopBuyButton: string
  shopBoughtButton: string
  shopCostValue: string
  shopAvailableHint: string
  shopLockedHint: string
}

export type UnlockState = {
  editorEditable: boolean
  lineCapacity: number
  helperLineCapacity: number
  allowedCommands: AllowedCommand[]
  unlockedConstructs: LockedConstruct[]
}

export type BoardModuleState = {
  portalSide: PortalSide
}

export type MachineModuleState = {
  board: BoardModuleState
}

export type RunStats = {
  featureUsage: ProgramFeatureUsage
  spawnedBalls: number
  programStepSpawnedCount: number
  resolvedBalls: number
  portalSplitCount: number
  skippedEvilBallCount: number
  luckyBallHitCount: number
  helperPositiveOutcomeCount: number
  positiveOutcomeCount: number
}

export type GameState = {
  currentView: GameView
  score: number
  resolvedDropCount: number
  isRunning: boolean
  unlocks: UnlockState
  programSource: string
  helperProgramSource: string
  programValidation: ProgramValidation
  helperProgramValidation: ProgramValidation
  queuedSteps: ExecutionStep[]
  activeLineNumber: number | null
  activeBalls: ActiveBall[]
  nextBallId: number
  nextSpawnAt: number | null
  lastPoints: number
  lastBucket: number
  streak: number
  ballQueue: BallType[]
  ballQueueCursor: number
  currentTopicId: TaskTopicId | null
  learnedTopicIds: TaskTopicId[]
  masteredTopicIds: TaskTopicId[]
  topicStage: TopicStage
  topicMeter: number
  topicMeterGoal: number
  activeCheckpointTaskIds: string[]
  checkpointIndex: number
  activeTaskId: string | null
  solvedTaskIds: string[]
  moduleStates: MachineModuleState
  supportUpgradeIds: SupportUpgradeId[]
  feedEntries: FeedEntry[]
  nextFeedEntryId: number
  currentRunFeatureUsage: ProgramFeatureUsage | null
  currentRunStats: RunStats | null
  plannedBallCount: number
  hasOpenedShop: boolean
}
