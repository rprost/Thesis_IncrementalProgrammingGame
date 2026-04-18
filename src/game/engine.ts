import type {
  BallType,
  ExecutionExpectation,
  FeedEntry,
  FeedEntryType,
  GameState,
  GameTask,
  GameView,
  PracticeGoalDefinition,
  PracticeGoalScenario,
  ProgramFeatureUsage,
  ProgramValidation,
  RunSummary,
  RunStats,
  ScoreBreakdownLine,
  SupportUpgradeId,
  TaskTopicId,
  TopicDefinition,
  WriteTaskFeedbackKey,
} from '../types'
import {
  BALL_CANCEL_DURATION_MS,
  BALL_FALL_DURATION_MS,
  BALL_SETTLE_HOLD_MS,
  BALL_SPAWN_INTERVAL_MS,
  DEFAULT_NEGATIVE_PENALTY,
  createBallQueue,
  createBallOutcome,
  getBallTypeValue,
  refillBallQueue,
  rollBonusMap,
  rollPortalSide,
} from './pachinko'
import {
  BASE_HELPER_LINE_LIMIT,
  INITIAL_HELPER_SOURCE,
  INITIAL_PROGRAM_SOURCE,
  parseProgram,
} from './program'
import {
  canOpenShop,
  canPurchaseShopNode,
  getSupportUpgradeEffects,
  SHOP_NODES,
} from './shop'

const FEED_LIMIT = 8
const SAVE_VERSION = 8
export const SAVE_STORAGE_KEY = 'incremental-programming-game.save'

type FeedEntryInput = {
  type: FeedEntryType
  taskId?: string
  topicId?: TaskTopicId
  upgradeId?: SupportUpgradeId
}

type PersistedGameState = {
  version: number
  state: Pick<
    GameState,
    | 'score'
    | 'resolvedDropCount'
    | 'soundEnabled'
    | 'programSource'
    | 'helperProgramSource'
    | 'lastPoints'
    | 'lastBucket'
    | 'lastRunSummary'
    | 'streak'
    | 'ballQueue'
    | 'ballQueueCursor'
    | 'currentTopicId'
    | 'learnedTopicIds'
    | 'masteredTopicIds'
    | 'topicStage'
    | 'topicMeter'
    | 'topicMeterGoal'
    | 'goalBaselineProgramSource'
    | 'goalBaselineHelperSource'
    | 'activeCheckpointTaskIds'
    | 'checkpointIndex'
    | 'activeTaskId'
    | 'solvedTaskIds'
    | 'moduleStates'
    | 'activeScenario'
    | 'supportUpgradeIds'
    | 'feedEntries'
    | 'nextFeedEntryId'
    | 'hasOpenedShop'
    | 'introDismissed'
    | 'autoRunUnlocked'
    | 'autoRunEnabled'
  >
}

function prependFeedEntries(
  state: GameState,
  entries: FeedEntryInput[],
): GameState {
  let nextFeedEntryId = state.nextFeedEntryId
  let feedEntries = state.feedEntries

  for (const entry of entries) {
    const nextEntry: FeedEntry = {
      id: nextFeedEntryId,
      ...entry,
    }
    nextFeedEntryId += 1
    feedEntries = [nextEntry, ...feedEntries].slice(0, FEED_LIMIT)
  }

  return {
    ...state,
    feedEntries,
    nextFeedEntryId,
  }
}

function getTopicById(
  topics: TopicDefinition[],
  topicId: TaskTopicId | null,
): TopicDefinition | null {
  if (topicId === null) {
    return null
  }

  return topics.find((topic) => topic.id === topicId) ?? null
}

function getNextTopic(
  topics: TopicDefinition[],
  topicId: TaskTopicId,
): TopicDefinition | null {
  const topicIndex = topics.findIndex((topic) => topic.id === topicId)

  if (topicIndex === -1) {
    return null
  }

  return topics[topicIndex + 1] ?? null
}

function getCurrentPracticeGoal(
  state: GameState,
  topics: TopicDefinition[],
): PracticeGoalDefinition | null {
  const topic = getTopicById(topics, state.currentTopicId)

  if (topic === null) {
    return null
  }

  return topic.practiceGoals[state.topicMeter] ?? null
}

function createBaseUnlockState(): GameState['unlocks'] {
  return {
    editorEditable: false,
    lineCapacity: 1,
    helperLineCapacity: BASE_HELPER_LINE_LIMIT,
    allowedCommands: ['drop_ball'],
    unlockedConstructs: [],
  }
}

function applyTopicUnlocks(
  unlocks: GameState['unlocks'],
  topicId: TaskTopicId,
): GameState['unlocks'] {
  switch (topicId) {
    case 'variables':
      return {
        ...unlocks,
        editorEditable: true,
        lineCapacity: Math.max(unlocks.lineCapacity, 3),
        allowedCommands: unlocks.allowedCommands.includes('choose_input')
          ? unlocks.allowedCommands
          : [...unlocks.allowedCommands, 'choose_input'],
        unlockedConstructs: unlocks.unlockedConstructs.includes('variables')
          ? unlocks.unlockedConstructs
          : [...unlocks.unlockedConstructs, 'variables'],
      }
    case 'conditions':
      return {
        ...unlocks,
        lineCapacity: Math.max(unlocks.lineCapacity, 5),
        allowedCommands: unlocks.allowedCommands.includes('skip_ball')
          ? unlocks.allowedCommands
          : [...unlocks.allowedCommands, 'skip_ball'],
        unlockedConstructs: unlocks.unlockedConstructs.includes('if')
          ? unlocks.unlockedConstructs
          : [...unlocks.unlockedConstructs, 'if'],
      }
    case 'functions':
      return {
        ...unlocks,
        unlockedConstructs: unlocks.unlockedConstructs.includes('functions')
          ? unlocks.unlockedConstructs
          : [...unlocks.unlockedConstructs, 'functions'],
      }
    case 'loops':
      return {
        ...unlocks,
        lineCapacity: Math.max(unlocks.lineCapacity, 9),
        unlockedConstructs: unlocks.unlockedConstructs.includes('for')
          ? unlocks.unlockedConstructs
          : [...unlocks.unlockedConstructs, 'for'],
      }
    case 'lists':
      return {
        ...unlocks,
        lineCapacity: Math.max(unlocks.lineCapacity, 12),
        unlockedConstructs: unlocks.unlockedConstructs.includes('lists')
          ? unlocks.unlockedConstructs
          : [...unlocks.unlockedConstructs, 'lists'],
      }
    default:
      return unlocks
  }
}

function applySupportUpgradeBonuses(
  unlocks: GameState['unlocks'],
  supportUpgradeIds: SupportUpgradeId[],
): GameState['unlocks'] {
  const effects = getSupportUpgradeEffects(supportUpgradeIds)

  return {
    ...unlocks,
    lineCapacity: unlocks.lineCapacity + effects.mainLineCapacityBonus,
    helperLineCapacity:
      unlocks.helperLineCapacity + effects.helperLineCapacityBonus,
  }
}

function buildUnlockState(
  learnedTopicIds: TaskTopicId[],
  supportUpgradeIds: SupportUpgradeId[],
): GameState['unlocks'] {
  const baseUnlocks = learnedTopicIds.reduce(
    (currentUnlocks, topicId) => applyTopicUnlocks(currentUnlocks, topicId),
    createBaseUnlockState(),
  )

  return applySupportUpgradeBonuses(baseUnlocks, supportUpgradeIds)
}

function createScenarioQueue(state: {
  activeScenario: PracticeGoalScenario | null
  learnedTopicIds: TaskTopicId[]
  currentTopicId: TaskTopicId | null
  topicStage: GameState['topicStage']
}): BallType[] {
  const fallbackQueue = createBallQueue({
    conditionsUnlocked:
      state.learnedTopicIds.includes('conditions') ||
      state.currentTopicId === 'lists',
    currentTopicId: state.currentTopicId,
    topicStage: state.topicStage,
  })

  if (state.activeScenario === null) {
    return replacePlainBallsInListsQueue({
      currentTopicId: state.currentTopicId,
      queue: fallbackQueue,
      fallbackQueue,
    })
  }

  if (state.currentTopicId === 'lists') {
    return buildListsScenarioQueue(state.activeScenario.previewQueue, fallbackQueue)
  }

  return [...state.activeScenario.previewQueue, ...fallbackQueue].slice(
    0,
    fallbackQueue.length,
  )
}

export function isBluePortalActive(state: Pick<
  GameState,
  'currentTopicId' | 'learnedTopicIds' | 'topicMeter' | 'topicStage'
>): boolean {
  if (!state.learnedTopicIds.includes('variables')) {
    return false
  }

  if (
    state.learnedTopicIds.includes('conditions') ||
    state.learnedTopicIds.includes('functions') ||
    state.learnedTopicIds.includes('loops')
  ) {
    return true
  }

  if (state.currentTopicId !== 'variables') {
    return false
  }

  return (
    state.topicMeter >= 2 ||
    state.topicStage === 'checkpoint_ready' ||
    state.topicStage === 'checkpoint_active' ||
    state.topicStage === 'completed'
  )
}

function getEvaluationContext(state: GameState) {
  const nextBall = state.ballQueue[state.ballQueueCursor] ?? 'plain'
  const portalActive = isBluePortalActive(state)

  return {
    ...(portalActive
      ? {
          portal_side: state.moduleStates.board.portalSide,
        }
      : {}),
    ...(state.learnedTopicIds.includes('conditions')
      ? {
          next_ball: getBallTypeValue(nextBall),
          center_ball: 1,
          portal_ball: 2,
          negative_ball: 3,
        }
      : {}),
    ...(state.learnedTopicIds.includes('lists')
      ? {
          bonus_map: state.moduleStates.board.bonusMap,
        }
      : {}),
  }
}

function createFeatureUsage(): ProgramFeatureUsage {
  return {
    usedVariables: false,
    usedChooseInput: false,
    usedIf: false,
    usedHelperCall: false,
    usedFor: false,
    usedContinue: false,
    usedLists: false,
  }
}

