import type {
  ActiveBall,
  AimLevel,
  BallType,
  BoardOutcome,
  BoardPathNode,
  PortalSide,
  TaskTopicId,
  TopicStage,
} from '../types'

export const BALL_SPAWN_INTERVAL_MS = 120
export const BALL_FALL_DURATION_MS = 920
export const BALL_SETTLE_HOLD_MS = 900
export const BALL_CANCEL_DURATION_MS = 180
export const BALL_QUEUE_LENGTH = 24
export const DEFAULT_LUCKY_BONUS = 2
export const DEFAULT_EVIL_PENALTY = 4
export const DEFAULT_PORTAL_CHILD_COUNT = 2

const BOARD_CENTER_X = 230
const BUCKET_SPACING = 46
const HALF_STEP_X = BUCKET_SPACING / 2
const PIN_START_Y = 64
const PIN_STEP_Y = 28
const BUCKET_COUNT = 9
const CHUTE_START_Y = 34
const CHUTE_MID_Y = 82
const CHUTE_LOW_Y = 118

export const BOARD_VIEWBOX = {
  width: 460,
  height: 368,
}

export const BOARD_BUCKET_TOP = 286
export const BOARD_BUCKET_BOTTOM = 348

export const BOARD_BUCKETS = Array.from({ length: BUCKET_COUNT }, (_, index) => ({
  id: `bucket_${index + 1}`,
  points: [8, 6, 4, 2, 1, 2, 4, 6, 8][index] ?? 1,
  x: 46 + index * BUCKET_SPACING,
}))

export const BOARD_PIN_ROWS = Array.from({ length: 8 }, (_, rowIndex) => {
  const rowCount = rowIndex + 1
  const rowWidth = rowIndex * HALF_STEP_X
  const startX = BOARD_CENTER_X - rowWidth
  const y = PIN_START_Y + rowIndex * PIN_STEP_Y

  return Array.from({ length: rowCount }, (_, columnIndex) => ({
    x: startX + columnIndex * BUCKET_SPACING,
    y,
  }))
})

const ENTRY_ROW_BY_AIM: Record<AimLevel, number> = {
  1: 3,
  2: 0,
  3: 3,
}

const ENTRY_COLUMN_BY_AIM: Record<AimLevel, number> = {
  1: 0,
  2: 0,
  3: 3,
}

export const BOARD_MAIN_CHUTE_X: Record<AimLevel, number> = {
  1: BOARD_PIN_ROWS[3]?.[0]?.x ?? 161,
  2: BOARD_PIN_ROWS[0]?.[0]?.x ?? 230,
  3: BOARD_PIN_ROWS[3]?.[3]?.x ?? 299,
}

export const BOARD_PORTAL_TRIGGER_PEGS: Record<PortalSide, { x: number; y: number }> = {
  1: BOARD_PIN_ROWS[6]?.[1] ?? { x: 138, y: 232 },
  3: BOARD_PIN_ROWS[6]?.[5] ?? { x: 322, y: 232 },
}

function getPortalCenter(portalSide: PortalSide): { x: number; y: number } {
  const rowIndex = 6
  const triggerColumnIndex = portalSide === 1 ? 1 : 5
  const upperRow = BOARD_PIN_ROWS[rowIndex - 1] ?? []
  const lowerRow = BOARD_PIN_ROWS[rowIndex] ?? []
  const surroundingPins = [
    upperRow[triggerColumnIndex - 1],
    upperRow[triggerColumnIndex],
    lowerRow[triggerColumnIndex],
    lowerRow[triggerColumnIndex + 1],
  ].filter((pin): pin is { x: number; y: number } => pin !== undefined)

  if (surroundingPins.length === 0) {
    return {
      x: portalSide === 1 ? 150 : 334,
      y: 218,
    }
  }

  const totals = surroundingPins.reduce(
    (accumulator, pin) => ({
      x: accumulator.x + pin.x,
      y: accumulator.y + pin.y,
    }),
    { x: 0, y: 0 },
  )

  return {
    x: totals.x / surroundingPins.length,
    y: totals.y / surroundingPins.length,
  }
}

