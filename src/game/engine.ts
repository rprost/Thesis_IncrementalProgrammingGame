import type {
  ActiveBall,
  FeedEntry,
  FeedEntryType,
  GameView,
  GameState,
  GameTask,
  ShopNodeId,
  TutorialStep,
} from '../types'
import {
  BALL_CANCEL_DURATION_MS,
  BALL_FALL_DURATION_MS,
  BALL_SETTLE_HOLD_MS,
  BALL_SPAWN_INTERVAL_MS,
  createBallOutcome,
  getBallRenderState,
  getTaskTarget,
  rollBonusLane,
} from './pachinko'
import {
  INITIAL_HELPER_SOURCE,
  INITIAL_PROGRAM_SOURCE,
  parseProgram,
} from './program'
import { canOpenShop, canPurchaseShopNode, SHOP_NODES } from './shop'

const FEED_LIMIT = 8

type FeedEntryInput = {
  type: FeedEntryType
  taskId?: string
  lineCapacity?: number
  upgradeId?: ShopNodeId
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

function hasRemainingTasks(tasks: GameTask[], solvedTaskIds: string[]): boolean {
  const solved = new Set(solvedTaskIds)
  return tasks.some((task) => !solved.has(task.id))
}

function getNextTaskId(
  tasks: GameTask[],
  solvedTaskIds: string[],
): string | null {
  const solved = new Set(solvedTaskIds)
  const unsolvedTasks = tasks.filter((task) => !solved.has(task.id))

  if (unsolvedTasks.length === 0) {
    return null
  }

  const currentTopicOrder = unsolvedTasks.reduce((lowest, task) => {
    return Math.min(lowest, task.topicOrder)
  }, Number.POSITIVE_INFINITY)

  const topicTasks = unsolvedTasks.filter(
    (task) => task.topicOrder === currentTopicOrder,
  )

  if (topicTasks.length === 0) {
    return null
  }

  const randomIndex = Math.floor(Math.random() * topicTasks.length)
  return topicTasks[randomIndex]?.id ?? null
}

function revalidatePrograms(state: GameState): GameState {
  const parsed = parseProgram(
    state.programSource,
    state.helperProgramSource,
    state.unlocks.lineCapacity,
    state.unlocks.allowedCommands,
    state.unlocks.unlockedConstructs,
    {
      bonus_lane: state.bonusLane,
    },
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

function markBallCanceled(ball: ActiveBall, now: number): ActiveBall {
  const { x, y } = getBallRenderState(ball, now)

  return {
    ...ball,
    state: 'canceled',
    removeAt: now + BALL_CANCEL_DURATION_MS,
    cancelX: x,
    cancelY: y,
  }
}

function spawnDueBalls(state: GameState, now: number): GameState {
  if (!state.isRunning || state.pendingTaskId !== null || state.nextSpawnAt === null) {
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

function settleDueBalls(
  state: GameState,
  tasks: GameTask[],
  now: number,
): GameState {
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

    nextState = {
      ...nextState,
      activeBalls: nextState.activeBalls.map((entry) =>
        entry.id === ball.id ? markBallSettled(entry, now) : entry,
      ),
      score: nextState.score + ball.points * nextState.multiplier,
      runCount: nextState.runCount + 1,
      lastPoints: ball.points,
      lastBucket: ball.bucketIndex + 1,
      streak: ball.points >= 4 ? nextState.streak + 1 : 0,
      dropsTowardNextTask: nextState.dropsTowardNextTask + 1,
    }

    if (
      hasRemainingTasks(tasks, nextState.solvedTaskIds) &&
      nextState.dropsTowardNextTask >= nextState.currentTaskTarget
    ) {
      const pendingTaskId =
        nextState.activeTaskId ?? getNextTaskId(tasks, nextState.solvedTaskIds)

      if (pendingTaskId !== null) {
        nextState = {
          ...nextState,
          pendingTaskId,
          isRunning: false,
          queuedSteps: [],
          nextSpawnAt: null,
          activeLineNumber: null,
          dropsTowardNextTask: 0,
          bonusLane: rollBonusLane(),
          activeBalls: nextState.activeBalls.map((entry) =>
            entry.id === ball.id || entry.state !== 'falling'
              ? entry
              : markBallCanceled(entry, now),
          ),
        }
      }

      break
    }
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

function finalizeRun(state: GameState, now: number): GameState {
  const hasVisibleBalls = state.activeBalls.some((ball) => ball.removeAt > now)

  if (state.pendingTaskId !== null) {
    if (hasVisibleBalls) {
      return state
    }

    return {
      ...state,
      activeTaskId: state.pendingTaskId,
      pendingTaskId: null,
      isTaskOpen: true,
      tutorialStep:
        state.tutorialStep === 'run_program'
          ? 'first_challenge'
          : state.tutorialStep,
    }
  }

  if (state.isRunning || state.queuedSteps.length > 0 || hasVisibleBalls) {
    return state
  }

  return {
    ...state,
    activeLineNumber: null,
  }
}

export function createInitialGameState(): GameState {
  const unlocks: GameState['unlocks'] = {
    editorVisible: true,
    editorEditable: false,
    lineCapacity: 1,
    allowedCommands: ['drop_ball'],
    unlockedConstructs: [],
  }

  const initialState: GameState = {
    currentView: 'play',
    score: 0,
    runCount: 0,
    multiplier: 1,
    correctAnswerCount: 0,
    solvedTaskIds: [],
    activeTaskId: null,
    pendingTaskId: null,
    isTaskOpen: false,
    isRunning: false,
    unlocks,
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
    bonusLane: 2,
    dropsTowardNextTask: 0,
    currentTaskTarget: 5,
    feedEntries: [],
    nextFeedEntryId: 1,
    tutorialStep: 'run_program',
    dismissedTutorialSteps: [],
    purchasedUpgradeIds: [],
    hasOpenedShop: false,
  }

  return revalidatePrograms(initialState)
}

export function dismissTutorialStep(
  state: GameState,
  tutorialStep: TutorialStep,
): GameState {
  if (state.dismissedTutorialSteps.includes(tutorialStep)) {
    return state
  }

  return {
    ...state,
    dismissedTutorialSteps: [...state.dismissedTutorialSteps, tutorialStep],
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
  if (state.isTaskOpen || state.isRunning) {
    return state
  }

  const parsed = parseProgram(
    state.programSource,
    state.helperProgramSource,
    state.unlocks.lineCapacity,
    state.unlocks.allowedCommands,
    state.unlocks.unlockedConstructs,
    {
      bonus_lane: state.bonusLane,
    },
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
      bonusLane: rollBonusLane(),
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
    currentView: state.currentView === 'shop' ? 'play' : state.currentView,
  }
}

export function advanceProgramRun(state: GameState, tasks: GameTask[]): GameState {
  const now = Date.now()

  let nextState = cleanupBalls(state, now)
  nextState = settleDueBalls(nextState, tasks, now)
  nextState = spawnDueBalls(nextState, now)
  nextState = cleanupBalls(nextState, now)

  if (
    nextState.isRunning &&
    nextState.queuedSteps.length === 0 &&
    nextState.activeBalls.length === 0 &&
    nextState.pendingTaskId === null
  ) {
    nextState = {
      ...nextState,
      isRunning: false,
      activeLineNumber: null,
      nextSpawnAt: null,
      bonusLane: rollBonusLane(),
    }
  }

  if (
    !nextState.isRunning &&
    nextState.pendingTaskId === null &&
    nextState.queuedSteps.length === 0 &&
    nextState.activeBalls.length === 0
  ) {
    nextState = {
      ...nextState,
      activeLineNumber: null,
    }
  }

  return finalizeRun(nextState, now)
}

export function applyTaskResult(
  state: GameState,
  task: GameTask,
  wasCorrect: boolean,
): GameState {
  if (!wasCorrect) {
    return prependFeedEntries(
      {
        ...state,
        score: Math.max(0, state.score - task.penaltyPoints),
        multiplier: 1,
        activeTaskId: task.id,
        isTaskOpen: true,
      },
      [
        {
          type: 'mini_task_failed',
          taskId: task.id,
        },
      ],
    )
  }

  const correctAnswerCount = state.correctAnswerCount + 1
  let nextState: GameState = {
    ...state,
    score: state.score + task.rewardPoints,
    multiplier: state.multiplier + task.rewardMultiplier,
    correctAnswerCount,
    solvedTaskIds: state.solvedTaskIds.includes(task.id)
      ? state.solvedTaskIds
      : [...state.solvedTaskIds, task.id],
    activeTaskId: null,
    isTaskOpen: false,
  }

  const newEntries: FeedEntryInput[] = [
    {
      type: 'mini_task_solved',
      taskId: task.id,
    },
  ]

  if (!state.unlocks.editorEditable && correctAnswerCount >= 2) {
    nextState = {
      ...nextState,
      unlocks: {
        ...state.unlocks,
        editorEditable: true,
        lineCapacity: 2,
      },
      tutorialStep: 'editor_unlock',
    }

    newEntries.push(
      {
        type: 'editor_unlocked',
      },
      {
        type: 'line_unlocked',
        lineCapacity: 2,
      },
    )
  }

  nextState = revalidatePrograms({
    ...nextState,
    currentTaskTarget: getTaskTarget(nextState),
  })

  return prependFeedEntries(nextState, newEntries)
}

export function purchaseShopNode(
  state: GameState,
  nodeId: ShopNodeId,
  tasks: GameTask[],
): GameState {
  if (!canOpenShop(state) || state.isRunning) {
    return state
  }

  const node = SHOP_NODES.find((entry) => entry.id === nodeId)

  if (
    node === undefined ||
    !node.implemented ||
    !canPurchaseShopNode(state, nodeId, tasks) ||
    state.purchasedUpgradeIds.includes(node.id) ||
    state.score < node.cost
  ) {
    return state
  }

  const nextAllowedCommands = node.unlockCommand
    ? state.unlocks.allowedCommands.includes(node.unlockCommand)
      ? state.unlocks.allowedCommands
      : [...state.unlocks.allowedCommands, node.unlockCommand]
    : state.unlocks.allowedCommands

  const nextUnlockedConstructs = node.unlockConstruct
    ? state.unlocks.unlockedConstructs.includes(node.unlockConstruct)
      ? state.unlocks.unlockedConstructs
      : [...state.unlocks.unlockedConstructs, node.unlockConstruct]
    : state.unlocks.unlockedConstructs

  const nextState: GameState = {
    ...state,
    score: state.score - node.cost,
    purchasedUpgradeIds: [...state.purchasedUpgradeIds, node.id],
    unlocks: {
      ...state.unlocks,
      lineCapacity: node.lineCapacity ?? state.unlocks.lineCapacity,
      allowedCommands: nextAllowedCommands,
      unlockedConstructs: nextUnlockedConstructs,
    },
    helperProgramSource:
      node.id === 'functions' && state.helperProgramSource.trim() === ''
        ? INITIAL_HELPER_SOURCE
        : state.helperProgramSource,
  }

  const revalidatedState = revalidatePrograms({
    ...nextState,
    currentTaskTarget: getTaskTarget(nextState),
  })

  return prependFeedEntries(revalidatedState, [
    {
      type: 'upgrade_bought',
      upgradeId: node.id,
    },
  ])
}

export function getRunsUntilChallenge(
  state: GameState,
  tasks: GameTask[],
): number | null {
  if (state.isTaskOpen) {
    return 0
  }

  if (!hasRemainingTasks(tasks, state.solvedTaskIds)) {
    return null
  }

  return Math.max(0, state.currentTaskTarget - state.dropsTowardNextTask)
}
