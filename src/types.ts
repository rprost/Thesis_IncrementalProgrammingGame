export type Locale = 'et' | 'en'

export type TaskTopicId = string

export type AllowedCommand = 'drop_ball' | 'set_aim'

export type GameView = 'play' | 'shop'

export type LockedConstruct =
  | 'for'
  | 'variables'
  | 'if'
  | 'while'
  | 'functions'
  | 'lists'

export type ShopNodeId =
  | 'editor_unlock'
  | 'line_capacity_3'
  | 'variables'
  | 'if_statement'
  | 'functions'
  | 'for_loop'
  | 'while_loop'
  | 'lists'

export type ShopNodeKind = 'milestone' | 'upgrade' | 'syntax'

export type ShopNodeDefinition = {
  id: ShopNodeId
  kind: ShopNodeKind
  cost: number
  implemented: boolean
  lineCapacity?: number
  unlockConstruct?: LockedConstruct
  unlockCommand?: AllowedCommand
  requiredNodeIds?: ShopNodeId[]
  requiredTopicIds?: TaskTopicId[]
}

export type ShopNodeCopy = {
  id: ShopNodeId
  title: string
  description: string
}

export type ShopNodeStatus = 'completed' | 'available' | 'locked' | 'preview'

export type AimLevel = 1 | 2 | 3

export type BonusLane = 1 | 2 | 3

export type BoardBucket =
  | 'outer_left'
  | 'inner_left'
  | 'center'
  | 'inner_right'
  | 'outer_right'

export type BoardOutcome = {
  bucket: BoardBucket
  bucketIndex: number
  points: number
}

export type ExecutionStep = {
  type: 'drop_ball'
  lineNumber: number
  aim: AimLevel
}

export type ActiveBallState = 'falling' | 'settled' | 'canceled'

export type ActiveBall = {
  id: number
  lineNumber: number
  aim: AimLevel
  bucket: BoardBucket
  bucketIndex: number
  laneBonus: number
  points: number
  pathXs: number[]
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
  mainValidation: ProgramValidation
  helperValidation: ProgramValidation
}

export type FeedEntryType =
  | 'game_opened'
  | 'run_hint'
  | 'mini_task_appeared'
  | 'mini_task_solved'
  | 'mini_task_failed'
  | 'editor_unlocked'
  | 'line_unlocked'
  | 'shop_opened'
  | 'upgrade_bought'

export type FeedEntry = {
  id: number
  type: FeedEntryType
  taskId?: string
  lineCapacity?: number
  upgradeId?: ShopNodeId
}

export type TutorialStep = 'run_program' | 'first_challenge' | 'editor_unlock'

export type GameTask = {
  id: string
  topicId: TaskTopicId
  topicOrder: number
  title: string
  question: string
  code: string
  options: string[]
  correctOption: number
  successMessage: string
  failureMessage: string
  rewardPoints: number
  rewardMultiplier: number
  penaltyPoints: number
}

export type UiText = {
  eyebrow: string
  title: string
  subtitle: string
  playTabLabel: string
  shopTabLabel: string
  scoreLabel: string
  runCountLabel: string
  multiplierLabel: string
  runButton: string
  runButtonRunning: string
  runPanelTitle: string
  taskAfterCommandsMessage: string
  challengeActiveMessage: string
  allTasksCompletedMessage: string
  runPanelRunningMessage: string
  challengeLabel: string
  submitButton: string
  continueButton: string
  retryButton: string
  correctTitle: string
  incorrectTitle: string
  rewardLabel: string
  penaltyLabel: string
  pointsSuffix: string
  multiplierResetMessage: string
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
  helperEditorSlotsLabel: string
  starterProgram: string
  helperProgramStarter: string
  editorLineUsageValue: string
  helperEditorLineUsageValue: string
  actionsPerRunLabel: string
  actionsPerRunValue: string
  lineCapacityLabel: string
  programStatusLabel: string
  programStatusLocked: string
  programStatusReady: string
  programStatusInvalid: string
  programStatusRunning: string
  programReadyMessage: string
  helperProgramReadyMessage: string
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
  programErrorAimRangeLimit: string
  programErrorInvalidFunctionDefinition: string
  programErrorDuplicateFunction: string
  programErrorHelperLimitExceeded: string
  programErrorHelperLineLimitExceeded: string
  programErrorHelperNotDefined: string
  programZeroStepMessage: string
  runBlockedInvalidProgram: string
  constructForLabel: string
  constructVariablesLabel: string
  constructIfLabel: string
  constructWhileLabel: string
  constructFunctionsLabel: string
  constructListsLabel: string
  activityFeedTitle: string
  activityFeedEmpty: string
  feedCategoryTutorial: string
  feedCategoryTask: string
  feedCategoryUnlock: string
  feedCategoryShop: string
  feedGameOpened: string
  feedRunHint: string
  feedMiniTaskAppeared: string
  feedMiniTaskSolved: string
  feedMiniTaskFailed: string
  feedEditorUnlocked: string
  feedLineUnlocked: string
  feedShopOpened: string
  feedUpgradeBought: string
  tutorialLabel: string
  tutorialDismissButton: string
  tutorialRunTitle: string
  tutorialRunMessage: string
  tutorialChallengeTitle: string
  tutorialChallengeMessage: string
  tutorialEditorTitle: string
  tutorialEditorMessage: string
  editorUnlockOneTaskMessage: string
  editorUnlockManyTasksMessage: string
  shopTitle: string
  shopSubtitle: string
  shopScoreLabel: string
  shopNodeCompleted: string
  shopNodeAvailable: string
  shopNodeLocked: string
  shopNodePreview: string
  shopBuyButton: string
  shopBoughtButton: string
  shopCostValue: string
  shopPreviewMessage: string
  shopAvailableHint: string
  availableSyntaxTitle: string
  availableFunctionsLabel: string
  availableStructuresLabel: string
  availableReadableValuesLabel: string
  availableLimitsLabel: string
  availableStructuresEmpty: string
  availableSyntaxStepLimit: string
  availableSyntaxRangeLimit: string
  nextTaskLabel: string
  nextTaskProgressText: string
  boardTitle: string
  boardSubtitle: string
  boardLastPointsLabel: string
  boardLastBucketLabel: string
  boardStreakLabel: string
  boardBonusLaneLabel: string
  boardLaneOneLabel: string
  boardLaneTwoLabel: string
  boardLaneThreeLabel: string
  boardBucketOuterLabel: string
  boardBucketInnerLabel: string
  boardBucketCenterLabel: string
}

export type UnlockState = {
  editorVisible: boolean
  editorEditable: boolean
  lineCapacity: number
  allowedCommands: AllowedCommand[]
  unlockedConstructs: LockedConstruct[]
}

export type GameState = {
  currentView: GameView
  score: number
  runCount: number
  multiplier: number
  correctAnswerCount: number
  solvedTaskIds: string[]
  activeTaskId: string | null
  pendingTaskId: string | null
  isTaskOpen: boolean
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
  bonusLane: BonusLane
  dropsTowardNextTask: number
  currentTaskTarget: number
  feedEntries: FeedEntry[]
  nextFeedEntryId: number
  tutorialStep: TutorialStep
  dismissedTutorialSteps: TutorialStep[]
  purchasedUpgradeIds: ShopNodeId[]
  hasOpenedShop: boolean
}