export const BOARD_PORTALS: Record<PortalSide, { x: number; y: number }> = {
  1: getPortalCenter(1),
  3: getPortalCenter(3),
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function easeInOutSine(progress: number): number {
  return -(Math.cos(Math.PI * progress) - 1) / 2
}

function jitter(amount: number): number {
  return (Math.random() - 0.5) * amount
}

function pickRightProbability(aim: AimLevel): number {
  switch (aim) {
    case 1:
      return 0.33
    case 3:
      return 0.67
    case 2:
    default:
      return 0.5
  }
}

function buildDecisions(aim: AimLevel, count: number): Array<-1 | 1> {
  const decisions: Array<-1 | 1> = []
  const rightProbability = pickRightProbability(aim)

  for (let index = 0; index < count; index += 1) {
    decisions.push(Math.random() < rightProbability ? 1 : -1)
  }

  return decisions
}

function getChuteLaunchNodes(aim: AimLevel): BoardPathNode[] {
  const chuteX = BOARD_MAIN_CHUTE_X[aim]

  if (aim === 2) {
    return [
      { x: chuteX, y: CHUTE_START_Y },
      { x: chuteX, y: 50 },
    ]
  }

  return [
    { x: chuteX, y: CHUTE_START_Y },
    { x: chuteX, y: CHUTE_MID_Y },
    { x: chuteX, y: CHUTE_LOW_Y },
  ]
}

function buildPegPath(
  aim: AimLevel,
  decisions: Array<-1 | 1>,
): {
  columnIndex: number
  lastDirection: -1 | 1
  path: BoardPathNode[]
} {
  const path = [...getChuteLaunchNodes(aim)]
  const startRowIndex = ENTRY_ROW_BY_AIM[aim]
  let columnIndex = ENTRY_COLUMN_BY_AIM[aim]
  const firstPin = BOARD_PIN_ROWS[startRowIndex]?.[columnIndex]

  if (firstPin !== undefined) {
    path.push({
      x: firstPin.x,
      y: firstPin.y,
      contact: true,
    })
  }

  decisions.forEach((direction, decisionIndex) => {
    const rowIndex = startRowIndex + 1 + decisionIndex

    if (rowIndex >= BOARD_PIN_ROWS.length) {
      return
    }

    if (direction === 1) {
      columnIndex += 1
    }

    const row = BOARD_PIN_ROWS[rowIndex]
    const nextColumn = clamp(columnIndex, 0, Math.max(0, row.length - 1))
    columnIndex = nextColumn
    const pin = row[nextColumn]

    if (pin === undefined) {
      return
    }

    path.push({
      x: pin.x,
      y: pin.y,
      contact: true,
    })
  })

  return {
    columnIndex,
    lastDirection: decisions[decisions.length - 1] ?? 1,
    path,
  }
}

function appendBucketNodes(path: BoardPathNode[], bucketIndex: number): BoardPathNode[] {
  const bucketX = BOARD_BUCKETS[bucketIndex]?.x ?? BOARD_CENTER_X

  return [
    ...path,
    { x: bucketX + jitter(4), y: BOARD_BUCKET_TOP - 14 },
    { x: bucketX, y: BOARD_BUCKET_TOP + 26 },
  ]
}

function appendPortalNodes(path: BoardPathNode[], portalSide: PortalSide): BoardPathNode[] {
  const portal = BOARD_PORTALS[portalSide]
  const triggerPeg = BOARD_PORTAL_TRIGGER_PEGS[portalSide]
  const approachX = portal.x + (portalSide === 1 ? 8 : -8)
  const approachY = portal.y + 6

  return [
    ...path,
    {
      x: triggerPeg.x + (portalSide === 1 ? 3 : -3),
      y: triggerPeg.y - 4,
    },
    { x: approachX, y: approachY },
    { x: portal.x, y: portal.y, contact: true },
  ]
}

function getPortalTriggerIndex(
  path: BoardPathNode[],
  portalSide: PortalSide,
  portalDepth: number,
  portalEnabled: boolean,
): number {
  if (!portalEnabled || portalDepth > 0) {
    return -1
  }

  const triggerPeg = BOARD_PORTAL_TRIGGER_PEGS[portalSide]
  return path.findIndex(
    (node) =>
      node.contact === true &&
      node.x === triggerPeg.x &&
      node.y === triggerPeg.y,
  )
}

function rollBallType(): BallType {
  const value = Math.random()

  if (value < 0.18) {
    return 'evil'
  }

  if (value < 0.34) {
    return 'lucky'
  }

  return 'normal'
}

export function getBallTypeValue(ballType: BallType): number {
  switch (ballType) {
    case 'lucky':
      return 2
    case 'evil':
      return 3
    case 'normal':
    default:
      return 1
  }
}

export function createBallQueue(options: {
  conditionsUnlocked: boolean
  currentTopicId: TaskTopicId | null
  topicStage: TopicStage
}): BallType[] {
  if (!options.conditionsUnlocked) {
    return Array.from({ length: BALL_QUEUE_LENGTH }, () => 'normal' as const)
  }

  const queue = Array.from({ length: BALL_QUEUE_LENGTH }, () => rollBallType())

  if (
    options.currentTopicId === 'conditions' &&
    !queue.slice(0, 4).includes('evil')
  ) {
    queue[0] = 'evil'
  }

  return queue
}

export function refillBallQueue(
  queue: BallType[],
  cursor: number,
  options: {
    conditionsUnlocked: boolean
  },
): BallType[] {
  const nextQueue = queue.slice(Math.max(0, cursor), BALL_QUEUE_LENGTH)

  while (nextQueue.length < BALL_QUEUE_LENGTH) {
    nextQueue.push(options.conditionsUnlocked ? rollBallType() : 'normal')
  }

  return nextQueue
}

export function rollPortalSide(): PortalSide {
  return Math.random() < 0.5 ? 1 : 3
}

export function createBallOutcome(
  aim: AimLevel,
  portalSide: PortalSide,
  ballType: BallType,
  options: {
    launchIndex: number
    portalEnabled: boolean
    portalDepth: number
    luckyBonusValue: number
  },
): BoardOutcome {
  const decisionCount = Math.max(0, BOARD_PIN_ROWS.length - ENTRY_ROW_BY_AIM[aim] - 1)
  const decisions = buildDecisions(aim, decisionCount)
  const pegPath = buildPegPath(aim, decisions)
  const bucketIndex = clamp(
    pegPath.columnIndex + (pegPath.lastDirection === 1 ? 1 : 0),
    0,
    BOARD_BUCKETS.length - 1,
  )
  const portalTriggerIndex = getPortalTriggerIndex(
    pegPath.path,
    portalSide,
    options.portalDepth,
    options.portalEnabled,
  )
  const triggeredPortal = portalTriggerIndex >= 0

  if (triggeredPortal) {
    const trimmedPath = pegPath.path.slice(0, portalTriggerIndex + 1)

    return {
      bucketIndex,
      basePoints: 0,
      points: 0,
      ballType,
      usedLuckyBonus: false,
      usedEvilPenalty: false,
      triggeredPortal: true,
      path: appendPortalNodes(trimmedPath, portalSide),
    }
  }

  const basePoints = BOARD_BUCKETS[bucketIndex]?.points ?? 1
  const usedLuckyBonus = ballType === 'lucky'
  const usedEvilPenalty = ballType === 'evil'
  const modifier = usedLuckyBonus
    ? options.luckyBonusValue
    : usedEvilPenalty
      ? -DEFAULT_EVIL_PENALTY
      : 0

  return {
    bucketIndex,
    basePoints,
    points: basePoints + modifier,
    ballType,
    usedLuckyBonus,
    usedEvilPenalty,
    triggeredPortal: false,
    path: appendBucketNodes(pegPath.path, bucketIndex),
  }
}

function interpolatePath(
  path: BoardPathNode[],
  progress: number,
): { x: number; y: number; scale: number } {
  const clamped = clamp(progress, 0, 1)
  const segmentCount = Math.max(1, path.length - 1)
  const scaled = clamped * segmentCount
  const segmentIndex = Math.min(segmentCount - 1, Math.floor(scaled))
  const localProgress = scaled - segmentIndex
  const start = path[segmentIndex] ?? path[0] ?? { x: BOARD_CENTER_X, y: 18 }
  const end = path[segmentIndex + 1] ?? start
  const eased = easeInOutSine(localProgress)
  const horizontalDirection = end.x === start.x ? 0 : Math.sign(end.x - start.x)
  const controlX =
    horizontalDirection === 0 ? start.x : (start.x + end.x) / 2 + horizontalDirection * 8
  const controlY =
    horizontalDirection === 0
      ? (start.y + end.y) / 2
      : (start.y + end.y) / 2 - (end.contact === true ? 12 : 4)
  const inverse = 1 - eased
  const x =
    inverse * inverse * start.x +
    2 * inverse * eased * controlX +
    eased * eased * end.x
  const y =
    inverse * inverse * start.y +
    2 * inverse * eased * controlY +
    eased * eased * end.y
  const contactPulse =
    end.contact === true && localProgress >= 0.74
      ? Math.sin(((localProgress - 0.74) / 0.26) * Math.PI)
      : 0

  return {
    x,
    y,
    scale: 1 + contactPulse * 0.14,
  }
}

export function getBallRenderState(
  ball: ActiveBall,
  now: number,
): { x: number; y: number; opacity: number; scale: number } {
  if (
    ball.state === 'canceled' &&
    ball.cancelX !== undefined &&
    ball.cancelY !== undefined
  ) {
    const cancelStartedAt = ball.removeAt - BALL_CANCEL_DURATION_MS
    const progress = clamp((now - cancelStartedAt) / BALL_CANCEL_DURATION_MS, 0, 1)

    return {
      x: ball.cancelX,
      y: ball.cancelY,
      opacity: 1 - progress,
      scale: 1 - progress * 0.28,
    }
  }

  if (now < ball.spawnedAt) {
    const startNode = ball.path[0] ?? { x: BOARD_CENTER_X, y: CHUTE_START_Y }

    return {
      x: startNode.x,
      y: startNode.y,
      opacity: 0,
      scale: 1,
    }
  }

  if (ball.state === 'settled') {
    const settledNode = ball.path[ball.path.length - 1] ?? {
      x: BOARD_CENTER_X,
      y: BOARD_BUCKET_TOP + 26,
    }
    const fadeWindow = 220
    const fadeStart = ball.removeAt - fadeWindow
    const progress = now <= fadeStart ? 0 : clamp((now - fadeStart) / fadeWindow, 0, 1)

    return {
      x: settledNode.x,
      y: settledNode.y,
      opacity: 1 - progress * 0.5,
      scale: 1 + (1 - progress) * 0.06,
    }
  }

  const progress = clamp(
    (now - ball.spawnedAt) / Math.max(1, ball.settleAt - ball.spawnedAt),
    0,
    1,
  )
  const position = interpolatePath(ball.path, progress)

  return {
    x: position.x,
    y: position.y,
    opacity: 1,
    scale: position.scale,
  }
}