function createRunStats(featureUsage: ProgramFeatureUsage): RunStats {
  return {
    featureUsage,
    spawnedBalls: 0,
    programStepSpawnedCount: 0,
    resolvedBalls: 0,
    portalSplitCount: 0,
    skippedNegativeBallCount: 0,
    skippedBallTypes: [],
    centerBonusCount: 0,
    negativePenaltyCount: 0,
    helperPositiveOutcomeCount: 0,
    positiveOutcomeCount: 0,
    mainLaunchCount: 0,
    helperLaunchCount: 0,
    launchAims: [],
    helperLaunchAims: [],
    previewResponses: [],
    pointsEarned: 0,
  }
}

function createInitialModuleState(): GameState['moduleStates'] {
  return {
    board: {
      portalSide: rollPortalSide(),
      bonusMap: rollBonusMap(),
    },
  }
}

function getLaneMultiplier(
  state: Pick<GameState, 'learnedTopicIds' | 'moduleStates'>,
  aim: 1 | 2 | 3,
): number {
  if (!state.learnedTopicIds.includes('lists')) {
    return 1
  }

  return state.moduleStates.board.bonusMap[aim - 1] ?? 1
}

function getPortalChildCount(
  ballType: BallType,
  supportUpgradeIds: SupportUpgradeId[],
): number {
  const effects = getSupportUpgradeEffects(supportUpgradeIds)
  const baseCount = ballType === 'portal' ? 4 : 2
  return baseCount + effects.extraPortalChildren
}

function getRefilledQueue(state: GameState): GameState['ballQueue'] {
  const conditionsUnlocked =
    state.learnedTopicIds.includes('conditions') ||
    state.currentTopicId === 'lists'
  const fallbackQueue = createBallQueue({
    conditionsUnlocked,
    currentTopicId: state.currentTopicId,
    topicStage: state.topicStage,
  })
  const refilledQueue = refillBallQueue(state.ballQueue, state.ballQueueCursor, {
    conditionsUnlocked,
  })

  return replacePlainBallsInListsQueue({
    currentTopicId: state.currentTopicId,
    queue: refilledQueue,
    fallbackQueue,
  })
}

function revalidatePrograms(state: GameState): GameState {
  const parsed = parseProgram(
    state.programSource,
    state.helperProgramSource,
    state.unlocks.lineCapacity,
    state.unlocks.helperLineCapacity,
    state.unlocks.allowedCommands,
    state.unlocks.unlockedConstructs,
    getEvaluationContext(state),
    state.ballQueue.slice(state.ballQueueCursor),
  )

  return {
    ...state,
    programValidation: parsed.mainValidation,
    helperProgramValidation: parsed.helperValidation,
  }
}

function markBallSettled(ball: GameState['activeBalls'][number], now: number) {
  return {
    ...ball,
    state: 'settled' as const,
    removeAt: now + BALL_SETTLE_HOLD_MS,
  }
}

function markBallCanceled(
  ball: GameState['activeBalls'][number],
  now: number,
  x: number,
  y: number,
) {
  return {
    ...ball,
    state: 'canceled' as const,
    cancelX: x,
    cancelY: y,
    removeAt: now + BALL_CANCEL_DURATION_MS,
  }
}

function createScoreBreakdown(
  ball: GameState['activeBalls'][number],
  total: number,
): ScoreBreakdownLine[] {
  const lines: ScoreBreakdownLine[] = [
    {
      kind: 'bucket',
      value: ball.basePoints,
    },
  ]

  if (ball.usedCenterBonus) {
    lines.push({
      kind: 'center_bonus',
      value: ball.centerBonusValue,
    })
  }

  if (ball.usedNegativePenalty) {
    lines.push({
      kind: 'negative_penalty',
      value: DEFAULT_NEGATIVE_PENALTY,
    })
  }

  if (ball.laneMultiplier !== 1) {
    lines.push({
      kind: 'lane_multiplier',
      value: ball.laneMultiplier,
    })
  }

  lines.push({
    kind: 'total',
    value: total,
  })

  return lines
}

function spawnDueBalls(state: GameState, now: number): GameState {
  if (!state.isRunning || state.nextSpawnAt === null) {
    return state
  }

  let nextSpawnAt = state.nextSpawnAt
  let activeBalls = state.activeBalls
  let queuedSteps = state.queuedSteps
  let nextBallId = state.nextBallId
  let activeLineNumber = state.activeLineNumber
  let ballQueueCursor = state.ballQueueCursor
  let runStats = state.currentRunStats ?? createRunStats(createFeatureUsage())
  const portalEnabled = isBluePortalActive(state)
  const supportEffects = getSupportUpgradeEffects(state.supportUpgradeIds)

  while (
    queuedSteps.length > 0 &&
    nextSpawnAt !== null &&
    nextSpawnAt <= now
  ) {
    const [step, ...remainingSteps] = queuedSteps

    if (step === undefined) {
      break
    }

    queuedSteps = remainingSteps
    activeLineNumber = step.lineNumber
    if (step.type === 'drop_ball') {
      ballQueueCursor += 1
    }

    if (step.type === 'skip_ball') {
      runStats = {
        ...runStats,
        skippedNegativeBallCount:
          runStats.skippedNegativeBallCount + (step.ballType === 'negative' ? 1 : 0),
        skippedBallTypes: [...runStats.skippedBallTypes, step.ballType],
        previewResponses: [
          ...runStats.previewResponses,
          {
            type: 'skip',
            ballType: step.ballType,
            aim: null,
          },
        ],
      }
      nextSpawnAt += BALL_SPAWN_INTERVAL_MS
      continue
    }

    const outcome = createBallOutcome(
      step.aim,
      state.moduleStates.board.portalSide,
      step.ballType,
      {
        launchIndex: runStats.spawnedBalls,
        portalEnabled,
        portalDepth: 0,
        maxPortalDepth: supportEffects.maxPortalDepth,
        extraCenterBinBonus: supportEffects.extraCenterBinBonus,
        laneMultiplier: getLaneMultiplier(state, step.aim),
      },
    )
    const activeBall = {
      id: nextBallId,
      lineNumber: step.lineNumber,
      aim: step.aim,
      source: step.source,
      ballType: step.ballType,
      laneMultiplier: outcome.laneMultiplier,
      spawnKind: 'direct' as const,
      portalDepth: 0,
      bucketIndex: outcome.bucketIndex,
      basePoints: outcome.basePoints,
      usedCenterBonus: outcome.usedCenterBonus,
      centerBonusValue: outcome.centerBonusValue,
      usedNegativePenalty: outcome.usedNegativePenalty,
      triggeredPortal: outcome.triggeredPortal,
      points: outcome.points,
      scoreBreakdown: [],
      path: outcome.path,
      spawnedAt: nextSpawnAt,
      settleAt: nextSpawnAt + BALL_FALL_DURATION_MS,
      removeAt: nextSpawnAt + BALL_FALL_DURATION_MS + BALL_SETTLE_HOLD_MS,
      state: 'falling' as const,
    }

    activeBalls = [...activeBalls, activeBall]
    nextBallId += 1
    nextSpawnAt += BALL_SPAWN_INTERVAL_MS
    runStats = {
      ...runStats,
      spawnedBalls: runStats.spawnedBalls + 1,
      programStepSpawnedCount: runStats.programStepSpawnedCount + 1,
      mainLaunchCount:
        runStats.mainLaunchCount + (step.source === 'main' ? 1 : 0),
      helperLaunchCount:
        runStats.helperLaunchCount + (step.source === 'helper' ? 1 : 0),
      launchAims:
        step.source === 'main'
          ? [...runStats.launchAims, step.aim]
          : runStats.launchAims,
      helperLaunchAims:
        step.source === 'helper'
          ? [...runStats.helperLaunchAims, step.aim]
          : runStats.helperLaunchAims,
      previewResponses:
        [
          ...runStats.previewResponses,
          {
            type: step.source === 'helper' ? 'helper_launch' : 'main_launch',
            ballType: step.ballType,
            aim: step.aim,
          },
        ],
    }
  }

  return {
    ...state,
    queuedSteps,
    activeBalls,
    nextBallId,
    ballQueueCursor,
    nextSpawnAt: queuedSteps.length === 0 ? null : nextSpawnAt,
    activeLineNumber,
    currentRunStats: runStats,
  }
}

function createPortalChildBall(
  state: GameState,
  parentBall: GameState['activeBalls'][number],
  ballId: number,
  spawnAt: number,
  launchIndex: number,
) {
  const portalEnabled = isBluePortalActive(state)
  const supportEffects = getSupportUpgradeEffects(state.supportUpgradeIds)
  const outcome = createBallOutcome(
    parentBall.aim,
    state.moduleStates.board.portalSide,
    parentBall.ballType,
    {
      launchIndex,
      portalEnabled,
      portalDepth: parentBall.portalDepth + 1,
      maxPortalDepth: supportEffects.maxPortalDepth,
      extraCenterBinBonus: supportEffects.extraCenterBinBonus,
      laneMultiplier: parentBall.laneMultiplier,
    },
  )

  return {
    id: ballId,
    lineNumber: parentBall.lineNumber,
    aim: parentBall.aim,
    source: parentBall.source,
    ballType: parentBall.ballType,
    laneMultiplier: outcome.laneMultiplier,
    spawnKind: 'portal' as const,
    portalDepth: parentBall.portalDepth + 1,
    bucketIndex: outcome.bucketIndex,
    basePoints: outcome.basePoints,
    usedCenterBonus: outcome.usedCenterBonus,
    centerBonusValue: outcome.centerBonusValue,
    usedNegativePenalty: outcome.usedNegativePenalty,
    triggeredPortal: outcome.triggeredPortal,
    points: outcome.points,
    scoreBreakdown: [],
    path: outcome.path,
    spawnedAt: spawnAt,
    settleAt: spawnAt + BALL_FALL_DURATION_MS,
    removeAt: spawnAt + BALL_FALL_DURATION_MS + BALL_SETTLE_HOLD_MS,
    state: 'falling' as const,
  }
}

