import type {
  ActiveBall,
  ActiveBallVariant,
  FeedEntry,
  FeedEntryType,
  GameState,
  GameTask,
  GameView,
  ProgramFeatureUsage,
  RunStats,
  SupportUpgradeId,
  TaskTopicId,
  TopicDefinition,
} from '../types'
import {
  BALL_FALL_DURATION_MS,
  BALL_SETTLE_HOLD_MS,
  BALL_SPAWN_INTERVAL_MS,
  bucketIndexToLane,
  createBallOutcome,
  rollBonusLane,
  rollComboTarget,
  rollGateState,
  rollLaneValues,
} from './pachinko'
import {
  BASE_HELPER_LINE_LIMIT,
  INITIAL_HELPER_SOURCE,
  INITIAL_PROGRAM_SOURCE,
  parseProgram,
} from './program'
import { canOpenShop, canPurchaseShopNode, SHOP_NODES } from './shop'

const FEED_LIMIT = 8
const JACKPOT_BONUS = 2
const RETURN_GATE_BONUS = 2
const BASE_RELAY_BONUS = 3
const BOOSTED_RELAY_BONUS = 5
const BASE_LIGHTNING_BONUS = 3
const BOOSTED_LIGHTNING_BONUS = 5

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
  return {
    bonus_lane: state.bonusLane,
    left_value: state.moduleStates.calibration.leftValue,
    center_value: state.moduleStates.calibration.centerValue,
    right_value: state.moduleStates.calibration.rightValue,
    jackpot_side: state.moduleStates.diverter.jackpotSide,
    return_side: state.moduleStates.diverter.returnSide,
    shield_side: state.moduleStates.diverter.returnSide,
    return_gate_open: state.moduleStates.diverter.returnGateOpen ? 1 : 0,
    feeder_charge: state.moduleStates.burst.feederCharge,
    combo_target: state.moduleStates.burst.comboTarget,
    burst_ready: state.moduleStates.burst.burstReady ? 1 : 0,
  }
}

function createFeatureUsage(): ProgramFeatureUsage {
  return {
    usedVariables: false,
    usedSetAim: false,
    usedIf: false,
    usedHelperCall: false,
    usedFor: false,
  }
}

function createRunStats(featureUsage: ProgramFeatureUsage): RunStats {
  return {
    featureUsage,
    resolvedBalls: 0,
    hitBonusLaneCount: 0,
    hitBestLaneCount: 0,
    hitJackpotLaneCount: 0,
    hitReturnLaneCount: 0,
    openedReturnGate: false,
    usedReturnGateCount: 0,
    relayArmedThisRun: false,
    relayTriggeredCount: 0,
    feederHitCount: 0,
    lightningBallsResolved: 0,
  }
}

function getRelayBonus(state: GameState): number {
  return state.supportUpgradeIds.includes('relay_bonus')
    ? BOOSTED_RELAY_BONUS
    : BASE_RELAY_BONUS
}

function getLightningBonus(state: GameState): number {
  return state.supportUpgradeIds.includes('lightning_bonus')
    ? BOOSTED_LIGHTNING_BONUS
    : BASE_LIGHTNING_BONUS
}

function createInitialModuleState(): GameState['moduleStates'] {
  const laneValues = rollLaneValues()
  const gateState = rollGateState()

  return {
    calibration: {
      ...laneValues,
      focusCharge: 0,
      focusThreshold: 3,
      luckyBallReady: false,
    },
    diverter: {
      jackpotSide: gateState.jackpotSide,
      returnSide: gateState.returnSide,
      returnGateOpen: false,
    },
    relay: {
      helperName: 'follow_bonus',
      relayArmed: false,
      relayTargetLane: null,
    },
    burst: {
      feederCharge: 0,
      feederTarget: 3,
      comboTarget: rollComboTarget(),
      burstReady: false,
      lightningShotsRemaining: 0,
    },
  }
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
  )

  return {
    ...state,
    programValidation: parsed.mainValidation,
    helperProgramValidation: parsed.helperValidation,
  }
}

