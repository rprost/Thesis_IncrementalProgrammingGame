import type {
  ActiveBall,
  AimLevel,
  BallType,
  BoardOutcome,
  BoardPathNode,
  PortalSide,
} from '../types'

export const BALL_SPAWN_INTERVAL_MS = 120
export const BALL_FALL_DURATION_MS = 920
export const BALL_SETTLE_HOLD_MS = 900
export const BALL_CANCEL_DURATION_MS = 180
export const BALL_QUEUE_LENGTH = 24
export const DEFAULT_CENTER_BONUS = 6
export const DEFAULT_NEGATIVE_PENALTY = 10
export const DEFAULT_PORTAL_CHILD_COUNT = 2
export const PORTAL_BALL_CHILD_COUNT = 4
export const BONUS_MAP_TEMPLATE = [0.5, 1, 5] as const

const BOARD_CENTER_X = 230
const BUCKET_SPACING = 46
const HALF_STEP_X = BUCKET_SPACING / 2
const PIN_START_Y = 64
const PIN_STEP_Y = 28
const BUCKET_COUNT = 9
const INPUT_START_Y = 34
const INPUT_MID_Y = 82
const INPUT_LOW_Y = 118
const PEG_RENDER_Y_OFFSET = -7

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

export const BOARD_MAIN_INPUT_X: Record<AimLevel, number> = {
  1: BOARD_PIN_ROWS[3]?.[0]?.x ?? 161,
  2: BOARD_PIN_ROWS[0]?.[0]?.x ?? 230,
  3: BOARD_PIN_ROWS[3]?.[3]?.x ?? 299,
}

export const BOARD_PORTAL_TRIGGER_PEGS: Record<PortalSide, { x: number; y: number }> = {
  1: BOARD_PIN_ROWS[6]?.[1] ?? { x: 138, y: 232 },
  3: BOARD_PIN_ROWS[6]?.[5] ?? { x: 322, y: 232 },
}