function settleBall(
  state: GameState,
  ball: GameState['activeBalls'][number],
  now: number,
): GameState {
  if (ball.source === 'ambient') {
    if (ball.triggeredPortal) {
      const portalNode = ball.path[ball.path.length - 1] ?? {
        x: ball.cancelX ?? 0,
        y: ball.cancelY ?? 0,
      }
      const childStart = now + 70
      const childCount = getPortalChildCount(ball.ballType, state.supportUpgradeIds)
      const childBalls = Array.from({ length: childCount }, (_, index) =>
        createPortalChildBall(
          state,
          ball,
          state.nextBallId + index,
          childStart + index * 120,
          index,
        ),
      )

      return {
        ...state,
        resolvedDropCount: state.resolvedDropCount + 1,
        lastPoints: 0,
        streak: 0,
        nextBallId: state.nextBallId + childCount,
        activeBalls: state.activeBalls.flatMap((entry) =>
          entry.id === ball.id
            ? [markBallCanceled(entry, now, portalNode.x, portalNode.y), ...childBalls]
            : [entry],
        ),
      }
    }

    const points = ball.points

    return {
      ...state,
      score: Math.max(0, state.score + points),
      resolvedDropCount: state.resolvedDropCount + 1,
      lastPoints: points,
      lastBucket: ball.bucketIndex + 1,
      streak: points >= 8 ? state.streak + 1 : 0,
      activeBalls: state.activeBalls.map((entry) =>
        entry.id === ball.id
          ? markBallSettled(
              {
                ...entry,
                points,
                scoreBreakdown: createScoreBreakdown(entry, points),
              },
              now,
            )
          : entry,
      ),
    }
  }

  const runStats = state.currentRunStats ?? createRunStats(createFeatureUsage())
  const didEarnPositiveOutcome = ball.usedCenterBonus || ball.triggeredPortal

  const nextRunStats: RunStats = {
    ...runStats,
    resolvedBalls: runStats.resolvedBalls + 1,
    portalSplitCount: runStats.portalSplitCount + (ball.triggeredPortal ? 1 : 0),
    centerBonusCount: runStats.centerBonusCount + (ball.usedCenterBonus ? 1 : 0),
    negativePenaltyCount:
      runStats.negativePenaltyCount + (ball.usedNegativePenalty ? 1 : 0),
    helperPositiveOutcomeCount:
      runStats.helperPositiveOutcomeCount +
      (ball.source === 'helper' && didEarnPositiveOutcome ? 1 : 0),
    positiveOutcomeCount:
      runStats.positiveOutcomeCount + (didEarnPositiveOutcome ? 1 : 0),
  }

  if (ball.triggeredPortal) {
    const portalNode = ball.path[ball.path.length - 1] ?? {
      x: ball.cancelX ?? 0,
      y: ball.cancelY ?? 0,
    }
    const childStart = now + 70
    const childCount = getPortalChildCount(ball.ballType, state.supportUpgradeIds)
    const childBalls = Array.from({ length: childCount }, (_, index) =>
      createPortalChildBall(
        state,
        ball,
        state.nextBallId + index,
        childStart + index * 120,
        nextRunStats.spawnedBalls + index,
      ),
    )

    return {
      ...state,
      currentRunStats: {
        ...nextRunStats,
        spawnedBalls: nextRunStats.spawnedBalls + childCount,
      },
      resolvedDropCount: state.resolvedDropCount + 1,
      lastPoints: 0,
      streak: 0,
      nextBallId: state.nextBallId + childCount,
      activeBalls: state.activeBalls.flatMap((entry) =>
        entry.id === ball.id
          ? [markBallCanceled(entry, now, portalNode.x, portalNode.y), ...childBalls]
          : [entry],
      ),
    }
  }

  const points = ball.points

  return {
    ...state,
    currentRunStats: {
      ...nextRunStats,
      pointsEarned: nextRunStats.pointsEarned + points,
    },
    score: Math.max(0, state.score + points),
    resolvedDropCount: state.resolvedDropCount + 1,
    lastPoints: points,
    lastBucket: ball.bucketIndex + 1,
    streak: points >= 8 ? state.streak + 1 : 0,
    activeBalls: state.activeBalls.map((entry) =>
      entry.id === ball.id
        ? markBallSettled(
            {
              ...entry,
              points,
              scoreBreakdown: createScoreBreakdown(entry, points),
            },
            now,
          )
        : entry,
    ),
  }
}

function settleDueBalls(state: GameState, now: number): GameState {
  const dueBallIds = state.activeBalls
    .filter((ball) => ball.state === 'falling' && ball.settleAt <= now)
    .sort((left, right) => left.settleAt - right.settleAt)
    .map((ball) => ball.id)

  if (dueBallIds.length === 0) {
    return state
  }

  let nextState = state

  for (const ballId of dueBallIds) {
    const ball = nextState.activeBalls.find((entry) => entry.id === ballId)

    if (ball === undefined || ball.state !== 'falling') {
      continue
    }

    nextState = settleBall(nextState, ball, now)
  }

  return nextState
}

function cleanupBalls(state: GameState, now: number): GameState {
  const activeBalls = state.activeBalls.filter((ball) => ball.removeAt > now)

  if (activeBalls.length === state.activeBalls.length) {
    return state
  }

  return {
    ...state,
    activeBalls,
  }
}

function sourceMentions(source: string, identifier: string): boolean {
  if (/^[A-Za-z_]\w*$/.test(identifier)) {
    return new RegExp(`\\b${identifier}\\b`).test(source)
  }

  return source.includes(identifier)
}

function mentionsAllIdentifiers(
  source: string,
  identifiers: string[] | undefined,
): boolean {
  if (identifiers === undefined || identifiers.length === 0) {
    return true
  }

  return identifiers.every((identifier) => sourceMentions(source, identifier))
}

function launchAimsMatch(
  aims: number[],
  expectedAims: number[] | undefined,
  allowExtraLaunches = false,
): boolean {
  if (expectedAims === undefined || expectedAims.length === 0) {
    return true
  }

  if (allowExtraLaunches) {
    if (aims.length < expectedAims.length) {
      return false
    }
  } else if (aims.length !== expectedAims.length) {
    return false
  }

  return expectedAims.every((aim, index) => aims[index] === aim)
}

function previewResponsesMatch(
  actualResponses: RunStats['previewResponses'],
  expectedResponses: ExecutionExpectation['previewResponses'],
  scenario: PracticeGoalScenario,
): boolean {
  if (expectedResponses === undefined || expectedResponses.length === 0) {
    return true
  }

  const visibleResponses = actualResponses.slice(0, scenario.previewQueue.length)

  if (visibleResponses.length < expectedResponses.length) {
    return false
  }

  return expectedResponses.every((expected, index) => {
    const actual = visibleResponses[index]

    if (actual === undefined || actual.type !== expected.type) {
      return false
    }

    if (expected.aim === undefined) {
      return true
    }

    const expectedAim =
      expected.aim === 'portal_side' ? scenario.portalSide : expected.aim

    return actual.aim === expectedAim
  })
}

function matchesExecutionExpectation(
  expectation: ExecutionExpectation,
  runStats: RunStats,
  combinedSource: string,
  scenario: PracticeGoalScenario,
): boolean {
  const requiredFeatures = expectation.requiredFeatures ?? []

  return (
    requiredFeatures.every((feature) => runStats.featureUsage[feature]) &&
    mentionsAllIdentifiers(combinedSource, expectation.requiredIdentifiers) &&
    previewResponsesMatch(
      runStats.previewResponses,
      expectation.previewResponses,
      scenario,
    ) &&
    launchAimsMatch(
      runStats.launchAims,
      expectation.expectedMainLaunchAims,
      expectation.allowExtraMainLaunches ?? false,
    ) &&
    launchAimsMatch(
      runStats.helperLaunchAims,
      expectation.expectedHelperLaunchAims,
      expectation.allowExtraHelperLaunches ?? false,
    ) &&
    runStats.mainLaunchCount >= (expectation.minMainLaunchCount ?? 0) &&
    runStats.mainLaunchCount <=
      (expectation.maxMainLaunchCount ?? Number.POSITIVE_INFINITY) &&
    runStats.helperLaunchCount >= (expectation.minHelperLaunchCount ?? 0) &&
    runStats.helperLaunchCount <=
      (expectation.maxHelperLaunchCount ?? Number.POSITIVE_INFINITY) &&
    runStats.skippedNegativeBallCount >=
      (expectation.minSkippedNegativeBallCount ?? 0) &&
    runStats.skippedNegativeBallCount <=
      (expectation.maxSkippedNegativeBallCount ?? Number.POSITIVE_INFINITY) &&
    runStats.portalSplitCount >= (expectation.minPortalSplitCount ?? 0) &&
    runStats.centerBonusCount >= (expectation.minCenterBonusCount ?? 0) &&
    runStats.positiveOutcomeCount >=
      (expectation.minPositiveOutcomeCount ?? 0)
  )
}

function normalizeSourceForGoalComparison(source: string): string {
  return source
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/^\n+|\n+$/g, '')
}

function hasRequiredGoalSourceChange(
  state: GameState,
  goal: PracticeGoalDefinition,
): boolean {
  const changeTarget = goal.changeTarget ?? 'main'
  const currentSource =
    changeTarget === 'helper' ? state.helperProgramSource : state.programSource
  const baselineSource =
    changeTarget === 'helper'
      ? state.goalBaselineHelperSource
      : state.goalBaselineProgramSource

  return normalizeSourceForGoalComparison(currentSource) !==
    normalizeSourceForGoalComparison(baselineSource ?? '')
}

function didCompletePracticeGoal(
  state: GameState,
  goal: PracticeGoalDefinition,
  runStats: RunStats,
): { completed: boolean; blockedChangeTarget: 'main' | 'helper' | null } {
  const matchesBehavior = matchesExecutionExpectation(
    goal.acceptance,
    runStats,
    `${state.programSource}\n${state.helperProgramSource}`,
    goal.scenario,
  )

  if (!matchesBehavior) {
    return {
      completed: false,
      blockedChangeTarget: null,
    }
  }

  if (goal.requiresCodeChange && !hasRequiredGoalSourceChange(state, goal)) {
    return {
      completed: false,
      blockedChangeTarget: goal.changeTarget ?? 'main',
    }
  }

  return {
    completed: true,
    blockedChangeTarget: null,
  }
}

function refreshMachineState(state: GameState): GameState {
  if (state.activeScenario !== null) {
    return {
      ...state,
      ballQueue: createScenarioQueue(state),
      ballQueueCursor: 0,
      moduleStates: {
        board: {
          portalSide: state.activeScenario.portalSide,
          bonusMap: state.activeScenario.bonusMap ?? state.moduleStates.board.bonusMap,
        },
      },
    }
  }

  return {
    ...state,
    ballQueue: getRefilledQueue(state),
    ballQueueCursor: 0,
    moduleStates: {
      board: {
        portalSide: rollPortalSide(),
        bonusMap: rollBonusMap(),
      },
    },
  }
}