function markBallSettled(ball: ActiveBall, now: number): ActiveBall {
  return {
    ...ball,
    state: 'settled',
    removeAt: now + BALL_SETTLE_HOLD_MS,
  }
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

  while (
    queuedSteps.length > 0 &&
    nextSpawnAt !== null &&
    nextSpawnAt <= now
  ) {
    const [step, ...remainingSteps] = queuedSteps

    if (step === undefined) {
      break
    }

    const outcome = createBallOutcome(step.aim, state.bonusLane)
    const activeBall: ActiveBall = {
      id: nextBallId,
      lineNumber: step.lineNumber,
      aim: step.aim,
      bucket: outcome.bucket,
      bucketIndex: outcome.bucketIndex,
      laneBonus: outcome.laneBonus,
      points: outcome.points,
      variant: 'normal',
      pathXs: outcome.pathXs,
      spawnedAt: nextSpawnAt,
      settleAt: nextSpawnAt + BALL_FALL_DURATION_MS,
      removeAt: nextSpawnAt + BALL_FALL_DURATION_MS + BALL_SETTLE_HOLD_MS,
      state: 'falling',
    }

    activeBalls = [...activeBalls, activeBall]
    queuedSteps = remainingSteps
    activeLineNumber = step.lineNumber
    nextBallId += 1
    nextSpawnAt += BALL_SPAWN_INTERVAL_MS
  }

  return {
    ...state,
    queuedSteps,
    activeBalls,
    nextBallId,
    nextSpawnAt: queuedSteps.length === 0 ? null : nextSpawnAt,
    activeLineNumber,
  }
}

