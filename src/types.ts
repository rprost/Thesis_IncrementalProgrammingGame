export type Locale = 'et' | 'en'

export type TaskTopicId =
  | 'variables'
  | 'conditions'
  | 'functions'
  | 'loops'
  | 'lists'

export type TopicStage =
  | 'onboarding'
  | 'topic_active'
  | 'checkpoint_ready'
  | 'checkpoint_active'
  | 'new_unlock_spotlight'
  | 'completed'

export type AllowedCommand =
  | 'drop_ball'
  | 'choose_input'
  | 'skip_ball'

export type GameView = 'play' | 'shop'

export type LockedConstruct =
  | 'for'
  | 'variables'
  | 'if'
  | 'functions'
  | 'lists'

export type SupportUpgradeId =
  | 'extra_line'
  | 'extra_portal_split'
  | 'queue_peek'
  | 'center_bin_bonus'
  | 'helper_line_capacity'
  | 'portal_chain_once'

export type SupportUpgradeKind =
  | 'capacity'
  | 'visibility'
  | 'scoring'
  | 'automation'

export type SupportUpgradeDefinition = {
  id: SupportUpgradeId
  kind: SupportUpgradeKind
  cost: number
  requiredTopicId: TaskTopicId
  mainLineCapacityBonus?: number
  helperLineCapacityBonus?: number
  previewCountBonus?: number
  extraPortalChildren?: number
  extraCenterBinBonus?: number
  maxPortalDepth?: number
  ambientDropIntervalMs?: number
}

export type SupportUpgradeCopy = {
  id: SupportUpgradeId
  title: string
  description: string
}

export type ShopNodeStatus = 'completed' | 'available' | 'locked'

export type SupportUpgradeEffects = {
  mainLineCapacityBonus: number
  helperLineCapacityBonus: number
  previewCount: number
  extraPortalChildren: number
  extraCenterBinBonus: number
  maxPortalDepth: number
  ambientDropIntervalMs: number | null
}

export type AimLevel = 1 | 2 | 3

export type PortalSide = 1 | 3

export type ActiveBallSource = 'main' | 'helper' | 'ambient'
export type BallSpawnKind = 'direct' | 'portal'
export type BallType = 'plain' | 'center' | 'portal' | 'negative'

export type BoardPathNode = {
  x: number
  y: number
  contact?: boolean
  renderYOffset?: number
}

export type ScoreBreakdownKind =
  | 'bucket'
  | 'center_bonus'
  | 'negative_penalty'
  | 'lane_multiplier'
  | 'total'

export type ScoreBreakdownLine = {
  kind: ScoreBreakdownKind
  value: number
}

export type BoardOutcome = {
  bucketIndex: number
  basePoints: number
  points: number
  laneMultiplier: number
  ballType: BallType
  centerBonusValue: number
  usedCenterBonus: boolean
  usedNegativePenalty: boolean
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
  usedChooseInput: boolean
  usedIf: boolean
  usedHelperCall: boolean
  usedFor: boolean
  usedContinue: boolean
  usedLists: boolean
}

export type PreviewResponseKind = 'skip' | 'main_launch' | 'helper_launch'

export type PreviewResponse = {
  type: PreviewResponseKind
  ballType: BallType
  aim: AimLevel | null
}

export type PreviewResponseExpectation = {
  type: PreviewResponseKind
  aim?: AimLevel | 'portal_side'
}

export type ExecutionExpectation = {
  requiredFeatures?: Array<keyof ProgramFeatureUsage>
  requiredIdentifiers?: string[]
  expectedMainLaunchAims?: AimLevel[]
  expectedHelperLaunchAims?: AimLevel[]
  allowExtraMainLaunches?: boolean
  allowExtraHelperLaunches?: boolean
  previewResponses?: PreviewResponseExpectation[]
  minMainLaunchCount?: number
  maxMainLaunchCount?: number
  minHelperLaunchCount?: number
  maxHelperLaunchCount?: number
  minSkippedNegativeBallCount?: number
  maxSkippedNegativeBallCount?: number
  minPortalSplitCount?: number
  minCenterBonusCount?: number
  minPositiveOutcomeCount?: number
}

export type WriteTaskFeedbackKey =
  | 'taskFeedbackWrongChute'
  | 'taskFeedbackNeedChooseChute'
  | 'taskFeedbackNeedDropBall'
  | 'taskFeedbackNeedVariableStore'
  | 'taskFeedbackNeedSkipEvil'
  | 'taskFeedbackNeedSkipNegativeHelper'
  | 'taskFeedbackNeedElseLaunch'
  | 'taskFeedbackNeedPortalLaunch'
  | 'taskFeedbackNeedCenterLaunch'
  | 'taskFeedbackNeedHelperCall'
  | 'taskFeedbackNeedHelperGateLogic'
  | 'taskFeedbackNeedLoop'
  | 'taskFeedbackNeedIf'
  | 'taskFeedbackNeedBestTracker'
  | 'taskFeedbackNeedContinue'
  | 'taskFeedbackNeedFullPreviewLoop'
  | 'taskFeedbackNeedList'
  | 'taskFeedbackWrongLaunchCount'

