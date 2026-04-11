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
  BallType,
  PortalSide,
  TaskTopicId,
  UiText,
} from '../types'

type PachinkoBoardProps = {
  ui: UiText
  activeBalls: ActiveBall[]
  portalSide: PortalSide
  portalActive: boolean
  learnedTopicIds: TaskTopicId[]
  upcomingBalls: BallType[]
  previewMeaning: string | null
  showQueuePreview: boolean
  portalChildCount: number
  now: number
  reducedMotion: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getLaneLabel(lane: PortalSide, ui: UiText): string {
  return lane === 1 ? ui.boardLaneLeft : ui.boardLaneRight
}

function getBallTypeConstant(ballType: BallType): string {
  switch (ballType) {
    case 'plain':
      return 'ball'
    case 'portal':
      return 'portal_ball'
    case 'negative':
      return 'negative_ball'
    case 'center':
    default:
      return 'center_ball'
  }
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
    case 'center_bonus':
      return `+${value} ${ui.boardScoreLuckyBonusLabel}`
    case 'negative_penalty':
      return `-${value} ${ui.boardScoreEvilPenaltyLabel}`
    case 'total':
      return `= ${value} ${ui.boardScoreTotalLabel}`
    default:
      return String(value)
  }
}

function getBallTypeLabel(ballType: BallType, ui: UiText): string {
  switch (ballType) {
    case 'plain':
      return ui.boardBallTypePlain
    case 'portal':
      return ui.boardBallTypeLucky
    case 'negative':
      return ui.boardBallTypeEvil
    case 'center':
    default:
      return ui.boardBallTypeNormal
  }
}

function getBallTypeDescription(ballType: BallType, ui: UiText): string {
  switch (ballType) {
    case 'portal':
      return ui.referenceLuckyBallDescription
    case 'negative':
      return ui.referenceEvilBallDescription
    case 'center':
    default:
      return ui.referenceNormalBallDescription
  }
}

export function PachinkoBoard({
  ui,
  activeBalls,
  portalSide,
  portalActive,
  learnedTopicIds,
  upcomingBalls,
  previewMeaning,
  showQueuePreview,
  portalChildCount,
  now,
  reducedMotion,
}: PachinkoBoardProps) {
  const showPortalState = portalActive
  const showPreview =
    showQueuePreview && learnedTopicIds.includes('conditions') && upcomingBalls.length > 0
  const showBallGuide = learnedTopicIds.includes('conditions')
  const previewTone = upcomingBalls[0] ?? 'plain'
  const previewCodeValue =
    upcomingBalls[0] !== undefined
      ? formatText(ui.boardNextBallCodeValue, {
          value: getBallTypeConstant(upcomingBalls[0]),
        })
      : null
  const portalSplitLabel = formatText(ui.boardPortalSplitLabel, {
    count: String(portalChildCount),
  })
  const hasInfoRow = showPreview || showPortalState

  return (
    <section className="board-shell" aria-label={ui.boardTitle}>
      {hasInfoRow ? (
        <div className={`board-info-row${showPreview && showPortalState ? ' split' : ''}`}>
          {showPreview ? (
            <div
              className="board-preview-strip"
              aria-label={
                upcomingBalls.length === 1
                  ? ui.boardNextBallLabel
                  : ui.boardUpcomingBallsLabel
              }
            >
              <div className="board-preview-copy">
                <span className="board-preview-label">
                  {upcomingBalls.length === 1
                    ? ui.boardNextBallLabel
                    : ui.boardUpcomingBallsLabel}
                </span>
                {previewCodeValue !== null ? (
                  <small className="board-preview-code">{previewCodeValue}</small>
                ) : null}
                {previewMeaning !== null ? (
                  <p className={`board-preview-meaning type-${previewTone}`}>
                    {previewMeaning}
                  </p>
                ) : null}
              </div>
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

          {showPortalState ? (
            <div className={`board-risk portal-${portalSide}`}>
              <span>{ui.boardActivePortalLabel}</span>
              <strong>
                {formatText(ui.boardActivePortalValue, {
                  label: getLaneLabel(portalSide, ui),
                  value: String(portalSide),
                })}
              </strong>
              <small>
                {formatText(ui.boardPortalCodeValue, {
                  value: String(portalSide),
                })}
              </small>
            </div>
          ) : null}
        </div>
      ) : null}

      {showBallGuide ? (
        <div className="board-ball-guide" aria-label={ui.boardLegendTitle}>
          {(['negative', 'portal', 'center'] as const).map((ballType) => (
            <article className={`board-ball-guide-card type-${ballType}`} key={ballType}>
              <code>{getBallTypeLabel(ballType, ui)}</code>
              <p>{getBallTypeDescription(ballType, ui)}</p>
            </article>
          ))}
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

          {showPortalState ? (
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