function settleBall(state: GameState, ball: ActiveBall, now: number): GameState {
  const runStats = state.currentRunStats ?? createRunStats(createFeatureUsage())
  const lane = bucketIndexToLane(ball.bucketIndex)

  let points = ball.points
  let variant: ActiveBallVariant = ball.variant
  const nextModuleStates = {
    calibration: { ...state.moduleStates.calibration },
    diverter: { ...state.moduleStates.diverter },
    relay: { ...state.moduleStates.relay },
    burst: { ...state.moduleStates.burst },
  }

  runStats.resolvedBalls += 1

  if (lane === state.bonusLane) {
    runStats.hitBonusLaneCount += 1
  }

  if (nextModuleStates.burst.lightningShotsRemaining > 0) {
    points += getLightningBonus(state)
    nextModuleStates.burst.lightningShotsRemaining -= 1
    runStats.lightningBallsResolved += 1
    variant = 'lightning'
  }

  if (lane === nextModuleStates.diverter.jackpotSide) {
    runStats.hitJackpotLaneCount += 1

    if (runStats.featureUsage.usedIf) {
      points += JACKPOT_BONUS
      nextModuleStates.diverter.returnGateOpen = true
      runStats.openedReturnGate = true

      if (variant === 'normal') {
        variant = 'jackpot'
      }
    }
  }

  if (lane === nextModuleStates.diverter.returnSide) {
    runStats.hitReturnLaneCount += 1

    if (nextModuleStates.diverter.returnGateOpen) {
      points += RETURN_GATE_BONUS
      runStats.usedReturnGateCount += 1

      if (!state.supportUpgradeIds.includes('return_gate_hold')) {
        nextModuleStates.diverter.returnGateOpen = false
      }

      if (variant === 'normal') {
        variant = 'return'
      }
    }
  }

  if (
    nextModuleStates.relay.relayArmed &&
    nextModuleStates.relay.relayTargetLane === lane
  ) {
    points += getRelayBonus(state)
    runStats.relayTriggeredCount += 1
    nextModuleStates.relay.relayArmed = false
    nextModuleStates.relay.relayTargetLane = null

    if (variant === 'normal') {
      variant = 'relay'
    }
  }

  if (runStats.featureUsage.usedHelperCall && lane === state.bonusLane) {
    nextModuleStates.relay.relayArmed = true
    nextModuleStates.relay.relayTargetLane = state.bonusLane
    runStats.relayArmedThisRun = true
  }

  if (runStats.featureUsage.usedFor && lane === nextModuleStates.burst.comboTarget) {
    runStats.feederHitCount += 1
    nextModuleStates.burst.feederCharge += 1

    if (nextModuleStates.burst.feederCharge >= nextModuleStates.burst.feederTarget) {
      nextModuleStates.burst.feederCharge = 0
      nextModuleStates.burst.burstReady = true
    }
  }

  return {
    ...state,
    moduleStates: nextModuleStates,
    currentRunStats: runStats,
    score: state.score + points,
    resolvedDropCount: state.resolvedDropCount + 1,
    lastPoints: points,
    lastBucket: ball.bucketIndex + 1,
    streak: points >= 6 ? state.streak + 1 : 0,
    activeBalls: state.activeBalls.map((entry) =>
      entry.id === ball.id
        ? markBallSettled(
            {
              ...entry,
              points,
              variant,
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
      return featureUsage.usedSetAim || featureUsage.usedVariables
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
        runStats.featureUsage.usedSetAim &&
        runStats.hitBonusLaneCount > 0 &&
        /\bbonus_lane\b/.test(combinedSource)
      )
    case 'conditions':
      return (
        runStats.featureUsage.usedIf &&
        (runStats.openedReturnGate || runStats.usedReturnGateCount > 0) &&
        /\b(jackpot_side|return_side|return_gate_open)\b/.test(combinedSource)
      )
    case 'functions':
      return (
        runStats.featureUsage.usedHelperCall &&
        (runStats.relayArmedThisRun || runStats.relayTriggeredCount > 0)
      )
    case 'loops':
      return (
        runStats.featureUsage.usedFor &&
        (runStats.feederHitCount > 0 || runStats.lightningBallsResolved > 0)
      )
    default:
      return false
  }
}

function refreshMachineState(state: GameState): GameState {
  const nextLaneValues = rollLaneValues()
  const nextGateState = state.moduleStates.diverter.returnGateOpen
    ? {
        jackpotSide: state.moduleStates.diverter.jackpotSide,
        returnSide: state.moduleStates.diverter.returnSide,
      }
    : rollGateState()
  const nextComboTarget =
    state.moduleStates.burst.feederCharge > 0 ||
    state.moduleStates.burst.burstReady ||
    state.moduleStates.burst.lightningShotsRemaining > 0
      ? state.moduleStates.burst.comboTarget
      : rollComboTarget()
  const nextModuleStates = {
    calibration: {
      ...state.moduleStates.calibration,
      ...nextLaneValues,
    },
    diverter: {
      ...state.moduleStates.diverter,
      jackpotSide: nextGateState.jackpotSide,
      returnSide: nextGateState.returnSide,
    },
    relay: { ...state.moduleStates.relay },
    burst: {
      ...state.moduleStates.burst,
      comboTarget: nextComboTarget,
    },
  }

  if (
    !state.supportUpgradeIds.includes('feeder_persistence') &&
    (state.currentRunStats?.feederHitCount ?? 0) === 0 &&
    !nextModuleStates.burst.burstReady
  ) {
    nextModuleStates.burst.feederCharge = 0
  }

  return {
    ...state,
    bonusLane: rollBonusLane(),
    moduleStates: nextModuleStates,
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
        allowedCommands: unlocks.allowedCommands.includes('set_aim')
          ? unlocks.allowedCommands
          : [...unlocks.allowedCommands, 'set_aim'],
        unlockedConstructs: unlocks.unlockedConstructs.includes('variables')
          ? unlocks.unlockedConstructs
          : [...unlocks.unlockedConstructs, 'variables'],
      }
      break
    case 'conditions':
      unlocks = {
        ...unlocks,
        lineCapacity: Math.max(unlocks.lineCapacity, 5),
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
  }

  if (nextState.topicStage === 'onboarding') {
    const nextTaskId = getNextOnboardingTaskId(tasks, nextState.solvedTaskIds)
    nextState = refreshMachineState({
      ...nextState,
      currentRunFeatureUsage: null,
      currentRunStats: null,
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
    lastBucket: 3,
    streak: 0,
    bonusLane: rollBonusLane(),
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
  )

  if (!parsed.mainValidation.isValid || !parsed.helperValidation.isValid) {
    return {
      ...state,
      programValidation: parsed.mainValidation,
      helperProgramValidation: parsed.helperValidation,
      queuedSteps: [],
      activeLineNumber: null,
      isRunning: false,
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
    }
  }

  const nextState: GameState = {
    ...state,
    programValidation: parsed.mainValidation,
    helperProgramValidation: parsed.helperValidation,
    queuedSteps: parsed.steps,
    isRunning: true,
    nextSpawnAt: Date.now(),
    activeLineNumber: parsed.steps[0]?.lineNumber ?? null,
    currentView: state.currentView === 'shop' ? 'play' : state.currentView,
    currentRunFeatureUsage: parsed.featureUsage,
    currentRunStats: createRunStats(parsed.featureUsage),
    moduleStates: {
      ...state.moduleStates,
      burst:
        state.moduleStates.burst.burstReady &&
        state.moduleStates.burst.lightningShotsRemaining === 0
          ? {
              ...state.moduleStates.burst,
              burstReady: false,
              lightningShotsRemaining: 2,
            }
          : state.moduleStates.burst,
    },
  }

  return nextState
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
