import type {
  ActiveBall,
  AimLevel,
  BonusLane,
  BoardBucket,
  BoardOutcome,
  GameState,
} from '../types'

export const BALL_SPAWN_INTERVAL_MS = 100
export const BALL_FALL_DURATION_MS = 600
export const BALL_SETTLE_HOLD_MS = 220
export const BALL_CANCEL_DURATION_MS = 180

export const BOARD_VIEWBOX = {
  width: 320,
  height: 250,
}

export const BOARD_PATH_Y = [18, 54, 96, 138, 180, 214]

export const BOARD_PIN_ROWS = [
  [{ x: 160, y: 54 }],
  [
    { x: 128, y: 96 },
    { x: 192, y: 96 },
  ],
  [
    { x: 96, y: 138 },
    { x: 160, y: 138 },
    { x: 224, y: 138 },
  ],
  [
    { x: 64, y: 180 },
    { x: 128, y: 180 },
    { x: 192, y: 180 },
    { x: 256, y: 180 },
  ],
] as const

export const BOARD_BUCKET_TOP = 188
export const BOARD_BUCKET_BOTTOM = 244

const PATH_COLUMNS = [
  [160],
  [128, 192],
  [96, 160, 224],
  [64, 128, 192, 256],
  [32, 96, 160, 224, 288],
] as const

const AIM_RIGHT_PROBABILITY: Record<AimLevel, number> = {
  1: 0.35,
  2: 0.5,
  3: 0.65,
}

export const BOARD_BUCKETS: Array<{
  id: BoardBucket
  points: number
  x: number
}> = [
  { id: 'outer_left', points: 4, x: 32 },
  { id: 'inner_left', points: 2, x: 96 },
  { id: 'center', points: 1, x: 160 },
  { id: 'inner_right', points: 2, x: 224 },
  { id: 'outer_right', points: 4, x: 288 },
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getLaneBonus(bucketIndex: number, bonusLane: BonusLane): number {
  if (bonusLane === 1) {
    return bucketIndex <= 1 ? 2 : 0
  }

  if (bonusLane === 2) {
    return bucketIndex === 2 ? 4 : 0
  }

  return bucketIndex >= 3 ? 2 : 0
}

function buildBallPath(decisions: Array<-1 | 1>): number[] {
  const pathXs: number[] = [PATH_COLUMNS[0][0], PATH_COLUMNS[0][0]]
  let rights = 0

  decisions.forEach((direction, index) => {
    if (direction === 1) {
      rights += 1
    }

    pathXs.push(PATH_COLUMNS[index + 1]?.[rights] ?? PATH_COLUMNS[0][0])
  })

  return pathXs
}

function interpolatePath(pathXs: number[], progress: number): { x: number; y: number } {
  const clamped = clamp(progress, 0, 1)
  const segmentCount = BOARD_PATH_Y.length - 1
  const scaled = clamped * segmentCount
  const segmentIndex = Math.min(segmentCount - 1, Math.floor(scaled))
  const localProgress = scaled - segmentIndex
  const startX = pathXs[segmentIndex] ?? pathXs[0] ?? PATH_COLUMNS[0][0]
  const endX = pathXs[segmentIndex + 1] ?? startX
  const startY = BOARD_PATH_Y[segmentIndex] ?? BOARD_PATH_Y[0]
  const endY = BOARD_PATH_Y[segmentIndex + 1] ?? startY

  return {
    x: startX + (endX - startX) * localProgress,
    y: startY + (endY - startY) * localProgress,
  }
}

export function rollBonusLane(): BonusLane {
  const value = Math.floor(Math.random() * 3) + 1
  return value as BonusLane
}

export function getTaskTarget(state: GameState): number {
  if (state.purchasedUpgradeIds.includes('for_loop')) {
    return 18
  }

  if (state.purchasedUpgradeIds.includes('functions')) {
    return 16
  }

  if (state.purchasedUpgradeIds.includes('if_statement')) {
    return 14
  }

  if (state.purchasedUpgradeIds.includes('variables')) {
    return 12
  }

  if (state.purchasedUpgradeIds.includes('line_capacity_3')) {
    return 10
  }

  if (state.unlocks.editorEditable) {
    return 7
  }

  return 5
}

export function createBallOutcome(
  aim: AimLevel,
  bonusLane: BonusLane,
): BoardOutcome & { laneBonus: number; pathXs: number[] } {
  const decisions: Array<-1 | 1> = []
  let rights = 0

  for (let index = 0; index < 4; index += 1) {
    const goRight = Math.random() < AIM_RIGHT_PROBABILITY[aim]
    decisions.push(goRight ? 1 : -1)

    if (goRight) {
      rights += 1
    }
  }

  const bucketIndex = clamp(rights, 0, BOARD_BUCKETS.length - 1)
  const bucket = BOARD_BUCKETS[bucketIndex] ?? BOARD_BUCKETS[2]
  const laneBonus = getLaneBonus(bucketIndex, bonusLane)

  return {
    bucket: bucket.id,
    bucketIndex,
    points: bucket.points + laneBonus,
    laneBonus,
    pathXs: buildBallPath(decisions),
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
    const progress = clamp(
      (now - cancelStartedAt) / BALL_CANCEL_DURATION_MS,
      0,
      1,
    )

    return {
      x: ball.cancelX,
      y: ball.cancelY,
      opacity: 1 - progress,
      scale: 1 - progress * 0.28,
    }
  }

  if (ball.state === 'settled') {
    const settledX = ball.pathXs[ball.pathXs.length - 1] ?? PATH_COLUMNS[0][0]
    const settledY = BOARD_PATH_Y[BOARD_PATH_Y.length - 1] ?? 214
    const fadeWindow = 90
    const fadeStart = ball.removeAt - fadeWindow
    const progress =
      now <= fadeStart ? 0 : clamp((now - fadeStart) / fadeWindow, 0, 1)

    return {
      x: settledX,
      y: settledY,
      opacity: 1 - progress * 0.2,
      scale: 1,
    }
  }

  const progress = clamp(
    (now - ball.spawnedAt) / Math.max(1, ball.settleAt - ball.spawnedAt),
    0,
    1,
  )
  const position = interpolatePath(ball.pathXs, progress)

  return {
    x: position.x,
    y: position.y,
    opacity: 1,
    scale: 1,
  }
}