function getNextOnboardingTaskId(
  tasks: GameTask[],
  solvedTaskIds: string[],
): string | null {
  const solvedTaskSet = new Set(solvedTaskIds)
  const onboardingTasks = tasks
    .filter((task) => task.kind === 'onboarding')
    .sort((left, right) => left.taskOrder - right.taskOrder)

  return onboardingTasks.find((task) => !solvedTaskSet.has(task.id))?.id ?? null
}

function applyPracticeGoalState(
  state: GameState,
  goal: PracticeGoalDefinition | null,
  topicStage: GameState['topicStage'],
  options: {
    seedProgramSource: boolean
    seedHelperSource: boolean
  },
): GameState {
  const programSource =
    options.seedProgramSource && goal !== null
      ? goal.starterProgramSource
      : state.programSource
  const helperProgramSource =
    options.seedHelperSource && goal?.starterHelperSource !== undefined
      ? (goal.starterHelperSource ?? '')
      : state.helperProgramSource
  const activeScenario = goal?.scenario ?? null
  const learnedTopicIds = state.learnedTopicIds
  const currentTopicId = state.currentTopicId

  return {
    ...state,
    programSource,
    helperProgramSource,
    goalBaselineProgramSource:
      goal !== null ? normalizeSourceForGoalComparison(programSource) : null,
    goalBaselineHelperSource:
      goal !== null ? normalizeSourceForGoalComparison(helperProgramSource) : null,
    goalChangeNoticeTarget: null,
    activeScenario,
    ballQueue: createScenarioQueue({
      activeScenario,
      learnedTopicIds,
      currentTopicId,
      topicStage,
    }),
    ballQueueCursor: 0,
    moduleStates: {
      board: {
        portalSide: activeScenario?.portalSide ?? rollPortalSide(),
        bonusMap: activeScenario?.bonusMap ?? rollBonusMap(),
      },
    },
  }
}

function buildCheckpointTaskIds(
  topicId: TaskTopicId,
  tasks: GameTask[],
  masteredTopicIds: TaskTopicId[],
): string[] {
  const masteryTasks = tasks
    .filter((task) => task.kind === 'mastery' && task.topicId === topicId)
    .sort((left, right) => left.taskOrder - right.taskOrder)

  const reviewTasks = masteryTasks.filter(
    (task) =>
      task.reviewOriginTopicId !== undefined &&
      masteredTopicIds.includes(task.reviewOriginTopicId),
  )
  const currentTasks = masteryTasks.filter(
    (task) => task.reviewOriginTopicId === undefined,
  )

  if (topicId === 'variables' || reviewTasks.length === 0) {
    return masteryTasks.slice(0, 3).map((task) => task.id)
  }

  return [...currentTasks.slice(0, 2), reviewTasks[0]]
    .slice(0, 3)
    .map((task) => task.id)
}

function unlockTopic(
  state: GameState,
  topicId: TaskTopicId,
  topics: TopicDefinition[],
): GameState {
  const topic = getTopicById(topics, topicId)

  if (topic === null) {
    return state
  }

  const learnedTopicIds = state.learnedTopicIds.includes(topicId)
    ? state.learnedTopicIds
    : [...state.learnedTopicIds, topicId]
  let helperProgramSource = state.helperProgramSource
  const unlocks = buildUnlockState(learnedTopicIds, state.supportUpgradeIds)
  const firstGoal = topic.practiceGoals[0] ?? null

  if (topicId === 'functions' && helperProgramSource.trim() === '') {
    helperProgramSource = INITIAL_HELPER_SOURCE
  }

  return revalidatePrograms(
    prependFeedEntries(
      applyPracticeGoalState(
        {
          ...state,
          unlocks,
          helperProgramSource,
          currentTopicId: topicId,
          learnedTopicIds,
          topicStage: 'new_unlock_spotlight',
          topicMeter: 0,
          topicMeterGoal: topic.practiceGoals.length,
          activeCheckpointTaskIds: [],
          checkpointIndex: 0,
          activeTaskId: null,
        },
        firstGoal,
        'new_unlock_spotlight',
        {
          seedProgramSource: true,
          seedHelperSource: true,
        },
      ),
      [
        {
          type: 'module_installed',
          topicId,
        },
      ],
    ),
  )
}

function buildRunSummary(
  runStats: RunStats,
): RunSummary {
  return {
    pointsEarned: runStats.pointsEarned,
    launchedBalls: runStats.spawnedBalls,
    skippedBalls: runStats.skippedBallTypes.length,
    portalSplits: runStats.portalSplitCount,
    centerBonuses: runStats.centerBonusCount,
    negativePenalties: runStats.negativePenaltyCount,
  }
}

function completeRun(
  state: GameState,
  tasks: GameTask[],
  topics: TopicDefinition[],
): GameState {
  const runStats = state.currentRunStats

  if (runStats === null) {
    return revalidatePrograms({
      ...state,
      isRunning: false,
      activeLineNumber: null,
      nextSpawnAt: null,
      plannedBallCount: 0,
      currentRunFeatureUsage: null,
      currentRunStats: null,
    })
  }

  const currentGoal = getCurrentPracticeGoal(state, topics)
  const targetTopic = getTopicById(topics, state.currentTopicId)
  const goalResult =
    currentGoal !== null ? didCompletePracticeGoal(state, currentGoal, runStats) : null

  let nextState: GameState = {
    ...state,
    isRunning: false,
    activeLineNumber: null,
    nextSpawnAt: null,
    plannedBallCount: 0,
    lastRunSummary: buildRunSummary(runStats),
    goalChangeNoticeTarget:
      goalResult?.blockedChangeTarget ?? null,
  }

  if (nextState.topicStage === 'onboarding') {
    const nextTaskId = getNextOnboardingTaskId(tasks, nextState.solvedTaskIds)
    nextState = refreshMachineState({
      ...nextState,
      currentRunFeatureUsage: null,
      currentRunStats: null,
      plannedBallCount: 0,
    })
    nextState = revalidatePrograms(nextState)

    if (nextTaskId !== null) {
      const solvedOnboardingCount = nextState.solvedTaskIds.filter((taskId) =>
        tasks.some((task) => task.id === taskId && task.kind === 'onboarding'),
      ).length

      return {
        ...nextState,
        checkpointIndex: solvedOnboardingCount,
        activeTaskId: nextTaskId,
      }
    }

    return unlockTopic(nextState, 'variables', topics)
  }

  if (
    nextState.topicStage === 'topic_active' &&
    nextState.currentTopicId !== null &&
    targetTopic !== null &&
    currentGoal !== null
  ) {
    if (goalResult?.completed) {
      const nextMeter = Math.min(
        targetTopic.practiceGoals.length,
        nextState.topicMeter + 1,
      )
      const nextGoal = targetTopic.practiceGoals[nextMeter] ?? null

      nextState = applyPracticeGoalState(
        {
          ...nextState,
          topicMeter: nextMeter,
          topicMeterGoal: targetTopic.practiceGoals.length,
          autoRunUnlocked:
            nextState.autoRunUnlocked ||
            (targetTopic.id === 'loops' && nextMeter >= 1),
        },
        nextGoal,
        'topic_active',
        {
          seedProgramSource: false,
          seedHelperSource: false,
        },
      )

      if (nextMeter >= targetTopic.practiceGoals.length) {
        nextState = prependFeedEntries(
          {
            ...nextState,
            topicStage: 'checkpoint_ready',
            activeCheckpointTaskIds: buildCheckpointTaskIds(
              targetTopic.id,
              tasks,
              nextState.masteredTopicIds,
            ),
            checkpointIndex: 0,
            activeScenario: null,
          },
          [
            {
              type: 'checkpoint_ready',
              topicId: targetTopic.id,
            },
          ],
        )
      }
    }
  }

  nextState = refreshMachineState(nextState)
  nextState = revalidatePrograms({
    ...nextState,
    currentRunFeatureUsage: null,
    currentRunStats: null,
    plannedBallCount: 0,
  })

  return nextState
}

function finalizeRun(
  state: GameState,
  tasks: GameTask[],
  topics: TopicDefinition[],
  now: number,
): GameState {
  const hasVisibleBalls = state.activeBalls.some((ball) => ball.removeAt > now)

  if (state.isRunning || state.queuedSteps.length > 0 || hasVisibleBalls) {
    return state
  }

  if (state.currentRunStats === null) {
    return {
      ...state,
      activeLineNumber: null,
    }
  }

  return completeRun(state, tasks, topics)
}

function isValidBallType(value: unknown): value is BallType {
  return (
    value === 'plain' ||
    value === 'center' ||
    value === 'portal' ||
    value === 'negative'
  )
}

function isValidTopicStage(value: unknown): value is GameState['topicStage'] {
  return (
    value === 'onboarding' ||
    value === 'topic_active' ||
    value === 'checkpoint_ready' ||
    value === 'checkpoint_active' ||
    value === 'new_unlock_spotlight' ||
    value === 'completed'
  )
}

function sanitizeScenario(
  value: unknown,
  fallback: PracticeGoalScenario | null,
): PracticeGoalScenario | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('portalSide' in value) ||
    !('previewQueue' in value)
  ) {
    return fallback
  }

  const portalSide = value.portalSide
  const previewQueue = value.previewQueue
  const visiblePreviewCount =
    'visiblePreviewCount' in value &&
    typeof value.visiblePreviewCount === 'number' &&
    Number.isFinite(value.visiblePreviewCount) &&
    value.visiblePreviewCount >= 1
      ? Math.floor(value.visiblePreviewCount)
      : undefined
  const bonusMap =
    'bonusMap' in value &&
    Array.isArray(value.bonusMap) &&
    value.bonusMap.length === 3 &&
    value.bonusMap.every(
      (entry) => typeof entry === 'number' && Number.isFinite(entry),
    )
      ? value.bonusMap
      : undefined

  if (
    (portalSide !== 1 && portalSide !== 3) ||
    !Array.isArray(previewQueue) ||
    !previewQueue.every(isValidBallType)
  ) {
    return fallback
  }

  return {
    portalSide,
    previewQueue,
    visiblePreviewCount,
    bonusMap,
  }
}

function sanitizeBonusMap(value: unknown, fallback: number[]): number[] {
  if (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
  ) {
    return value
  }

  return fallback
}