export type ActiveBallState = 'falling' | 'settled' | 'canceled'

export type ActiveBall = {
  id: number
  lineNumber: number
  aim: AimLevel
  source: ActiveBallSource
  ballType: BallType
  laneMultiplier: number
  spawnKind: BallSpawnKind
  portalDepth: number
  bucketIndex: number
  basePoints: number
  usedCenterBonus: boolean
  centerBonusValue: number
  usedNegativePenalty: boolean
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
  | 'invalid_index_access'
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
  source?: 'main' | 'helper'
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

export type TaskArchetype = 'trace' | 'choose' | 'repair' | 'write'

export type TaskWriteCase = {
  title: string
  requirement: string
  scenario: PracticeGoalScenario
  programContextSource?: string
  helperContextSource?: string
  expectation: ExecutionExpectation
  hiddenFromPrompt?: boolean
}

export type TaskWriteValidation = {
  target: 'main' | 'helper'
  starterSource: string
  lineLimit?: number
  cases: TaskWriteCase[]
  presentation?:
    | {
        mode: 'none'
      }
    | {
        mode: 'cases'
      }
    | {
        mode: 'summary'
        title: string
        body: string
      }
}

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
  options?: string[]
  correctOption?: number
  writeValidation?: TaskWriteValidation
  reviewOriginTopicId?: TaskTopicId
  successMessage: string
  failureMessage: string
}

export type PracticeGoalScenario = {
  portalSide: PortalSide
  previewQueue: BallType[]
  visiblePreviewCount?: number
  bonusMap?: number[]
  launchPlan?: number[]
  planFocusIndex?: number | null
}

export type PracticeGoalDefinition = {
  id: string
  title: string
  instruction: string
  boardHint: string
  primerCards?: UnlockPrimerCard[]
  suggestedSnippet: string
  starterProgramSource: string
  starterHelperSource?: string | null
  scenario: PracticeGoalScenario
  acceptance: ExecutionExpectation
  requiresCodeChange?: boolean
  changeTarget?: 'main' | 'helper'
}

