import type {
  FeedEntry,
  FeedEntryType,
  GameState,
  GameTask,
  GameView,
  ProgramFeatureUsage,
  RunStats,
  ScoreBreakdownLine,
  SupportUpgradeId,
  TaskTopicId,
  TopicDefinition,
} from '../types'
import {
  BALL_CANCEL_DURATION_MS,
  BALL_FALL_DURATION_MS,
  BALL_SETTLE_HOLD_MS,
  BALL_SPAWN_INTERVAL_MS,
  DEFAULT_EVIL_PENALTY,
  DEFAULT_LUCKY_BONUS,
  DEFAULT_PORTAL_CHILD_COUNT,
  createBallQueue,
  createBallOutcome,
  refillBallQueue,
  rollPortalSide,
} from './pachinko'
import {
  BASE_HELPER_LINE_LIMIT,
  INITIAL_HELPER_SOURCE,
  INITIAL_PROGRAM_SOURCE,
  parseProgram,
} from './program'
import { canOpenShop, canPurchaseShopNode, SHOP_NODES } from './shop'

const FEED_LIMIT = 8

type FeedEntryInput = {
  type: FeedEntryType
  taskId?: string
  topicId?: TaskTopicId
  upgradeId?: SupportUpgradeId
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

function getEvaluationContext(state: GameState) {
  const nextBall = state.ballQueue[state.ballQueueCursor] ?? 'normal'

  return {
    ...(state.learnedTopicIds.includes('variables')
      ? {
          portal_side: state.moduleStates.board.portalSide,
        }
      : {}),
    ...(state.learnedTopicIds.includes('conditions')
      ? {
          next_ball:
            nextBall === 'lucky' ? 2 : nextBall === 'evil' ? 3 : 1,
          normal_ball: 1,
          lucky_ball: 2,
          evil_ball: 3,
        }
      : {}),
  }
}

function createFeatureUsage(): ProgramFeatureUsage {
  return {
    usedVariables: false,
    usedChooseChute: false,
    usedIf: false,
    usedHelperCall: false,
    usedFor: false,
  }
}

function createRunStats(featureUsage: ProgramFeatureUsage): RunStats {
  return {
    featureUsage,
    spawnedBalls: 0,
    programStepSpawnedCount: 0,
    resolvedBalls: 0,
    portalSplitCount: 0,
    skippedEvilBallCount: 0,
    luckyBallHitCount: 0,
    helperPositiveOutcomeCount: 0,
    positiveOutcomeCount: 0,
  }
}

function createInitialModuleState(): GameState['moduleStates'] {
  return {
    board: {
      portalSide: rollPortalSide(),
    },
  }
}

function getLuckyBonusValue(state: GameState): number {
  return DEFAULT_LUCKY_BONUS + (state.supportUpgradeIds.includes('lucky_bonus') ? 2 : 0)
}

function getPortalChildCount(state: GameState): number {
  return DEFAULT_PORTAL_CHILD_COUNT + (state.supportUpgradeIds.includes('portal_overcharge') ? 1 : 0)
}

function getRefilledQueue(state: GameState): GameState['ballQueue'] {
  return refillBallQueue(state.ballQueue, state.ballQueueCursor, {
    conditionsUnlocked: state.learnedTopicIds.includes('conditions'),
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

  if (ball.usedLuckyBonus) {
    lines.push({
      kind: 'lucky_bonus',
      value: getLuckyBonusValueFromBall(ball),
    })
  }

  if (ball.usedEvilPenalty) {
    lines.push({
      kind: 'evil_penalty',
      value: DEFAULT_EVIL_PENALTY,
    })
  }

  lines.push({
    kind: 'total',
    value: total,
  })

  return lines
}

function getLuckyBonusValueFromBall(ball: GameState['activeBalls'][number]): number {
  return ball.points - ball.basePoints
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
    ballQueueCursor += 1

    if (step.type === 'skip_ball') {
      runStats = {
        ...runStats,
        skippedEvilBallCount:
          runStats.skippedEvilBallCount + (step.ballType === 'evil' ? 1 : 0),
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
        portalEnabled: state.learnedTopicIds.includes('variables'),
        portalDepth: 0,
        luckyBonusValue: getLuckyBonusValue(state),
      },
    )
    const activeBall = {
      id: nextBallId,
      lineNumber: step.lineNumber,
      aim: step.aim,
      source: step.source,
      ballType: step.ballType,
      spawnKind: 'direct' as const,
      portalDepth: 0,
      bucketIndex: outcome.bucketIndex,
      basePoints: outcome.basePoints,
      usedLuckyBonus: outcome.usedLuckyBonus,
      usedEvilPenalty: outcome.usedEvilPenalty,
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
  const outcome = createBallOutcome(
    parentBall.aim,
    state.moduleStates.board.portalSide,
    parentBall.ballType,
    {
      launchIndex,
      portalEnabled: state.learnedTopicIds.includes('variables'),
      portalDepth: 1,
      luckyBonusValue: getLuckyBonusValue(state),
    },
  )

  return {
    id: ballId,
    lineNumber: parentBall.lineNumber,
    aim: parentBall.aim,
    source: parentBall.source,
    ballType: parentBall.ballType,
    spawnKind: 'portal' as const,
    portalDepth: 1,
    bucketIndex: outcome.bucketIndex,
    basePoints: outcome.basePoints,
    usedLuckyBonus: outcome.usedLuckyBonus,
    usedEvilPenalty: outcome.usedEvilPenalty,
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
  const runStats = state.currentRunStats ?? createRunStats(createFeatureUsage())
  const didEarnPositiveOutcome = ball.usedLuckyBonus || ball.triggeredPortal

  const nextRunStats: RunStats = {
    ...runStats,
    resolvedBalls: runStats.resolvedBalls + 1,
    portalSplitCount: runStats.portalSplitCount + (ball.triggeredPortal ? 1 : 0),
    luckyBallHitCount: runStats.luckyBallHitCount + (ball.usedLuckyBonus ? 1 : 0),
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
    const childCount = getPortalChildCount(state)
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
    currentRunStats: nextRunStats,
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

function hasUsedCurrentTopicFeature(
  state: GameState,
  topicId: TaskTopicId | null,
): boolean {
  if (topicId === null || state.currentRunStats === null) {
    return false
  }

  const { featureUsage } = state.currentRunStats

  switch (topicId) {
    case 'variables':
      return featureUsage.usedChooseChute || featureUsage.usedVariables
    case 'conditions':
      return featureUsage.usedIf
    case 'functions':
      return featureUsage.usedHelperCall
    case 'loops':
      return featureUsage.usedFor
    default:
      return false
  }
}

function didCompleteTopicGoal(
  state: GameState,
  topicId: TaskTopicId,
  runStats: RunStats,
): boolean {
  const combinedSource = `${state.programSource}\n${state.helperProgramSource}`

  switch (topicId) {
    case 'variables':
      return (
        runStats.featureUsage.usedChooseChute &&
        runStats.portalSplitCount > 0 &&
        /\bportal_side\b/.test(combinedSource)
      )
    case 'conditions':
      return (
        runStats.featureUsage.usedIf &&
        runStats.skippedEvilBallCount > 0 &&
        /\bnext_ball\b/.test(combinedSource) &&
        /\bevil_ball\b/.test(combinedSource)
      )
    case 'functions':
      return (
        runStats.featureUsage.usedHelperCall &&
        runStats.helperPositiveOutcomeCount > 0
      )
    case 'loops':
      return (
        runStats.featureUsage.usedFor &&
        runStats.programStepSpawnedCount >= 3 &&
        runStats.positiveOutcomeCount >= 2
      )
    default:
      return false
  }
}

function refreshMachineState(state: GameState): GameState {
  return {
    ...state,
    ballQueue: getRefilledQueue(state),
    ballQueueCursor: 0,
    moduleStates: {
      board: {
        portalSide: rollPortalSide(),
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

function unlockTopic(
  state: GameState,
  topicId: TaskTopicId,
  topics: TopicDefinition[],
): GameState {
  const topic = getTopicById(topics, topicId)

  if (topic === null) {
    return state
  }

  let unlocks = state.unlocks
  let helperProgramSource = state.helperProgramSource

  switch (topicId) {
    case 'variables':
      unlocks = {
        ...unlocks,
        editorEditable: true,
        lineCapacity: Math.max(unlocks.lineCapacity, 3),
        allowedCommands: unlocks.allowedCommands.includes('choose_chute')
          ? unlocks.allowedCommands
          : [...unlocks.allowedCommands, 'choose_chute'],
        unlockedConstructs: unlocks.unlockedConstructs.includes('variables')
          ? unlocks.unlockedConstructs
          : [...unlocks.unlockedConstructs, 'variables'],
      }
      break
    case 'conditions':
      unlocks = {
        ...unlocks,
        lineCapacity: Math.max(unlocks.lineCapacity, 5),
        allowedCommands: unlocks.allowedCommands.includes('skip_ball')
          ? unlocks.allowedCommands
          : [...unlocks.allowedCommands, 'skip_ball'],
        unlockedConstructs: unlocks.unlockedConstructs.includes('if')
          ? unlocks.unlockedConstructs
          : [...unlocks.unlockedConstructs, 'if'],
      }
      break
    case 'functions':
      unlocks = {
        ...unlocks,
        unlockedConstructs: unlocks.unlockedConstructs.includes('functions')
          ? unlocks.unlockedConstructs
          : [...unlocks.unlockedConstructs, 'functions'],
      }
      if (helperProgramSource.trim() === '') {
        helperProgramSource = INITIAL_HELPER_SOURCE
      }
      break
    case 'loops':
      unlocks = {
        ...unlocks,
        unlockedConstructs: unlocks.unlockedConstructs.includes('for')
          ? unlocks.unlockedConstructs
          : [...unlocks.unlockedConstructs, 'for'],
      }
      break
    default:
      break
  }

  const learnedTopicIds = state.learnedTopicIds.includes(topicId)
    ? state.learnedTopicIds
    : [...state.learnedTopicIds, topicId]
  const shouldRegenerateQueue = topicId === 'conditions'

  return revalidatePrograms(
    prependFeedEntries(
      {
        ...state,
        unlocks,
        helperProgramSource,
        currentTopicId: topicId,
        learnedTopicIds,
        topicStage: 'new_unlock_spotlight',
        topicMeter: 0,
        topicMeterGoal: topic.meterGoal,
        activeCheckpointTaskIds: [],
        checkpointIndex: 0,
        activeTaskId: null,
        ballQueue: shouldRegenerateQueue
          ? createBallQueue({
              conditionsUnlocked: learnedTopicIds.includes('conditions'),
              currentTopicId: topicId,
              topicStage: 'new_unlock_spotlight',
            })
          : getRefilledQueue({
              ...state,
              learnedTopicIds,
            }),
        ballQueueCursor: 0,
        moduleStates: {
          board: {
            portalSide: rollPortalSide(),
          },
        },
      },
      [
        {
          type: 'module_installed',
          topicId,
        },
      ],
    ),
  )
}

function completeRun(
  state: GameState,
  tasks: GameTask[],
  topics: TopicDefinition[],
): GameState {
  let nextState: GameState = {
    ...state,
    isRunning: false,
    activeLineNumber: null,
    nextSpawnAt: null,
    plannedBallCount: 0,
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
      return {
        ...nextState,
        activeTaskId: nextTaskId,
      }
    }

    return unlockTopic(nextState, 'variables', topics)
  }

  if (
    nextState.topicStage === 'new_unlock_spotlight' &&
    hasUsedCurrentTopicFeature(nextState, nextState.currentTopicId)
  ) {
    nextState = {
      ...nextState,
      topicStage: 'topic_active',
    }
  }

  if (
    (nextState.topicStage === 'topic_active' ||
      nextState.topicStage === 'new_unlock_spotlight') &&
    nextState.currentTopicId !== null &&
    nextState.currentRunStats !== null
  ) {
    const didCompleteGoal = didCompleteTopicGoal(
      nextState,
      nextState.currentTopicId,
      nextState.currentRunStats,
    )
    const targetTopic = getTopicById(topics, nextState.currentTopicId)

    if (targetTopic !== null && didCompleteGoal) {
      const nextMeter = Math.min(targetTopic.meterGoal, nextState.topicMeter + 1)
      nextState = {
        ...nextState,
        topicMeter: nextMeter,
        topicMeterGoal: targetTopic.meterGoal,
      }

      if (nextMeter >= targetTopic.meterGoal) {
        nextState = prependFeedEntries(
          {
            ...nextState,
            topicStage: 'checkpoint_ready',
            activeCheckpointTaskIds: targetTopic.masteryTaskIds,
            checkpointIndex: 0,
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

export function createInitialGameState(): GameState {
  const initialState: GameState = {
    currentView: 'play',
    score: 0,
    resolvedDropCount: 0,
    isRunning: false,
    unlocks: {
      editorEditable: false,
      lineCapacity: 1,
      helperLineCapacity: BASE_HELPER_LINE_LIMIT,
      allowedCommands: ['drop_ball'],
      unlockedConstructs: [],
    },
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
    activeCheckpointTaskIds: [],
    checkpointIndex: 0,
    activeTaskId: null,
    solvedTaskIds: [],
    moduleStates: createInitialModuleState(),
    supportUpgradeIds: [],
    feedEntries: [],
    nextFeedEntryId: 1,
    currentRunFeatureUsage: null,
    currentRunStats: null,
    plannedBallCount: 0,
    hasOpenedShop: false,
  }

  return revalidatePrograms(initialState)
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
  })
}

export function startProgramRun(state: GameState): GameState {
  if (state.isRunning || state.activeTaskId !== null || state.topicStage === 'checkpoint_ready') {
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

    if (nextOnboardingTaskId !== null) {
      return {
        ...nextState,
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
      unlocks: {
        ...state.unlocks,
        lineCapacity: state.unlocks.lineCapacity + (node.mainLineCapacityBonus ?? 0),
        helperLineCapacity:
          state.unlocks.helperLineCapacity + (node.helperLineCapacityBonus ?? 0),
      },
    }),
    [
      {
        type: 'support_upgrade_bought',
        upgradeId: node.id,
      },
    ],
  )
}