function buildListsScenarioQueue(
  previewQueue: BallType[],
  fallbackQueue: BallType[],
): BallType[] {
  let fallbackIndex = 0
  const filledPreview = previewQueue.map((ballType) => {
    if (ballType !== 'plain') {
      return ballType
    }

    const replacement = fallbackQueue[fallbackIndex] ?? 'center'
    fallbackIndex += 1
    return replacement
  })

  return [...filledPreview, ...fallbackQueue.slice(fallbackIndex)].slice(
    0,
    fallbackQueue.length,
  )
}

function replacePlainBallsInListsQueue(options: {
  currentTopicId: TaskTopicId | null
  queue: BallType[]
  fallbackQueue: BallType[]
}): BallType[] {
  if (
    options.currentTopicId !== 'lists' ||
    !options.queue.some((ballType) => ballType === 'plain')
  ) {
    return options.queue
  }

  return options.queue.map((ballType, index) =>
    ballType === 'plain'
      ? (options.fallbackQueue[index] ?? 'center')
      : ballType,
  )
}

function sanitizeRunSummary(value: unknown): RunSummary | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('pointsEarned' in value) ||
    !('launchedBalls' in value) ||
    !('skippedBalls' in value) ||
    !('portalSplits' in value) ||
    !('centerBonuses' in value) ||
    !('negativePenalties' in value)
  ) {
    return null
  }

  const {
    pointsEarned,
    launchedBalls,
    skippedBalls,
    portalSplits,
    centerBonuses,
    negativePenalties,
  } = value

  if (
    typeof pointsEarned !== 'number' ||
    typeof launchedBalls !== 'number' ||
    typeof skippedBalls !== 'number' ||
    typeof portalSplits !== 'number' ||
    typeof centerBonuses !== 'number' ||
    typeof negativePenalties !== 'number'
  ) {
    return null
  }

  return {
    pointsEarned,
    launchedBalls,
    skippedBalls,
    portalSplits,
    centerBonuses,
    negativePenalties,
  }
}

export function loadPersistedGameState(
  topics: TopicDefinition[],
  tasks: GameTask[],
): GameState {
  const initialState = createInitialGameState()

  if (typeof window === 'undefined') {
    return initialState
  }

  const raw = window.localStorage.getItem(SAVE_STORAGE_KEY)

  if (raw === null) {
    return initialState
  }

  try {
    const parsed = JSON.parse(raw) as PersistedGameState

    if (
      parsed.version !== SAVE_VERSION &&
      parsed.version !== 7 &&
      parsed.version !== 6 &&
      parsed.version !== 5
    ) {
      return initialState
    }

    const validTaskIds = new Set(tasks.map((task) => task.id))
    const validTopicIds = new Set<string>(topics.map((topic) => topic.id))
    const validUpgradeIds = new Set<string>(SHOP_NODES.map((node) => node.id))
    const isLegacySave = parsed.version < SAVE_VERSION
    const persistedCurrentTopicId = parsed.state.currentTopicId as string | null
    const persistedLearnedTopicIds = (parsed.state.learnedTopicIds ?? []) as string[]
    const persistedMasteredTopicIds = (parsed.state.masteredTopicIds ?? []) as string[]
    const persistedSupportUpgradeIds = (parsed.state.supportUpgradeIds ?? []) as string[]
    const hadLegacyListsProgress =
      isLegacySave &&
      (
        persistedLearnedTopicIds.includes('lists') ||
        persistedMasteredTopicIds.includes('lists') ||
        persistedCurrentTopicId === 'lists' ||
        persistedSupportUpgradeIds.includes('fourth_loader_slot')
      )
    const hadLegacyLoopsCompletion =
      isLegacySave &&
      parsed.state.topicStage === 'completed' &&
      (persistedLearnedTopicIds.includes('loops') ||
        persistedMasteredTopicIds.includes('loops') ||
        persistedCurrentTopicId === 'loops')
    const shouldUnlockListsFromMigration =
      validTopicIds.has('lists') &&
      (hadLegacyListsProgress || hadLegacyLoopsCompletion)
    const learnedTopicIdsBase = persistedLearnedTopicIds.filter((topicId): topicId is TaskTopicId =>
      validTopicIds.has(topicId),
    )
    const masteredTopicIdsBase = persistedMasteredTopicIds.filter((topicId): topicId is TaskTopicId =>
      validTopicIds.has(topicId),
    )
    const needsLoopsMastered = hadLegacyListsProgress || hadLegacyLoopsCompletion
    const learnedTopicIds: TaskTopicId[] =
      needsLoopsMastered && !learnedTopicIdsBase.includes('loops')
        ? [...learnedTopicIdsBase, 'loops']
        : learnedTopicIdsBase
    const masteredTopicIds: TaskTopicId[] =
      needsLoopsMastered && !masteredTopicIdsBase.includes('loops')
        ? [...masteredTopicIdsBase, 'loops']
        : masteredTopicIdsBase
    const supportUpgradeIds = (parsed.state.supportUpgradeIds ?? []).filter((upgradeId) =>
      validUpgradeIds.has(upgradeId),
    )
    const parsedCurrentTopicId = persistedCurrentTopicId
    const currentTopicId =
      typeof parsedCurrentTopicId === 'string' &&
      validTopicIds.has(parsedCurrentTopicId as TaskTopicId)
        ? (parsedCurrentTopicId as TaskTopicId)
        : null
    const currentTopic = getTopicById(topics, currentTopicId)
    const topicMeterGoal = currentTopic?.practiceGoals.length ?? 0
    const topicMeter = Math.min(parsed.state.topicMeter ?? 0, topicMeterGoal)
    const topicStage = isValidTopicStage(parsed.state.topicStage)
      ? parsed.state.topicStage
      : currentTopicId === null
        ? 'onboarding'
        : 'topic_active'
    const derivedScenario =
      currentTopic !== null &&
      (topicStage === 'topic_active' || topicStage === 'new_unlock_spotlight') &&
      topicMeter < currentTopic.practiceGoals.length
        ? currentTopic.practiceGoals[topicMeter]?.scenario ?? null
        : null
    const activeScenario =
      derivedScenario ?? sanitizeScenario(parsed.state.activeScenario, derivedScenario)
    const fallbackQueue = createScenarioQueue({
      activeScenario,
      learnedTopicIds,
      currentTopicId,
      topicStage,
    })
    const persistedBallQueue = Array.isArray(parsed.state.ballQueue)
      ? parsed.state.ballQueue.filter(isValidBallType)
      : fallbackQueue
    const ballQueue =
      persistedBallQueue.length > 0 ? persistedBallQueue : fallbackQueue
    const filteredBallQueue =
      currentTopicId === 'lists' &&
      activeScenario !== null &&
      ballQueue.some((ballType) => ballType === 'plain')
        ? buildListsScenarioQueue(activeScenario.previewQueue, fallbackQueue)
        : replacePlainBallsInListsQueue({
            currentTopicId,
            queue: ballQueue,
            fallbackQueue,
          })
    const ballQueueCursor = Math.min(
      Math.max(0, parsed.state.ballQueueCursor ?? 0),
      Math.max(0, filteredBallQueue.length - 1),
    )
    const feedEntries = (parsed.state.feedEntries ?? [])
      .filter(
        (entry): entry is FeedEntry =>
          typeof entry?.id === 'number' &&
          typeof entry?.type === 'string',
      )
      .slice(0, FEED_LIMIT)
    const nextFeedEntryId = Math.max(
      parsed.state.nextFeedEntryId ?? 1,
      (feedEntries[0]?.id ?? 0) + 1,
    )
    const modulePortalSide =
      parsed.state.moduleStates?.board?.portalSide === 1 ||
      parsed.state.moduleStates?.board?.portalSide === 3
        ? parsed.state.moduleStates.board.portalSide
        : activeScenario?.portalSide ?? initialState.moduleStates.board.portalSide
    const moduleBonusMap = sanitizeBonusMap(
      parsed.state.moduleStates?.board?.bonusMap,
      activeScenario?.bonusMap ?? initialState.moduleStates.board.bonusMap,
    )
    const helperProgramSource =
      learnedTopicIds.includes('functions') &&
      (parsed.state.helperProgramSource ?? '').trim() === ''
        ? INITIAL_HELPER_SOURCE
        : parsed.state.helperProgramSource ?? ''
    const loadedState = revalidatePrograms({
      ...initialState,
      score: parsed.state.score ?? initialState.score,
      resolvedDropCount:
        parsed.state.resolvedDropCount ?? initialState.resolvedDropCount,
      soundEnabled: parsed.state.soundEnabled ?? initialState.soundEnabled,
      programSource: parsed.state.programSource ?? initialState.programSource,
      helperProgramSource,
      lastPoints: parsed.state.lastPoints ?? initialState.lastPoints,
      lastBucket: parsed.state.lastBucket ?? initialState.lastBucket,
      lastRunSummary: sanitizeRunSummary(parsed.state.lastRunSummary),
      streak: parsed.state.streak ?? initialState.streak,
      ballQueue: filteredBallQueue,
      ballQueueCursor,
      currentTopicId,
      learnedTopicIds,
      masteredTopicIds,
      topicStage,
      topicMeter,
      topicMeterGoal,
      goalBaselineProgramSource:
        parsed.state.goalBaselineProgramSource ??
        initialState.goalBaselineProgramSource,
      goalBaselineHelperSource:
        parsed.state.goalBaselineHelperSource ??
        initialState.goalBaselineHelperSource,
      activeCheckpointTaskIds: (parsed.state.activeCheckpointTaskIds ?? []).filter((taskId) =>
        validTaskIds.has(taskId),
      ),
      checkpointIndex: Math.max(0, parsed.state.checkpointIndex ?? 0),
      activeTaskId:
        validTaskIds.has(parsed.state.activeTaskId ?? '')
          ? parsed.state.activeTaskId
          : null,
      solvedTaskIds: (parsed.state.solvedTaskIds ?? []).filter((taskId) =>
        validTaskIds.has(taskId),
      ),
      moduleStates: {
        board: {
          portalSide: modulePortalSide,
          bonusMap: moduleBonusMap,
        },
      },
      activeScenario,
      supportUpgradeIds,
      unlocks: buildUnlockState(learnedTopicIds, supportUpgradeIds),
      feedEntries,
      nextFeedEntryId,
      hasOpenedShop: parsed.state.hasOpenedShop ?? false,
      introDismissed: parsed.state.introDismissed ?? false,
      autoRunUnlocked: parsed.state.autoRunUnlocked ?? false,
      autoRunEnabled:
        (parsed.state.autoRunUnlocked ?? false) &&
        (parsed.state.autoRunEnabled ?? false),
      goalChangeNoticeTarget: null,
    })

    if (!shouldUnlockListsFromMigration) {
      return loadedState
    }

    const migratedLearnedTopicIds: TaskTopicId[] =
      loadedState.learnedTopicIds.includes('loops')
        ? loadedState.learnedTopicIds
        : [...loadedState.learnedTopicIds, 'loops']
    const migratedMasteredTopicIds: TaskTopicId[] =
      loadedState.masteredTopicIds.includes('loops')
        ? loadedState.masteredTopicIds
        : [...loadedState.masteredTopicIds, 'loops']
    const migratedState = revalidatePrograms({
      ...loadedState,
      learnedTopicIds: migratedLearnedTopicIds,
      masteredTopicIds: migratedMasteredTopicIds,
      topicStage: 'completed',
      activeCheckpointTaskIds: [],
      checkpointIndex: 0,
      activeTaskId: null,
      activeScenario: null,
      currentRunFeatureUsage: null,
      currentRunStats: null,
      unlocks: buildUnlockState(migratedLearnedTopicIds, supportUpgradeIds),
    })

    return unlockTopic(migratedState, 'lists', topics)
  } catch {
    return initialState
  }
}