export const BOARD_PORTALS: Record<PortalSide, { x: number; y: number }> = {
  1: BOARD_PORTAL_TRIGGER_PEGS[1],
  3: BOARD_PORTAL_TRIGGER_PEGS[3],
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

function getInputLaunchNodes(aim: AimLevel): BoardPathNode[] {
  const inputX = BOARD_MAIN_INPUT_X[aim]

  if (aim === 2) {
    return [
      { x: inputX, y: INPUT_START_Y },
      { x: inputX, y: 50 },
    ]
  }

  return [
    { x: inputX, y: INPUT_START_Y },
    { x: inputX, y: INPUT_MID_Y },
    { x: inputX, y: INPUT_LOW_Y },
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
  const path = [...getInputLaunchNodes(aim)]
  const startRowIndex = ENTRY_ROW_BY_AIM[aim]
  let columnIndex = ENTRY_COLUMN_BY_AIM[aim]
  const firstPin = BOARD_PIN_ROWS[startRowIndex]?.[columnIndex]

  if (firstPin !== undefined) {
    path.push({
      x: firstPin.x,
      y: firstPin.y,
      contact: true,
      renderYOffset: PEG_RENDER_Y_OFFSET,
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
      renderYOffset: PEG_RENDER_Y_OFFSET,
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

function getRenderableNode(node: BoardPathNode | undefined): BoardPathNode {
  if (node === undefined) {
    return { x: BOARD_CENTER_X, y: INPUT_START_Y }
  }

  return {
    ...node,
    y: node.y + (node.renderYOffset ?? 0),
  }
}

function getPortalTriggerIndex(
  path: BoardPathNode[],
  portalSide: PortalSide,
  portalDepth: number,
  maxPortalDepth: number,
  portalEnabled: boolean,
): number {
  if (!portalEnabled || portalDepth >= maxPortalDepth) {
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

  if (value < 1 / 3) {
    return 'negative'
  }

  if (value < 2 / 3) {
    return 'portal'
  }

  return 'center'
}

export function getBallTypeValue(ballType: BallType): number {
  switch (ballType) {
    case 'portal':
      return 2
    case 'negative':
      return 3
    case 'plain':
      return 0
    case 'center':
    default:
      return 1
  }
}

export function createBallQueue(options: {
  conditionsUnlocked: boolean
}): BallType[] {
  if (!options.conditionsUnlocked) {
    return Array.from({ length: BALL_QUEUE_LENGTH }, () => 'plain' as const)
  }

  return Array.from({ length: BALL_QUEUE_LENGTH }, () => rollBallType())
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
    nextQueue.push(options.conditionsUnlocked ? rollBallType() : 'plain')
  }

  return nextQueue
}

export function rollPortalSide(): PortalSide {
  return Math.random() < 0.5 ? 1 : 3
}

export function rollBonusMap(): number[] {
  const values = [...BONUS_MAP_TEMPLATE]

  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = values[index]
    values[index] = values[swapIndex] ?? current
    values[swapIndex] = current
  }

  return values
}

export function createBallOutcome(
  aim: AimLevel,
  portalSide: PortalSide,
  ballType: BallType,
  options: {
    launchIndex: number
    portalEnabled: boolean
    portalDepth: number
    maxPortalDepth: number
    extraCenterBinBonus: number
    laneMultiplier: number
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
    options.maxPortalDepth,
    options.portalEnabled,
  )
  const triggeredPortal = portalTriggerIndex >= 0

  if (triggeredPortal) {
    const trimmedPath = pegPath.path.slice(0, portalTriggerIndex + 1)

    return {
      bucketIndex,
      basePoints: 0,
      points: 0,
      laneMultiplier: options.laneMultiplier,
      ballType,
      centerBonusValue: 0,
      usedCenterBonus: false,
      usedNegativePenalty: false,
      triggeredPortal: true,
      path: appendPortalNodes(trimmedPath, portalSide),
    }
  }

  const basePoints = BOARD_BUCKETS[bucketIndex]?.points ?? 1
  const centerBonusValue =
    (ballType === 'center' && aim === 2 ? DEFAULT_CENTER_BONUS : 0) +
    (ballType === 'center' && bucketIndex === Math.floor(BOARD_BUCKETS.length / 2)
      ? options.extraCenterBinBonus
      : 0)
  const usedCenterBonus = centerBonusValue > 0
  const usedNegativePenalty = ballType === 'negative'
  const modifier = centerBonusValue + (usedNegativePenalty ? -DEFAULT_NEGATIVE_PENALTY : 0)
  const laneMultiplier = options.laneMultiplier

  return {
    bucketIndex,
    basePoints,
    points: (basePoints + modifier) * laneMultiplier,
    laneMultiplier,
    ballType,
    centerBonusValue,
    usedCenterBonus,
    usedNegativePenalty,
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
  const start = getRenderableNode(
    path[segmentIndex] ?? path[0] ?? { x: BOARD_CENTER_X, y: 18 },
  )
  const end = getRenderableNode(path[segmentIndex + 1] ?? path[segmentIndex] ?? path[0] ?? start)
  const eased = easeInOutSine(localProgress)
  const horizontalDirection = end.x === start.x ? 0 : Math.sign(end.x - start.x)
  const controlX =
    horizontalDirection === 0 ? start.x : (start.x + end.x) / 2 + horizontalDirection * 8
  const controlY =
    horizontalDirection === 0
      ? (start.y + end.y) / 2
      : (start.y + end.y) / 2 - (end.contact === true ? 14 : 4)
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

function getReducedMotionPathPosition(
  path: BoardPathNode[],
  progress: number,
): { x: number; y: number; scale: number } {
  if (path.length === 0) {
    return {
      x: BOARD_CENTER_X,
      y: INPUT_START_Y,
      scale: 1,
    }
  }

  const clamped = clamp(progress, 0, 1)
  const maxIndex = path.length - 1
  const stepIndex = Math.min(maxIndex, Math.floor(clamped * maxIndex))
  const node = getRenderableNode(path[stepIndex] ?? path[maxIndex] ?? path[0])

  return {
    x: node?.x ?? BOARD_CENTER_X,
    y: node?.y ?? INPUT_START_Y,
    scale: 1,
  }
}

export function getBallRenderState(
  ball: ActiveBall,
  now: number,
  reducedMotion = false,
): { x: number; y: number; opacity: number; scale: number } {
  if (reducedMotion) {
    const startNode = ball.path[0] ?? { x: BOARD_CENTER_X, y: INPUT_START_Y }

    if (now < ball.spawnedAt) {
      return {
        x: startNode.x,
        y: startNode.y,
        opacity: 1,
        scale: 1,
      }
    }

    if (
      ball.state === 'canceled' &&
      ball.cancelX !== undefined &&
      ball.cancelY !== undefined
    ) {
      return {
        x: ball.cancelX,
        y: ball.cancelY,
        opacity: 1,
        scale: 1,
      }
    }

    if (ball.state === 'falling') {
      const progress = clamp(
        (now - ball.spawnedAt) / Math.max(1, ball.settleAt - ball.spawnedAt),
        0,
        1,
      )
      const position = getReducedMotionPathPosition(ball.path, progress)

      return {
        x: position.x,
        y: position.y,
        opacity: 1,
        scale: 1,
      }
    }

    const settledNode = ball.path[ball.path.length - 1] ?? {
      x: BOARD_CENTER_X,
      y: BOARD_BUCKET_TOP + 26,
    }

    return {
      x: settledNode.x,
      y: settledNode.y,
      opacity: 1,
      scale: 1,
    }
  }

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
    const startNode = ball.path[0] ?? { x: BOARD_CENTER_X, y: INPUT_START_Y }

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
