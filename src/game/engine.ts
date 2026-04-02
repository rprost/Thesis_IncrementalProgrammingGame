import type {
  FeedEntry,
  FeedEntryType,
  GameView,
  GameState,
  GameTask,
  ShopNodeId,
  TutorialStep,
} from '../types'
import { INITIAL_PROGRAM_SOURCE, parseProgram } from './program'
import { canOpenShop, SHOP_NODES } from './shop'

export const CHALLENGE_INTERVAL = 5
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

function revalidateProgram(state: GameState): GameState {
  return {
    ...state,
    programValidation: parseProgram(
      state.programSource,
      state.unlocks.lineCapacity,
      state.unlocks.allowedCommands,
      state.unlocks.unlockedConstructs,
    ).validation,
  }
}

function maybeOpenChallenge(state: GameState, tasks: GameTask[]): GameState {
  if (
    !hasRemainingTasks(tasks, state.solvedTaskIds) ||
    state.runCount % CHALLENGE_INTERVAL !== 0
  ) {
    return state
  }

  const nextTaskId =
    state.activeTaskId ?? getNextTaskId(tasks, state.solvedTaskIds)

  if (nextTaskId === null) {
    return state
  }

  return {
    ...state,
    activeTaskId: nextTaskId,
    isTaskOpen: true,
    isRunning: false,
    queuedSteps: [],
    activeLineNumber: null,
    tutorialStep:
      state.tutorialStep === 'run_program'
        ? 'first_challenge'
        : state.tutorialStep,
  }
}

export function createInitialGameState(): GameState {
  const unlocks: GameState['unlocks'] = {
    editorVisible: true,
    editorEditable: false,
    lineCapacity: 1,
    allowedCommands: ['add_score'],
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
    isTaskOpen: false,
    isRunning: false,
    unlocks,
    programSource: INITIAL_PROGRAM_SOURCE,
    programValidation: parseProgram(
      INITIAL_PROGRAM_SOURCE,
      unlocks.lineCapacity,
      unlocks.allowedCommands,
      unlocks.unlockedConstructs,
    ).validation,
    queuedSteps: [],
    activeLineNumber: null,
    feedEntries: [],
    nextFeedEntryId: 1,
    tutorialStep: 'run_program',
    dismissedTutorialSteps: [],
    purchasedUpgradeIds: [],
    hasOpenedShop: false,
  }

  return prependFeedEntries(initialState, [
    { type: 'game_opened' },
    { type: 'run_hint' },
  ])
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

export function setCurrentView(
  state: GameState,
  view: GameView,
): GameState {
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
      [
        {
          type: 'shop_opened',
        },
      ],
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

  return {
    ...state,
    programSource,
    programValidation: parseProgram(
      programSource,
      state.unlocks.lineCapacity,
      state.unlocks.allowedCommands,
      state.unlocks.unlockedConstructs,
    ).validation,
  }
}

export function startProgramRun(
  state: GameState,
): GameState {
  if (state.isTaskOpen || state.isRunning) {
    return state
  }

  const parsedProgram = parseProgram(
    state.programSource,
    state.unlocks.lineCapacity,
    state.unlocks.allowedCommands,
    state.unlocks.unlockedConstructs,
  )

  if (!parsedProgram.validation.isValid || parsedProgram.steps.length === 0) {
    return {
      ...state,
      programValidation: parsedProgram.validation,
      queuedSteps: [],
      activeLineNumber: null,
      isRunning: false,
    }
  }

  return {
    ...state,
    programValidation: parsedProgram.validation,
    queuedSteps: parsedProgram.steps,
    activeLineNumber: parsedProgram.steps[0]?.lineNumber ?? null,
    isRunning: true,
    currentView: state.currentView === 'shop' ? 'play' : state.currentView,
  }
}

export function advanceProgramRun(
  state: GameState,
  tasks: GameTask[],
): GameState {
  if (!state.isRunning || state.queuedSteps.length === 0) {
    return state.isRunning
      ? {
          ...state,
          isRunning: false,
          activeLineNumber: null,
          queuedSteps: [],
        }
      : state
  }

  const [currentStep, ...remainingSteps] = state.queuedSteps

  if (currentStep === undefined) {
    return {
      ...state,
      isRunning: false,
      activeLineNumber: null,
      queuedSteps: [],
    }
  }

  let nextState: GameState = {
    ...state,
    queuedSteps: remainingSteps,
    activeLineNumber: remainingSteps[0]?.lineNumber ?? null,
    isRunning: remainingSteps.length > 0,
  }

  if (currentStep.type === 'add_score') {
    nextState = {
      ...nextState,
      score: nextState.score + nextState.multiplier,
      runCount: nextState.runCount + 1,
    }
  }

  const interruptedState = maybeOpenChallenge(nextState, tasks)

  if (interruptedState !== nextState) {
    return interruptedState
  }

  return nextState
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

  nextState = revalidateProgram(nextState)

  return prependFeedEntries(nextState, newEntries)
}

export function purchaseShopNode(
  state: GameState,
  nodeId: ShopNodeId,
): GameState {
  if (!canOpenShop(state) || state.isRunning) {
    return state
  }

  const node = SHOP_NODES.find((entry) => entry.id === nodeId)

  if (
    node === undefined ||
    !node.implemented ||
    state.purchasedUpgradeIds.includes(node.id) ||
    state.score < node.cost
  ) {
    return state
  }

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
      unlockedConstructs: nextUnlockedConstructs,
    },
  }

  const revalidatedState = revalidateProgram(nextState)

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

  const remainder = state.runCount % CHALLENGE_INTERVAL
  return remainder === 0 ? CHALLENGE_INTERVAL : CHALLENGE_INTERVAL - remainder
}