export function normalizeListsQueue(state: GameState): GameState {
  if (
    state.currentTopicId !== 'lists' ||
    !state.ballQueue.some((ballType) => ballType === 'plain')
  ) {
    return state
  }

  const fallbackQueue = createScenarioQueue({
    activeScenario: state.activeScenario,
    learnedTopicIds: state.learnedTopicIds,
    currentTopicId: state.currentTopicId,
    topicStage: state.topicStage,
  })
  const ballQueue =
    state.activeScenario !== null
      ? buildListsScenarioQueue(state.activeScenario.previewQueue, fallbackQueue)
      : replacePlainBallsInListsQueue({
          currentTopicId: state.currentTopicId,
          queue: state.ballQueue,
          fallbackQueue,
        })

  return revalidatePrograms({
    ...state,
    ballQueue,
    ballQueueCursor: Math.min(
      Math.max(0, state.ballQueueCursor),
      Math.max(0, ballQueue.length - 1),
    ),
  })
}

export function savePersistedGameState(state: GameState): void {
  if (typeof window === 'undefined') {
    return
  }

  const payload: PersistedGameState = {
    version: SAVE_VERSION,
    state: {
      score: state.score,
      resolvedDropCount: state.resolvedDropCount,
      soundEnabled: state.soundEnabled,
      programSource: state.programSource,
      helperProgramSource: state.helperProgramSource,
      lastPoints: state.lastPoints,
      lastBucket: state.lastBucket,
      lastRunSummary: state.lastRunSummary,
      streak: state.streak,
      ballQueue: state.ballQueue,
      ballQueueCursor: state.ballQueueCursor,
      currentTopicId: state.currentTopicId,
      learnedTopicIds: state.learnedTopicIds,
      masteredTopicIds: state.masteredTopicIds,
      topicStage: state.topicStage,
      topicMeter: state.topicMeter,
      topicMeterGoal: state.topicMeterGoal,
      goalBaselineProgramSource: state.goalBaselineProgramSource,
      goalBaselineHelperSource: state.goalBaselineHelperSource,
      activeCheckpointTaskIds: state.activeCheckpointTaskIds,
      checkpointIndex: state.checkpointIndex,
      activeTaskId: state.activeTaskId,
      solvedTaskIds: state.solvedTaskIds,
      moduleStates: state.moduleStates,
      activeScenario: state.activeScenario,
      supportUpgradeIds: state.supportUpgradeIds,
      feedEntries: state.feedEntries,
      nextFeedEntryId: state.nextFeedEntryId,
      hasOpenedShop: state.hasOpenedShop,
      introDismissed: state.introDismissed,
      autoRunUnlocked: state.autoRunUnlocked,
      autoRunEnabled: state.autoRunEnabled,
    },
  }

  window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload))
}

export function createInitialGameState(): GameState {
  const initialState: GameState = {
    currentView: 'play',
    score: 0,
    resolvedDropCount: 0,
    soundEnabled: true,
    isRunning: false,
    unlocks: createBaseUnlockState(),
    programSource: INITIAL_PROGRAM_SOURCE,
    helperProgramSource: '',
    programValidation: {
      isValid: true,
      issues: [],
      executableLineCount: 1,
      executionStepCount: 1,
      helperCount: 0,
    },
    helperProgramValidation: {
      isValid: true,
      issues: [],
      executableLineCount: 0,
      executionStepCount: 0,
      helperCount: 0,
    },
    queuedSteps: [],
    activeLineNumber: null,
    activeBalls: [],
    nextBallId: 1,
    nextSpawnAt: null,
    lastPoints: 0,
    lastBucket: 5,
    lastRunSummary: null,
    streak: 0,
    ballQueue: createBallQueue({
      conditionsUnlocked: false,
      currentTopicId: null,
      topicStage: 'onboarding',
    }),
    ballQueueCursor: 0,
    currentTopicId: null,
    learnedTopicIds: [],
    masteredTopicIds: [],
    topicStage: 'onboarding',
    topicMeter: 0,
    topicMeterGoal: 0,
    goalBaselineProgramSource: null,
    goalBaselineHelperSource: null,
    goalChangeNoticeTarget: null,
    activeCheckpointTaskIds: [],
    checkpointIndex: 0,
    activeTaskId: null,
    solvedTaskIds: [],
    moduleStates: createInitialModuleState(),
    activeScenario: null,
    supportUpgradeIds: [],
    feedEntries: [],
    nextFeedEntryId: 1,
    currentRunFeatureUsage: null,
    currentRunStats: null,
    plannedBallCount: 0,
    hasOpenedShop: false,
    introDismissed: false,
    autoRunUnlocked: false,
    autoRunEnabled: false,
  }

  return revalidatePrograms(initialState)
}

function getLearnedTopicsForTask(
  topicId: GameTask['topicId'],
): TaskTopicId[] {
  if (topicId === 'onboarding') {
    return []
  }

  const topicOrder: TaskTopicId[] = [
    'variables',
    'conditions',
    'functions',
    'loops',
    'lists',
  ]
  const topicIndex = topicOrder.indexOf(topicId)

  return topicIndex === -1 ? [] : topicOrder.slice(0, topicIndex + 1)
}

function getEvaluationContextForScenario(
  topicId: GameTask['topicId'],
  scenario: PracticeGoalScenario,
) {
  const learnedTopicIds = getLearnedTopicsForTask(topicId)
  const nextBall = scenario.previewQueue[0] ?? 'plain'

  return {
    ...(learnedTopicIds.includes('variables')
      ? {
          portal_side: scenario.portalSide,
        }
      : {}),
    ...(learnedTopicIds.includes('conditions')
      ? {
          next_ball: getBallTypeValue(nextBall),
          center_ball: 1,
          portal_ball: 2,
          negative_ball: 3,
        }
      : {}),
    ...(learnedTopicIds.includes('lists')
      ? {
          bonus_map: scenario.bonusMap ?? [1, 1, 1],
        }
      : {}),
  }
}

function createTaskRunStats(parsed: ReturnType<typeof parseProgram>): RunStats {
  const runStats = createRunStats(parsed.featureUsage)

  for (const step of parsed.steps) {
    if (step.type === 'skip_ball') {
      runStats.skippedBallTypes.push(step.ballType)
      runStats.previewResponses.push({
        type: 'skip',
        ballType: step.ballType,
        aim: null,
      })

      if (step.ballType === 'negative') {
        runStats.skippedNegativeBallCount += 1
      }

      continue
    }

    runStats.spawnedBalls += 1

    if (step.source === 'main') {
      runStats.previewResponses.push({
        type: 'main_launch',
        ballType: step.ballType,
        aim: step.aim,
      })
      runStats.mainLaunchCount += 1
      runStats.launchAims.push(step.aim)
    } else if (step.source === 'helper') {
      runStats.previewResponses.push({
        type: 'helper_launch',
        ballType: step.ballType,
        aim: step.aim,
      })
      runStats.helperLaunchCount += 1
      runStats.helperLaunchAims.push(step.aim)
    }
  }

  return runStats
}

type WriteTaskValidationCase = NonNullable<
  NonNullable<GameTask['writeValidation']>['cases']
>[number]

type WriteTaskFeedback = {
  key: WriteTaskFeedbackKey
  values?: Record<string, string>
}

type WriteTaskValidationResult = {
  passed: boolean
  validation: ProgramValidation | null
  feedback?: WriteTaskFeedback
  failedCaseTitle?: string
}

function createWriteTaskFeedback(
  key: WriteTaskFeedbackKey,
  values?: Record<string, string>,
): WriteTaskFeedback {
  return {
    key,
    values,
  }
}

function getWrongChuteFeedback(
  expected: number,
  actual: number,
): WriteTaskFeedback {
  return createWriteTaskFeedback('taskFeedbackWrongChute', {
    expected: String(expected),
    actual: String(actual),
  })
}

function getWrongLaunchCountFeedback(
  expected: number,
  actual: number,
): WriteTaskFeedback {
  return createWriteTaskFeedback('taskFeedbackWrongLaunchCount', {
    expected: String(expected),
    actual: String(actual),
  })
}

