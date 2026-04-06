import { formatText } from '../content'
import {
  BOARD_BUCKET_BOTTOM,
  BOARD_BUCKET_TOP,
  BOARD_BUCKETS,
  BOARD_MAIN_CHUTE_X,
  BOARD_PIN_ROWS,
  BOARD_PORTALS,
  BOARD_VIEWBOX,
  getBallRenderState,
} from '../game/pachinko'
import type {
  ActiveBall,
  BallType,
  PortalSide,
  TaskTopicId,
  UiText,
} from '../types'

type PachinkoBoardProps = {
  ui: UiText
  activeBalls: ActiveBall[]
  portalSide: PortalSide
  learnedTopicIds: TaskTopicId[]
  upcomingBalls: BallType[]
  portalChildCount: number
  now: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getLaneLabel(lane: PortalSide, ui: UiText): string {
  return lane === 1 ? ui.boardLaneLeft : ui.boardLaneRight
}

function getBucketPath(centerX: number): string {
  const left = centerX - 20
  const right = centerX + 20
  const bottom = BOARD_BUCKET_BOTTOM
  const top = BOARD_BUCKET_TOP

  return `M ${left} ${top} L ${left} ${bottom} L ${right} ${bottom} L ${right} ${top}`
}

function getScoreLineText(
  kind: ActiveBall['scoreBreakdown'][number]['kind'],
  value: number,
  ui: UiText,
): string {
  switch (kind) {
    case 'bucket':
      return `${value} ${ui.boardScoreBucketLabel}`
    case 'lucky_bonus':
      return `+${value} ${ui.boardScoreLuckyBonusLabel}`
    case 'evil_penalty':
      return `-${value} ${ui.boardScoreEvilPenaltyLabel}`
    case 'total':
      return `= ${value} ${ui.boardScoreTotalLabel}`
    default:
      return String(value)
  }
}

function getPortalSpiralPath(x: number, y: number): string {
  return [
    `M ${x + 8} ${y - 3}`,
    `C ${x + 11} ${y - 11}, ${x - 1} ${y - 13}, ${x - 8} ${y - 7}`,
    `C ${x - 14} ${y - 1}, ${x - 10} ${y + 10}, ${x + 1} ${y + 9}`,
    `C ${x + 8} ${y + 8}, ${x + 9} ${y + 2}, ${x + 4} ${y - 1}`,
  ].join(' ')
}

function getBallTypeLabel(ballType: BallType, ui: UiText): string {
  switch (ballType) {
    case 'lucky':
      return ui.boardBallTypeLucky
    case 'evil':
      return ui.boardBallTypeEvil
    case 'normal':
    default:
      return ui.boardBallTypeNormal
  }
}

export function PachinkoBoard({
  ui,
  activeBalls,
  portalSide,
  learnedTopicIds,
  upcomingBalls,
  portalChildCount,
  now,
}: PachinkoBoardProps) {
  const showPortalState = learnedTopicIds.includes('variables')
  const showPreview = learnedTopicIds.includes('conditions') && upcomingBalls.length > 0
  const portalSplitLabel = formatText(ui.boardPortalSplitLabel, {
    count: String(portalChildCount),
  })

  return (
    <section className="board-shell" aria-label={ui.boardTitle}>
      <div className="board-header">
        <div>
          <p className="panel-kicker">{ui.boardTitle}</p>
          <p className="board-subtitle">{ui.boardSubtitle}</p>
        </div>
        <div className="board-header-chips">
          {showPortalState ? (
            <div className={`board-risk portal-${portalSide}`}>
              <span>{ui.boardActivePortalLabel}</span>
              <strong>{getLaneLabel(portalSide, ui)}</strong>
            </div>
          ) : null}
        </div>
      </div>

      {showPreview ? (
        <div className="board-preview-strip" aria-label={ui.boardUpcomingBallsLabel}>
          <span className="board-preview-label">
            {upcomingBalls.length === 1 ? ui.boardNextBallLabel : ui.boardUpcomingBallsLabel}
          </span>
          <div className="board-preview-list">
            {upcomingBalls.map((ballType, index) => (
              <span
                className={`board-preview-pill type-${ballType}`}
                key={`${ballType}-${index}`}
              >
                <span className="board-preview-dot" aria-hidden="true" />
                {getBallTypeLabel(ballType, ui)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="board-stage">
        <svg
          aria-hidden="true"
          className="board-svg"
          viewBox={`0 0 ${BOARD_VIEWBOX.width} ${BOARD_VIEWBOX.height}`}
        >
          <rect className="board-zone" height="304" rx="28" width="138" x="20" y="28" />
          <rect className="board-zone" height="304" rx="28" width="144" x="158" y="28" />
          <rect className="board-zone" height="304" rx="28" width="138" x="302" y="28" />

          <g className="board-launchers">
            <text className="board-overlay-label" textAnchor="middle" x="230" y="18">
              {ui.boardMainLauncherLabel}
            </text>
            {[1, 2, 3].map((aim) => (
              <g key={`main-chute-${aim}`}>
                <circle
                  className="board-launcher-cap"
                  cx={BOARD_MAIN_CHUTE_X[aim as 1 | 2 | 3]}
                  cy="34"
                  r="11"
                />
                <text
                  className="board-launcher-label"
                  textAnchor="middle"
                  x={BOARD_MAIN_CHUTE_X[aim as 1 | 2 | 3]}
                  y="39"
                >
                  {aim}
                </text>
              </g>
            ))}
          </g>

          {showPortalState ? (
            (() => {
              const portal = BOARD_PORTALS[portalSide]

              return (
                <g className={`board-portal side-${portalSide} active`}>
                  <circle className="board-portal-aura" cx={portal.x} cy={portal.y} r="21" />
                  <circle className="board-portal-ring outer" cx={portal.x} cy={portal.y} r="16" />
                  <circle className="board-portal-ring inner" cx={portal.x} cy={portal.y} r="11" />
                  <ellipse className="board-portal-core" cx={portal.x} cy={portal.y} rx="6.5" ry="7.5" />
                  <path className="board-portal-spiral" d={getPortalSpiralPath(portal.x, portal.y)} />
                  <circle className="board-portal-spark" cx={portal.x + 10} cy={portal.y - 7} r="2.7" />
                </g>
              )
            })()
          ) : null}

          {BOARD_PIN_ROWS.flat().map((pin, index) => (
            <circle
              className="board-pin"
              cx={pin.x}
              cy={pin.y}
              key={`${pin.x}-${pin.y}-${index}`}
              r="4.7"
            />
          ))}

          {BOARD_BUCKETS.map((bucket) => (
            <g key={bucket.id}>
              <path className="board-bucket-shape" d={getBucketPath(bucket.x)} />
              <text
                className="board-bucket-points"
                textAnchor="middle"
                x={bucket.x}
                y={BOARD_BUCKET_TOP + 34}
              >
                {bucket.points}
              </text>
            </g>
          ))}

          {activeBalls.map((ball) => {
            const renderState = getBallRenderState(ball, now)
            const breakdownX = clamp(renderState.x, 90, BOARD_VIEWBOX.width - 90)
            const breakdownWidth = 112
            const breakdownHeight = 18 + ball.scoreBreakdown.length * 13
            const breakdownY = clamp(renderState.y - 78 - breakdownHeight / 2, 52, 188)

            return (
              <g key={ball.id}>
                {ball.spawnKind === 'portal' ? (
                  <g opacity={renderState.opacity}>
                    <circle
                      className="board-ball portal-child"
                      cx={renderState.x}
                      cy={renderState.y}
                      r={renderState.scale * 6.7}
                    />
                    <circle
                      className={`board-ball-inner source-${ball.source} type-${ball.ballType}`}
                      cx={renderState.x}
                      cy={renderState.y}
                      r={renderState.scale * 5.1}
                    />
                  </g>
                ) : (
                  <circle
                    className={`board-ball source-${ball.source} type-${ball.ballType}`}
                    cx={renderState.x}
                    cy={renderState.y}
                    opacity={renderState.opacity}
                    r={renderState.scale * 6.1}
                  />
                )}

                {ball.state === 'canceled' && ball.triggeredPortal ? (
                  <g className="board-portal-popup" opacity={renderState.opacity}>
                    <circle
                      className="board-portal-burst"
                      cx={renderState.x}
                      cy={renderState.y}
                      r="15"
                    />
                    <text textAnchor="middle" x={renderState.x} y={renderState.y - 22}>
                      {portalSplitLabel}
                    </text>
                  </g>
                ) : null}

                {ball.state === 'settled' && ball.scoreBreakdown.length > 0 ? (
                  <g className="board-score-breakdown">
                    <rect
                      height={breakdownHeight}
                      rx="11"
                      width={breakdownWidth}
                      x={breakdownX - breakdownWidth / 2}
                      y={breakdownY}
                    />
                    {ball.scoreBreakdown.map((line, index) => (
                      <text
                        className={`board-score-line ${line.kind}`}
                        key={`${ball.id}-${line.kind}-${index}`}
                        textAnchor="middle"
                        x={breakdownX}
                        y={breakdownY + 16 + index * 13}
                      >
                        {getScoreLineText(line.kind, line.value, ui)}
                      </text>
                    ))}
                  </g>
                ) : null}
              </g>
            )
          })}
        </svg>
      </div>
    </section>
  )
}
