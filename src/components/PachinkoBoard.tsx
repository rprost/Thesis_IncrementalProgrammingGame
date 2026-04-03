import {
  BOARD_BUCKET_BOTTOM,
  BOARD_BUCKET_TOP,
  BOARD_BUCKETS,
  BOARD_PIN_ROWS,
  BOARD_VIEWBOX,
  getBallRenderState,
} from '../game/pachinko'
import type { ActiveBall, BonusLane, UiText } from '../types'

type PachinkoBoardProps = {
  ui: UiText
  activeBalls: ActiveBall[]
  bonusLane: BonusLane
  now: number
}

function getLaneLabel(bonusLane: BonusLane, ui: UiText): string {
  switch (bonusLane) {
    case 1:
      return ui.boardLaneOneLabel
    case 2:
      return ui.boardLaneTwoLabel
    case 3:
      return ui.boardLaneThreeLabel
    default:
      return ui.boardLaneTwoLabel
  }
}

function isHighlightedBucket(
  bonusLane: BonusLane,
  bucketId: (typeof BOARD_BUCKETS)[number]['id'],
): boolean {
  if (bonusLane === 1) {
    return bucketId === 'outer_left' || bucketId === 'inner_left'
  }

  if (bonusLane === 2) {
    return bucketId === 'center'
  }

  return bucketId === 'inner_right' || bucketId === 'outer_right'
}

function getBucketPath(centerX: number): string {
  const left = centerX - 28
  const right = centerX + 28
  const bottom = BOARD_BUCKET_BOTTOM
  const top = BOARD_BUCKET_TOP

  return `M ${left} ${top} L ${left} ${bottom} L ${right} ${bottom} L ${right} ${top}`
}

export function PachinkoBoard({
  ui,
  activeBalls,
  bonusLane,
  now,
}: PachinkoBoardProps) {
  return (
    <section className="board-shell" aria-label={ui.boardTitle}>
      <div className="board-header">
        <div>
          <p className="panel-kicker">{ui.boardTitle}</p>
          <p className="board-subtitle">{ui.boardSubtitle}</p>
        </div>
        <div className={`board-risk lane-${bonusLane}`}>
          <span>{ui.boardBonusLaneLabel}</span>
          <strong>{getLaneLabel(bonusLane, ui)}</strong>
        </div>
      </div>

      <div className="board-stage">
        <svg
          aria-hidden="true"
          className="board-svg"
          viewBox={`0 0 ${BOARD_VIEWBOX.width} ${BOARD_VIEWBOX.height}`}
        >
          <circle className="board-launch-dot" cx="160" cy="18" r="5" />

          {BOARD_PIN_ROWS.flat().map((pin, index) => (
            <circle
              className="board-pin"
              cx={pin.x}
              cy={pin.y}
              key={`${pin.x}-${pin.y}-${index}`}
              r="4.5"
            />
          ))}

          {BOARD_BUCKETS.map((bucket) => (
            <g key={bucket.id}>
              <path
                className={`board-bucket-shape${
                  isHighlightedBucket(bonusLane, bucket.id) ? ' highlighted' : ''
                }`}
                d={getBucketPath(bucket.x)}
              />
              <text
                className="board-bucket-points"
                textAnchor="middle"
                x={bucket.x}
                y={BOARD_BUCKET_TOP + 32}
              >
                {bucket.points}
              </text>
            </g>
          ))}

          {activeBalls.map((ball) => {
            const renderState = getBallRenderState(ball, now)

            return (
              <g key={ball.id}>
                <circle
                  className={`board-ball ball-aim-${ball.aim} ${ball.state}`}
                  cx={renderState.x}
                  cy={renderState.y}
                  opacity={renderState.opacity}
                  r={renderState.scale * 6}
                />
                {ball.state === 'settled' ? (
                  <text
                    className="board-ball-points"
                    textAnchor="middle"
                    x={renderState.x}
                    y={renderState.y - 16}
                  >
                    +{ball.points}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>
      </div>
    </section>
  )
}