function getWriteTaskFeedback(
  task: GameTask,
  validationCase: WriteTaskValidationCase,
  runStats: RunStats,
  programSource: string,
  helperProgramSource: string,
): WriteTaskFeedback | null {
  const combinedSource = `${programSource}\n${helperProgramSource}`
  const expectedPortalSide = validationCase.scenario.portalSide

  switch (task.id) {
    case 'variables-write': {
      if (!sourceMentions(combinedSource, 'portal_side') || !runStats.featureUsage.usedVariables) {
        return createWriteTaskFeedback('taskFeedbackNeedVariableStore')
      }

      if (!runStats.featureUsage.usedChooseInput) {
        return createWriteTaskFeedback('taskFeedbackNeedChooseChute')
      }

      if (runStats.mainLaunchCount === 0) {
        return createWriteTaskFeedback('taskFeedbackNeedDropBall')
      }

      if (runStats.mainLaunchCount !== 1) {
        return getWrongLaunchCountFeedback(1, runStats.mainLaunchCount)
      }

      const actualAim = runStats.launchAims[0]
      const expectedAim = validationCase.expectation.expectedMainLaunchAims?.[0] ?? expectedPortalSide

      if (actualAim !== expectedAim) {
        return getWrongChuteFeedback(expectedAim, actualAim ?? 2)
      }

      return null
    }
    case 'conditions-write': {
      const previewBall = validationCase.scenario.previewQueue[0] ?? 'plain'
      const expectedAim = previewBall === 'center' ? 2 : expectedPortalSide

      if (!runStats.featureUsage.usedIf) {
        return createWriteTaskFeedback('taskFeedbackNeedIf')
      }

      if (previewBall === 'negative') {
        if (runStats.skippedNegativeBallCount === 0) {
          return createWriteTaskFeedback('taskFeedbackNeedSkipEvil')
        }

        if (runStats.mainLaunchCount > 0 || runStats.helperLaunchCount > 0) {
          return createWriteTaskFeedback('taskFeedbackNeedElseLaunch')
        }

        return null
      }

      if (runStats.mainLaunchCount === 0) {
        return createWriteTaskFeedback(
          previewBall === 'portal'
            ? 'taskFeedbackNeedPortalLaunch'
            : 'taskFeedbackNeedCenterLaunch',
        )
      }

      if (!runStats.featureUsage.usedChooseInput) {
        return createWriteTaskFeedback('taskFeedbackNeedChooseChute')
      }

      if (runStats.mainLaunchCount !== 1) {
        return getWrongLaunchCountFeedback(1, runStats.mainLaunchCount)
      }

      const actualAim = runStats.launchAims[0]

      if (actualAim !== expectedAim) {
        return getWrongChuteFeedback(expectedAim, actualAim ?? 2)
      }

      return null
    }
    case 'functions-write': {
      if (
        !runStats.featureUsage.usedHelperCall ||
        !sourceMentions(combinedSource, 'skip_negative')
      ) {
        return createWriteTaskFeedback('taskFeedbackNeedSkipNegativeHelper')
      }

      if (runStats.skippedNegativeBallCount === 0) {
        return createWriteTaskFeedback('taskFeedbackNeedSkipNegativeHelper')
      }

      if (runStats.mainLaunchCount > 0 || runStats.helperLaunchCount > 0) {
        return createWriteTaskFeedback('taskFeedbackNeedSkipNegativeHelper')
      }

      if (runStats.skippedNegativeBallCount !== 1) {
        return createWriteTaskFeedback('taskFeedbackNeedSkipNegativeHelper')
      }

      return null
    }
    case 'loops-write': {
      const portalBallCount = validationCase.scenario.previewQueue.filter(
        (ballType) => ballType === 'portal',
      ).length
      const centerBallCount = validationCase.scenario.previewQueue.filter(
        (ballType) => ballType === 'center',
      ).length
      const portalLaunches = runStats.previewResponses.filter(
        (response) =>
          response.type === 'main_launch' && response.ballType === 'portal',
      )
      const centerLaunches = runStats.previewResponses.filter(
        (response) =>
          response.type === 'main_launch' && response.ballType === 'center',
      )
      const launchedNegativeBall = runStats.previewResponses.some(
        (response) =>
          response.ballType === 'negative' && response.type !== 'skip',
      )

      if (!runStats.featureUsage.usedFor) {
        return createWriteTaskFeedback('taskFeedbackNeedLoop')
      }

      if (!runStats.featureUsage.usedIf) {
        return createWriteTaskFeedback('taskFeedbackNeedIf')
      }

      if (runStats.skippedNegativeBallCount === 0) {
        return createWriteTaskFeedback('taskFeedbackNeedSkipEvil')
      }

      if (launchedNegativeBall) {
        return createWriteTaskFeedback('taskFeedbackNeedElseLaunch')
      }

      if (!runStats.featureUsage.usedChooseInput) {
        return createWriteTaskFeedback('taskFeedbackNeedChooseChute')
      }

      if (portalLaunches.length < portalBallCount) {
        return createWriteTaskFeedback('taskFeedbackNeedPortalLaunch')
      }

      const wrongPortalAim = portalLaunches.find(
        (response) => response.aim !== expectedPortalSide,
      )

      if (wrongPortalAim?.aim !== undefined) {
        if (expectedPortalSide === null || wrongPortalAim.aim === null) {
          return createWriteTaskFeedback('taskFeedbackNeedChooseChute')
        }

        return getWrongChuteFeedback(expectedPortalSide, wrongPortalAim.aim)
      }

      if (centerLaunches.length < centerBallCount) {
        return createWriteTaskFeedback('taskFeedbackNeedCenterLaunch')
      }

      const wrongCenterAim = centerLaunches.find((response) => response.aim !== 2)

      if (wrongCenterAim?.aim !== undefined) {
        if (wrongCenterAim.aim === null) {
          return createWriteTaskFeedback('taskFeedbackNeedChooseChute')
        }

        return getWrongChuteFeedback(2, wrongCenterAim.aim)
      }

      if (runStats.helperLaunchCount > 0) {
        return createWriteTaskFeedback('taskFeedbackNeedPortalLaunch')
      }

      return null
    }
    case 'lists-write': {
      if (!runStats.featureUsage.usedLists) {
        return createWriteTaskFeedback('taskFeedbackNeedList')
      }

      if (!runStats.featureUsage.usedFor) {
        return createWriteTaskFeedback('taskFeedbackNeedLoop')
      }

      if (!runStats.featureUsage.usedIf) {
        return createWriteTaskFeedback('taskFeedbackNeedIf')
      }

      if (!runStats.featureUsage.usedVariables) {
        return createWriteTaskFeedback('taskFeedbackNeedBestTracker')
      }

      if (!runStats.featureUsage.usedChooseInput) {
        return createWriteTaskFeedback('taskFeedbackNeedChooseChute')
      }

      if (runStats.mainLaunchCount === 0) {
        return createWriteTaskFeedback('taskFeedbackNeedDropBall')
      }

      const expectedAims = validationCase.expectation.expectedMainLaunchAims ?? []
      const allowExtraLaunches =
        validationCase.expectation.allowExtraMainLaunches ?? false

      if (
        expectedAims.length > 0 &&
        (allowExtraLaunches
          ? runStats.mainLaunchCount < expectedAims.length
          : runStats.mainLaunchCount !== expectedAims.length)
      ) {
        return getWrongLaunchCountFeedback(
          expectedAims.length,
          runStats.mainLaunchCount,
        )
      }

      const wrongAimIndex = expectedAims.findIndex(
        (expectedAim, index) => runStats.launchAims[index] !== expectedAim,
      )

      if (wrongAimIndex !== -1) {
        return getWrongChuteFeedback(
          expectedAims[wrongAimIndex] ?? 2,
          runStats.launchAims[wrongAimIndex] ?? 2,
        )
      }

      return null
    }
    default:
      return sourceMentions(combinedSource, 'target')
        ? null
        : createWriteTaskFeedback('taskFeedbackNeedVariableStore')
  }
}

export function validateWriteTaskAnswer(
  task: GameTask,
  answer: string,
): WriteTaskValidationResult {
  const validationConfig = task.writeValidation

  if (task.archetype !== 'write' || validationConfig === undefined) {
    return {
      passed: false,
      validation: null,
    }
  }

  const learnedTopicIds = getLearnedTopicsForTask(task.topicId)
  const unlocks = buildUnlockState(learnedTopicIds, [])
  const mainLineLimit =
    validationConfig.target === 'main'
      ? (validationConfig.lineLimit ?? unlocks.lineCapacity)
      : unlocks.lineCapacity
  const helperLineLimit =
    validationConfig.target === 'helper'
      ? (validationConfig.lineLimit ?? unlocks.helperLineCapacity)
      : unlocks.helperLineCapacity

  for (const validationCase of validationConfig.cases) {
    const programSource =
      validationConfig.target === 'main'
        ? answer
        : (validationCase.programContextSource ?? INITIAL_PROGRAM_SOURCE)
    const helperProgramSource =
      validationConfig.target === 'helper'
        ? answer
        : (validationCase.helperContextSource ?? '')

    const parsed = parseProgram(
      programSource,
      helperProgramSource,
      mainLineLimit,
      helperLineLimit,
      unlocks.allowedCommands,
      unlocks.unlockedConstructs,
      getEvaluationContextForScenario(task.topicId, validationCase.scenario),
      validationCase.scenario.previewQueue,
    )
    const targetValidation =
      validationConfig.target === 'main'
        ? parsed.mainValidation
        : parsed.helperValidation

    if (!targetValidation.isValid) {
      return {
        passed: false,
        validation: targetValidation,
        failedCaseTitle: validationCase.title,
      }
    }

    const runStats = createTaskRunStats(parsed)

    if (
      !matchesExecutionExpectation(
        validationCase.expectation,
        runStats,
        `${programSource}\n${helperProgramSource}`,
        validationCase.scenario,
      )
    ) {
      return {
        passed: false,
        validation: null,
        feedback: getWriteTaskFeedback(
          task,
          validationCase,
          runStats,
          programSource,
          helperProgramSource,
        )
          ?? undefined,
        failedCaseTitle: validationCase.title,
      }
    }
  }

  return {
    passed: true,
    validation: null,
  }
}

export function resetToSuggestedGoalCode(
  state: GameState,
  goal: PracticeGoalDefinition,
): GameState {
  if (state.isRunning) {
    return state
  }

  const helperProgramSource =
    goal.starterHelperSource !== undefined
      ? (goal.starterHelperSource ?? '')
      : state.helperProgramSource

  return revalidatePrograms({
    ...state,
    programSource: goal.suggestedSnippet,
    helperProgramSource,
    goalBaselineProgramSource: normalizeSourceForGoalComparison(goal.suggestedSnippet),
    goalBaselineHelperSource: normalizeSourceForGoalComparison(helperProgramSource),
    goalChangeNoticeTarget: null,
  })
}

export function resetProgress(state: GameState): GameState {
  const initialState = createInitialGameState()

  return {
    ...initialState,
    soundEnabled: state.soundEnabled,
  }
}

