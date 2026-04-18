import { formatText } from '../content'
import {
  BOARD_BUCKET_BOTTOM,
  BOARD_BUCKET_TOP,
  BOARD_BUCKETS,
  BOARD_MAIN_INPUT_X,
  BOARD_PIN_ROWS,
  BOARD_PORTALS,
  BOARD_VIEWBOX,
  getBallRenderState,
} from '../game/pachinko'
import type {
  ActiveBall,
  PortalSide,
  UiText,
} from '../types'

type PachinkoBoardProps = {
  ui: UiText
  activeBalls: ActiveBall[]
  portalSide: PortalSide
  portalActive: boolean
  extraPortalChildren: number
  bonusMap: number[] | null
  now: number
  reducedMotion: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
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
  const formattedValue = Number.isInteger(value) ? String(value) : String(value)

  switch (kind) {
    case 'bucket':
      return `${formattedValue} ${ui.boardScoreBucketLabel}`
    case 'center_bonus':
      return `+${formattedValue} ${ui.boardScoreLuckyBonusLabel}`
    case 'negative_penalty':
      return `-${formattedValue} ${ui.boardScoreEvilPenaltyLabel}`
    case 'lane_multiplier':
      return `x${formattedValue} ${ui.boardScoreMultiplierLabel}`
    case 'total':
      return `= ${formattedValue} ${ui.boardScoreTotalLabel}`
    default:
      return formattedValue
  }
}

function formatMultiplier(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value)
}

export function PachinkoBoard({
  ui,
  activeBalls,
  portalSide,
  portalActive,
  extraPortalChildren,
  bonusMap,
  now,
  reducedMotion,
}: PachinkoBoardProps) {
  const highestMultiplier =
    bonusMap !== null && bonusMap.length > 0 ? Math.max(...bonusMap) : null

  return (
    <section className="board-shell" aria-label={ui.boardTitle}>
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
              <g key={`main-input-${aim}`}>
                <circle
                  className="board-launcher-cap"
                  cx={BOARD_MAIN_INPUT_X[aim as 1 | 2 | 3]}
                  cy="34"
                  r="11"
                />
                <text
                  className="board-launcher-label"
                  textAnchor="middle"
                  x={BOARD_MAIN_INPUT_X[aim as 1 | 2 | 3]}
                  y="39"
                >
                  {aim}
                </text>
              </g>
            ))}
          </g>

          {bonusMap !== null ? (
            <g className="board-multiplier-row">
              {bonusMap.map((value, index) => {
                const aim = (index + 1) as 1 | 2 | 3
                const isBest = value === highestMultiplier
                const x = BOARD_MAIN_INPUT_X[aim]

                return (
                  <g
                    className={`board-multiplier-chip${isBest ? ' best' : ''}`}
                    key={`board-multiplier-${aim}`}
                    transform={`translate(${x - 22} 48)`}
                  >
                    <rect height="15" rx="7.5" width="44" x="0" y="0" />
                    <text
                      className="board-multiplier-label"
                      textAnchor="middle"
                      x="22"
                      y="10.5"
                    >
                      {`x${formatMultiplier(value)}`}
                    </text>
                  </g>
                )
              })}
            </g>
          ) : null}

          {portalActive ? (
            (() => {
              const portal = BOARD_PORTALS[portalSide]

              return (
                <g className={`board-portal side-${portalSide} active`}>
                  <ellipse className="board-portal-aura" cx={portal.x} cy={portal.y} rx="18" ry="13" />
                  <ellipse className="board-portal-ring" cx={portal.x} cy={portal.y} rx="12.5" ry="8.5" />
                  <ellipse className="board-portal-core" cx={portal.x} cy={portal.y} rx="8.5" ry="5.8" />
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
            const renderState = getBallRenderState(ball, now, reducedMotion)
            const breakdownX = clamp(renderState.x, 90, BOARD_VIEWBOX.width - 90)
            const breakdownWidth = 112
            const breakdownHeight = 18 + ball.scoreBreakdown.length * 13
            const breakdownY = clamp(renderState.y - 78 - breakdownHeight / 2, 52, 188)
            const portalSplitLabel = formatText(ui.boardPortalSplitLabel, {
              count: String(
                (ball.ballType === 'portal' ? 4 : 2) + extraPortalChildren,
              ),
            })

            return (
              <g key={ball.id}>
                {ball.spawnKind === 'portal' ? (
                  <g opacity={renderState.opacity}>
                    <circle
                      className="board-ball portal-child"
                      cx={renderState.x}
                      cy={renderState.y}
                      r={renderState.scale * 7.2}
                    />
                    <circle
                      className={`board-ball-inner source-${ball.source} type-${ball.ballType}`}
                      cx={renderState.x}
                      cy={renderState.y}
                      r={renderState.scale * 5.6}
                    />
                  </g>
                ) : (
                  <circle
                    className={`board-ball source-${ball.source} type-${ball.ballType}`}
                    cx={renderState.x}
                    cy={renderState.y}
                    opacity={renderState.opacity}
                    r={renderState.scale * 6.9}
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
