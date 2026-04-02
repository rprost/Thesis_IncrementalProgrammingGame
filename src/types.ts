export type Locale = 'et' | 'en'

export type TaskTopicId = string

export type AllowedCommand = 'add_score'

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
  | 'for_loop'
  | 'variables'
  | 'if_statement'
  | 'while_loop'
  | 'functions'
  | 'lists'

export type ShopNodeKind = 'milestone' | 'upgrade' | 'syntax'

export type ShopNodeDefinition = {
  id: ShopNodeId
  kind: ShopNodeKind
  cost: number
  implemented: boolean
  lineCapacity?: number
  unlockConstruct?: LockedConstruct
}

export type ShopNodeCopy = {
  id: ShopNodeId
  title: string
  description: string
}

export type ShopNodeStatus = 'completed' | 'available' | 'locked' | 'preview'

export type ProgramCallNode = {
  type: 'call'
  command: AllowedCommand
  lineNumber: number
}

export type ProgramForRangeNode = {
  type: 'for_range'
  lineNumber: number
  iterations: number
  body: ProgramCallNode[]
}

export type ProgramNode = ProgramCallNode | ProgramForRangeNode

export type ExecutionStep = {
  type: AllowedCommand
  lineNumber: number
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

export type ValidationIssue = {
  code: ProgramValidationIssueCode
  lineNumber?: number
  limit?: number
  construct?: LockedConstruct
  maxRange?: number
  maxSteps?: number
}

export type ProgramValidation = {
  isValid: boolean
  issues: ValidationIssue[]
  executableLineCount: number
  executionStepCount: number
}

export type ParsedProgram = {
  nodes: ProgramNode[]
  steps: ExecutionStep[]
  validation: ProgramValidation
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
  controlsHintLocked: string
  controlsHintEditable: string
  nextChallengeLabel: string
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
  starterProgram: string
  editorLineUsageValue: string
  actionsPerRunLabel: string
  actionsPerRunValue: string
  lineCapacityLabel: string
  programStatusLabel: string
  programStatusLocked: string
  programStatusReady: string
  programStatusInvalid: string
  programStatusRunning: string
  programReadyMessage: string
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
  availableLimitsLabel: string
  availableStructuresEmpty: string
  availableSyntaxNextUnlockLabel: string
  availableSyntaxNextEditor: string
  availableSyntaxNextLine: string
  availableSyntaxNextFor: string
  availableSyntaxNextVariables: string
  availableSyntaxStepLimit: string
  availableSyntaxRangeLimit: string
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
  isTaskOpen: boolean
  isRunning: boolean
  unlocks: UnlockState
  programSource: string
  programValidation: ProgramValidation
  queuedSteps: ExecutionStep[]
  activeLineNumber: number | null
  feedEntries: FeedEntry[]
  nextFeedEntryId: number
  tutorialStep: TutorialStep
  dismissedTutorialSteps: TutorialStep[]
  purchasedUpgradeIds: ShopNodeId[]
  hasOpenedShop: boolean
}