export function setSoundEnabled(state: GameState, soundEnabled: boolean): GameState {
  if (state.soundEnabled === soundEnabled) {
    return state
  }

  return {
    ...state,
    soundEnabled,
  }
}

export function setCurrentView(state: GameState, view: GameView): GameState {
  if (view === state.currentView || state.isRunning) {
    return state
  }

  if (view === 'shop' && !canOpenShop(state)) {
    return state
  }

  const nextState: GameState = {
    ...state,
    currentView: view,
  }

  if (view === 'shop' && !state.hasOpenedShop) {
    return prependFeedEntries(
      {
        ...nextState,
        hasOpenedShop: true,
      },
      [{ type: 'shop_opened' }],
    )
  }

  return nextState
}

export function updateProgramSource(
  state: GameState,
  programSource: string,
): GameState {
  if (state.isRunning) {
    return state
  }

  return revalidatePrograms({
    ...state,
    programSource,
    goalChangeNoticeTarget: null,
  })
}

export function updateHelperProgramSource(
  state: GameState,
  helperProgramSource: string,
): GameState {
  if (state.isRunning) {
    return state
  }

  return revalidatePrograms({
    ...state,
    helperProgramSource,
    goalChangeNoticeTarget: null,
  })
}

export function setAutoRunEnabled(
  state: GameState,
  enabled: boolean,
): GameState {
  if (!state.autoRunUnlocked) {
    return state
  }

  return {
    ...state,
    autoRunEnabled: enabled,
  }
}

export function startProgramRun(state: GameState): GameState {
  if (
    state.isRunning ||
    state.activeTaskId !== null ||
    state.topicStage === 'checkpoint_ready' ||
    state.topicStage === 'new_unlock_spotlight'
  ) {
    return state
  }

  const parsed = parseProgram(
    state.programSource,
    state.helperProgramSource,
    state.unlocks.lineCapacity,
    state.unlocks.helperLineCapacity,
    state.unlocks.allowedCommands,
    state.unlocks.unlockedConstructs,
    getEvaluationContext(state),
    state.ballQueue.slice(state.ballQueueCursor),
  )

  if (!parsed.mainValidation.isValid || !parsed.helperValidation.isValid) {
    return {
      ...state,
      programValidation: parsed.mainValidation,
      helperProgramValidation: parsed.helperValidation,
      queuedSteps: [],
      activeLineNumber: null,
      isRunning: false,
      plannedBallCount: 0,
    }
  }

  if (parsed.steps.length === 0) {
    return {
      ...state,
      programValidation: parsed.mainValidation,
      helperProgramValidation: parsed.helperValidation,
      queuedSteps: [],
      activeLineNumber: null,
      isRunning: false,
      plannedBallCount: 0,
    }
  }

  return {
    ...state,
    programValidation: parsed.mainValidation,
    helperProgramValidation: parsed.helperValidation,
    queuedSteps: parsed.steps,
    isRunning: true,
    nextSpawnAt: Date.now(),
    activeLineNumber: parsed.steps[0]?.lineNumber ?? null,
    plannedBallCount: parsed.mainValidation.executionStepCount,
    currentView: state.currentView === 'shop' ? 'play' : state.currentView,
    currentRunFeatureUsage: parsed.featureUsage,
    currentRunStats: createRunStats(parsed.featureUsage),
  }
}

export function advanceProgramRun(
  state: GameState,
  tasks: GameTask[],
  topics: TopicDefinition[],
): GameState {
  const now = Date.now()

  let nextState = cleanupBalls(state, now)
  nextState = settleDueBalls(nextState, now)
  nextState = spawnDueBalls(nextState, now)
  nextState = cleanupBalls(nextState, now)

  if (
    nextState.isRunning &&
    nextState.queuedSteps.length === 0 &&
    nextState.activeBalls.length === 0
  ) {
    nextState = {
      ...nextState,
      isRunning: false,
      activeLineNumber: null,
      nextSpawnAt: null,
      plannedBallCount: 0,
    }
  }

  return finalizeRun(nextState, tasks, topics, now)
}

export function startCheckpoint(state: GameState): GameState {
  if (
    state.topicStage !== 'checkpoint_ready' ||
    state.activeCheckpointTaskIds.length === 0
  ) {
    return state
  }

  return {
    ...state,
    topicStage: 'checkpoint_active',
    checkpointIndex: 0,
    activeTaskId: state.activeCheckpointTaskIds[0] ?? null,
  }
}

export function dismissUnlockSpotlight(state: GameState): GameState {
  if (state.topicStage !== 'new_unlock_spotlight') {
    return state
  }

  return {
    ...state,
    topicStage: 'topic_active',
  }
}

export function applyTaskResult(
  state: GameState,
  task: GameTask,
  wasCorrect: boolean,
  tasks: GameTask[],
  topics: TopicDefinition[],
): GameState {
  if (!wasCorrect) {
    return state
  }

  const nextState = prependFeedEntries(
    {
      ...state,
      solvedTaskIds: state.solvedTaskIds.includes(task.id)
        ? state.solvedTaskIds
        : [...state.solvedTaskIds, task.id],
    },
    [
      {
        type: 'task_solved',
        taskId: task.id,
        topicId: task.topicId === 'onboarding' ? undefined : task.topicId,
      },
    ],
  )

  if (task.kind === 'onboarding') {
    const nextOnboardingTaskId = getNextOnboardingTaskId(
      tasks,
      nextState.solvedTaskIds,
    )
    const solvedOnboardingCount = nextState.solvedTaskIds.filter((taskId) =>
      tasks.some((entry) => entry.id === taskId && entry.kind === 'onboarding'),
    ).length

    if (nextOnboardingTaskId !== null) {
      return {
        ...nextState,
        checkpointIndex: solvedOnboardingCount,
        activeTaskId: nextOnboardingTaskId,
      }
    }

    return unlockTopic(
      {
        ...nextState,
        activeTaskId: null,
      },
      'variables',
      topics,
    )
  }

  if (state.currentTopicId === null) {
    return {
      ...nextState,
      activeTaskId: null,
    }
  }

  const nextCheckpointIndex = state.checkpointIndex + 1

  if (nextCheckpointIndex < state.activeCheckpointTaskIds.length) {
    return {
      ...nextState,
      topicStage: 'checkpoint_active',
      checkpointIndex: nextCheckpointIndex,
      activeTaskId: state.activeCheckpointTaskIds[nextCheckpointIndex] ?? null,
    }
  }

  const masteredTopicId = state.currentTopicId
  const masteredState = prependFeedEntries(
    {
      ...nextState,
      activeTaskId: null,
      checkpointIndex: state.activeCheckpointTaskIds.length,
      activeCheckpointTaskIds: [],
      masteredTopicIds: state.masteredTopicIds.includes(masteredTopicId)
        ? state.masteredTopicIds
        : [...state.masteredTopicIds, masteredTopicId],
    },
    [
      {
        type: 'topic_mastered',
        topicId: masteredTopicId,
      },
    ],
  )

  const nextTopic = getNextTopic(topics, masteredTopicId)

  if (nextTopic === null) {
    return revalidatePrograms({
      ...masteredState,
      topicStage: 'completed',
      topicMeter: masteredState.topicMeterGoal,
      activeScenario: null,
      currentRunFeatureUsage: null,
      currentRunStats: null,
    })
  }

  return unlockTopic(masteredState, nextTopic.id, topics)
}

export function purchaseShopNode(
  state: GameState,
  nodeId: SupportUpgradeId,
): GameState {
  if (!canOpenShop(state) || state.isRunning) {
    return state
  }

  const node = SHOP_NODES.find((entry) => entry.id === nodeId)

  if (
    node === undefined ||
    !canPurchaseShopNode(state, nodeId) ||
    state.supportUpgradeIds.includes(node.id) ||
    state.score < node.cost
  ) {
    return state
  }

  return prependFeedEntries(
    revalidatePrograms({
      ...state,
      score: state.score - node.cost,
      supportUpgradeIds: [...state.supportUpgradeIds, node.id],
      unlocks: buildUnlockState(
        state.learnedTopicIds,
        [...state.supportUpgradeIds, node.id],
      ),
    }),
    [
      {
        type: 'support_upgrade_bought',
        upgradeId: node.id,
      },
    ],
  )
}

export function spawnAmbientPlainBall(state: GameState): GameState {
  const supportEffects = getSupportUpgradeEffects(state.supportUpgradeIds)

  if (
    supportEffects.ambientDropIntervalMs === null ||
    state.currentView !== 'play' ||
    state.topicStage !== 'completed' ||
    state.activeTaskId !== null ||
    state.isRunning ||
    state.activeBalls.length > 0 ||
    !state.introDismissed
  ) {
    return state
  }

  const now = Date.now()
  const portalEnabled = isBluePortalActive(state)
  const ambientBallType: BallType =
    state.currentTopicId === 'lists' || state.learnedTopicIds.includes('lists')
      ? 'center'
      : 'plain'
  const outcome = createBallOutcome(
    2,
    state.moduleStates.board.portalSide,
    ambientBallType,
    {
      launchIndex: 0,
      portalEnabled,
      portalDepth: 0,
      maxPortalDepth: supportEffects.maxPortalDepth,
      extraCenterBinBonus: supportEffects.extraCenterBinBonus,
      laneMultiplier: getLaneMultiplier(state, 2),
    },
  )

  return {
    ...state,
    activeBalls: [
      ...state.activeBalls,
      {
        id: state.nextBallId,
        lineNumber: 0,
        aim: 2,
        source: 'ambient',
        ballType: ambientBallType,
        laneMultiplier: outcome.laneMultiplier,
        spawnKind: 'direct',
        portalDepth: 0,
        bucketIndex: outcome.bucketIndex,
        basePoints: outcome.basePoints,
        usedCenterBonus: outcome.usedCenterBonus,
        centerBonusValue: outcome.centerBonusValue,
        usedNegativePenalty: outcome.usedNegativePenalty,
        triggeredPortal: outcome.triggeredPortal,
        points: outcome.points,
        scoreBreakdown: [],
        path: outcome.path,
        spawnedAt: now,
        settleAt: now + BALL_FALL_DURATION_MS,
        removeAt: now + BALL_FALL_DURATION_MS + BALL_SETTLE_HOLD_MS,
        state: 'falling',
      },
    ],
    nextBallId: state.nextBallId + 1,
  }
}