export type UnlockPrimerCard = {
  id: string
  title: string
  body: string
  syntax: string
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
  boardSubtitle: string
  unlockSpotlightText: string
  unlockPrimerCards: UnlockPrimerCard[]
  practiceGoals: PracticeGoalDefinition[]
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
  settingsButtonLabel: string
  settingsTitle: string
  settingsLanguageLabel: string
  settingsSoundLabel: string
  settingsSoundDescription: string
  settingsSoundOn: string
  settingsSoundOff: string
  settingsProgressLabel: string
  settingsCopyProgressButton: string
  settingsCopyProgressDescription: string
  settingsCopyProgressCopied: string
  settingsCopyProgressManual: string
  settingsCopyProgressManualPrompt: string
  settingsResetProgressButton: string
  settingsResetProgressConfirm: string
  settingsCloseButton: string
  editorTitle: string
  editorLockedTitle: string
  editorUnlockedTitle: string
  editorReadOnlyTitle: string
  editorLockedDescription: string
  editorUnlockedDescription: string
  editorSpotlightDescription: string
  helperEditorTitle: string
  helperEditorLockedDescription: string
  helperEditorUnlockedDescription: string
  helperEditorSpotlightDescription: string
  helperEditorExpandButton: string
  helperEditorCollapseButton: string
  helperEditorCollapsedDescription: string
  editorLineUsageValue: string
  helperEditorLineUsageValue: string
  programReadyMessage: string
  helperProgramReadyMessage: string
  programZeroStepMessage: string
  programZeroStepNeedActionMessage: string
  programZeroStepUnhandledBallMessage: string
  programZeroStepWrongBallMessage: string
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
  runPanelSpotlightMessage: string
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
  programErrorInvalidIndexAccess: string
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
  constructListsLabel: string
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
  referenceBonusMapDescription: string
  referenceNormalBallDescription: string
  referenceLuckyBallDescription: string
  referenceEvilBallDescription: string
  referenceExampleVariablesLabel: string
  referenceExampleConditionsLabel: string
  referenceExampleFunctionsLabel: string
  referenceExampleLoopsLabel: string
  referenceExampleListsLabel: string
  coachmarkDismissButton: string
  helpCoachmarkBody: string
  referenceCoachmarkBody: string
  nextStepLabel: string
  nextStepProgressLabel: string
  nextStepProgressValue: string
  nextStepPrimerLabel: string
  nextStepPrimerSyntaxLabel: string
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
  boardLaunchPlanLabel: string
  boardInternalsTitle: string
  boardMultipliersLabel: string
  boardBonusMapCodeValue: string
  boardSubtitleOnboarding: string
  boardBonusLaneLabel: string
  boardActivePortalLabel: string
  boardActivePortalValue: string
  boardUpcomingBallsLabel: string
  boardNextBallLabel: string
  boardBallTypePlain: string
  boardBallTypeNormal: string
  boardBallTypeLucky: string
  boardBallTypeEvil: string
  boardNeutralPreviewCountValue: string
  boardSkipLabel: string
  boardMainLauncherLabel: string
  boardScoreBucketLabel: string
  boardScoreLuckyBonusLabel: string
  boardScoreEvilPenaltyLabel: string
  boardScoreMultiplierLabel: string
  boardScoreTotalLabel: string
  boardPortalSplitLabel: string
  boardGateExplanation: string
  boardGateExplanationAdvanced: string
  boardRandomnessExplanation: string
  boardRandomnessExplanationAdvanced: string
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
  taskTraceLabel: string
  taskChooseLabel: string
  taskRepairLabel: string
  taskWriteLabel: string
  submitButton: string
  continueButton: string
  retryButton: string
  taskCloseButton: string
  taskResumeButton: string
  correctTitle: string
  incorrectTitle: string
  taskBoardHintLabel: string
  taskUnlockConnectionLabel: string
  taskShowHintButton: string
  taskHideHintButton: string
  taskAnswerCodeLabel: string
  taskContextCodeLabel: string
  taskMainProgramLabel: string
  taskHelperProgramLabel: string
  taskValidationNeedsRun: string
  taskValidationExpectedBehavior: string
  taskValidationCaseFailure: string
  taskFeedbackWrongChute: string
  taskFeedbackNeedChooseChute: string
  taskFeedbackNeedDropBall: string
  taskFeedbackNeedVariableStore: string
  taskFeedbackNeedSkipEvil: string
  taskFeedbackNeedSkipNegativeHelper: string
  taskFeedbackNeedElseLaunch: string
  taskFeedbackNeedPortalLaunch: string
  taskFeedbackNeedCenterLaunch: string
  taskFeedbackNeedHelperCall: string
  taskFeedbackNeedHelperGateLogic: string
  taskFeedbackNeedLoop: string
  taskFeedbackNeedIf: string
  taskFeedbackNeedBestTracker: string
  taskFeedbackNeedContinue: string
  taskFeedbackNeedFullPreviewLoop: string
  taskFeedbackNeedList: string
  taskFeedbackWrongLaunchCount: string
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
  introEyebrow: string
  introTitle: string
  introBody: string
  introFeedbackReminderLabel: string
  introFeedbackReminder: string
  introChecklistLabel: string
  introChecklistOne: string
  introChecklistTwo: string
  introChecklistThree: string
  introStartButton: string
  nextStepHintLabel: string
  nextStepSnippetLabel: string
  nextStepOnboardingAfterRunBody: string
  nextStepOnboardingTaskBody: string
  nextStepUnlockBody: string
  nextStepCompleteBody: string
  nextStepOnboardingSnippet: string
  onboardingTaskSolvedFeed: string
  objectiveShowHintButton: string
  objectiveHideHintButton: string
  objectiveShowExampleButton: string
  objectiveHideExampleButton: string
  goalEditRequiredMainMessage: string
  goalEditRequiredHelperMessage: string
  boardPreviewMeaningNormal: string
  boardPreviewMeaningLucky: string
  boardPreviewMeaningEvil: string
  scoreMultiplierLabel: string
  autoRunLabel: string
  autoRunOn: string
  autoRunOff: string
  autoRunReadyLabel: string
  boardPortalCodeValue: string
  boardNextBallCodeValue: string
  shopMultiplierValue: string
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
  bonusMap: number[]
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
  skippedNegativeBallCount: number
  skippedBallTypes: BallType[]
  centerBonusCount: number
  negativePenaltyCount: number
  helperPositiveOutcomeCount: number
  positiveOutcomeCount: number
  mainLaunchCount: number
  helperLaunchCount: number
  launchAims: AimLevel[]
  helperLaunchAims: AimLevel[]
  previewResponses: PreviewResponse[]
  pointsEarned: number
}

export type RunSummary = {
  pointsEarned: number
  launchedBalls: number
  skippedBalls: number
  portalSplits: number
  centerBonuses: number
  negativePenalties: number
}

export type GameState = {
  currentView: GameView
  score: number
  resolvedDropCount: number
  soundEnabled: boolean
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
  lastRunSummary: RunSummary | null
  streak: number
  ballQueue: BallType[]
  ballQueueCursor: number
  currentTopicId: TaskTopicId | null
  learnedTopicIds: TaskTopicId[]
  masteredTopicIds: TaskTopicId[]
  topicStage: TopicStage
  topicMeter: number
  topicMeterGoal: number
  goalBaselineProgramSource: string | null
  goalBaselineHelperSource: string | null
  goalChangeNoticeTarget: 'main' | 'helper' | null
  activeCheckpointTaskIds: string[]
  checkpointIndex: number
  activeTaskId: string | null
  solvedTaskIds: string[]
  moduleStates: MachineModuleState
  activeScenario: PracticeGoalScenario | null
  supportUpgradeIds: SupportUpgradeId[]
  feedEntries: FeedEntry[]
  nextFeedEntryId: number
  currentRunFeatureUsage: ProgramFeatureUsage | null
  currentRunStats: RunStats | null
  plannedBallCount: number
  hasOpenedShop: boolean
  introDismissed: boolean
  autoRunUnlocked: boolean
  autoRunEnabled: boolean
}
